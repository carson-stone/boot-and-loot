import type { TxClient } from "./deck";
import { drawCards } from "./deck";
import type { StateDelta, ActionLogEntry } from "./cardEffects";

export async function applyStateDelta(
  tx: TxClient,
  delta: StateDelta,
  gameId: string,
  turnId: string,
  playerId: string,
) {
  // 1. Apply player changes
  for (const [pid, changes] of delta.playerChanges) {
    const player = await tx.player.findUniqueOrThrow({ where: { id: pid } });
    const newHealth = Math.max(0, Math.min(player.maxHealth, player.currentHealth + changes.healthChange));
    const newGold = Math.max(0, player.gold + changes.goldChange);
    const newAttention = Math.max(0, player.attentionPoints + changes.attentionChange);

    const updateData: Record<string, unknown> = {
      currentHealth: newHealth,
      gold: newGold,
      attentionPoints: newAttention,
    };

    if (newHealth === 0 && !player.isDead) {
      updateData.isDead = true;
      updateData.diedAt = new Date();
    }

    await tx.player.update({ where: { id: pid }, data: updateData });

    if (newHealth === 0 && !player.isDead) {
      await dropPlayerArtifacts(tx, pid);
    }
  }

  // 2. Apply card movements
  for (const movement of delta.cardMovements) {
    const isPlayerLocation = ["player_deck", "player_hand", "player_play_area", "player_discard"].includes(movement.to);
    await tx.gameCard.update({
      where: { id: movement.cardInstanceId },
      data: {
        location: movement.to,
        playerId: isPlayerLocation ? playerId : null,
        dynamicSlotIndex: null,
        deckPosition: null,
      },
    });
  }

  // 3. Apply card upgrades (Alchemy: swap card_definition_id in-place)
  for (const upgrade of delta.cardUpgrades) {
    await tx.gameCard.update({
      where: { id: upgrade.gameCardId },
      data: { cardDefinitionId: upgrade.newCardDefinitionId },
    });
  }

  // 4. Append action log entries
  const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnId } });
  const existingActions = (turn.actions ?? []) as ActionLogEntry[];
  const updatedActions = [...existingActions, ...delta.actionLogEntries];

  // Update turn resource tracking
  const goldChange = delta.turnResourceChanges.gold ?? 0;
  const movementChange = delta.turnResourceChanges.movement ?? 0;
  const attacksChange = delta.turnResourceChanges.attacks ?? 0;

  await tx.turn.update({
    where: { id: turnId },
    data: {
      actions: updatedActions as never,
      goldEarned: { increment: Math.max(0, goldChange) },
    },
  });

  // 4. Handle card draws
  const cardsToDraw = delta.turnResourceChanges.cardsToDraw ?? 0;
  if (cardsToDraw > 0) {
    await drawCards(tx, playerId, cardsToDraw, gameId);
  }

  // 5. Update game timestamp
  await tx.game.update({
    where: { id: gameId },
    data: { updatedAt: new Date() },
  });
}

async function dropPlayerArtifacts(tx: TxClient, playerId: string) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const artifacts = await tx.gameArtifact.findMany({
    where: { heldByPlayerId: playerId },
  });

  for (const artifact of artifacts) {
    await tx.gameArtifact.update({
      where: { id: artifact.id },
      data: { roomId: player.currentRoomId, heldByPlayerId: null },
    });
  }
}
