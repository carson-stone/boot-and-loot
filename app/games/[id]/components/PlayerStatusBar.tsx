"use client";

import type { PlayerSummary } from "@/lib/game/types";
import { Badge } from "@/components/ui/badge";

interface Props {
  players: PlayerSummary[];
  currentTurnPlayerId: string | null;
  turnNumber: number | null;
}

export function PlayerStatusBar({ players, currentTurnPlayerId, turnNumber }: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-900">Players</h2>
        {turnNumber && <Badge variant="secondary">Turn {turnNumber}</Badge>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {players.map((p) => {
          const isActive = p.id === currentTurnPlayerId;
          return (
            <div
              key={p.id}
              className={`p-2 rounded border ${
                isActive ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"
              } ${p.isDead ? "opacity-50" : ""} ${p.hasExited ? "bg-green-50 border-green-300" : ""}`}
            >
              <div className="text-sm font-semibold text-slate-900 truncate">
                {p.name}
                {p.isDead && " 💀"}
                {p.hasExited && " 🚪"}
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                <Badge variant="destructive" className="text-xs">
                  ❤ {p.currentHealth}/{p.maxHealth}
                </Badge>
                <Badge variant="gold" className="text-xs">
                  💰 {p.gold}
                </Badge>
                <Badge variant="attention" className="text-xs">
                  👁 {p.attentionPoints}
                </Badge>
              </div>
              <div className="text-xs text-slate-700 mt-1">
                Hand: {p.handCount} • Artifacts: {p.artifactCount}
                {p.tools.length > 0 && ` • ${p.tools.join(", ")}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
