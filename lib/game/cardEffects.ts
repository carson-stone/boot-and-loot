/**
 * Boot & Loot — Card Effect Engine
 *
 * Two lifecycles:
 *   - on-play: card played from a player's hand → run card_effects
 *   - on-reveal: card flipped face-up in dynamic market → if triggers_horde, fire horde attack
 *
 * The resolver does NOT touch the database. It computes a StateDelta from a CardEffect[]
 * plus current state. The caller is responsible for:
 *   1. Validating the delta (player can afford costs, etc.)
 *   2. Persisting the delta atomically in a single transaction
 *   3. Appending action-log entries to turns.actions
 */

// =====================================================================
// PRIMITIVE EFFECT TYPES
// =====================================================================

/** A single primitive effect. Discriminated union over effect_type. */
export type CardEffect =
  // ---- Instant additive (player's own resources) ----
  | { type: "gain_gold";       amount: number }
  | { type: "gain_movement";   amount: number }
  | { type: "gain_attack";     amount: number }
  | { type: "gain_attention";  amount: number }
  | { type: "draw_cards";      amount: number }
  | { type: "heal";            amount: number }

  // ---- Instant attention transfer ----
  | { type: "remove_attention";              amount: number }
  | { type: "redirect_attention_to_filler";  amount: number }

  // ---- Broad (other players) ----
  | { type: "all_others_gain_attention";     amount: number }
  | { type: "all_others_lose_gold_this_turn"; amount: number }

  // ---- Turn modifiers (apply for the remainder of the current turn) ----
  | { type: "multiply_gold_this_turn";       factor: number }
  | { type: "multiply_attack_this_turn";     factor: number }
  | { type: "reduce_attention_generated_this_turn"; amount: number }
  | { type: "all_cards_zero_attention_this_turn" }
  | { type: "prevent_damage_this_turn";      amount: number }

  // ---- Conditional ----
  | { type: "conditional_gain_attack_if_card_type_played"; card_type: "monster" | "device" | "companion"; threshold: number; bonus: number }

  // ---- Card-level special ----
  | { type: "grant_market_access_this_turn" }

  // ---- Escape hatch ----
  | { type: "scripted"; script_id: string };


// =====================================================================
// STATE TYPES
// =====================================================================

/** Snapshot of a player as the resolver sees them. */
export interface PlayerView {
  id: string;
  health: number;
  maxHealth: number;
  gold: number;
  goldGainedThisTurn: number;
  attention: number;
  isDead: boolean;
  hasExited: boolean;
}

/** Turn-scoped modifiers that affect how primitives compute values. */
export interface TurnModifiers {
  goldMultiplier: number;                  // default 1
  attackMultiplier: number;                // default 1
  attentionGeneratedMultiplier: number;    // default 1 (Shadow Cloak sets to 0)
  attentionGeneratedReduction: number;     // default 0 (Crystal Charm raises by 1)
  damagePrevention: number;                // default 0 (Iron Buckler raises by 1)
  marketAccessFromAnywhere: boolean;       // Wandering Merchant
}

export const DEFAULT_TURN_MODIFIERS: TurnModifiers = {
  goldMultiplier: 1,
  attackMultiplier: 1,
  attentionGeneratedMultiplier: 1,
  attentionGeneratedReduction: 0,
  damagePrevention: 0,
  marketAccessFromAnywhere: false,
};

/** Counts of card-type plays this turn, used for conditional effects. */
export interface PlayCounts {
  monsters: number;
  devices: number;
  companions: number;
}

/** Resources accumulated during the current turn. */
export interface TurnResources {
  gold: number;
  movement: number;
  attacks: number;
  cardsToDraw: number;  // cards queued to be drawn after current effect resolves
}

