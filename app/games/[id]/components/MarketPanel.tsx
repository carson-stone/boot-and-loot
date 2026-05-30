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
            <p className="text-xs text-slate-600">Empty</p>
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
                      disabled: !isMyTurn || myGold < card.costGold,
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
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[
              { code: "skeleton_key", name: "Skeleton Key", cost: 8, description: "Unlocks tool-gated passages permanently." },
              { code: "backpack", name: "Backpack", cost: 10, description: "Increases your artifact carrying capacity to 2." },
            ].map((tool) => {
              const owned = myTools.includes(tool.code);
              return (
                <div key={tool.code} className="w-44 h-60 shrink-0 flex flex-col rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="font-bold text-sm text-slate-900 leading-tight">{tool.name}</div>
                    <span className="text-xs font-semibold text-amber-700 shrink-0">{tool.cost}g</span>
                  </div>
                  <div className="mb-2">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      tool
                    </span>
                    {owned && (
                      <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
                        owned
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 leading-snug mb-2">{tool.description}</p>
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      disabled={!canBuyTools || myGold < tool.cost || owned}
                      onClick={() => onBuyTool(tool.code)}
                    >
                      {owned ? "Owned" : "Buy"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
