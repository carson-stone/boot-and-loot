"use client";

import type { PlayerSummary, RoomView } from "@/lib/game/types";
import { Badge } from "@/components/ui/badge";

interface Props {
  players: PlayerSummary[];
  rooms: RoomView[];
  currentTurnPlayerId: string | null;
  turnNumber: number | null;
}

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

export function PlayerStatusBar({ players, rooms, currentTurnPlayerId, turnNumber }: Props) {
  function roomName(roomId: string | null): string {
    if (!roomId) return "—";
    return rooms.find((r) => r.id === roomId)?.name ?? "?";
  }
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-700">Players</h2>
        {turnNumber && <Badge variant="secondary">Turn {turnNumber}</Badge>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {players.map((p) => {
          const isActive = p.id === currentTurnPlayerId;
          const color = PLAYER_COLORS[p.turnOrder] ?? "#64748b";
          return (
            <div
              key={p.id}
              className={`p-2 rounded border ${
                isActive ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"
              } ${p.isDead ? "opacity-50" : ""} ${p.hasExited ? "bg-green-50 border-green-300" : ""}`}
            >
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
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
              <div className="text-xs text-slate-700 mt-1 truncate">
                📍 {p.hasExited ? "Escaped" : p.isDead ? "Dead" : roomName(p.currentRoomId)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
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
