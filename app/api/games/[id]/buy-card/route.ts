import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadTurnState } from "@/lib/game/state";
import { buyCard } from "@/lib/game/market";
import { GameError } from "@/lib/game/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const { playerId, gameCardId, cardDefinitionId } = body;

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }

    if (!gameCardId && !cardDefinitionId) {
      return NextResponse.json({ error: "gameCardId or cardDefinitionId required" }, { status: 400 });
    }

    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { currentTurn: true },
    });

    if (game.status !== "active") throw new GameError("Game is not active", "GAME_NOT_ACTIVE");
    if (!game.currentTurn || game.currentTurn.playerId !== playerId) {
      throw new GameError("Not your turn", "NOT_YOUR_TURN");
    }

    // For static market purchases by card definition, find any available card
    let resolvedGameCardId = gameCardId;
    if (!resolvedGameCardId && cardDefinitionId) {
      const staticCard = await prisma.gameCard.findFirst({
        where: {
          gameId,
          cardDefinitionId,
          location: "static_market",
        },
      });
      if (!staticCard) {
        throw new GameError("No cards of that type available in static market", "OUT_OF_STOCK");
      }
      resolvedGameCardId = staticCard.id;
    }

    const turnState = await loadTurnState(game.currentTurn.id);
    const result = await buyCard(gameId, playerId, resolvedGameCardId, turnState);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[API Error]", error);
    return NextResponse.json({ error: "Internal server error", detail: String(error) }, { status: 500 });
  }
}
