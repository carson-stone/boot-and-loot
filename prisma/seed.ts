import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import type { CardPool, CardType } from "../lib/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ---- Tools ----
  const skeletonKey = await prisma.toolDefinition.upsert({
    where: { code: "skeleton_key" },
    update: {},
    create: { code: "skeleton_key", name: "Skeleton Key", description: "Unlocks sealed passages permanently.", costGold: 8 },
  });
  const backpack = await prisma.toolDefinition.upsert({
    where: { code: "backpack" },
    update: {},
    create: { code: "backpack", name: "Backpack", description: "Increases artifact carrying capacity to 2.", costGold: 10 },
  });
  console.log(`  Tools: ${skeletonKey.id}, ${backpack.id}`);

  // ---- Achievements ----
  const achievementData = [
    { code: "first_blood", name: "First Blood", description: "First to defeat a dynamic threat.", reputationPoints: 2 },
    { code: "pacifist", name: "Pacifist", description: "Escape without ever playing an Attack value or defeating a threat by Fight.", reputationPoints: 5 },
    { code: "light_step", name: "Light Step", description: "Escape with 0 attention points in your personal pool.", reputationPoints: 3 },
    { code: "big_spender", name: "Big Spender", description: "Spend 25+ gold across the game.", reputationPoints: 3 },
    { code: "hoarder", name: "Hoarder", description: "Escape carrying two artifacts.", reputationPoints: 4 },
    { code: "speedrunner", name: "Speedrunner", description: "Be the first player to escape.", reputationPoints: 3 },
    { code: "survivor", name: "Survivor", description: "Escape with full health.", reputationPoints: 3 },
    { code: "deep_diver", name: "Deep Diver", description: "Visit every room on the map at least once before escaping.", reputationPoints: 4 },
    { code: "companion_lord", name: "Companion Lord", description: "Have 5+ Companion cards in your deck at game end.", reputationPoints: 3 },
    { code: "tinkerer", name: "Tinkerer", description: "Have 5+ Device cards in your deck at game end.", reputationPoints: 3 },
    { code: "horde_slayer", name: "Horde Slayer", description: "Personally defeat 2+ dynamic threats during the game.", reputationPoints: 5 },
    { code: "medic", name: "Medic", description: "Heal at least 5 health total during the game.", reputationPoints: 2 },
    { code: "cloak_dagger", name: "Cloak & Dagger", description: "Play Shadow Cloak or Decoy at least twice during the game.", reputationPoints: 3 },
    { code: "looter", name: "Looter", description: "Pick up an artifact dropped by a dead player.", reputationPoints: 3 },
  ];
  for (const a of achievementData) {
    await prisma.achievementDefinition.upsert({ where: { code: a.code }, update: {}, create: a });
  }
  console.log(`  Achievements: ${achievementData.length}`);

  // ---- Artifacts ----
  const artifactData = [
    { name: "Bone Trinket", description: "A small carved finger bone on a leather cord.", reputationPoints: 2, flavorText: "Worthless to most. Lucky to some." },
    { name: "Vaulted Coronet", description: "A modest crown sealed behind a locked vault.", reputationPoints: 4, flavorText: "Once worn by a forgotten prince." },
    { name: "Tome of Whispers", description: "A leather-bound book that hums faintly.", reputationPoints: 5, flavorText: "Reading it is unwise." },
    { name: "Funerary Mask", description: "Gold leaf over carved obsidian.", reputationPoints: 5, flavorText: "The face it copies is unknown." },
    { name: "Crown of Thorns", description: "A circlet of black iron spikes.", reputationPoints: 6, flavorText: "Rumored to whisper to its wearer." },
    { name: "Venomfang Idol", description: "A small idol carved from a spider queen's fang.", reputationPoints: 6, flavorText: "It pulses with cold heat." },
    { name: "Reliquary Chalice", description: "A jeweled chalice from the central reliquary.", reputationPoints: 7, flavorText: "Holds something that should not be touched." },
    { name: "Drowned King's Signet", description: "A heavy gold ring still on the finger.", reputationPoints: 9, flavorText: "The finger is still attached." },
  ];
  for (const a of artifactData) {
    await prisma.artifactDefinition.upsert({ where: { name: a.name }, update: {}, create: a });
  }
  console.log(`  Artifacts: ${artifactData.length}`);

  // ---- Card Definitions + Effects + Resolution Options ----
  interface CardDef {
    name: string;
    cardType: CardType;
    pool: CardPool;
    costGold?: number;
    costFocus?: number;
    isOneTimeUse?: boolean;
    triggersHorde?: boolean;
    isKillableThreat?: boolean;
    description: string;
    totalQuantity: number;
    effects?: { displayOrder: number; effectType: string; amount: number; parametersJson?: Record<string, unknown> }[];
    resolutionOptions?: {
      label: string; displayOrder: number;
      costAttacks?: number; costGold?: number; costAttention?: number; costHealth?: number;
      specialCostJson?: Record<string, unknown>;
      rewardGold?: number; rewardReputation?: number;
      rewardJson?: Record<string, unknown>;
    }[];
  }

  const cards: CardDef[] = [
    // ---- Starter ----
    { name: "Copper Coin", cardType: "device", pool: "starter", description: "A simple coin. Basic income.", totalQuantity: 6, effects: [{ displayOrder: 0, effectType: "gain_gold", amount: 1 }] },
    { name: "Walking Stick", cardType: "device", pool: "starter", costGold: 0, description: "Helps you cover ground.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 1 }] },
    { name: "Rusty Dagger", cardType: "device", pool: "starter", costGold: 0, description: "Better than fists. Barely.", totalQuantity: 1, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 1 }] },

    // ---- Static market ----
    { name: "Silver Coin", cardType: "device", pool: "static", costFocus: 3, description: "A better coin. Builds toward real wealth.", totalQuantity: 10, effects: [{ displayOrder: 0, effectType: "gain_gold", amount: 2 }] },
    { name: "Adventurer's Boots", cardType: "device", pool: "static", costFocus: 4, description: "Speed when you need it.", totalQuantity: 10, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 2 }] },
    { name: "Short Sword", cardType: "device", pool: "static", costFocus: 4, description: "Real steel.", totalQuantity: 10, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 2 }] },
    { name: "Hired Hand", cardType: "companion", pool: "static", costFocus: 3, description: "A useful traveling friend.", totalQuantity: 10, effects: [{ displayOrder: 0, effectType: "gain_focus", amount: 1 }, { displayOrder: 1, effectType: "draw_cards", amount: 1 }] },

    // ---- Dynamic: standard ----
    { name: "Stolen Lantern", cardType: "device", pool: "dynamic", costFocus: 4, description: "Borrowed light, borrowed speed. Gain 3 movement.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 3 }] },
    { name: "Rope", cardType: "device", pool: "dynamic", costFocus: 3, description: "Useful in the dark. Gain 2 movement and make less noise this turn.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 2 }, { displayOrder: 1, effectType: "reduce_attention_generated_this_turn", amount: 1 }] },
    { name: "Flask of Fire", cardType: "device", pool: "dynamic", costFocus: 4, description: "Hurled into the dark — chaos follows. Gain 2 attack; every other player gains 1 attention.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 2 }, { displayOrder: 1, effectType: "all_others_gain_attention", amount: 1 }] },
    { name: "Thieves' Tools", cardType: "device", pool: "dynamic", costFocus: 5, description: "A lockpick, a pry bar, and quick hands. Gain 1 focus and 2 attack.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_focus", amount: 1 }, { displayOrder: 1, effectType: "gain_attack", amount: 2 }] },
    { name: "Trinket", cardType: "device", pool: "dynamic", costFocus: 2, description: "Worthless, but it keeps your hands busy. Draw 1 card.", totalQuantity: 4, effects: [{ displayOrder: 0, effectType: "draw_cards", amount: 1 }] },
    { name: "Heavy Crossbow", cardType: "device", pool: "dynamic", costFocus: 6, description: "Devastating range. Terrible subtlety. Gain 4 attack and 1 attention.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 4 }, { displayOrder: 1, effectType: "gain_attention", amount: 1 }] },
    { name: "Grizzled Veteran", cardType: "companion", pool: "dynamic", costFocus: 5, description: "Seen it all. Hit it all. Gain 3 attack; his war stories draw 1 attention.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 3 }, { displayOrder: 1, effectType: "gain_attention", amount: 1 }] },
    { name: "Tracker", cardType: "companion", pool: "dynamic", costFocus: 4, description: "Reads the dungeon like a book. Gain 1 movement and draw 1 card.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 1 }, { displayOrder: 1, effectType: "draw_cards", amount: 1 }] },
    { name: "Fence", cardType: "companion", pool: "dynamic", costFocus: 3, description: "Turns contraband into opportunity. Gain 1 gold and 1 focus.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_gold", amount: 1 }, { displayOrder: 1, effectType: "gain_focus", amount: 1 }] },
    { name: "Tomb Raider", cardType: "companion", pool: "dynamic", costFocus: 6, costGold: 1, description: "Expensive company, but she pays for herself. Gain 2 focus and draw 2 cards.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "gain_focus", amount: 2 }, { displayOrder: 1, effectType: "draw_cards", amount: 2 }] },
    { name: "Gold Pouch", cardType: "device", pool: "dynamic", costFocus: 5, description: "A heavy purse.", totalQuantity: 4, effects: [{ displayOrder: 0, effectType: "gain_gold", amount: 3 }] },
    { name: "Lantern Bearer", cardType: "companion", pool: "dynamic", costFocus: 4, description: "Light and a stout arm.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 1 }, { displayOrder: 1, effectType: "gain_attack", amount: 1 }] },
    { name: "Veteran Mercenary", cardType: "companion", pool: "dynamic", costFocus: 4, costGold: 2, description: "Battle-tested. Worth the coin — and some gold.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_gold", amount: 1 }, { displayOrder: 1, effectType: "gain_attack", amount: 2 }] },
    { name: "Treasure Map", cardType: "device", pool: "dynamic", costFocus: 5, description: "Points to riches. And card draws.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 2 }, { displayOrder: 1, effectType: "draw_cards", amount: 1 }] },
    { name: "Scout", cardType: "companion", pool: "dynamic", costFocus: 3, description: "Sees what others miss.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "draw_cards", amount: 2 }] },
    { name: "War Drum", cardType: "device", pool: "dynamic", costFocus: 4, description: "Loud. Effective. Loud.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 1 }, { displayOrder: 1, effectType: "gain_attention", amount: 1 }] },
    { name: "Cave Bat", cardType: "monster", pool: "dynamic", costGold: 0, isKillableThreat: true, description: "A shrieking swarm. Fast and disorienting.", totalQuantity: 3, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 1, rewardGold: 2 },
    ]},
    { name: "Ogre Brute", cardType: "monster", pool: "dynamic", costGold: 0, isKillableThreat: true, description: "A wall of muscle and bad intentions.", totalQuantity: 2, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 3, rewardGold: 4 },
    ]},
    { name: "Bag of Loot", cardType: "device", pool: "dynamic", costFocus: 5, description: "A heavy sack — coins and a quick step.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_gold", amount: 2 }, { displayOrder: 1, effectType: "gain_movement", amount: 1 }] },
    { name: "Map Fragment", cardType: "device", pool: "dynamic", costFocus: 3, description: "A torn corner of a larger map.", totalQuantity: 4, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 1 }, { displayOrder: 1, effectType: "draw_cards", amount: 1 }] },
    { name: "Cultist", cardType: "monster", pool: "dynamic", costGold: 0, isKillableThreat: true, description: "A fanatic offering a deal. Fight or pay the price.", totalQuantity: 3, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 2, rewardGold: 3, rewardReputation: 1 },
      { label: "Purify", displayOrder: 1, costHealth: 2, rewardGold: 5, rewardReputation: 2 },
    ]},

    // ---- Dynamic: broad effects ----
    { name: "Imp Saboteur", cardType: "monster", pool: "dynamic", costGold: 0, isKillableThreat: true, description: "A sneaky little wretch. Defeat it before it causes more trouble.", totalQuantity: 3, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 1, rewardGold: 2 },
    ]},
    { name: "Goblin Trickster", cardType: "monster", pool: "dynamic", costGold: 0, isKillableThreat: true, description: "Cackles as it dies. Defeating it is satisfying but loud.", totalQuantity: 3, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 2, rewardGold: 3, rewardReputation: 1, rewardJson: { gain_attention: 1 } },
    ]},
    { name: "Pickpocket", cardType: "companion", pool: "dynamic", costFocus: 5, description: "Nimble fingers. Gain focus and permanently lift a gold coin from every other player.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_focus", amount: 2 }, { displayOrder: 1, effectType: "all_others_lose_gold", amount: 1 }] },

    // ---- Dynamic: turn modifiers ----
    { name: "Focus Crystal", cardType: "device", pool: "dynamic", costFocus: 6, description: "A shard of pure will. Doubles all focus you generate this turn — retroactively.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "multiply_focus_this_turn", amount: 2 }] },
    { name: "Mirror Shield", cardType: "device", pool: "dynamic", costFocus: 5, description: "Bash and deflect. Gain 1 attack and prevent 2 damage this turn.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 1 }, { displayOrder: 1, effectType: "prevent_damage_this_turn", amount: 2 }] },
    { name: "Crystal Charm", cardType: "device", pool: "dynamic", costFocus: 6, description: "Reduces all attention you generate this turn by 1.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "reduce_attention_generated_this_turn", amount: 1 }] },
    { name: "Iron Buckler", cardType: "device", pool: "dynamic", costFocus: 5, description: "Bash and block. Prevents 1 damage this turn.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 1 }, { displayOrder: 1, effectType: "prevent_damage_this_turn", amount: 1 }] },
    { name: "Battle Standard", cardType: "device", pool: "dynamic", costFocus: 5, description: "Rally your allies. If you play 2 or more companions this turn, gain +2 attack.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 1 }, { displayOrder: 1, effectType: "conditional_gain_attack_if_card_type_played", amount: 0, parametersJson: { card_type: "companion", threshold: 2, bonus: 2 } }] },
    { name: "Shadow Cloak", cardType: "device", pool: "dynamic", costFocus: 7, isOneTimeUse: true, description: "All cards you play this turn generate 0 attention.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "all_cards_zero_attention_this_turn", amount: 0 }] },

    // ---- Dynamic: one-time-use ----
    { name: "Antidote", cardType: "device", pool: "dynamic", costFocus: 3, isOneTimeUse: true, description: "Purge the poison. Remove 3 attention and heal 1 health.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "remove_attention", amount: 3 }, { displayOrder: 1, effectType: "heal", amount: 1 }] },
    { name: "Flash Powder", cardType: "device", pool: "dynamic", costFocus: 4, isOneTimeUse: true, description: "A blinding detonation. Every other player gains 2 attention while you slip away with 2 focus.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "all_others_gain_attention", amount: 2 }, { displayOrder: 1, effectType: "gain_focus", amount: 2 }] },
    { name: "Sleight of Hand", cardType: "device", pool: "dynamic", costFocus: 4, isOneTimeUse: true, description: "Slip away unnoticed. Remove 2 attention from your pool.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "remove_attention", amount: 2 }] },
    { name: "Smoke Bomb", cardType: "device", pool: "dynamic", costFocus: 6, isOneTimeUse: true, description: "A puff of cover and a quick exit.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 2 }, { displayOrder: 1, effectType: "remove_attention", amount: 3 }] },
    { name: "Healing Draught", cardType: "device", pool: "dynamic", costFocus: 4, isOneTimeUse: true, description: "Heal 3 health.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "heal", amount: 3 }] },
    { name: "Decoy", cardType: "device", pool: "dynamic", costFocus: 3, isOneTimeUse: true, description: "Convert 1 of your attention into Luck. It stays in the Fray but can no longer be traced back to you.", totalQuantity: 4, effects: [{ displayOrder: 0, effectType: "redirect_attention_to_filler", amount: 1 }] },
    { name: "Apothecary", cardType: "companion", pool: "dynamic", costFocus: 6, isOneTimeUse: true, description: "Gain 1 gold and heal 2 health.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_gold", amount: 1 }, { displayOrder: 1, effectType: "heal", amount: 2 }] },

    // ---- Dynamic: special ----
    { name: "Wandering Merchant", cardType: "companion", pool: "dynamic", costFocus: 6, description: "Brings the market wherever he goes.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "gain_focus", amount: 1 }, { displayOrder: 1, effectType: "grant_market_access_this_turn", amount: 0 }] },

    // ---- Dynamic: spells (single-use when played; go to discard on purchase) ----
    { name: "Stone Skin", cardType: "spell", pool: "dynamic", costFocus: 5, description: "Your flesh hardens to granite. Prevent 3 damage this turn.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "prevent_damage_this_turn", amount: 3 }] },
    { name: "Phase Step", cardType: "spell", pool: "dynamic", costFocus: 6, description: "Step between shadows. Gain 4 movement and remove 2 attention.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 4 }, { displayOrder: 1, effectType: "remove_attention", amount: 2 }] },
    { name: "Tremor", cardType: "spell", pool: "dynamic", costFocus: 5, description: "A shockwave through stone. You gain 3 attack; the rumble startles everyone else into 1 attention.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 3 }, { displayOrder: 1, effectType: "all_others_gain_attention", amount: 1 }] },
    { name: "Recall", cardType: "spell", pool: "dynamic", costFocus: 6, description: "The dungeon's secrets flood back to you. Draw 3 cards.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "draw_cards", amount: 3 }] },
    { name: "Alchemy", cardType: "spell", pool: "dynamic", costFocus: 6, description: "Transmute your deck. Upgrades up to 3 Copper Coins in your discard or play area to Silver Coins. If you have no coppers, upgrades one Silver Coin to a Gold Pouch.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "scripted", amount: 0, parametersJson: { script_id: "alchemy" } }] },
    { name: "Smelt", cardType: "spell", pool: "dynamic", costFocus: 4, description: "Melt down your copper. Converts up to 3 Copper Coins from your discard or play area into gold — then discards them permanently.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "scripted", amount: 0, parametersJson: { script_id: "smelt" } }] },
    { name: "Arcane Surge", cardType: "spell", pool: "dynamic", costFocus: 5, description: "A torrent of raw Focus. Generates 4 Focus this turn.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_focus", amount: 4 }] },
    { name: "Blink", cardType: "spell", pool: "dynamic", costFocus: 5, description: "Teleport yourself forward. Gain 3 movement this turn.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "gain_movement", amount: 3 }] },
    { name: "Mending", cardType: "spell", pool: "dynamic", costFocus: 5, description: "Knit flesh and bone. Heal 5 health.", totalQuantity: 3, effects: [{ displayOrder: 0, effectType: "heal", amount: 5 }] },
    { name: "Battle Cry", cardType: "spell", pool: "dynamic", costFocus: 6, description: "A thunderous roar that steels your arm. Gain 4 attack this turn.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "gain_attack", amount: 4 }] },
    { name: "Veil", cardType: "spell", pool: "dynamic", costFocus: 7, description: "Cloak yourself in silence. All cards generate 0 attention this turn, and remove 2 attention from your pool.", totalQuantity: 2, effects: [{ displayOrder: 0, effectType: "all_cards_zero_attention_this_turn", amount: 0 }, { displayOrder: 1, effectType: "remove_attention", amount: 2 }] },

    // ---- Dynamic: killable threats (non-horde) ----
    { name: "Venomous Serpent", cardType: "monster", pool: "dynamic", isKillableThreat: true, description: "Coiled and patient. The bite costs more than the kill.", totalQuantity: 2, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 2, rewardGold: 3 },
      { label: "Purify", displayOrder: 1, costHealth: 1, rewardGold: 5, rewardReputation: 1 },
    ]},
    { name: "Phantom", cardType: "monster", pool: "dynamic", isKillableThreat: true, description: "Incorporeal and ancient. Steel barely slows it; gold does not buy its mercy cheaply.", totalQuantity: 2, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 4, rewardGold: 6, rewardReputation: 1 },
      { label: "Bribe", displayOrder: 1, costGold: 5, rewardReputation: 3 },
    ]},

    // ---- Dynamic: killable threats (horde triggers) ----
    { name: "Restless Horde", cardType: "monster", pool: "dynamic", costGold: 0, triggersHorde: true, isKillableThreat: true, description: "Hazard. Triggers a horde attack on reveal, then sits as a killable threat.", totalQuantity: 4, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 3, rewardGold: 4 },
      { label: "Bribe", displayOrder: 1, costGold: 5, rewardGold: 3, rewardReputation: 1 },
    ]},
    { name: "Awakened Tomb", cardType: "monster", pool: "dynamic", costGold: 0, triggersHorde: true, isKillableThreat: true, description: "Hazard. The dead stir below.", totalQuantity: 3, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 4, rewardGold: 5, rewardReputation: 1 },
      { label: "Banish", displayOrder: 1, costAttention: 3, rewardGold: 4, rewardReputation: 2 },
    ]},
    { name: "Skittering Swarm", cardType: "monster", pool: "dynamic", costGold: 0, triggersHorde: true, isKillableThreat: true, description: "Hazard. Many small things. Easy to kill, easier to ignore.", totalQuantity: 4, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 2, rewardGold: 3 },
      { label: "Sneak Past", displayOrder: 1, costAttention: 1, rewardGold: 2 },
    ]},
    { name: "Wraith Chieftain", cardType: "monster", pool: "dynamic", costGold: 0, triggersHorde: true, isKillableThreat: true, description: "Hazard. A formidable spirit leading lesser shades.", totalQuantity: 2, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 4, rewardGold: 6, rewardReputation: 2 },
      { label: "Bribe", displayOrder: 1, costGold: 8, rewardReputation: 1 },
      { label: "Banish", displayOrder: 2, costAttention: 4, rewardGold: 7, rewardReputation: 1 },
    ]},
    { name: "Crypt Lord", cardType: "monster", pool: "dynamic", costGold: 0, triggersHorde: true, isKillableThreat: true, description: "Hazard. The deepest dweller. A great kill — for great cost.", totalQuantity: 2, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 5, rewardGold: 8, rewardReputation: 3 },
      { label: "Bribe", displayOrder: 1, costGold: 10, rewardReputation: 2 },
      { label: "Purify", displayOrder: 2, costHealth: 3, rewardGold: 6, rewardReputation: 4 },
    ]},
    { name: "The Collector", cardType: "companion", pool: "dynamic", costGold: 0, triggersHorde: true, isKillableThreat: true, description: "Hazard. A grim trader who appraises your effects. Fight or trade cards.", totalQuantity: 2, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 3, rewardGold: 4 },
      { label: "Trade", displayOrder: 1, specialCostJson: { trash_cards: 2 }, rewardGold: 5, rewardReputation: 1 },
    ]},
    { name: "Stone Guardian", cardType: "device", pool: "dynamic", costGold: 0, triggersHorde: true, isKillableThreat: true, description: "Hazard. An ancient sentinel. Fight or decipher.", totalQuantity: 2, resolutionOptions: [
      { label: "Fight", displayOrder: 0, costAttacks: 4, rewardGold: 6 },
      { label: "Decipher", displayOrder: 1, costAttention: 3, rewardGold: 3, rewardReputation: 2 },
    ]},
  ];

  for (const card of cards) {
    const created = await prisma.cardDefinition.upsert({
      where: { name: card.name },
      update: {},
      create: {
        name: card.name,
        cardType: card.cardType,
        pool: card.pool,
        costGold: card.costGold ?? 0,
        costFocus: card.costFocus ?? 0,
        isOneTimeUse: card.isOneTimeUse ?? false,
        triggersHorde: card.triggersHorde ?? false,
        isKillableThreat: card.isKillableThreat ?? false,
        description: card.description,
        totalQuantity: card.totalQuantity,
      },
    });

    if (card.effects) {
      for (const eff of card.effects) {
        await prisma.cardEffect.upsert({
          where: { cardDefinitionId_displayOrder: { cardDefinitionId: created.id, displayOrder: eff.displayOrder } },
          update: {},
          create: {
            cardDefinitionId: created.id,
            displayOrder: eff.displayOrder,
            effectType: eff.effectType,
            amount: eff.amount,
            parametersJson: (eff.parametersJson ?? {}) as never,
          },
        });
      }
    }

    if (card.resolutionOptions) {
      for (const opt of card.resolutionOptions) {
        const existing = await prisma.cardResolutionOption.findFirst({
          where: { cardDefinitionId: created.id, displayOrder: opt.displayOrder },
        });
        if (!existing) {
          await prisma.cardResolutionOption.create({
            data: {
              cardDefinitionId: created.id,
              label: opt.label,
              displayOrder: opt.displayOrder,
              costAttacks: opt.costAttacks ?? 0,
              costGold: opt.costGold ?? 0,
              costAttention: opt.costAttention ?? 0,
              costHealth: opt.costHealth ?? 0,
              specialCostJson: (opt.specialCostJson ?? {}) as never,
              rewardGold: opt.rewardGold ?? 0,
              rewardReputation: opt.rewardReputation ?? 0,
              rewardJson: (opt.rewardJson ?? {}) as never,
            },
          });
        }
      }
    }
  }
  console.log(`  Cards: ${cards.length}`);

  // ---- The Sunken Crypt Map ----
  const map = await prisma.map.upsert({
    where: { name: "The Sunken Crypt" },
    update: {},
    create: {
      name: "The Sunken Crypt",
      description: "A sprawling tomb with branching wings, one-way drops, sealed passages, and a deep central chamber. 2-5 players.",
    },
  });

  const roomData: { name: string; isEntrance: boolean; isExit: boolean; isMarket: boolean; hasArtifactSlot: boolean; monsterCount: number; positionX: number; positionY: number }[] = [
    { name: "Entrance", isEntrance: true, isExit: true, isMarket: false, hasArtifactSlot: false, monsterCount: 0, positionX: 6, positionY: 0 },
    { name: "West Gate", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 1, positionX: 3, positionY: 1 },
    { name: "East Gate", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 1, positionX: 9, positionY: 1 },
    { name: "Old Armory", isEntrance: false, isExit: false, isMarket: true, hasArtifactSlot: false, monsterCount: 0, positionX: 1, positionY: 2 },
    { name: "Antechamber", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 0, positionX: 6, positionY: 2 },
    { name: "Torchlit Path", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 1, positionX: 11, positionY: 2 },
    { name: "Crossroads", isEntrance: false, isExit: false, isMarket: true, hasArtifactSlot: false, monsterCount: 0, positionX: 3, positionY: 3 },
    { name: "Echoing Cavern", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 1, positionX: 6, positionY: 3 },
    { name: "Bone Pit", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 2, positionX: 9, positionY: 3 },
    { name: "Deep Well", isEntrance: false, isExit: false, isMarket: true, hasArtifactSlot: false, monsterCount: 0, positionX: 1, positionY: 4 },
    { name: "Trapped Vault", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: true, monsterCount: 1, positionX: 4, positionY: 4 },
    { name: "Burial Chamber", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: true, monsterCount: 2, positionX: 6, positionY: 4 },
    { name: "Whispering Tunnel", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 1, positionX: 9, positionY: 4 },
    { name: "Spider Nest", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 2, positionX: 12, positionY: 4 },
    { name: "Forgotten Library", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: true, monsterCount: 0, positionX: 1, positionY: 5 },
    { name: "Ossuary", isEntrance: false, isExit: false, isMarket: true, hasArtifactSlot: true, monsterCount: 0, positionX: 4, positionY: 5 },
    { name: "Sunken Reliquary", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: true, monsterCount: 1, positionX: 6, positionY: 5 },
    { name: "Cursed Throne", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: true, monsterCount: 2, positionX: 9, positionY: 5 },
    { name: "Venom Vault", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: true, monsterCount: 2, positionX: 12, positionY: 5 },
    { name: "Drowned Crypt", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: true, monsterCount: 2, positionX: 6, positionY: 6 },
    { name: "Throne Antechamber", isEntrance: false, isExit: false, isMarket: false, hasArtifactSlot: false, monsterCount: 1, positionX: 9, positionY: 6 },
  ];

  const roomMap = new Map<string, string>();
  for (const r of roomData) {
    const room = await prisma.room.upsert({
      where: { mapId_name: { mapId: map.id, name: r.name } },
      update: {},
      create: { mapId: map.id, ...r },
    });
    roomMap.set(r.name, room.id);
  }
  console.log(`  Rooms: ${roomData.length}`);

  // ---- Room Connections ----
  const edges: { from: string; to: string; bidirectional: boolean; cost: number; requiresTool: string | null; description: string | null }[] = [
    { from: "Entrance", to: "West Gate", bidirectional: true, cost: 1, requiresTool: null, description: "Stone steps west" },
    { from: "Entrance", to: "East Gate", bidirectional: true, cost: 1, requiresTool: null, description: "Stone steps east" },
    { from: "West Gate", to: "Old Armory", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "West Gate", to: "Antechamber", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "West Gate", to: "Crossroads", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "East Gate", to: "Antechamber", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "East Gate", to: "Torchlit Path", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Old Armory", to: "Crossroads", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Old Armory", to: "Deep Well", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Antechamber", to: "Crossroads", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Antechamber", to: "Echoing Cavern", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Torchlit Path", to: "Echoing Cavern", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Torchlit Path", to: "Bone Pit", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Crossroads", to: "Echoing Cavern", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Crossroads", to: "Deep Well", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Crossroads", to: "Trapped Vault", bidirectional: true, cost: 1, requiresTool: "skeleton_key", description: "Iron door" },
    { from: "Echoing Cavern", to: "Bone Pit", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Echoing Cavern", to: "Trapped Vault", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Echoing Cavern", to: "Burial Chamber", bidirectional: true, cost: 1, requiresTool: "skeleton_key", description: "Sealed passage" },
    { from: "Bone Pit", to: "Whispering Tunnel", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Bone Pit", to: "Spider Nest", bidirectional: false, cost: 1, requiresTool: null, description: "Sinkhole - one-way drop" },
    { from: "Deep Well", to: "Forgotten Library", bidirectional: true, cost: 2, requiresTool: null, description: "Long submerged crawl" },
    { from: "Deep Well", to: "Ossuary", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Trapped Vault", to: "Forgotten Library", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Trapped Vault", to: "Ossuary", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Burial Chamber", to: "Sunken Reliquary", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Burial Chamber", to: "Ossuary", bidirectional: true, cost: 1, requiresTool: "skeleton_key", description: "Sealed crypt door" },
    { from: "Whispering Tunnel", to: "Sunken Reliquary", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Whispering Tunnel", to: "Cursed Throne", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Spider Nest", to: "Venom Vault", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Spider Nest", to: "Cursed Throne", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Forgotten Library", to: "Ossuary", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Sunken Reliquary", to: "Cursed Throne", bidirectional: true, cost: 1, requiresTool: "skeleton_key", description: "Sealed archway" },
    { from: "Sunken Reliquary", to: "Drowned Crypt", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Cursed Throne", to: "Venom Vault", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Cursed Throne", to: "Throne Antechamber", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Cursed Throne", to: "Drowned Crypt", bidirectional: false, cost: 1, requiresTool: null, description: "Crumbling ledge — one-way drop" },
    { from: "Drowned Crypt", to: "Throne Antechamber", bidirectional: true, cost: 1, requiresTool: null, description: null },
    { from: "Venom Vault", to: "Throne Antechamber", bidirectional: true, cost: 1, requiresTool: null, description: null },
  ];

  let connectionCount = 0;
  for (const edge of edges) {
    const fromId = roomMap.get(edge.from)!;
    const toId = roomMap.get(edge.to)!;

    const existing = await prisma.roomConnection.findUnique({
      where: { fromRoomId_toRoomId: { fromRoomId: fromId, toRoomId: toId } },
    });
    if (!existing) {
      await prisma.roomConnection.create({
        data: { fromRoomId: fromId, toRoomId: toId, movementCost: edge.cost, requiresTool: edge.requiresTool, description: edge.description },
      });
      connectionCount++;
    }

    if (edge.bidirectional) {
      const existingReverse = await prisma.roomConnection.findUnique({
        where: { fromRoomId_toRoomId: { fromRoomId: toId, toRoomId: fromId } },
      });
      if (!existingReverse) {
        await prisma.roomConnection.create({
          data: { fromRoomId: toId, toRoomId: fromId, movementCost: edge.cost, requiresTool: edge.requiresTool, description: edge.description },
        });
        connectionCount++;
      }
    }
  }
  console.log(`  Connections: ${connectionCount}`);

  // ---- Artifact Placements ----
  const placements: [string, string][] = [
    ["Ossuary", "Bone Trinket"],
    ["Trapped Vault", "Vaulted Coronet"],
    ["Forgotten Library", "Tome of Whispers"],
    ["Burial Chamber", "Funerary Mask"],
    ["Cursed Throne", "Crown of Thorns"],
    ["Venom Vault", "Venomfang Idol"],
    ["Sunken Reliquary", "Reliquary Chalice"],
    ["Drowned Crypt", "Drowned King's Signet"],
  ];

  for (const [roomName, artifactName] of placements) {
    const rId = roomMap.get(roomName)!;
    const artifact = await prisma.artifactDefinition.findUnique({ where: { name: artifactName } });
    if (!artifact) throw new Error(`Artifact not found: ${artifactName}`);

    const existing = await prisma.mapArtifactPlacement.findUnique({
      where: { mapId_roomId: { mapId: map.id, roomId: rId } },
    });
    if (!existing) {
      await prisma.mapArtifactPlacement.create({
        data: { mapId: map.id, roomId: rId, artifactDefinitionId: artifact.id },
      });
    }
  }
  console.log(`  Artifact placements: ${placements.length}`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
