import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadTurnState } from "@/lib/game/state";
import { movePlayer } from "@/lib/game/movement";
import { GameError } from "@/lib/game/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const { playerId, targetRoomId } = body;

    if (!playerId || !targetRoomId) {
      return NextResponse.json({ error: "playerId and targetRoomId are required" }, { status: 400 });
    }

    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { currentTurn: true },
    });

    if (game.status !== "active") throw new GameError("Game is not active", "GAME_NOT_ACTIVE");
    if (!game.currentTurn || game.currentTurn.playerId !== playerId) {
      throw new GameError("Not your turn", "NOT_YOUR_TURN");
    }

    const turnState = await loadTurnState(game.currentTurn.id);
    const result = await movePlayer(gameId, playerId, targetRoomId, turnState);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[API Error]", error);
    return NextResponse.json({ error: "Internal server error", detail: String(error) }, { status: 500 });
  }
}
