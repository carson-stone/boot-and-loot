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
  const canBuyTools = isMyTurn && myRoomIsMarket;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Dynamic Market */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Dynamic Market</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {dynamicMarket.length === 0 ? (
            <p className="text-xs text-slate-600">Empty</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {dynamicMarket.map((card) => (
                <div
                  key={card.gameCardId}
                  className={`border rounded p-2 text-xs flex-1 min-w-[120px] max-w-[180px] ${
                    card.isKillableThreat ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-slate-900 leading-tight">{card.name}</div>
                    <Badge variant="secondary" className="text-xs ml-1 shrink-0">
                      {card.costGold > 0 ? `${card.costGold}g` : card.isKillableThreat ? "threat" : ""}
                    </Badge>
                  </div>
                  {card.description && (
                    <div className="text-slate-700 mb-2 text-[11px] leading-tight line-clamp-2">{card.description}</div>
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
                      disabled={!isMyTurn || myGold < card.costGold}
                      onClick={() => onBuyCard({ gameCardId: card.gameCardId })}
                    >
                      Buy
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Static Market */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Static Market</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex gap-2 flex-wrap">
            {staticMarket.map((card) => (
              <div
                key={card.cardDefinitionId}
                className="border border-slate-200 rounded p-2 text-xs flex-1 min-w-[110px] max-w-[160px] bg-slate-50"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-slate-900 leading-tight">{card.name}</div>
                  <Badge variant="secondary" className="text-xs ml-1 shrink-0">
                    {card.costGold}g ({card.available})
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  disabled={!isMyTurn || myGold < card.costGold || card.available === 0}
                  onClick={() => onBuyCard({ cardDefinitionId: card.cardDefinitionId })}
                >
                  Buy
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tools — market room required */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">
            Tools{" "}
            {!myRoomIsMarket && (
              <span className="text-xs font-normal text-slate-500">— visit a market room</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex gap-2">
            {[
              { code: "skeleton_key", name: "Skeleton Key", cost: 8, description: "Unlocks sealed passages" },
              { code: "backpack", name: "Backpack", cost: 10, description: "Carry 2 artifacts" },
            ].map((tool) => (
              <div
                key={tool.code}
                className="border border-slate-200 rounded p-2 text-xs flex-1 bg-slate-50"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-slate-900 leading-tight">{tool.name}</div>
                  <Badge variant="secondary" className="text-xs ml-1 shrink-0">
                    {tool.cost}g
                  </Badge>
                </div>
                <div className="text-slate-600 text-[11px] mb-2">{tool.description}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  disabled={!canBuyTools || myGold < tool.cost || myTools.includes(tool.code)}
                  onClick={() => onBuyTool(tool.code)}
                >
                  {myTools.includes(tool.code) ? "Owned" : "Buy"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
