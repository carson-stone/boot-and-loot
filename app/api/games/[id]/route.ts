import { NextResponse } from "next/server";
import { loadGameState } from "@/lib/game/state";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId") ?? undefined;

  try {
    const state = await loadGameState(id, playerId);
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
}
