"use client";

import type { MarketCardView, StaticMarketView } from "@/lib/game/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  dynamicMarket: MarketCardView[];
  staticMarket: StaticMarketView[];
  isMyTurn: boolean;
  myGold: number;
  myRoomIsMarket: boolean;
  myTools: string[];
  onBuyCard: (params: { gameCardId?: string; cardDefinitionId?: string }) => void;
  onBuyTool: (toolCode: string) => void;
  onResolveThreat: (card: MarketCardView) => void;
}

export function MarketPanel({
  dynamicMarket,
  staticMarket,
  isMyTurn,
  myGold,
  myRoomIsMarket,
  myTools,
  onBuyCard,
  onBuyTool,
  onResolveThreat,
}: Props) {
  const canBuy = isMyTurn && myRoomIsMarket;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          Market {!myRoomIsMarket && <span className="text-xs text-slate-500 font-normal">(not in market)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Dynamic Market */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Dynamic Market</h3>
          <div className="space-y-1">
            {dynamicMarket.length === 0 ? (
              <p className="text-xs text-slate-600">Empty</p>
            ) : (
              dynamicMarket.map((card) => (
                <div
                  key={card.gameCardId}
                  className={`border rounded p-2 text-xs ${
                    card.isKillableThreat ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-slate-900">{card.name}</div>
                    <Badge variant="secondary" className="text-xs ml-1">
                      {card.costGold > 0 ? `${card.costGold}g` : card.isKillableThreat ? "threat" : ""}
                    </Badge>
                  </div>
                  {card.description && (
                    <div className="text-slate-700 mb-1 line-clamp-2">{card.description}</div>
                  )}
                  {card.isKillableThreat ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full h-7 text-xs"
                      disabled={!isMyTurn}
                      onClick={() => onResolveThreat(card)}
                    >
                      Resolve
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      disabled={!canBuy || myGold < card.costGold}
                      onClick={() => onBuyCard({ gameCardId: card.gameCardId })}
                    >
                      Buy
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Static Market */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Static Market</h3>
          <div className="space-y-1">
            {staticMarket.map((card) => (
              <div key={card.cardDefinitionId} className="border border-slate-200 rounded p-2 text-xs bg-slate-50">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-slate-900">{card.name}</div>
                  <Badge variant="secondary" className="text-xs ml-1">
                    {card.costGold}g ({card.available})
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  disabled={!canBuy || myGold < card.costGold || card.available === 0}
                  onClick={() => onBuyCard({ cardDefinitionId: card.cardDefinitionId })}
                >
                  Buy
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Tools</h3>
          <div className="space-y-1">
            {[
              { code: "skeleton_key", name: "Skeleton Key", cost: 8 },
              { code: "backpack", name: "Backpack", cost: 10 },
            ].map((tool) => (
              <div key={tool.code} className="border border-slate-200 rounded p-2 text-xs bg-slate-50">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-slate-900">{tool.name}</div>
                  <Badge variant="secondary" className="text-xs ml-1">
                    {tool.cost}g
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  disabled={!canBuy || myGold < tool.cost || myTools.includes(tool.code)}
                  onClick={() => onBuyTool(tool.code)}
                >
                  {myTools.includes(tool.code) ? "Owned" : "Buy"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
