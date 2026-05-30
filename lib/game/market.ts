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
  // Tools require a market room (see buyTool).
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

  const def = gameCard.cardDefinition;
  const focusCost = def.costFocus;
  const goldCost = def.costGold;

  const availableFocus = turnState.resources.focus;
  if (focusCost > availableFocus) {
    throw new GameError(`Not enough focus: need ${focusCost}, have ${availableFocus}`, "NOT_ENOUGH_FOCUS");
  }

  if (goldCost > 0) {
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    if (goldCost > player.gold) {
      throw new GameError(`Not enough gold: need ${goldCost}, have ${player.gold}`, "NOT_ENOUGH_GOLD");
    }
  }

  const immediateUse = def.isOneTimeUse && def.cardType !== "spell";

  if (immediateUse) {
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
    for (const mv of delta.cardMovements) {
      if (mv.cardInstanceId === gameCardId) mv.to = "trashed";
    }

    const buyEntry: ActionLogEntry = {
      type: "buy_card",
      game_card_id: gameCardId,
      card_name: def.name,
      from: gameCard.location === "static_market" ? "static" : "dynamic",
      focus_paid: focusCost,
      gold_paid: goldCost,
    };
    delta.actionLogEntries.unshift(buyEntry);

    await prisma.$transaction(async (tx) => {
      await tx.gameCard.update({
        where: { id: gameCardId },
        data: { location: "player_play_area", playerId, dynamicSlotIndex: null, deckPosition: null },
      });
      if (goldCost > 0) {
        await tx.player.update({ where: { id: playerId }, data: { gold: { decrement: goldCost } } });
      }
      await applyStateDelta(tx, delta, gameId, turnState.turnId, playerId);
    });

    return { cardName: def.name, focusPaid: focusCost, goldPaid: goldCost, usedImmediately: true };
  }

  // Normal purchase: card goes to discard (or trashed via resolver for spells)
  return await prisma.$transaction(async (tx) => {
    await tx.gameCard.update({
      where: { id: gameCardId },
      data: { location: "player_discard", playerId, dynamicSlotIndex: null, deckPosition: null },
    });

    if (goldCost > 0) {
      await tx.player.update({ where: { id: playerId }, data: { gold: { decrement: goldCost } } });
    }

    const actionLog: ActionLogEntry = {
      type: "buy_card",
      game_card_id: gameCardId,
      card_name: def.name,
      from: gameCard.location === "static_market" ? "static" : "dynamic",
      focus_paid: focusCost,
      gold_paid: goldCost,
    };

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: { actions: [...existingActions, actionLog] as never },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });
    return { cardName: def.name, focusPaid: focusCost, goldPaid: goldCost, usedImmediately: false };
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

  if (tool.costGold > player.gold) {
    throw new GameError(`Not enough gold: need ${tool.costGold}, have ${player.gold}`, "NOT_ENOUGH_GOLD");
  }

  return await prisma.$transaction(async (tx) => {
    await tx.playerTool.create({ data: { playerId, toolDefinitionId: tool.id } });

    // Deduct gold directly (persistent resource)
    await tx.player.update({ where: { id: playerId }, data: { gold: { decrement: tool.costGold } } });

    if (toolCode === "backpack") {
      await tx.player.update({ where: { id: playerId }, data: { artifactCapacity: 2 } });
    }

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: {
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
