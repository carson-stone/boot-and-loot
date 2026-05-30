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
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  return (
    <div
      className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Expanded panel */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          open ? "w-52 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <div className="w-52 min-h-[300px] max-h-[90vh] overflow-y-auto bg-stone-900 border-r border-stone-600 shadow-2xl flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="font-display text-xs text-amber-300 tracking-widest uppercase">Hand</span>
            <button
              onClick={() => setPinned(!pinned)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                pinned
                  ? "border-amber-500 text-amber-300 bg-amber-900/40"
                  : "border-stone-600 text-stone-300 hover:text-stone-300"
              }`}
              title={pinned ? "Unpin hand" : "Pin hand open"}
            >
              {pinned ? "📌" : "pin"}
            </button>
          </div>

          {hand.length === 0 ? (
            <p className="text-stone-300 text-xs px-1 italic">Empty hand</p>
          ) : (
            hand.map((card) => (
              <div key={card.gameCardId} className="shrink-0">
                <GameCardTile
                  card={card}
                  action={{
                    label: "Play",
                    variant: "default",
                    disabled: !isMyTurn,
                    onClick: () => onPlay(card.gameCardId),
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Collapsed tab */}
      <div
        className={`flex flex-col items-center justify-center cursor-pointer transition-all duration-200
          bg-stone-800 border border-l-0 border-stone-600 rounded-r-lg shadow-lg
          ${open ? "w-6" : "w-8"}`}
        style={{ minHeight: "80px" }}
        onClick={() => setPinned(!pinned)}
      >
        <span
          className="font-display text-amber-300 text-[10px] tracking-widest uppercase"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Hand {hand.length > 0 ? `(${hand.length})` : ""}
        </span>
      </div>
    </div>
  );
}
