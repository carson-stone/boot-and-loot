import type { TxClient } from "./types";

interface PoolEntry {
  owner: string; // player ID or "filler"
}

export async function resolveHordeAttack(
  tx: TxClient,
  gameId: string,
  triggeringCardId: string | null,
  turnId: string,
) {
  const game = await tx.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      players: { where: { isDead: false, hasExited: false } },
    },
  });

  // 1. Build pool: filler + carryover from previous hordes + player AP dump
  const pool: PoolEntry[] = [];

  // Get carryover from previous horde attacks
  const previousHordes = await tx.hordeAttack.findMany({
    where: { gameId },
    orderBy: { createdAt: "asc" },
  });

  // Reconstruct pool state from horde history
  let fillerRemaining = game.attentionPoolSize;
  const carriedOver: Record<string, number> = {};

  for (const horde of previousHordes) {
    const dist = horde.damageDistribution as {
      poolAfter?: { filler: number; players: Record<string, number> };
    };
    if (dist.poolAfter) {
      fillerRemaining = dist.poolAfter.filler;
      for (const [pid, count] of Object.entries(dist.poolAfter.players)) {
        carriedOver[pid] = count;
      }
    }
  }

  // Add filler points
  for (let i = 0; i < fillerRemaining; i++) {
    pool.push({ owner: "filler" });
  }

  // Add carried-over player points
  for (const [pid, count] of Object.entries(carriedOver)) {
    for (let i = 0; i < count; i++) {
      pool.push({ owner: pid });
    }
  }

  // Dump all living players' AP into pool
  for (const player of game.players) {
    for (let i = 0; i < player.attentionPoints; i++) {
      pool.push({ owner: player.id });
    }
    // Set player AP to 0
    await tx.player.update({
      where: { id: player.id },
      data: { attentionPoints: 0 },
    });
  }

  const poolSizeBefore = pool.length;

  // 2. Calculate horde damage: base + artifacts currently held.
  // Known limitation: artifacts dropped by dead players aren't counted; use action log
  // pickup entries to track lifetime pickups accurately in a future pass.
  const artifactsTaken = await tx.gameArtifact.count({
    where: { gameId, heldByPlayerId: { not: null } },
  });
  const hordeDamage = game.hordeDamageAmount + artifactsTaken;

  // 3. Randomly remove points from pool
  const pointsToRemove = Math.min(hordeDamage, pool.length);
  const damage: Record<string, number> = {};

  // Fisher-Yates partial shuffle to select random points
  for (let i = 0; i < pointsToRemove; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  const removed = pool.splice(0, pointsToRemove);

  // Get current turn modifiers for damage prevention
  const currentTurn = await tx.turn.findUnique({ where: { id: turnId } });
  const actions = (currentTurn?.actions ?? []) as Array<{ type: string; details?: { type?: string } }>;

  for (const entry of removed) {
    if (entry.owner !== "filler") {
      damage[entry.owner] = (damage[entry.owner] ?? 0) + 1;
    }
  }

  // 4. Apply damage to players
  for (const [playerId, dmg] of Object.entries(damage)) {
    const player = game.players.find((p) => p.id === playerId);
    if (!player) continue;

    const newHealth = Math.max(0, player.currentHealth - dmg);
    const updateData: { currentHealth: number; isDead?: boolean; diedAt?: Date } = {
      currentHealth: newHealth,
    };

    if (newHealth === 0) {
      updateData.isDead = true;
      updateData.diedAt = new Date();
    }

    await tx.player.update({
      where: { id: playerId },
      data: updateData,
    });

    // If player died, drop their artifacts
    if (newHealth === 0) {
      await dropPlayerArtifacts(tx, playerId);
    }
  }

  // 5. Calculate pool state after
  const poolAfter: { filler: number; players: Record<string, number> } = { filler: 0, players: {} };
  for (const entry of pool) {
    if (entry.owner === "filler") {
      poolAfter.filler++;
    } else {
      poolAfter.players[entry.owner] = (poolAfter.players[entry.owner] ?? 0) + 1;
    }
  }

  // 6. Record horde attack
  const hordeAttack = await tx.hordeAttack.create({
    data: {
      gameId,
      turnId,
      triggeringCardId,
      poolSizeBefore,
      pointsRemoved: pointsToRemove,
      damageDistribution: {
        damage,
        removed: removed.map((e) => e.owner),
        poolAfter,
      },
    },
  });

  return hordeAttack;
}

async function dropPlayerArtifacts(tx: TxClient, playerId: string) {
  const player = await tx.player.findUniqueOrThrow({
    where: { id: playerId },
  });

  const artifacts = await tx.gameArtifact.findMany({
    where: { heldByPlayerId: playerId },
  });

  for (const artifact of artifacts) {
    await tx.gameArtifact.update({
      where: { id: artifact.id },
      data: {
        roomId: player.currentRoomId,
        heldByPlayerId: null,
      },
    });
  }
}
