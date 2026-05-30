/**
 * Test harness for the card effect resolver.
 * Verifies primitive behavior, modifier composition, and edge cases.
 */

import {
  CardEffect,
  PlayContext,
  PlayerView,
  StateDelta,
  TurnModifiers,
  TurnResources,
  PlayCounts,
  DEFAULT_TURN_MODIFIERS,
  applyEffect,
  resolveCardPlay,
  parseCardEffects,
} from "./cardEffects";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${(err as Error).message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function makePlayer(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    id: "p1",
    health: 10,
    maxHealth: 10,
    gold: 0,
    goldGainedThisTurn: 0,
    attention: 0,
    isDead: false,
    hasExited: false,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<PlayContext> = {}): PlayContext {
  const current = overrides.currentPlayer ?? makePlayer();
  return {
    currentPlayer: current,
    otherPlayers: [makePlayer({ id: "p2" }), makePlayer({ id: "p3" })],
    turnResources: { gold: 0, movement: 0, attacks: 0, cardsToDraw: 0 },
    modifiers: { ...DEFAULT_TURN_MODIFIERS },
    playCounts: { monsters: 0, devices: 0, companions: 0 },
    cardInstanceId: "card-instance-1",
    cardName: "Test Card",
    cardIsOneTimeUse: false,
    cardType: "device",
    upgradeableCards: [],
    ...overrides,
  };
}

console.log("\n=== BASIC PRIMITIVES ===");

test("gain_gold adds gold to current player", () => {
  const ctx = makeCtx();
  const delta = new StateDelta();
  applyEffect({ type: "gain_gold", amount: 3 }, ctx, delta);
  assertEqual(delta.playerDelta("p1").goldChange, 3, "gold change");
  assertEqual(delta.turnResourceChanges.gold ?? 0, 3, "turn gold");
});

test("gain_movement adds to turn resources", () => {
  const ctx = makeCtx();
  const delta = new StateDelta();
  applyEffect({ type: "gain_movement", amount: 2 }, ctx, delta);
  assertEqual(delta.turnResourceChanges.movement ?? 0, 2, "movement");
});

test("heal caps at maxHealth", () => {
  const ctx = makeCtx({ currentPlayer: makePlayer({ health: 8, maxHealth: 10 }) });
  const delta = new StateDelta();
  applyEffect({ type: "heal", amount: 5 }, ctx, delta);
  assertEqual(delta.playerDelta("p1").healthChange, 2, "heal capped at 2 (8+5 -> 10)");
});

test("remove_attention can't go below 0", () => {
  const ctx = makeCtx({ currentPlayer: makePlayer({ attention: 1 }) });
  const delta = new StateDelta();
  applyEffect({ type: "remove_attention", amount: 5 }, ctx, delta);
  assertEqual(delta.playerDelta("p1").attentionChange, -1, "only removes what exists");
});

console.log("\n=== BROAD EFFECTS ===");

test("all_others_gain_attention skips self, hits others", () => {
  const ctx = makeCtx();
  const delta = new StateDelta();
  applyEffect({ type: "all_others_gain_attention", amount: 1 }, ctx, delta);
  assertEqual(delta.playerDelta("p1").attentionChange, 0, "self unaffected");
  assertEqual(delta.playerDelta("p2").attentionChange, 1, "p2 +1");
  assertEqual(delta.playerDelta("p3").attentionChange, 1, "p3 +1");
});

test("all_others_lose_gold_this_turn respects each player's current gold", () => {
  const ctx = makeCtx({
    otherPlayers: [
      makePlayer({ id: "p2", gold: 3 }),
      makePlayer({ id: "p3", gold: 0 }),  // can't go negative
    ],
  });
  const delta = new StateDelta();
  applyEffect({ type: "all_others_lose_gold_this_turn", amount: 2 }, ctx, delta);
  assertEqual(delta.playerDelta("p2").goldChange, -2, "p2 loses 2");
  assertEqual(delta.playerDelta("p3").goldChange, 0, "p3 has 0, loses 0");
});

console.log("\n=== ATTENTION MODIFIERS ===");

test("reduce_attention_generated_this_turn reduces subsequent gain_attention", () => {
  const ctx = makeCtx({
    modifiers: { ...DEFAULT_TURN_MODIFIERS, attentionGeneratedReduction: 1 },
  });
  const delta = new StateDelta();
  applyEffect({ type: "gain_attention", amount: 2 }, ctx, delta);
  assertEqual(delta.playerDelta("p1").attentionChange, 1, "2 - 1 reduction = 1");
});

test("all_cards_zero_attention_this_turn zeroes future attention gains", () => {
  // Simulating: Shadow Cloak played, then War Drum's gain_attention(1) should resolve to 0
  const ctx = makeCtx({
    modifiers: { ...DEFAULT_TURN_MODIFIERS, attentionGeneratedMultiplier: 0 },
  });
  const delta = new StateDelta();
  applyEffect({ type: "gain_attention", amount: 5 }, ctx, delta);
  assertEqual(delta.playerDelta("p1").attentionChange, 0, "all attention zeroed");
});

console.log("\n=== MULTIPLIER COMPOSITION ===");

test("multiply_gold_this_turn retroactively buffs gold gained earlier", () => {
  // Player already gained 3 gold this turn. Now plays a "double gold" card.
  const ctx = makeCtx({
    currentPlayer: makePlayer({ goldGainedThisTurn: 3 }),
  });
  const delta = new StateDelta();
  applyEffect({ type: "multiply_gold_this_turn", factor: 2 }, ctx, delta);
  // Retroactive bonus: 3 * (2 - 1) / 1 = 3 extra gold
  assertEqual(delta.playerDelta("p1").goldChange, 3, "retroactive +3");
  assertEqual(delta.turnModifierChanges.goldMultiplier, 2, "multiplier set to 2");
});

test("gain_gold AFTER multiplier applies the multiplier", () => {
  const ctx = makeCtx({
    modifiers: { ...DEFAULT_TURN_MODIFIERS, goldMultiplier: 2 },
  });
  const delta = new StateDelta();
  applyEffect({ type: "gain_gold", amount: 3 }, ctx, delta);
  assertEqual(delta.playerDelta("p1").goldChange, 6, "3 * 2 = 6");
});

test("order-independence: +3 gold then ×2 == ×2 then +3 gold", () => {
  // Scenario A: gain 3 gold, then play multiplier
  const ctxA = makeCtx();
  const deltaA = new StateDelta();
  applyEffect({ type: "gain_gold", amount: 3 }, ctxA, deltaA);
  // Update context to reflect what just happened (would happen in real engine
  // by re-fetching state between effect calls)
  const ctxA2 = makeCtx({
    currentPlayer: makePlayer({ goldGainedThisTurn: 3 }),
  });
  applyEffect({ type: "multiply_gold_this_turn", factor: 2 }, ctxA2, deltaA);
  const totalA = deltaA.playerDelta("p1").goldChange;

  // Scenario B: play multiplier first, then gain 3 gold
  const deltaB = new StateDelta();
  const ctxB = makeCtx();
  applyEffect({ type: "multiply_gold_this_turn", factor: 2 }, ctxB, deltaB);
  const ctxB2 = makeCtx({
    modifiers: { ...DEFAULT_TURN_MODIFIERS, goldMultiplier: 2 },
  });
  applyEffect({ type: "gain_gold", amount: 3 }, ctxB2, deltaB);
  const totalB = deltaB.playerDelta("p1").goldChange;

  assertEqual(totalA, 6, "scenario A total");
  assertEqual(totalB, 6, "scenario B total");
  assertEqual(totalA, totalB, "order-independent");
});

console.log("\n=== CONDITIONAL EFFECTS ===");

test("Battle Standard: no bonus when fewer than 2 companions played", () => {
  const ctx = makeCtx({
    playCounts: { monsters: 0, devices: 0, companions: 1 },
  });
  const delta = new StateDelta();
  applyEffect({
    type: "conditional_gain_attack_if_card_type_played",
    card_type: "companion",
    threshold: 2,
    bonus: 2,
  }, ctx, delta);
  assertEqual(delta.turnResourceChanges.attacks ?? 0, 0, "no bonus");
});

test("Battle Standard: bonus applies when 2+ companions played", () => {
  const ctx = makeCtx({
    playCounts: { monsters: 0, devices: 0, companions: 2 },
  });
  const delta = new StateDelta();
  applyEffect({
    type: "conditional_gain_attack_if_card_type_played",
    card_type: "companion",
    threshold: 2,
    bonus: 2,
  }, ctx, delta);
  assertEqual(delta.turnResourceChanges.attacks ?? 0, 2, "+2 attack bonus");
});

console.log("\n=== FULL CARD RESOLUTION ===");

test("Pickpocket: gain 2 gold AND all others lose 1 gold", () => {
  const effects: CardEffect[] = [
    { type: "gain_gold", amount: 2 },
    { type: "all_others_lose_gold_this_turn", amount: 1 },
  ];
  const ctx = makeCtx({
    otherPlayers: [
      makePlayer({ id: "p2", gold: 5 }),
      makePlayer({ id: "p3", gold: 5 }),
    ],
  });
  const delta = resolveCardPlay(effects, ctx);

  assertEqual(delta.playerDelta("p1").goldChange, 2, "self +2");
  assertEqual(delta.playerDelta("p2").goldChange, -1, "p2 -1");
  assertEqual(delta.playerDelta("p3").goldChange, -1, "p3 -1");
  assertEqual(delta.cardMovements.length, 1, "one card movement");
  assertEqual(delta.cardMovements[0]?.to, "player_discard", "non-one-time moves to discard");
});

test("Healing Draught (one-time-use): heal 3 and trash", () => {
  const effects: CardEffect[] = [{ type: "heal", amount: 3 }];
  const ctx = makeCtx({
    currentPlayer: makePlayer({ health: 5 }),
    cardIsOneTimeUse: true,
  });
  const delta = resolveCardPlay(effects, ctx);

  assertEqual(delta.playerDelta("p1").healthChange, 3, "+3 heal");
  assertEqual(delta.cardMovements[0]?.to, "trashed", "one-time goes to trashed");
});

test("Imagined card: '+1 attention and double gold this turn'", () => {
  // The exact card the user asked about. Player has 4 gold already this turn.
  const effects: CardEffect[] = [
    { type: "gain_attention", amount: 1 },
    { type: "multiply_gold_this_turn", factor: 2 },
  ];
  const ctx = makeCtx({
    currentPlayer: makePlayer({ goldGainedThisTurn: 4 }),
  });
  const delta = resolveCardPlay(effects, ctx);
  // +1 attention applied
  assertEqual(delta.playerDelta("p1").attentionChange, 1, "+1 attention");
  // multiplier retroactively gives +4 gold (4 * (2-1)/1)
  assertEqual(delta.playerDelta("p1").goldChange, 4, "retroactive doubling of 4 = +4");
  assertEqual(delta.turnModifierChanges.goldMultiplier, 2, "multiplier set");
});

console.log("\n=== DB → TYPED PARSING ===");

test("parseCardEffects sorts by display_order and maps types", () => {
  const rows = [
    { display_order: 1, effect_type: "draw_cards", amount: 2, parameters_json: {} },
    { display_order: 0, effect_type: "gain_gold", amount: 1, parameters_json: {} },
  ];
  const effects = parseCardEffects(rows);
  assertEqual(effects.length, 2, "two effects");
  assertEqual(effects[0]?.type, "gain_gold", "sorted first");
  assertEqual(effects[1]?.type, "draw_cards", "sorted second");
});

test("parseCardEffects: conditional pulls from parameters_json", () => {
  const rows = [{
    display_order: 0,
    effect_type: "conditional_gain_attack_if_card_type_played",
    amount: 0,
    parameters_json: { card_type: "companion", threshold: 2, bonus: 2 },
  }];
  const effects = parseCardEffects(rows);
  const e = effects[0];
  if (e?.type !== "conditional_gain_attack_if_card_type_played") {
    throw new Error("wrong type discriminator");
  }
  assertEqual(e.card_type, "companion", "card_type");
  assertEqual(e.threshold, 2, "threshold");
  assertEqual(e.bonus, 2, "bonus");
});

test("parseCardEffects: multiply uses amount as factor", () => {
  const rows = [{
    display_order: 0,
    effect_type: "multiply_gold_this_turn",
    amount: 2,
    parameters_json: {},
  }];
  const effects = parseCardEffects(rows);
  const e = effects[0];
  if (e?.type !== "multiply_gold_this_turn") throw new Error("wrong type");
  assertEqual(e.factor, 2, "factor from amount");
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (failed > 0) (globalThis as any).process?.exit(1);
