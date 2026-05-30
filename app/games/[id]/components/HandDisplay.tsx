"use client";

import type { HandCardView } from "@/lib/game/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  hand: HandCardView[];
  isMyTurn: boolean;
  onPlay: (gameCardId: string) => void;
}

export function HandDisplay({ hand, isMyTurn, onPlay }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Your Hand ({hand.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {hand.length === 0 ? (
          <p className="text-slate-600 text-sm">No cards in hand.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {hand.map((card) => (
              <div
                key={card.gameCardId}
                className="border border-slate-200 rounded-md p-3 bg-slate-50 hover:bg-white transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="font-semibold text-sm text-slate-900">{card.name}</div>
                  <Badge variant="secondary" className="text-xs">
                    {card.cardType}
                  </Badge>
                </div>
                {card.description && (
                  <div className="text-xs text-slate-600 mb-2">{card.description}</div>
                )}
                <div className="flex gap-1 mb-2 flex-wrap">
                  {card.effects.map((e, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {e.effectType.replace(/_/g, " ")} {e.amount ? `+${e.amount}` : ""}
                    </Badge>
                  ))}
                </div>
                {card.isOneTimeUse && (
                  <Badge variant="destructive" className="text-xs mb-2">
                    One-time use
                  </Badge>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!isMyTurn}
                  onClick={() => onPlay(card.gameCardId)}
                >
                  Play
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
