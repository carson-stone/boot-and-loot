import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCardPlay, parseCardEffects } from "@/lib/game/cardEffects";
import { loadTurnState, buildPlayContext } from "@/lib/game/state";
import { applyStateDelta } from "@/lib/game/persistence";
import { checkCloakAndDagger } from "@/lib/game/achievements";
import { GameError } from "@/lib/game/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const { playerId, gameCardId } = body;

    if (!playerId || !gameCardId) {
      return NextResponse.json({ error: "playerId and gameCardId are required" }, { status: 400 });
    }

    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { currentTurn: true },
    });

    if (game.status !== "active") throw new GameError("Game is not active", "GAME_NOT_ACTIVE");
    if (!game.currentTurn || game.currentTurn.playerId !== playerId) {
      throw new GameError("Not your turn", "NOT_YOUR_TURN");
    }

    // Validate card is in player's hand
    const gameCard = await prisma.gameCard.findUniqueOrThrow({
      where: { id: gameCardId },
      include: {
        cardDefinition: {
          include: { effects: { orderBy: { displayOrder: "asc" } } },
        },
      },
    });

    if (gameCard.location !== "player_hand" || gameCard.playerId !== playerId) {
      throw new GameError("Card is not in your hand", "CARD_NOT_IN_HAND");
    }

    // Move card to play area first
    await prisma.gameCard.update({
      where: { id: gameCardId },
      data: { location: "player_play_area" },
    });

    // Build context and resolve
    const turnState = await loadTurnState(game.currentTurn.id);

    // Pre-load upgrade candidates for Alchemy (scripted effects can't query the DB directly)
    const upgradeableCards: import("@/lib/game/cardEffects").UpgradeableCard[] = [];
    if (gameCard.cardDefinition.name === "Alchemy") {
      const [silverDef, goldDef] = await Promise.all([
        prisma.cardDefinition.findUnique({ where: { name: "Silver Coin" } }),
        prisma.cardDefinition.findUnique({ where: { name: "Gold Pouch" } }),
      ]);
      const coppers = silverDef ? await prisma.gameCard.findMany({
        where: { gameId, playerId, location: { in: ["player_discard", "player_play_area"] }, cardDefinition: { name: "Copper Coin" } },
        take: 3,
      }) : [];
      if (coppers.length > 0 && silverDef) {
        for (const c of coppers) upgradeableCards.push({ gameCardId: c.id, cardName: "Copper Coin", upgradedDefinitionId: silverDef.id, upgradedCardName: "Silver Coin" });
      } else if (goldDef) {
        const silver = await prisma.gameCard.findFirst({
          where: { gameId, playerId, location: { in: ["player_discard", "player_play_area"] }, cardDefinition: { name: "Silver Coin" } },
        });
        if (silver) upgradeableCards.push({ gameCardId: silver.id, cardName: "Silver Coin", upgradedDefinitionId: goldDef.id, upgradedCardName: "Gold Pouch" });
      }
    } else if (gameCard.cardDefinition.name === "Smelt") {
      const coppers = await prisma.gameCard.findMany({
        where: { gameId, playerId, location: { in: ["player_discard", "player_play_area"] }, cardDefinition: { name: "Copper Coin" } },
        take: 3,
      });
      for (const c of coppers) upgradeableCards.push({ gameCardId: c.id, cardName: "Copper Coin", upgradedDefinitionId: "", upgradedCardName: "" });
    }

    const ctx = await buildPlayContext(gameId, playerId, gameCardId, turnState, upgradeableCards);
    const effects = parseCardEffects(
      gameCard.cardDefinition.effects.map((e) => ({
        display_order: e.displayOrder,
        effect_type: e.effectType,
        amount: e.amount,
        parameters_json: e.parametersJson as Record<string, unknown>,
      })),
    );

    const delta = resolveCardPlay(effects, ctx);

    // Apply delta in transaction
    await prisma.$transaction(async (tx) => {
      await applyStateDelta(tx, delta, gameId, game.currentTurn!.id, playerId);

      // Check Cloak & Dagger achievement
      await checkCloakAndDagger(tx, gameId, playerId, game.currentTurn!.id, gameCard.cardDefinition.name);
    });

    return NextResponse.json({
      cardName: gameCard.cardDefinition.name,
      effects: delta.actionLogEntries,
    });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[API Error]", error);
    return NextResponse.json({ error: "Internal server error", detail: String(error) }, { status: 500 });
  }
}
