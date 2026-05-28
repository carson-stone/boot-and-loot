import { prisma } from "@/lib/db";
import { GameError } from "./types";
import { drawCards } from "./deck";
import { resolveHordeAttack } from "./horde";
import { checkEscapeAchievements, computeReputation } from "./achievements";
import type { ActionLogEntry } from "./cardEffects";

export async function endTurn(gameId: string, playerId: string) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      currentTurn: true,
      players: { orderBy: { turnOrder: "asc" } },
    },
  });

  if (game.status !== "active") throw new GameError("Game is not active", "GAME_NOT_ACTIVE");
  if (!game.currentTurn) throw new GameError("No current turn", "NO_TURN");
  if (game.currentTurn.playerId !== playerId) throw new GameError("Not your turn", "NOT_YOUR_TURN");

  return await prisma.$transaction(async (tx) => {
    // 1. Move hand + play area to discard
    await tx.gameCard.updateMany({
      where: {
        gameId,
        playerId,
        location: { in: ["player_hand", "player_play_area"] },
      },
      data: { location: "player_discard" },
    });

    // 2. Reset player's gold (unspent gold doesn't carry over)
    await tx.player.update({
      where: { id: playerId },
      data: { gold: 0 },
    });

    // 3. Complete current turn
    await tx.turn.update({
      where: { id: game.currentTurn!.id },
      data: { completedAt: new Date() },
    });

    // 4. Refill dynamic market
    const occupiedSlots = await tx.gameCard.findMany({
      where: { gameId, location: "dynamic_market" },
      select: { dynamicSlotIndex: true },
    });
    const occupied = new Set(occupiedSlots.map((c) => c.dynamicSlotIndex));

    const emptySlots: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (!occupied.has(i)) emptySlots.push(i);
    }

    const newlyRevealed: string[] = [];
    if (emptySlots.length > 0) {
      const deckCards = await tx.gameCard.findMany({
        where: { gameId, location: "dynamic_deck" },
        orderBy: { deckPosition: "asc" },
        take: emptySlots.length,
      });

      for (let i = 0; i < deckCards.length; i++) {
        await tx.gameCard.update({
          where: { id: deckCards[i]!.id },
          data: {
            location: "dynamic_market",
            dynamicSlotIndex: emptySlots[i]!,
            deckPosition: null,
          },
        });
        newlyRevealed.push(deckCards[i]!.id);
      }
    }

    // 5. Resolve horde triggers on newly revealed cards
    for (const cardId of newlyRevealed) {
      const card = await tx.gameCard.findUniqueOrThrow({
        where: { id: cardId },
        include: { cardDefinition: true },
      });
      if (card.cardDefinition.triggersHorde) {
        await resolveHordeAttack(tx, gameId, cardId, game.currentTurn!.id);
      }
    }

    // 6. After horde, refill any new empty slots
    let hasNewEmpties = true;
    while (hasNewEmpties) {
      const currentOccupied = await tx.gameCard.findMany({
        where: { gameId, location: "dynamic_market" },
        select: { dynamicSlotIndex: true },
      });
      const currentOccupiedSet = new Set(currentOccupied.map((c) => c.dynamicSlotIndex));

      const newEmpties: number[] = [];
      for (let i = 0; i < 5; i++) {
        if (!currentOccupiedSet.has(i)) newEmpties.push(i);
      }

      if (newEmpties.length === 0) {
        hasNewEmpties = false;
        break;
      }

      const moreCards = await tx.gameCard.findMany({
        where: { gameId, location: "dynamic_deck" },
        orderBy: { deckPosition: "asc" },
        take: newEmpties.length,
      });

      if (moreCards.length === 0) {
        hasNewEmpties = false;
        break;
      }

      let triggeredHorde = false;
      for (let i = 0; i < moreCards.length; i++) {
        await tx.gameCard.update({
          where: { id: moreCards[i]!.id },
          data: {
            location: "dynamic_market",
            dynamicSlotIndex: newEmpties[i]!,
            deckPosition: null,
          },
        });

        const def = await tx.cardDefinition.findUniqueOrThrow({
          where: { id: moreCards[i]!.cardDefinitionId },
        });
        if (def.triggersHorde) {
          await resolveHordeAttack(tx, gameId, moreCards[i]!.id, game.currentTurn!.id);
          triggeredHorde = true;
        }
      }

      hasNewEmpties = triggeredHorde;
    }

    // 7. Check end-game condition
    const activePlayers = game.players.filter((p) => !p.isDead && !p.hasExited);
    // Re-check after hordes may have killed players
    const stillActive = await tx.player.findMany({
      where: { gameId, isDead: false, hasExited: false },
    });

    if (stillActive.length === 0) {
      // Game over
      await finishGame(tx, gameId);
      return { gameOver: true, nextPlayerId: null };
    }

    // 8. Find next player
    const currentOrder = game.players.find((p) => p.id === playerId)!.turnOrder;
    let nextPlayer = null;
    for (let i = 1; i <= game.players.length; i++) {
      const nextOrder = (currentOrder + i) % game.players.length;
      const candidate = stillActive.find((p) => p.turnOrder === nextOrder);
      if (candidate) {
        nextPlayer = candidate;
        break;
      }
    }

    if (!nextPlayer) {
      await finishGame(tx, gameId);
      return { gameOver: true, nextPlayerId: null };
    }

    // 9. Create new turn + draw hand
    const newTurn = await tx.turn.create({
      data: {
        gameId,
        playerId: nextPlayer.id,
        turnNumber: game.currentTurn!.turnNumber + 1,
        startingRoomId: nextPlayer.currentRoomId,
        startingHealth: nextPlayer.currentHealth,
        startingAttention: nextPlayer.attentionPoints,
      },
    });

    await tx.game.update({
      where: { id: gameId },
      data: { currentTurnId: newTurn.id, updatedAt: new Date() },
    });

    await drawCards(tx, nextPlayer.id, 5, gameId);

    return { gameOver: false, nextPlayerId: nextPlayer.id };
  });
}

