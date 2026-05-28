import { prisma } from "@/lib/db";
import type { ActionLogEntry } from "./cardEffects";
import type { TurnState } from "./types";
import { GameError } from "./types";

export async function buyCard(
  gameId: string,
  playerId: string,
  gameCardId: string,
  turnState: TurnState,
) {
  // Cards (static + dynamic) are always purchasable, regardless of room.
  // Only tools require a market room (see buyTool).
  const gameCard = await prisma.gameCard.findUniqueOrThrow({
    where: { id: gameCardId },
    include: { cardDefinition: true },
  });

  if (gameCard.gameId !== gameId) {
    throw new GameError("Card not in this game", "WRONG_GAME");
  }

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

  return await prisma.$transaction(async (tx) => {
    // Move card to player's discard
    await tx.gameCard.update({
      where: { id: gameCardId },
      data: {
        location: "player_discard",
        playerId,
        dynamicSlotIndex: null,
        deckPosition: null,
      },
    });

    const actionLog: ActionLogEntry = {
      type: "buy_card",
      game_card_id: gameCardId,
      from: gameCard.location === "static_market" ? "static" : "dynamic",
      gold_paid: gameCard.cardDefinition.costGold,
    };

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: {
        goldSpent: { increment: gameCard.cardDefinition.costGold },
        actions: [...existingActions, actionLog] as never,
      },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });

    return { cardName: gameCard.cardDefinition.name, goldPaid: gameCard.cardDefinition.costGold };
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
    await tx.playerTool.create({
      data: { playerId, toolDefinitionId: tool.id },
    });

    if (toolCode === "backpack") {
      await tx.player.update({
        where: { id: playerId },
        data: { artifactCapacity: 2 },
      });
    }

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: {
        goldSpent: { increment: tool.costGold },
        actions: [
          ...existingActions,
          { type: "buy_tool", tool_code: toolCode, gold_paid: tool.costGold },
        ] as never,
      },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });

    return { toolName: tool.name, goldPaid: tool.costGold };
  });
}
