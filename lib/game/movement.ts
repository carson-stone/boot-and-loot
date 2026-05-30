import { prisma } from "@/lib/db";
import type { ActionLogEntry } from "./cardEffects";
import type { TurnState } from "./types";
import { GameError } from "./types";

export async function movePlayer(
  gameId: string,
  playerId: string,
  targetRoomId: string,
  turnState: TurnState,
) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!player.currentRoomId) throw new GameError("Player has no current room", "NO_ROOM");

  const connection = await prisma.roomConnection.findUnique({
    where: {
      fromRoomId_toRoomId: { fromRoomId: player.currentRoomId, toRoomId: targetRoomId },
    },
  });
  if (!connection) throw new GameError("No path to that room", "NO_CONNECTION");

  if (connection.requiresTool) {
    const hasTool = await prisma.playerTool.findFirst({
      where: { playerId, toolDefinition: { code: connection.requiresTool } },
    });
    if (!hasTool) throw new GameError(`Requires tool: ${connection.requiresTool}`, "MISSING_TOOL");
  }

  const availableMovement = turnState.resources.movement - turnState.movementUsedThisTurn;
  if (connection.movementCost > availableMovement) {
    throw new GameError(
      `Not enough movement: need ${connection.movementCost}, have ${availableMovement}`,
      "NOT_ENOUGH_MOVEMENT",
    );
  }

  const fromRoom = await prisma.room.findUniqueOrThrow({ where: { id: player.currentRoomId } });
  const targetRoom = await prisma.room.findUniqueOrThrow({ where: { id: targetRoomId } });

  return await prisma.$transaction(async (tx) => {
    await tx.player.update({ where: { id: playerId }, data: { currentRoomId: targetRoomId } });

    // Room combat
    let damageTaken = 0;
    const availableAttacks = turnState.resources.attacks - turnState.attacksUsedThisTurn;
    if (targetRoom.monsterCount > 0) {
      const monstersUnkilled = Math.max(0, targetRoom.monsterCount - availableAttacks);
      damageTaken = Math.max(0, monstersUnkilled - turnState.modifiers.damagePrevention);

      if (damageTaken > 0) {
        const newHealth = Math.max(0, player.currentHealth - damageTaken);
        const updateData: { currentHealth: number; isDead?: boolean; diedAt?: Date } = { currentHealth: newHealth };
        if (newHealth === 0) { updateData.isDead = true; updateData.diedAt = new Date(); }
        await tx.player.update({ where: { id: playerId }, data: updateData });

        if (newHealth === 0) {
          const artifacts = await tx.gameArtifact.findMany({ where: { heldByPlayerId: playerId } });
          for (const artifact of artifacts) {
            await tx.gameArtifact.update({
              where: { id: artifact.id },
              data: { roomId: targetRoomId, heldByPlayerId: null },
            });
          }
        }
      }
    }

    const actionEntry: ActionLogEntry = {
      type: "move",
      from_room_id: player.currentRoomId!,
      to_room_id: targetRoomId,
      from_room_name: fromRoom.name,
      to_room_name: targetRoom.name,
      movement_cost: connection.movementCost,
      damage_taken: damageTaken > 0 ? damageTaken : undefined,
    };

    const turn = await tx.turn.findUniqueOrThrow({ where: { id: turnState.turnId } });
    const existingActions = (turn.actions ?? []) as ActionLogEntry[];

    await tx.turn.update({
      where: { id: turnState.turnId },
      data: {
        movementUsed: { increment: connection.movementCost },
        attacksUsed: { increment: Math.min(targetRoom.monsterCount, availableAttacks) },
        actions: [...existingActions, actionEntry] as never,
      },
    });

    await tx.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });
    return { damageTaken, monsterCount: targetRoom.monsterCount };
  });
}
