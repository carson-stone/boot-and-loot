"use client";

import type { MarketCardView, StaticMarketView } from "@/lib/game/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameCardTile } from "./GameCardTile";

// ---- Shared prop shapes ------------------------------------------------

interface CardBuyProps {
  isMyTurn: boolean;
  myGold: number;
  myFocus: number;
  onBuyCard: (params: { gameCardId?: string; cardDefinitionId?: string }) => void;
  onResolveThreat: (card: MarketCardView) => void;
}

// ---- Loot (randomly drawn card offers) --------------------------------

interface LootSectionProps extends CardBuyProps {
  cardOffers: MarketCardView[];
}

export function LootSection({ cardOffers, isMyTurn, myGold, myFocus, onBuyCard, onResolveThreat }: LootSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle>Loot</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {cardOffers.length === 0 ? (
          <p className="text-xs text-stone-400 italic">Empty</p>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-280px)]">
            {cardOffers.map((card) =>
              card.isKillableThreat ? (
                <GameCardTile key={card.gameCardId} card={card} action={{ label: "Resolve", variant: "destructive", disabled: !isMyTurn, onClick: () => onResolveThreat(card) }} />
              ) : (
                <GameCardTile key={card.gameCardId} card={card} action={{ label: card.isOneTimeUse ? "Use" : "Buy", variant: "outline", disabled: !isMyTurn || myFocus < card.costFocus || myGold < card.costGold, onClick: () => onBuyCard({ gameCardId: card.gameCardId }) }} />
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Essentials (always-available cards) --------------------------------

interface EssentialsSectionProps extends CardBuyProps {
  standardCards: StaticMarketView[];
}

export function EssentialsSection({ standardCards, isMyTurn, myGold, myFocus, onBuyCard }: EssentialsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle>Essentials</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-col gap-2">
          {standardCards.map((card) => (
            <GameCardTile
              key={card.cardDefinitionId}
              card={{ ...card, available: card.available }}
              action={{ label: "Buy", variant: "outline", disabled: !isMyTurn || myFocus < card.costFocus || myGold < card.costGold || card.available === 0, onClick: () => onBuyCard({ cardDefinitionId: card.cardDefinitionId }) }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Market (tools — requires a market room) --------------------------------

interface ToolsSectionProps {
  isMyTurn: boolean;
  myGold: number;
  myRoomIsMarket: boolean;
  myTools: string[];
  onBuyTool: (toolCode: string) => void;
}

export function ToolsSection({ isMyTurn, myGold, myRoomIsMarket, myTools, onBuyTool }: ToolsSectionProps) {
  const canBuy = isMyTurn && myRoomIsMarket;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle>
          Market{" "}
          {!myRoomIsMarket && <span className="text-xs font-normal text-stone-400">— visit a market room</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-col gap-2">
          {[
            { code: "skeleton_key", name: "Skeleton Key", cost: 8, description: "Unlocks all key-gated passages permanently.", icon: "🔑" },
            { code: "backpack",     name: "Backpack",     cost: 10, description: "Carry up to 2 artifacts.",                    icon: "🎒" },
          ].map((tool) => {
            const owned = myTools.includes(tool.code);
            return (
              <div key={tool.code} className={`flex items-center gap-3 rounded-lg border px-4 py-3 w-full ${owned ? "border-green-700 bg-green-950/30" : "border-stone-600 bg-stone-800/60"}`}>
                <span className="text-2xl shrink-0">{tool.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm text-stone-100 font-semibold">{tool.name}</span>
                    {owned
                      ? <span className="text-xs text-green-400 font-semibold">Owned</span>
                      : <span className="text-xs text-amber-400 font-semibold">💰 {tool.cost}g</span>}
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{tool.description}</p>
                </div>
                {!owned && (
                  <div className="shrink-0 ml-auto">
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!canBuy || myGold < tool.cost} onClick={() => onBuyTool(tool.code)}>
                      Buy
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
