import { prisma } from "@/lib/db";
import type {
  PlayerView,
  TurnModifiers,
  TurnResources,
  PlayCounts,
  PlayContext,
  ActionLogEntry,
} from "./cardEffects";
import type { GameView, TurnState } from "./types";
import { GameError } from "./types";

export async function loadTurnState(turnId: string): Promise<TurnState> {
  const turn = await prisma.turn.findUniqueOrThrow({ where: { id: turnId } });
  const actions = (turn.actions ?? []) as ActionLogEntry[];

  const resources: TurnResources = { gold: 0, movement: 0, attacks: 0, cardsToDraw: 0 };
  const modifiers: TurnModifiers = {
    goldMultiplier: 1,
    attackMultiplier: 1,
    attentionGeneratedMultiplier: 1,
    attentionGeneratedReduction: 0,
    damagePrevention: 0,
    marketAccessFromAnywhere: false,
  };
  const playCounts: PlayCounts = { monsters: 0, devices: 0, companions: 0 };
  let goldGained = 0;
  let goldSpent = turn.goldSpent;
  let movementUsed = turn.movementUsed;
  let attacksUsed = turn.attacksUsed;

  for (const action of actions) {
    if (action.type === "effect_resolved") {
      const details = action.details as Record<string, unknown>;
      const effectType = action.effect_type;

      switch (effectType) {
        case "gain_gold": {
          const amount = (details.amount as number) * modifiers.goldMultiplier;
          resources.gold += amount;
          goldGained += amount;
          break;
        }
        case "gain_movement":
          resources.movement += details.amount as number;
          break;
        case "gain_attack": {
          const amount = (details.amount as number) * modifiers.attackMultiplier;
          resources.attacks += amount;
          break;
        }
        case "draw_cards":
          resources.cardsToDraw += details.amount as number;
          break;
        case "multiply_gold_this_turn": {
          const factor = details.factor as number;
          const oldGold = goldGained;
          goldGained = oldGold * factor;
          resources.gold = goldGained - goldSpent;
          modifiers.goldMultiplier *= factor;
          break;
        }
        case "multiply_attack_this_turn":
          modifiers.attackMultiplier *= details.factor as number;
          break;
        case "reduce_attention_generated_this_turn":
          modifiers.attentionGeneratedReduction += details.amount as number;
          break;
        case "all_cards_zero_attention_this_turn":
          modifiers.attentionGeneratedMultiplier = 0;
          break;
        case "prevent_damage_this_turn":
          modifiers.damagePrevention += details.amount as number;
          break;
        case "grant_market_access_this_turn":
          modifiers.marketAccessFromAnywhere = true;
          break;
      }
    }

    if (action.type === "play_card") {
      // We need to look up card type to count plays — fetch it
    }

    if (action.type === "buy_card") {
      goldSpent += (action as { gold_paid: number }).gold_paid;
      resources.gold -= (action as { gold_paid: number }).gold_paid;
    }

    if (action.type === "move") {
      const moveCost = (action as { movement_cost: number }).movement_cost;
      movementUsed += moveCost;
      resources.movement -= moveCost;
    }
  }

  // Count play types from cards in play area
  const playAreaCards = await prisma.gameCard.findMany({
    where: {
      gameId: turn.gameId,
      playerId: turn.playerId,
      location: { in: ["player_play_area", "player_discard", "trashed"] },
    },
    include: { cardDefinition: true },
  });

  // Count cards played this turn by looking at play_card actions
  const playedCardIds = actions
    .filter((a): a is { type: "play_card"; game_card_id: string } => a.type === "play_card")
    .map((a) => a.game_card_id);

  for (const card of playAreaCards) {
    if (playedCardIds.includes(card.id)) {
      if (card.cardDefinition.cardType === "monster") playCounts.monsters++;
      else if (card.cardDefinition.cardType === "device") playCounts.devices++;
      else if (card.cardDefinition.cardType === "companion") playCounts.companions++;
    }
  }

  return {
    turnId,
    resources,
    modifiers,
    playCounts,
    goldGainedThisTurn: goldGained,
    goldSpentThisTurn: goldSpent,
    movementUsedThisTurn: movementUsed,
    attacksUsedThisTurn: attacksUsed,
  };
}

