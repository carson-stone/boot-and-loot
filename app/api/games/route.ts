import { NextResponse } from "next/server";
import { createGame } from "@/lib/game/setup";
import { GameError } from "@/lib/game/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mapName = "The Sunken Crypt", maxPlayers = 5 } = body;

    const game = await createGame(mapName, maxPlayers);
    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[API Error]", error);
    return NextResponse.json({ error: "Internal server error", detail: String(error) }, { status: 500 });
  }
}
