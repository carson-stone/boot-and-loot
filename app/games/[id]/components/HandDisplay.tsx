"use client";

import type { HandCardView } from "@/lib/game/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameCardTile } from "./GameCardTile";

interface Props {
  hand: HandCardView[];
  isMyTurn: boolean;
  onPlay: (gameCardId: string) => void;
}

export function HandDisplay({ hand, isMyTurn, onPlay }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm">Your Hand ({hand.length})</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {hand.length === 0 ? (
          <p className="text-slate-600 text-sm">No cards in hand.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {hand.map((card) => (
              <GameCardTile
                key={card.gameCardId}
                card={card}
                action={{
                  label: "Play",
                  variant: "default",
                  disabled: !isMyTurn,
                  onClick: () => onPlay(card.gameCardId),
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