/** Everything the resolver needs to read to make decisions. */
export interface PlayContext {
  currentPlayer: PlayerView;
  otherPlayers: PlayerView[];        // alive, non-exited rivals only
  turnResources: TurnResources;
  modifiers: TurnModifiers;
  playCounts: PlayCounts;
  cardInstanceId: string;            // the game_cards.id being played
  cardName: string;                  // human-readable name for action log
  cardIsOneTimeUse: boolean;         // from card_definitions.is_one_time_use
  cardType: "monster" | "device" | "companion";
}


// =====================================================================
// STATE DELTA — what changed
// =====================================================================

/** A movement of a card from one location to another. */
export interface CardMovement {
  cardInstanceId: string;
  from: CardLocation;
  to: CardLocation;
}

export type CardLocation =
  | "static_market"
  | "dynamic_market"
  | "dynamic_deck"
  | "player_deck"
  | "player_hand"
  | "player_play_area"
  | "player_discard"
  | "trashed";

/** Per-player changes resulting from an effect. */
export interface PlayerDelta {
  playerId: string;
  goldChange: number;
  healthChange: number;
  attentionChange: number;
}

/** A complete description of what an effect or sequence of effects did. */
export class StateDelta {
  playerChanges: Map<string, PlayerDelta> = new Map();
  turnResourceChanges: Partial<TurnResources> = {};
  turnModifierChanges: Partial<TurnModifiers> = {};
  cardMovements: CardMovement[] = [];
  attentionToFiller: number = 0;       // amount moved from player to shared filler
  actionLogEntries: ActionLogEntry[] = [];

  /** Mutating helper: get-or-create a per-player delta. */
  playerDelta(playerId: string): PlayerDelta {
    let d = this.playerChanges.get(playerId);
    if (!d) {
      d = { playerId, goldChange: 0, healthChange: 0, attentionChange: 0 };
      this.playerChanges.set(playerId, d);
    }
    return d;
  }
}

/** An entry destined for turns.actions JSONB. */
export type ActionLogEntry =
  | { type: "effect_resolved"; effect_type: string; details: Record<string, unknown> }
  | { type: "play_card"; game_card_id: string; card_name: string }
  | { type: "move"; from_room_id: string; to_room_id: string; from_room_name: string; to_room_name: string; movement_cost: number; damage_taken?: number }
  | { type: "buy_card"; game_card_id: string; card_name: string; from: "static" | "dynamic"; gold_paid: number }
  | { type: "buy_tool"; tool_code: string; tool_name: string; gold_paid: number }
  | { type: "pickup_artifact"; game_artifact_id: string; artifact_name: string }
  | { type: "defeat_threat"; game_card_id: string; threat_name: string; resolution_option_id: string; label: string }
  | { type: "horde_attack"; horde_attack_id: string }
  | { type: "escape"; player_id: string };


// =====================================================================
// SCRIPT REGISTRY — for cards too unusual for primitives
// =====================================================================

export type CardScript = (ctx: PlayContext, delta: StateDelta) => void;

export const SCRIPT_REGISTRY: Record<string, CardScript> = {
  // Currently empty — every card we've designed fits the primitive vocabulary.
  // Add scripted entries here when a card's behavior genuinely can't be expressed
  // as a list of primitives. Each script receives the same (ctx, delta) signature.
};


// =====================================================================
// THE RESOLVER
// =====================================================================

/**
 * Resolve a single primitive effect against the current play context.
 * Mutates the passed StateDelta. Does not touch the database.
 *
 * Modifier composition: when a multiplier changes, the resolver retroactively
 * adjusts gold/attacks already gained this turn so the order in which the
 * player plays cards doesn't trap them.
 */
