import { prisma } from "@/lib/db";
import { GameError } from "./types";
import { drawCards } from "./deck";
import type { TxClient } from "./types";
import { resolveHordeAttack } from "./horde";

export async function createGame(mapName: string, maxPlayers: number = 5) {
  if (maxPlayers < 2 || maxPlayers > 5) {
    throw new GameError("Player count must be between 2 and 5", "INVALID_PLAYER_COUNT");
  }

  const map = await prisma.map.findUnique({ where: { name: mapName } });
  if (!map) throw new GameError(`Map not found: ${mapName}`, "MAP_NOT_FOUND", 404);

  const game = await prisma.game.create({
    data: { mapId: map.id, maxPlayers },
  });

  return game;
}

export async function joinGame(gameId: string, playerName: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: { orderBy: { turnOrder: "asc" } } },
  });

  if (!game) throw new GameError("Game not found", "GAME_NOT_FOUND", 404);
  if (game.status !== "waiting") throw new GameError("Game already started", "GAME_STARTED");
  if (game.players.length >= game.maxPlayers) throw new GameError("Game is full", "GAME_FULL");

  const entrance = await prisma.room.findFirst({
    where: { mapId: game.mapId, isEntrance: true },
  });
  if (!entrance) throw new GameError("Map has no entrance", "NO_ENTRANCE");

  const turnOrder = game.players.length;

  const player = await prisma.player.create({
    data: {
      gameId,
      name: playerName,
      turnOrder,
      currentRoomId: entrance.id,
    },
  });

  return player;
}

export async function startGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { orderBy: { turnOrder: "asc" } },
      map: { include: { artifactPlacements: true } },
    },
  });

  if (!game) throw new GameError("Game not found", "GAME_NOT_FOUND", 404);
  if (game.status !== "waiting") throw new GameError("Game already started", "GAME_STARTED");
  if (game.players.length < 2) throw new GameError("Need at least 2 players", "NOT_ENOUGH_PLAYERS");

  const starterDefs = await prisma.cardDefinition.findMany({ where: { pool: "starter" } });
  const staticDefs = await prisma.cardDefinition.findMany({ where: { pool: "static" } });
  const dynamicDefs = await prisma.cardDefinition.findMany({ where: { pool: "dynamic" } });

  await prisma.$transaction(async (tx) => {
    // 1. Clone static market cards
    const staticCards = staticDefs.flatMap((def) =>
      Array.from({ length: def.totalQuantity }, () => ({
        gameId,
        cardDefinitionId: def.id,
        location: "static_market" as const,
      })),
    );
    if (staticCards.length > 0) {
      await tx.gameCard.createMany({ data: staticCards });
    }

    // 2. Build dynamic deck with random positions
    let dynamicPosition = 0;
    const dynamicCards = dynamicDefs.flatMap((def) =>
      Array.from({ length: def.totalQuantity }, () => ({
        gameId,
        cardDefinitionId: def.id,
        location: "dynamic_deck" as const,
        deckPosition: dynamicPosition++,
      })),
    );
    // Shuffle positions
    const positions = dynamicCards.map((c) => c.deckPosition);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j]!, positions[i]!];
    }
    dynamicCards.forEach((c, i) => (c.deckPosition = positions[i]!));

    if (dynamicCards.length > 0) {
      await tx.gameCard.createMany({ data: dynamicCards });
    }

    // 3. Deal starter decks to each player
    for (const player of game.players) {
      const starterCards: { gameId: string; cardDefinitionId: string; location: "player_deck"; playerId: string; deckPosition: number }[] = [];
      let pos = 0;
      for (const def of starterDefs) {
        const qty = def.name === "Copper Coin" ? 6 : def.name === "Walking Stick" ? 3 : 1;
        for (let i = 0; i < qty; i++) {
          starterCards.push({
            gameId,
            cardDefinitionId: def.id,
            location: "player_deck",
            playerId: player.id,
            deckPosition: pos++,
          });
        }
      }
      // Shuffle
      const deckPositions = starterCards.map((c) => c.deckPosition);
      for (let i = deckPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckPositions[i], deckPositions[j]] = [deckPositions[j]!, deckPositions[i]!];
      }
      starterCards.forEach((c, i) => (c.deckPosition = deckPositions[i]!));

      await tx.gameCard.createMany({ data: starterCards });
    }

    // 4. Place artifacts
    for (const placement of game.map.artifactPlacements) {
      await tx.gameArtifact.create({
        data: {
          gameId,
          artifactDefinitionId: placement.artifactDefinitionId,
          roomId: placement.roomId,
        },
      });
    }

    // 5. Fill dynamic market (5 slots)
    await fillDynamicMarket(tx, gameId, 5);

    // 6. Create first turn
    const firstPlayer = game.players[0]!;
    const turn = await tx.turn.create({
      data: {
        gameId,
        playerId: firstPlayer.id,
        turnNumber: 1,
        startingRoomId: firstPlayer.currentRoomId,
        startingHealth: firstPlayer.currentHealth,
        startingAttention: firstPlayer.attentionPoints,
      },
    });

    // 7. Draw opening hand for first player
    await drawCards(tx, firstPlayer.id, 5, gameId);

    // 8. Activate game
    await tx.game.update({
      where: { id: gameId },
      data: {
        status: "active",
        currentTurnId: turn.id,
        startedAt: new Date(),
      },
    });

    // 9. Resolve initial horde triggers
    await resolveInitialHordes(tx, gameId, turn.id);
  });

  return prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
}

async function fillDynamicMarket(
  tx: TxClient,
  gameId: string,
  slotsNeeded: number,
) {
  const occupiedSlots = await tx.gameCard.findMany({
    where: { gameId, location: "dynamic_market" },
    select: { dynamicSlotIndex: true },
  });
  const occupied = new Set(occupiedSlots.map((c) => c.dynamicSlotIndex));

  const emptySlots: number[] = [];
  for (let i = 0; i < 5; i++) {
    if (!occupied.has(i)) emptySlots.push(i);
  }
  if (emptySlots.length === 0) return;

  const toFill = Math.min(emptySlots.length, slotsNeeded);
  const deckCards = await tx.gameCard.findMany({
    where: { gameId, location: "dynamic_deck" },
    orderBy: { deckPosition: "asc" },
    take: toFill,
  });

  for (let i = 0; i < deckCards.length; i++) {
    await tx.gameCard.update({
      where: { id: deckCards[i]!.id },
      data: {
        location: "dynamic_market",
        dynamicSlotIndex: emptySlots[i]!,
        deckPosition: null,
      },
    });
  }
}

async function resolveInitialHordes(
  tx: TxClient,
  gameId: string,
  turnId: string,
) {
  let hasNewTriggers = true;
  while (hasNewTriggers) {
    hasNewTriggers = false;
    const marketCards = await tx.gameCard.findMany({
      where: { gameId, location: "dynamic_market" },
      include: { cardDefinition: true },
    });

    for (const card of marketCards) {
      if (card.cardDefinition.triggersHorde) {
        const existingAttack = await tx.hordeAttack.findFirst({
          where: { gameId, triggeringCardId: card.id },
        });
        if (!existingAttack) {
          await resolveHordeAttack(tx, gameId, card.id, turnId);
          hasNewTriggers = true;
        }
      }
    }

    if (hasNewTriggers) {
      await fillDynamicMarket(tx, gameId, 5);
    }
  }
}

export { fillDynamicMarket };
