import { NextResponse } from "next/server";
import { joinGame } from "@/lib/game/setup";
import { GameError } from "@/lib/game/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { playerName } = body;

    if (!playerName || typeof playerName !== "string") {
      return NextResponse.json({ error: "playerName is required" }, { status: 400 });
    }

    const player = await joinGame(id, playerName);
    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    throw error;
  }
}
