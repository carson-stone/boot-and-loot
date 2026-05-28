import { NextResponse } from "next/server";
import { endTurn } from "@/lib/game/turnFlow";
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

    const result = await endTurn(gameId, playerId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    throw error;
  }
}
