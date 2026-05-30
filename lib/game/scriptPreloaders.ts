/**
 * Script pre-loaders: data-driven context builders for scripted card effects.
 *
 * When a card with effectType="scripted" is played, the route handler checks
 * this map by script_id and calls the matching pre-loader to build the
 * upgradeableCards array that PlayContext passes to the SCRIPT_REGISTRY fn.
 *
 * To add a new scripted card:
 *   1. Add its effects row to the seed with effectType="scripted", script_id="your_id"
 *   2. Add an entry to SCRIPT_REGISTRY in cardEffects.ts
 *   3. Add an entry here if the script needs DB context (most do)
 */

import { prisma } from "@/lib/db";
import type { UpgradeableCard } from "./cardEffects";

export type ScriptPreloader = (
  gameId: string,
  playerId: string,
) => Promise<UpgradeableCard[]>;

export const SCRIPT_PRELOADERS: Record<string, ScriptPreloader> = {
  /** Alchemy: upgrades up to 3 Copper Coins → Silver, or 1 Silver → Gold Pouch. */
  alchemy: async (gameId, playerId) => {
    const [silverDef, goldDef] = await Promise.all([
      prisma.cardDefinition.findUnique({ where: { name: "Silver Coin" } }),
      prisma.cardDefinition.findUnique({ where: { name: "Gold Pouch" } }),
    ]);

    const coppers = silverDef
      ? await prisma.gameCard.findMany({
          where: { gameId, playerId, location: { in: ["player_discard", "player_play_area"] }, cardDefinition: { name: "Copper Coin" } },
          take: 3,
        })
      : [];

    if (coppers.length > 0 && silverDef) {
      return coppers.map((c) => ({ gameCardId: c.id, cardName: "Copper Coin", upgradedDefinitionId: silverDef.id, upgradedCardName: "Silver Coin" }));
    }

    if (goldDef) {
      const silver = await prisma.gameCard.findFirst({
        where: { gameId, playerId, location: { in: ["player_discard", "player_play_area"] }, cardDefinition: { name: "Silver Coin" } },
      });
      if (silver) return [{ gameCardId: silver.id, cardName: "Silver Coin", upgradedDefinitionId: goldDef.id, upgradedCardName: "Gold Pouch" }];
    }

    return [];
  },

  /** Smelt: converts up to 3 Copper Coins from discard/play area into gold, then trashes them. */
  smelt: async (gameId, playerId) => {
    const coppers = await prisma.gameCard.findMany({
      where: { gameId, playerId, location: { in: ["player_discard", "player_play_area"] }, cardDefinition: { name: "Copper Coin" } },
      take: 3,
    });
    // upgradedDefinitionId/Name are unused by the smelt script, but UpgradeableCard requires them
    return coppers.map((c) => ({ gameCardId: c.id, cardName: "Copper Coin", upgradedDefinitionId: "", upgradedCardName: "" }));
  },
};
