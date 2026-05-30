import type { TxClient } from "./types";
import type { ActionLogEntry } from "./cardEffects";

async function awardAchievement(
  tx: TxClient,
  playerId: string,
  achievementCode: string,
  turnId: string,
) {
  const achievement = await tx.achievementDefinition.findUnique({
    where: { code: achievementCode },
  });
  if (!achievement) return;

  const existing = await tx.playerAchievement.findUnique({
    where: {
      playerId_achievementDefinitionId: {
        playerId,
        achievementDefinitionId: achievement.id,
      },
    },
  });
  if (existing) return;

  await tx.playerAchievement.create({
    data: {
      playerId,
      achievementDefinitionId: achievement.id,
      earnedOnTurnId: turnId,
    },
  });
}

export async function checkFirstBlood(tx: TxClient, gameId: string, playerId: string, turnId: string) {
  const otherDefeats = await tx.turn.findMany({
    where: {
      gameId,
      NOT: { playerId },
    },
    select: { actions: true },
  });

  const anyOtherDefeat = otherDefeats.some((t) => {
    const actions = (t.actions ?? []) as ActionLogEntry[];
    return actions.some((a) => a.type === "defeat_threat");
  });

  if (!anyOtherDefeat) {
    await awardAchievement(tx, playerId, "first_blood", turnId);
  }
}

export async function checkHordeSlayer(tx: TxClient, gameId: string, playerId: string, turnId: string) {
  const playerTurns = await tx.turn.findMany({
    where: { gameId, playerId },
    select: { actions: true },
  });

  let threatCount = 0;
  for (const t of playerTurns) {
    const actions = (t.actions ?? []) as ActionLogEntry[];
    threatCount += actions.filter((a) => a.type === "defeat_threat").length;
  }

  if (threatCount >= 2) {
    await awardAchievement(tx, playerId, "horde_slayer", turnId);
  }
}

export async function checkCloakAndDagger(tx: TxClient, gameId: string, playerId: string, turnId: string, cardName: string) {
  if (cardName !== "Shadow Cloak" && cardName !== "Decoy") return;

  const playerTurns = await tx.turn.findMany({
    where: { gameId, playerId },
    select: { actions: true },
  });

  let playCount = 0;
  for (const t of playerTurns) {
    const actions = (t.actions ?? []) as ActionLogEntry[];
    for (const a of actions) {
      if (a.type === "play_card") {
        // Need to check if the played card was Shadow Cloak or Decoy
        const gameCard = await tx.gameCard.findUnique({
          where: { id: (a as { game_card_id: string }).game_card_id },
          include: { cardDefinition: true },
        });
        if (gameCard?.cardDefinition.name === "Shadow Cloak" || gameCard?.cardDefinition.name === "Decoy") {
          playCount++;
        }
      }
    }
  }

  if (playCount >= 2) {
    await awardAchievement(tx, playerId, "cloak_dagger", turnId);
  }
}

export async function checkLooter(tx: TxClient, playerId: string, artifactRoomId: string, turnId: string) {
  // Check if any dead player dropped an artifact in this room
  const deadPlayers = await tx.player.findMany({
    where: { isDead: true, currentRoomId: artifactRoomId },
  });

  if (deadPlayers.length > 0) {
    await awardAchievement(tx, playerId, "looter", turnId);
  }
}