export async function escapePlayer(gameId: string, playerId: string, turnId: string) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { currentTurn: true },
  });

  if (game.status !== "active") throw new GameError("Game is not active", "GAME_NOT_ACTIVE");
  if (!game.currentTurn || game.currentTurn.playerId !== playerId) {
    throw new GameError("Not your turn", "NOT_YOUR_TURN");
  }

  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { currentRoom: true, gameArtifacts: true },
  });

  if (!player.currentRoom?.isExit) {
    throw new GameError("Not at the exit", "NOT_AT_EXIT");
  }

  if (player.gameArtifacts.length === 0) {
    throw new GameError(
      "Must carry at least one artifact to escape the dungeon",
      "NO_ARTIFACT",
    );
  }

  // Check remaining movement (need >=1) by looking at turn state
  // The API route should pass turnState; for now we do a simple check
  return await prisma.$transaction(async (tx) => {
    // Check and award escape-time achievements
    await checkEscapeAchievements(tx, gameId, playerId, turnId);

    // Compute final reputation
    const reputation = await computeReputation(tx, playerId);

    await tx.player.update({
      where: { id: playerId },
      data: {
        hasExited: true,
        exitedAt: new Date(),
        reputationFinal: reputation,
      },
    });

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];
    await tx.turn.update({
      where: { id: turnId },
      data: {
        actions: [...existingActions, { type: "escape", player_id: playerId }] as never,
      },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });

    return { reputation };
  });
}

async function finishGame(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  gameId: string,
) {
  const players = await tx.player.findMany({
    where: { gameId, hasExited: true },
    orderBy: { reputationFinal: "desc" },
    include: { gameArtifacts: true },
  });

  let winnerId: string | null = null;

  if (players.length > 0) {
    // Tiebreak: most artifacts, then most health, then lowest attention
    const sorted = [...players].sort((a, b) => {
      if ((b.reputationFinal ?? 0) !== (a.reputationFinal ?? 0)) {
        return (b.reputationFinal ?? 0) - (a.reputationFinal ?? 0);
      }
      if (b.gameArtifacts.length !== a.gameArtifacts.length) {
        return b.gameArtifacts.length - a.gameArtifacts.length;
      }
      if (b.currentHealth !== a.currentHealth) {
        return b.currentHealth - a.currentHealth;
      }
      return a.attentionPoints - b.attentionPoints;
    });
    winnerId = sorted[0]!.id;
  }

  await tx.game.update({
    where: { id: gameId },
    data: {
      status: "finished",
      finishedAt: new Date(),
      winnerPlayerId: winnerId,
      updatedAt: new Date(),
    },
  });
}