export function applyEffect(
  effect: CardEffect,
  ctx: PlayContext,
  delta: StateDelta
): void {
  const self = delta.playerDelta(ctx.currentPlayer.id);

  switch (effect.type) {
    // ---- Instant additive ----
    case "gain_gold": {
      const amount = effect.amount * ctx.modifiers.goldMultiplier;
      self.goldChange += amount;
      delta.turnResourceChanges.gold =
        (delta.turnResourceChanges.gold ?? 0) + amount;
      return;
    }

    case "gain_movement": {
      delta.turnResourceChanges.movement =
        (delta.turnResourceChanges.movement ?? 0) + effect.amount;
      return;
    }

    case "gain_attack": {
      const amount = effect.amount * ctx.modifiers.attackMultiplier;
      delta.turnResourceChanges.attacks =
        (delta.turnResourceChanges.attacks ?? 0) + amount;
      return;
    }

    case "gain_attention": {
      // Apply attention modifiers: reduction first, then multiplier, floored at 0.
      const reduced = Math.max(0, effect.amount - ctx.modifiers.attentionGeneratedReduction);
      const final = Math.max(0, reduced * ctx.modifiers.attentionGeneratedMultiplier);
      self.attentionChange += final;
      return;
    }

    case "draw_cards": {
      delta.turnResourceChanges.cardsToDraw =
        (delta.turnResourceChanges.cardsToDraw ?? 0) + effect.amount;
      return;
    }

    case "heal": {
      const newHealth = Math.min(
        ctx.currentPlayer.maxHealth,
        ctx.currentPlayer.health + effect.amount
      );
      self.healthChange += newHealth - ctx.currentPlayer.health;
      return;
    }

    // ---- Instant attention transfer ----
    case "remove_attention": {
      const removed = Math.min(ctx.currentPlayer.attention, effect.amount);
      self.attentionChange -= removed;
      return;
    }

    case "redirect_attention_to_filler": {
      const moved = Math.min(ctx.currentPlayer.attention, effect.amount);
      self.attentionChange -= moved;
      delta.attentionToFiller += moved;
      return;
    }

    // ---- Broad effects on other players ----
    case "all_others_gain_attention": {
      for (const other of ctx.otherPlayers) {
        delta.playerDelta(other.id).attentionChange += effect.amount;
      }
      return;
    }

    case "all_others_lose_gold_this_turn": {
      for (const other of ctx.otherPlayers) {
        const lost = Math.min(other.gold, effect.amount);
        delta.playerDelta(other.id).goldChange -= lost;
      }
      return;
    }

    // ---- Turn modifiers ----
    case "multiply_gold_this_turn": {
      const oldMult = ctx.modifiers.goldMultiplier;
      const newMult = oldMult * effect.factor;
      const extraOnExisting =
        ctx.currentPlayer.goldGainedThisTurn * (newMult - oldMult) / oldMult;
      self.goldChange += extraOnExisting;
      delta.turnResourceChanges.gold =
        (delta.turnResourceChanges.gold ?? 0) + extraOnExisting;
      delta.turnModifierChanges.goldMultiplier = newMult;
      return;
    }

    case "multiply_attack_this_turn": {
      const oldMult = ctx.modifiers.attackMultiplier;
      const newMult = oldMult * effect.factor;
      const extraOnExisting =
        ctx.turnResources.attacks * (newMult - oldMult) / oldMult;
      delta.turnResourceChanges.attacks =
        (delta.turnResourceChanges.attacks ?? 0) + extraOnExisting;
      delta.turnModifierChanges.attackMultiplier = newMult;
      return;
    }

    case "reduce_attention_generated_this_turn": {
      delta.turnModifierChanges.attentionGeneratedReduction =
        ctx.modifiers.attentionGeneratedReduction + effect.amount;
      return;
    }

    case "all_cards_zero_attention_this_turn": {
      delta.turnModifierChanges.attentionGeneratedMultiplier = 0;
      return;
    }

    case "prevent_damage_this_turn": {
      delta.turnModifierChanges.damagePrevention =
        ctx.modifiers.damagePrevention + effect.amount;
      return;
    }

    // ---- Conditional ----
    case "conditional_gain_attack_if_card_type_played": {
      const count = ctx.playCounts[effect.card_type === "monster" ? "monsters"
        : effect.card_type === "companion" ? "companions" : "devices"];
      if (count >= effect.threshold) {
        const bonus = effect.bonus * ctx.modifiers.attackMultiplier;
        delta.turnResourceChanges.attacks =
          (delta.turnResourceChanges.attacks ?? 0) + bonus;
      }
      return;
    }

    // ---- Card-level special ----
    case "grant_market_access_this_turn": {
      delta.turnModifierChanges.marketAccessFromAnywhere = true;
      return;
    }

    // ---- Escape hatch ----
    case "scripted": {
      const script = SCRIPT_REGISTRY[effect.script_id];
      if (!script) {
        throw new Error(`Unknown card script: ${effect.script_id}`);
      }
      script(ctx, delta);
      return;
    }

    default: {
      // TypeScript exhaustiveness check: if a new effect_type is added to the
      // union without a case here, this line will be a compile error.
      const _exhaustive: never = effect;
      throw new Error(`Unhandled effect type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Resolve an entire card play: applies all effects in order, then queues
 * the card movement (to discard, or to trash if one-time-use).
 */
export function resolveCardPlay(
  effects: CardEffect[],
  ctx: PlayContext
): StateDelta {
  const delta = new StateDelta();

  delta.actionLogEntries.push({
    type: "play_card",
    game_card_id: ctx.cardInstanceId,
    card_name: ctx.cardName,
  });

  for (const effect of effects) {
    applyEffect(effect, ctx, delta);
    delta.actionLogEntries.push({
      type: "effect_resolved",
      effect_type: effect.type,
      details: { ...effect },
    });
  }

  delta.cardMovements.push({
    cardInstanceId: ctx.cardInstanceId,
    from: "player_play_area",
    to: ctx.cardIsOneTimeUse ? "trashed" : "player_discard",
  });

  return delta;
}


// =====================================================================
// PARSING: card_effects rows from DB → typed CardEffect objects
// =====================================================================

/** Shape of a row from the card_effects table. */
export interface CardEffectRow {
  display_order: number;
  effect_type: string;
  amount: number;
  parameters_json: Record<string, unknown>;
}

/**
 * Convert raw card_effects rows into a validated CardEffect[]. This is the
 * boundary between the loose database representation and the strict typed
 * effect model.
 */
export function parseCardEffects(rows: CardEffectRow[]): CardEffect[] {
  return rows
    .sort((a, b) => a.display_order - b.display_order)
    .map(rowToEffect);
}

function rowToEffect(row: CardEffectRow): CardEffect {
  const { effect_type, amount, parameters_json } = row;
  switch (effect_type) {
    case "gain_gold":
    case "gain_movement":
    case "gain_attack":
    case "gain_attention":
    case "draw_cards":
    case "heal":
    case "remove_attention":
    case "redirect_attention_to_filler":
    case "all_others_gain_attention":
    case "all_others_lose_gold_this_turn":
    case "reduce_attention_generated_this_turn":
    case "prevent_damage_this_turn":
      return { type: effect_type, amount } as CardEffect;

    case "multiply_gold_this_turn":
    case "multiply_attack_this_turn":
      return { type: effect_type, factor: amount } as CardEffect;

    case "all_cards_zero_attention_this_turn":
    case "grant_market_access_this_turn":
      return { type: effect_type } as CardEffect;

    case "conditional_gain_attack_if_card_type_played":
      return {
        type: "conditional_gain_attack_if_card_type_played",
        card_type: String(parameters_json.card_type) as "monster" | "device" | "companion",
        threshold: Number(parameters_json.threshold),
        bonus: Number(parameters_json.bonus),
      };

    case "scripted":
      return {
        type: "scripted",
        script_id: String(parameters_json.script_id),
      };

    default:
      throw new Error(`Unknown effect_type in DB: ${effect_type}`);
  }
}
