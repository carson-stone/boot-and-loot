import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadTurnState } from "@/lib/game/state";
import { checkLooter } from "@/lib/game/achievements";
import { GameError } from "@/lib/game/types";
import type { ActionLogEntry } from "@/lib/game/cardEffects";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const { playerId, gameArtifactId } = body;

    if (!playerId || !gameArtifactId) {
      return NextResponse.json({ error: "playerId and gameArtifactId are required" }, { status: 400 });
    }

    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { currentTurn: true },
    });

    if (game.status !== "active") throw new GameError("Game is not active", "GAME_NOT_ACTIVE");
    if (!game.currentTurn || game.currentTurn.playerId !== playerId) {
      throw new GameError("Not your turn", "NOT_YOUR_TURN");
    }

    const player = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { gameArtifacts: true },
    });

    if (player.gameArtifacts.length >= player.artifactCapacity) {
      throw new GameError("Cannot carry more artifacts", "AT_CAPACITY");
    }

    const artifact = await prisma.gameArtifact.findUniqueOrThrow({
      where: { id: gameArtifactId },
      include: { artifactDefinition: true },
    });

    if (artifact.gameId !== gameId) throw new GameError("Artifact not in this game", "WRONG_GAME");
    if (artifact.roomId !== player.currentRoomId) throw new GameError("Artifact is not in your room", "WRONG_ROOM");
    if (artifact.heldByPlayerId) throw new GameError("Artifact is already held", "ALREADY_HELD");

    const result = await prisma.$transaction(async (tx) => {
      await tx.gameArtifact.update({
        where: { id: gameArtifactId },
        data: { roomId: null, heldByPlayerId: playerId },
      });

      const actionLog: ActionLogEntry = {
        type: "pickup_artifact",
        game_artifact_id: gameArtifactId,
        artifact_name: artifact.artifactDefinition.name,
      };

      const turn = await tx.turn.findUniqueOrThrow({ where: { id: game.currentTurn!.id } });
      const existingActions = (turn.actions ?? []) as ActionLogEntry[];

      await tx.turn.update({
        where: { id: game.currentTurn!.id },
        data: { actions: [...existingActions, actionLog] as never },
      });

      // Check looter achievement
      await checkLooter(tx, playerId, player.currentRoomId!, game.currentTurn!.id);

      await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });

      return { artifactName: artifact.artifactDefinition.name };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[API Error]", error);
    return NextResponse.json({ error: "Internal server error", detail: String(error) }, { status: 500 });
  }
}
