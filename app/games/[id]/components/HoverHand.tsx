"use client";

import { useState } from "react";
import type { HandCardView } from "@/lib/game/types";
import { GameCardTile } from "./GameCardTile";

interface Props {
  hand: HandCardView[];
  isMyTurn: boolean;
  onPlay: (gameCardId: string) => void;
}

export function HoverHand({ hand, isMyTurn, onPlay }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex shrink-0 self-stretch">
      {/* Expanded card list */}
      {open && (
        <div className="w-52 flex flex-col gap-2 bg-stone-900 border border-stone-700 rounded-lg p-2 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="font-display text-sm font-semibold tracking-wide text-amber-200">
              Hand {hand.length > 0 && `(${hand.length})`}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
              title="Collapse hand"
            >
              ◀
            </button>
          </div>
          {hand.length === 0 ? (
            <p className="text-stone-400 text-xs px-1 italic">Empty hand</p>
          ) : (
            hand.map((card) => (
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
            ))
          )}
        </div>
      )}

      {/* Collapsed tab */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-9 flex flex-col items-center justify-center bg-stone-900 border border-stone-700 rounded-lg hover:border-amber-700 transition-colors cursor-pointer"
          title="Expand hand"
        >
          <span
            className="font-display text-amber-200 text-xs font-semibold tracking-wide select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Hand {hand.length > 0 ? `(${hand.length})` : ""}
          </span>
        </button>
      )}
    </div>
  );
}
