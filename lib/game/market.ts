import { prisma } from "@/lib/db";
import { parseCardEffects, resolveCardPlay, type ActionLogEntry } from "./cardEffects";
import type { TurnState } from "./types";
import { GameError } from "./types";
import { buildPlayContext } from "./state";
import { applyStateDelta } from "./persistence";

export async function buyCard(
  gameId: string,
  playerId: string,
  gameCardId: string,
  turnState: TurnState,
) {
  // Cards are purchasable from any room — no market room required.
  // Only tools require a market room (see buyTool).
  const gameCard = await prisma.gameCard.findUniqueOrThrow({
    where: { id: gameCardId },
    include: {
      cardDefinition: {
        include: { effects: { orderBy: { displayOrder: "asc" } } },
      },
    },
  });

  if (gameCard.gameId !== gameId) throw new GameError("Card not in this game", "WRONG_GAME");
  if (gameCard.location !== "static_market" && gameCard.location !== "dynamic_market") {
    throw new GameError("Card is not in a market", "NOT_IN_MARKET");
  }

  const availableGold = turnState.goldGainedThisTurn - turnState.goldSpentThisTurn;
  if (gameCard.cardDefinition.costGold > availableGold) {
    throw new GameError(
      `Not enough gold: need ${gameCard.cardDefinition.costGold}, have ${availableGold}`,
      "NOT_ENOUGH_GOLD",
    );
  }

  const def = gameCard.cardDefinition;
  // One-time-use items fire immediately on purchase and skip the deck entirely.
  // Exception: spells (once added as a card type) go to discard — they require deck preparation.
  const immediateUse = def.isOneTimeUse;

  if (immediateUse) {
    // Build context and resolve effects before the transaction (pure reads + pure function).
    const ctx = await buildPlayContext(gameId, playerId, gameCardId, turnState);
    const effects = parseCardEffects(
      def.effects.map((e) => ({
        display_order: e.displayOrder,
        effect_type: e.effectType,
        amount: e.amount,
        parameters_json: e.parametersJson as Record<string, unknown>,
      })),
    );
    const delta = resolveCardPlay(effects, ctx);

    // Overwrite the card movement: it was set to player_discard by the resolver,
    // but since we're firing it at purchase time it should go to trashed.
    for (const mv of delta.cardMovements) {
      if (mv.cardInstanceId === gameCardId) mv.to = "trashed";
    }

    // Prepend the buy_card log entry before the play effects.
    const buyEntry: ActionLogEntry = {
      type: "buy_card",
      game_card_id: gameCardId,
      card_name: def.name,
      from: gameCard.location === "static_market" ? "static" : "dynamic",
      gold_paid: def.costGold,
    };
    delta.actionLogEntries.unshift(buyEntry);

    await prisma.$transaction(async (tx) => {
      // First move card to play_area so applyStateDelta can move it to trashed.
      await tx.gameCard.update({
        where: { id: gameCardId },
        data: { location: "player_play_area", playerId, dynamicSlotIndex: null, deckPosition: null },
      });
      await tx.turn.update({
        where: { id: turnState.turnId },
        data: { goldSpent: { increment: def.costGold } },
      });
      await applyStateDelta(tx, delta, gameId, turnState.turnId, playerId);
    });

    return { cardName: def.name, goldPaid: def.costGold, usedImmediately: true };
  }

  // Normal purchase: card goes to discard and enters the deck cycle.
  return await prisma.$transaction(async (tx) => {
    await tx.gameCard.update({
      where: { id: gameCardId },
      data: { location: "player_discard", playerId, dynamicSlotIndex: null, deckPosition: null },
    });

    const actionLog: ActionLogEntry = {
      type: "buy_card",
      game_card_id: gameCardId,
      card_name: def.name,
      from: gameCard.location === "static_market" ? "static" : "dynamic",
      gold_paid: def.costGold,
    };

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: {
        goldSpent: { increment: def.costGold },
        actions: [...existingActions, actionLog] as never,
      },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });
    return { cardName: def.name, goldPaid: def.costGold, usedImmediately: false };
  });
}

export async function buyTool(
  gameId: string,
  playerId: string,
  toolCode: string,
  turnState: TurnState,
) {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { currentRoom: true, tools: { include: { toolDefinition: true } } },
  });

  const hasMarketAccess =
    player.currentRoom?.isMarket || turnState.modifiers.marketAccessFromAnywhere;
  if (!hasMarketAccess) {
    throw new GameError("Not in a market room and no market access modifier", "NO_MARKET_ACCESS");
  }

  const tool = await prisma.toolDefinition.findUnique({ where: { code: toolCode } });
  if (!tool) throw new GameError(`Unknown tool: ${toolCode}`, "UNKNOWN_TOOL", 404);

  if (player.tools.some((t) => t.toolDefinition.code === toolCode)) {
    throw new GameError("Already own this tool", "ALREADY_OWNED");
  }

  const availableGold = turnState.goldGainedThisTurn - turnState.goldSpentThisTurn;
  if (tool.costGold > availableGold) {
    throw new GameError(
      `Not enough gold: need ${tool.costGold}, have ${availableGold}`,
      "NOT_ENOUGH_GOLD",
    );
  }

  return await prisma.$transaction(async (tx) => {
    await tx.playerTool.create({ data: { playerId, toolDefinitionId: tool.id } });

    if (toolCode === "backpack") {
      await tx.player.update({ where: { id: playerId }, data: { artifactCapacity: 2 } });
    }

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: {
        goldSpent: { increment: tool.costGold },
        actions: [
          ...existingActions,
          { type: "buy_tool", tool_code: toolCode, tool_name: tool.name, gold_paid: tool.costGold },
        ] as never,
      },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });
    return { toolName: tool.name, goldPaid: tool.costGold };
  });
}
