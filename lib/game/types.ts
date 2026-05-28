import type { TurnModifiers, TurnResources } from "./cardEffects";

export interface TurnState {
  turnId: string;
  resources: TurnResources;
  modifiers: TurnModifiers;
  playCounts: { monsters: number; devices: number; companions: number };
  goldGainedThisTurn: number;
  goldSpentThisTurn: number;
  movementUsedThisTurn: number;
  attacksUsedThisTurn: number;
}

export interface GameView {
  id: string;
  status: "waiting" | "active" | "finished";
  mapId: string;
  map: MapView;
  players: PlayerSummary[];
  currentTurnPlayerId: string | null;
  turnNumber: number | null;
  dynamicMarket: MarketCardView[];
  staticMarket: StaticMarketView[];
  myHand: HandCardView[] | null;
  actionLog: ActionLogView[];
  attentionPoolSize: number;
  hordeDamageAmount: number;
  artifacts: ArtifactView[];
  marketAccessFromAnywhere: boolean;
}

export interface MapView {
  id: string;
  name: string;
  rooms: RoomView[];
  connections: ConnectionView[];
}

export interface RoomView {
  id: string;
  name: string;
  isEntrance: boolean;
  isExit: boolean;
  isMarket: boolean;
  hasArtifactSlot: boolean;
  monsterCount: number;
  positionX: number | null;
  positionY: number | null;
  playersHere: string[];
  artifact: { id: string; name: string; reputationPoints: number } | null;
}

export interface ConnectionView {
  fromRoomId: string;
  toRoomId: string;
  movementCost: number;
  requiresTool: string | null;
  description: string | null;
}

export interface PlayerSummary {
  id: string;
  name: string;
  turnOrder: number;
  currentRoomId: string | null;
  maxHealth: number;
  currentHealth: number;
  gold: number;
  attentionPoints: number;
  hasExited: boolean;
  isDead: boolean;
  handCount: number;
  artifactCount: number;
  tools: string[];
  reputationFinal: number | null;
}

export interface MarketCardView {
  gameCardId: string;
  cardDefinitionId: string;
  name: string;
  cardType: string;
  costGold: number;
  isOneTimeUse: boolean;
  isKillableThreat: boolean;
  description: string | null;
  dynamicSlotIndex: number;
  effects: EffectView[];
  resolutionOptions: ResolutionOptionView[];
}

export interface StaticMarketView {
  cardDefinitionId: string;
  name: string;
  cardType: string;
  costGold: number;
  description: string | null;
  available: number;
  effects: EffectView[];
}

export interface HandCardView {
  gameCardId: string;
  cardDefinitionId: string;
  name: string;
  cardType: string;
  costGold: number;
  isOneTimeUse: boolean;
  description: string | null;
  effects: EffectView[];
}

export interface EffectView {
  effectType: string;
  amount: number;
  parametersJson: Record<string, unknown>;
}

export interface ResolutionOptionView {
  id: string;
  label: string;
  costAttacks: number;
  costGold: number;
  costAttention: number;
  costHealth: number;
  specialCostJson: Record<string, unknown>;
  rewardGold: number;
  rewardReputation: number;
}

export interface ArtifactView {
  id: string;
  name: string;
  reputationPoints: number;
  roomId: string | null;
  heldByPlayerId: string | null;
}

export interface ActionLogView {
  type: string;
  details: Record<string, unknown>;
}

export class GameError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "GameError";
  }
}