export async function checkEscapeAchievements(tx: TxClient, gameId: string, playerId: string, turnId: string) {
  const player = await tx.player.findUniqueOrThrow({
    where: { id: playerId },
    include: {
      gameArtifacts: true,
      tools: true,
    },
  });

  const game = await tx.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      map: { include: { rooms: true } },
      players: true,
    },
  });

  // Pacifist: no attack plays and no Fight resolutions
  const playerTurns = await tx.turn.findMany({
    where: { gameId, playerId },
    select: { actions: true },
  });

  let usedAttack = false;
  let usedFight = false;
  let totalGoldSpent = 0;
  let totalHealing = 0;
  const roomsVisited = new Set<string>();

  for (const t of playerTurns) {
    const actions = (t.actions ?? []) as ActionLogEntry[];
    for (const a of actions) {
      if (a.type === "effect_resolved") {
        const details = a as { effect_type: string; details: Record<string, unknown> };
        if (details.effect_type === "gain_attack") usedAttack = true;
        if (details.effect_type === "heal") {
          totalHealing += (details.details.amount as number) ?? 0;
        }
      }
      if (a.type === "defeat_threat") {
        const details = a as { label: string };
        if (details.label === "Fight") usedFight = true;
      }
      if (a.type === "buy_card" || a.type === "buy_tool") {
        totalGoldSpent += ((a as Record<string, unknown>).gold_paid as number) ?? 0;
      }
      if (a.type === "move") {
        roomsVisited.add((a as { to_room_id: string }).to_room_id);
      }
    }
  }

  if (!usedAttack && !usedFight) {
    await awardAchievement(tx, playerId, "pacifist", turnId);
  }

  // Light Step: 0 attention
  if (player.attentionPoints === 0) {
    await awardAchievement(tx, playerId, "light_step", turnId);
  }

  // Big Spender: 25+ gold spent
  if (totalGoldSpent >= 25) {
    await awardAchievement(tx, playerId, "big_spender", turnId);
  }

  // Hoarder: 2 artifacts
  if (player.gameArtifacts.length >= 2) {
    await awardAchievement(tx, playerId, "hoarder", turnId);
  }

  // Speedrunner: first to escape
  const otherEscaped = game.players.some((p) => p.id !== playerId && p.hasExited);
  if (!otherEscaped) {
    await awardAchievement(tx, playerId, "speedrunner", turnId);
  }

  // Survivor: full health
  if (player.currentHealth === player.maxHealth) {
    await awardAchievement(tx, playerId, "survivor", turnId);
  }

  // Deep Diver: visited every room
  const allRoomIds = new Set(game.map.rooms.map((r) => r.id));
  // Add starting room
  const entrance = game.map.rooms.find((r) => r.isEntrance);
  if (entrance) roomsVisited.add(entrance.id);
  if (allRoomIds.size === roomsVisited.size && [...allRoomIds].every((id) => roomsVisited.has(id))) {
    await awardAchievement(tx, playerId, "deep_diver", turnId);
  }

  // Companion Lord: 5+ companions
  const companionCount = await tx.gameCard.count({
    where: {
      gameId,
      playerId,
      location: { in: ["player_deck", "player_hand", "player_discard", "player_play_area"] },
      cardDefinition: { cardType: "companion" },
    },
  });
  if (companionCount >= 5) {
    await awardAchievement(tx, playerId, "companion_lord", turnId);
  }

  // Tinkerer: 5+ devices
  const deviceCount = await tx.gameCard.count({
    where: {
      gameId,
      playerId,
      location: { in: ["player_deck", "player_hand", "player_discard", "player_play_area"] },
      cardDefinition: { cardType: "device" },
    },
  });
  if (deviceCount >= 5) {
    await awardAchievement(tx, playerId, "tinkerer", turnId);
  }

  // Medic: healed 5+ total
  if (totalHealing >= 5) {
    await awardAchievement(tx, playerId, "medic", turnId);
  }
}

export async function computeReputation(tx: TxClient, playerId: string): Promise<number> {
  const artifacts = await tx.gameArtifact.findMany({
    where: { heldByPlayerId: playerId },
    include: { artifactDefinition: true },
  });
  const artifactRep = artifacts.reduce((sum, a) => sum + a.artifactDefinition.reputationPoints, 0);

  // Reputation from defeated threats
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const playerTurns = await tx.turn.findMany({
    where: { gameId: player.gameId, playerId },
    select: { actions: true },
  });

  let threatRep = 0;
  for (const t of playerTurns) {
    const actions = (t.actions ?? []) as ActionLogEntry[];
    for (const a of actions) {
      if (a.type === "defeat_threat") {
        const optionId = (a as { resolution_option_id: string }).resolution_option_id;
        const option = await tx.cardResolutionOption.findUnique({ where: { id: optionId } });
        if (option) threatRep += option.rewardReputation;
      }
    }
  }

  // Reputation from achievements
  const achievements = await tx.playerAchievement.findMany({
    where: { playerId },
    include: { achievementDefinition: true },
  });
  const achievementRep = achievements.reduce((sum, a) => sum + a.achievementDefinition.reputationPoints, 0);

  return artifactRep + threatRep + achievementRep;
}
