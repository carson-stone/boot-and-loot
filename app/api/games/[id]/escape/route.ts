import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadTurnState } from "@/lib/game/state";
import { escapePlayer } from "@/lib/game/turnFlow";
import { GameError } from "@/lib/game/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }

    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { currentTurn: true },
    });

    if (game.status !== "active") throw new GameError("Game is not active", "GAME_NOT_ACTIVE");
    if (!game.currentTurn || game.currentTurn.playerId !== playerId) {
      throw new GameError("Not your turn", "NOT_YOUR_TURN");
    }

    // Check remaining movement
    const turnState = await loadTurnState(game.currentTurn.id);
    const availableMovement = turnState.resources.movement - turnState.movementUsedThisTurn;
    if (availableMovement < 1) {
      throw new GameError("Need at least 1 movement to escape", "NOT_ENOUGH_MOVEMENT");
    }

    const result = await escapePlayer(gameId, playerId, game.currentTurn.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[API Error]", error);
    return NextResponse.json({ error: "Internal server error", detail: String(error) }, { status: 500 });
  }
}
