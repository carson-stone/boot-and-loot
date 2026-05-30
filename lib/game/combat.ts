import { prisma } from "@/lib/db";
import type { ActionLogEntry } from "./cardEffects";
import type { TurnState } from "./types";
import { GameError } from "./types";
import { checkFirstBlood, checkHordeSlayer } from "./achievements";

export async function resolveThreat(
  gameId: string,
  playerId: string,
  gameCardId: string,
  resolutionOptionId: string,
  turnState: TurnState,
) {
  const gameCard = await prisma.gameCard.findUniqueOrThrow({
    where: { id: gameCardId },
    include: { cardDefinition: { include: { resolutionOptions: true } } },
  });

  if (gameCard.gameId !== gameId) throw new GameError("Card not in this game", "WRONG_GAME");
  if (gameCard.location !== "dynamic_market") throw new GameError("Threat not in market", "NOT_IN_MARKET");
  if (!gameCard.cardDefinition.isKillableThreat) throw new GameError("Card is not a killable threat", "NOT_THREAT");

  const option = gameCard.cardDefinition.resolutionOptions.find((o) => o.id === resolutionOptionId);
  if (!option) throw new GameError("Invalid resolution option", "INVALID_OPTION");

  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });

  // Validate costs
  const availableAttacks = turnState.resources.attacks - turnState.attacksUsedThisTurn;

  if (option.costAttacks > availableAttacks) {
    throw new GameError(`Not enough attacks: need ${option.costAttacks}, have ${availableAttacks}`, "NOT_ENOUGH_ATTACKS");
  }
  if (option.costGold > player.gold) {
    throw new GameError(`Not enough gold: need ${option.costGold}, have ${player.gold}`, "NOT_ENOUGH_GOLD");
  }
  if (option.costAttention > player.attentionPoints) {
    throw new GameError(`Not enough attention: need ${option.costAttention}, have ${player.attentionPoints}`, "NOT_ENOUGH_ATTENTION");
  }
  if (option.costHealth > player.currentHealth) {
    throw new GameError(`Not enough health: need ${option.costHealth}, have ${player.currentHealth}`, "NOT_ENOUGH_HEALTH");
  }

  // Handle special costs
  const specialCost = option.specialCostJson as Record<string, unknown>;
  if (specialCost.trash_cards) {
    const trashCount = specialCost.trash_cards as number;
    const availableCards = await prisma.gameCard.count({
      where: {
        gameId,
        playerId,
        location: { in: ["player_hand", "player_discard"] },
      },
    });
    if (availableCards < trashCount) {
      throw new GameError(`Not enough cards to trash: need ${trashCount}, have ${availableCards}`, "NOT_ENOUGH_CARDS");
    }
  }

  return await prisma.$transaction(async (tx) => {
    // Deduct costs
    const playerUpdate: Record<string, unknown> = {};

    if (option.costHealth > 0) {
      const newHealth = Math.max(0, player.currentHealth - option.costHealth);
      playerUpdate.currentHealth = newHealth;
      if (newHealth === 0) {
        playerUpdate.isDead = true;
        playerUpdate.diedAt = new Date();
      }
    }
    if (option.costAttention > 0) {
      playerUpdate.attentionPoints = { decrement: option.costAttention };
    }
    // Gold: award reward and deduct cost as a single net change (gold is now persistent)
    const netGold = option.rewardGold - option.costGold;
    if (netGold !== 0) {
      playerUpdate.gold = netGold > 0 ? { increment: netGold } : { decrement: -netGold };
    }

    if (Object.keys(playerUpdate).length > 0) {
      await tx.player.update({ where: { id: playerId }, data: playerUpdate });
    }

    // Apply reward_json effects (separate update to avoid field conflicts)
    const rewardJson = option.rewardJson as Record<string, unknown>;
    if (typeof rewardJson.remove_attention === "number" && rewardJson.remove_attention > 0) {
      const current = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { attentionPoints: true } });
      const removed = Math.min(current.attentionPoints, rewardJson.remove_attention);
      if (removed > 0) await tx.player.update({ where: { id: playerId }, data: { attentionPoints: { decrement: removed } } });
    }
    if (typeof rewardJson.gain_attention === "number" && rewardJson.gain_attention > 0) {
      await tx.player.update({ where: { id: playerId }, data: { attentionPoints: { increment: rewardJson.gain_attention } } });
    }

    // Trash the threat card
    await tx.gameCard.update({
      where: { id: gameCardId },
      data: { location: "trashed", dynamicSlotIndex: null },
    });

    // Handle special cost: trash cards
    if (specialCost.trash_cards) {
      const trashCount = specialCost.trash_cards as number;
      const cardsToTrash = await tx.gameCard.findMany({
        where: {
          gameId,
          playerId,
          location: { in: ["player_hand", "player_discard"] },
        },
        take: trashCount,
      });
      for (const card of cardsToTrash) {
        await tx.gameCard.update({
          where: { id: card.id },
          data: { location: "trashed", playerId: null },
        });
      }
    }

    // Record action log
    const actionLog: ActionLogEntry = {
      type: "defeat_threat",
      game_card_id: gameCardId,
      threat_name: gameCard.cardDefinition.name,
      resolution_option_id: resolutionOptionId,
      label: option.label,
    };

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: {
        goldSpent: { increment: option.costGold },
        attacksUsed: { increment: option.costAttacks },
        actions: [...existingActions, actionLog] as never,
      },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });

    // Check achievements
    await checkFirstBlood(tx, gameId, playerId, turnState.turnId);
    await checkHordeSlayer(tx, gameId, playerId, turnState.turnId);

    return {
      threatName: gameCard.cardDefinition.name,
      resolution: option.label,
      rewardGold: option.rewardGold,
      rewardReputation: option.rewardReputation,
    };
  });
}