export async function buildPlayContext(
  gameId: string,
  playerId: string,
  cardInstanceId: string,
  turnState: TurnState,
): Promise<PlayContext> {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  const otherPlayers = await prisma.player.findMany({
    where: { gameId, isDead: false, hasExited: false, id: { not: playerId } },
  });

  const gameCard = await prisma.gameCard.findUniqueOrThrow({
    where: { id: cardInstanceId },
    include: { cardDefinition: true },
  });

  const currentPlayer: PlayerView = {
    id: player.id,
    health: player.currentHealth,
    maxHealth: player.maxHealth,
    gold: player.gold + turnState.resources.gold - turnState.goldSpentThisTurn,
    goldGainedThisTurn: turnState.goldGainedThisTurn,
    attention: player.attentionPoints,
    isDead: player.isDead,
    hasExited: player.hasExited,
  };

  const otherPlayerViews: PlayerView[] = otherPlayers.map((p) => ({
    id: p.id,
    health: p.currentHealth,
    maxHealth: p.maxHealth,
    gold: p.gold,
    goldGainedThisTurn: 0,
    attention: p.attentionPoints,
    isDead: p.isDead,
    hasExited: p.hasExited,
  }));

  return {
    currentPlayer,
    otherPlayers: otherPlayerViews,
    turnResources: { ...turnState.resources },
    modifiers: { ...turnState.modifiers },
    playCounts: { ...turnState.playCounts },
    cardInstanceId,
    cardIsOneTimeUse: gameCard.cardDefinition.isOneTimeUse,
    cardType: gameCard.cardDefinition.cardType,
  };
}

