"use client";

import type { MarketCardView, StaticMarketView } from "@/lib/game/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameCardTile } from "./GameCardTile";

interface Props {
  cardOffers: MarketCardView[];
  standardCards: StaticMarketView[];
  isMyTurn: boolean;
  myGold: number;
  myFocus: number;
  myRoomIsMarket: boolean;
  myTools: string[];
  onBuyCard: (params: { gameCardId?: string; cardDefinitionId?: string }) => void;
  onBuyTool: (toolCode: string) => void;
  onResolveThreat: (card: MarketCardView) => void;
}

export function MarketPanel({
  cardOffers,
  standardCards,
  isMyTurn,
  myGold,
  myFocus,
  myRoomIsMarket,
  myTools,
  onBuyCard,
  onBuyTool,
  onResolveThreat,
}: Props) {
  const canBuyTools = isMyTurn && myRoomIsMarket;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Card Offers */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Card Offers</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {cardOffers.length === 0 ? (
            <p className="text-xs text-stone-600 italic">Empty</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {cardOffers.map((card) =>
                card.isKillableThreat ? (
                  <GameCardTile
                    key={card.gameCardId}
                    card={card}
                    action={{
                      label: "Resolve",
                      variant: "destructive",
                      disabled: !isMyTurn,
                      onClick: () => onResolveThreat(card),
                    }}
                  />
                ) : (
                  <GameCardTile
                    key={card.gameCardId}
                    card={card}
                    action={{
                      label: card.isOneTimeUse ? `Use (${card.costGold}g)` : "Buy",
                      variant: "outline",
                      disabled: !isMyTurn || myFocus < card.costFocus || myGold < card.costGold,
                      onClick: () => onBuyCard({ gameCardId: card.gameCardId }),
                    }}
                  />
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Standard Cards */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Standard Cards</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {standardCards.map((card) => (
              <GameCardTile
                key={card.cardDefinitionId}
                card={{ ...card, available: card.available }}
                action={{
                  label: "Buy",
                  variant: "outline",
                  disabled: !isMyTurn || myGold < card.costGold || card.available === 0,
                  onClick: () => onBuyCard({ cardDefinitionId: card.cardDefinitionId }),
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">
            Tools{" "}
            {!myRoomIsMarket && (
              <span className="text-xs font-normal text-slate-500">— visit a market room</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-3 flex-wrap">
            {[
              { code: "skeleton_key", name: "Skeleton Key", cost: 8, description: "Unlocks all key-gated passages permanently.", icon: "🔑" },
              { code: "backpack", name: "Backpack", cost: 10, description: "Carry up to 2 artifacts.", icon: "🎒" },
            ].map((tool) => {
              const owned = myTools.includes(tool.code);
              return (
                <div key={tool.code} className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${owned ? "border-green-700 bg-green-950/30" : "border-stone-600 bg-stone-800/60"}`}>
                  <span className="text-2xl shrink-0">{tool.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm text-stone-100 font-semibold">{tool.name}</span>
                      {owned
                        ? <span className="text-xs text-green-400 font-semibold">Owned</span>
                        : <span className="text-xs text-amber-400 font-semibold">💰 {tool.cost}g</span>}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{tool.description}</p>
                  </div>
                  {!owned && (
                  <div className="shrink-0 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={!canBuyTools || myGold < tool.cost}
                      onClick={() => onBuyTool(tool.code)}
                    >
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
    </div>
  );
}