export async function loadGameState(gameId: string, requestingPlayerId?: string): Promise<GameView> {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      map: {
        include: {
          rooms: {
            include: {
              connectionsFrom: true,
            },
          },
        },
      },
      players: {
        orderBy: { turnOrder: "asc" },
        include: {
          tools: { include: { toolDefinition: true } },
          _count: {
            select: {
              gameCards: { where: { location: "player_hand" } },
              gameArtifacts: true,
            },
          },
        },
      },
      gameArtifacts: {
        include: { artifactDefinition: true },
      },
      currentTurn: true,
    },
  });

  // Load dynamic market
  const dynamicMarketCards = await prisma.gameCard.findMany({
    where: { gameId, location: "dynamic_market" },
    include: {
      cardDefinition: {
        include: {
          effects: { orderBy: { displayOrder: "asc" } },
          resolutionOptions: { orderBy: { displayOrder: "asc" } },
        },
      },
    },
    orderBy: { dynamicSlotIndex: "asc" },
  });

  // Load static market availability
  const staticDefs = await prisma.cardDefinition.findMany({
    where: { pool: "static" },
    include: { effects: { orderBy: { displayOrder: "asc" } } },
  });

  const staticMarket = await Promise.all(
    staticDefs.map(async (def) => {
      const available = await prisma.gameCard.count({
        where: { gameId, cardDefinitionId: def.id, location: "static_market" },
      });
      return {
        cardDefinitionId: def.id,
        name: def.name,
        cardType: def.cardType,
        costGold: def.costGold,
        description: def.description,
        available,
        effects: def.effects.map((e) => ({
          effectType: e.effectType,
          amount: e.amount,
          parametersJson: e.parametersJson as Record<string, unknown>,
        })),
      };
    }),
  );

  // Load requesting player's hand
  let myHand = null;
  if (requestingPlayerId) {
    const handCards = await prisma.gameCard.findMany({
      where: { gameId, playerId: requestingPlayerId, location: "player_hand" },
      include: {
        cardDefinition: {
          include: { effects: { orderBy: { displayOrder: "asc" } } },
        },
      },
    });
    myHand = handCards.map((c) => ({
      gameCardId: c.id,
      cardDefinitionId: c.cardDefinitionId,
      name: c.cardDefinition.name,
      cardType: c.cardDefinition.cardType,
      costGold: c.cardDefinition.costGold,
      isOneTimeUse: c.cardDefinition.isOneTimeUse,
      description: c.cardDefinition.description,
      effects: c.cardDefinition.effects.map((e) => ({
        effectType: e.effectType,
        amount: e.amount,
        parametersJson: e.parametersJson as Record<string, unknown>,
      })),
    }));
  }

  // Action log from current turn
  const actionLog = ((game.currentTurn?.actions ?? []) as Array<{ type: string; [key: string]: unknown }>).map(
    (a) => ({ type: a.type, details: a as Record<string, unknown> }),
  );

  // Compute current turn modifiers (only marketAccessFromAnywhere is exposed for now)
  let marketAccessFromAnywhere = false;
  if (game.currentTurn) {
    const turnState = await loadTurnState(game.currentTurn.id);
    marketAccessFromAnywhere = turnState.modifiers.marketAccessFromAnywhere;
  }

  // Build room connections from the included data
  const allConnections = game.map.rooms.flatMap((r) =>
    r.connectionsFrom.map((c) => ({
      fromRoomId: c.fromRoomId,
      toRoomId: c.toRoomId,
      movementCost: c.movementCost,
      requiresTool: c.requiresTool,
      description: c.description,
    })),
  );

  return {
    id: game.id,
    status: game.status,
    mapId: game.mapId,
    map: {
      id: game.map.id,
      name: game.map.name,
      rooms: game.map.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        isEntrance: r.isEntrance,
        isExit: r.isExit,
        isMarket: r.isMarket,
        hasArtifactSlot: r.hasArtifactSlot,
        monsterCount: r.monsterCount,
        positionX: r.positionX,
        positionY: r.positionY,
        playersHere: game.players.filter((p) => p.currentRoomId === r.id && !p.isDead && !p.hasExited).map((p) => p.id),
        artifact: game.gameArtifacts.find((a) => a.roomId === r.id)
          ? {
              id: game.gameArtifacts.find((a) => a.roomId === r.id)!.id,
              name: game.gameArtifacts.find((a) => a.roomId === r.id)!.artifactDefinition.name,
              reputationPoints: game.gameArtifacts.find((a) => a.roomId === r.id)!.artifactDefinition.reputationPoints,
            }
          : null,
      })),
      connections: allConnections,
    },
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      turnOrder: p.turnOrder,
      currentRoomId: p.currentRoomId,
      maxHealth: p.maxHealth,
      currentHealth: p.currentHealth,
      gold: p.gold,
      attentionPoints: p.attentionPoints,
      hasExited: p.hasExited,
      isDead: p.isDead,
      handCount: p._count.gameCards,
      artifactCount: p._count.gameArtifacts,
      tools: p.tools.map((t) => t.toolDefinition.code),
      reputationFinal: p.reputationFinal,
    })),
    currentTurnPlayerId: game.currentTurn?.playerId ?? null,
    turnNumber: game.currentTurn?.turnNumber ?? null,
    dynamicMarket: dynamicMarketCards.map((c) => ({
      gameCardId: c.id,
      cardDefinitionId: c.cardDefinitionId,
      name: c.cardDefinition.name,
      cardType: c.cardDefinition.cardType,
      costGold: c.cardDefinition.costGold,
      isOneTimeUse: c.cardDefinition.isOneTimeUse,
      isKillableThreat: c.cardDefinition.isKillableThreat,
      description: c.cardDefinition.description,
      dynamicSlotIndex: c.dynamicSlotIndex!,
      effects: c.cardDefinition.effects.map((e) => ({
        effectType: e.effectType,
        amount: e.amount,
        parametersJson: e.parametersJson as Record<string, unknown>,
      })),
      resolutionOptions: c.cardDefinition.resolutionOptions.map((o) => ({
        id: o.id,
        label: o.label,
        costAttacks: o.costAttacks,
        costGold: o.costGold,
        costAttention: o.costAttention,
        costHealth: o.costHealth,
        specialCostJson: o.specialCostJson as Record<string, unknown>,
        rewardGold: o.rewardGold,
        rewardReputation: o.rewardReputation,
      })),
    })),
    staticMarket,
    myHand,
    actionLog,
    attentionPoolSize: game.attentionPoolSize,
    hordeDamageAmount: game.hordeDamageAmount,
    artifacts: game.gameArtifacts.map((a) => ({
      id: a.id,
      name: a.artifactDefinition.name,
      reputationPoints: a.artifactDefinition.reputationPoints,
      roomId: a.roomId,
      heldByPlayerId: a.heldByPlayerId,
    })),
    marketAccessFromAnywhere,
  };
}
