"use client";

import { useState } from "react";
import type { PlayerSummary, MyTurnStats, HandCardView } from "@/lib/game/types";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  players: PlayerSummary[];
  currentTurnPlayerId: string | null;
  turnNumber: number | null;
  myPlayerId: string | null;
  myStats: MyTurnStats | null;
}

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

export function PlayerStatusBar({ players, currentTurnPlayerId, turnNumber, myPlayerId, myStats }: Props) {
  const [inspecting, setInspecting] = useState<PlayerSummary | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900">Players</h2>
          {turnNumber && <Badge variant="secondary">Turn {turnNumber}</Badge>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {players.map((p) => {
            const isActive = p.id === currentTurnPlayerId;
            const isMe = p.id === myPlayerId;
            const color = PLAYER_COLORS[p.turnOrder] ?? "#64748b";
            return (
              <button
                key={p.id}
                className={`p-2 rounded border text-left w-full transition-colors hover:brightness-95 ${
                  isActive ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"
                } ${p.isDead ? "opacity-50" : ""} ${p.hasExited ? "bg-green-50 border-green-300" : ""}`}
                onClick={() => setInspecting(p)}
              >
                <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {p.name}
                  {isMe && <span className="text-[10px] text-slate-500 font-normal">(you)</span>}
                  {p.isDead && " 💀"}
                  {p.hasExited && " 🚪"}
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <Badge variant="destructive" className="text-xs">❤ {p.currentHealth}/{p.maxHealth}</Badge>
                  <Badge variant="gold" className="text-xs">💰 {p.gold}</Badge>
                  <Badge variant="attention" className="text-xs">👁 {p.attentionPoints}</Badge>
                </div>
                <div className="text-xs text-slate-700 mt-1">
                  Hand: {p.handCount} · Artifacts: {p.artifactCount}
                </div>
                {p.achievements.length > 0 && (
                  <div className="text-xs text-amber-700 mt-0.5">
                    🏆 {p.achievements.length} achievement{p.achievements.length !== 1 ? "s" : ""}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Current player's turn stats */}
        {myStats && (
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-3 text-xs text-slate-700">
            <span>⚡ <strong className="text-slate-900">{myStats.movementRemaining}</strong> movement</span>
            <span>⚔ <strong className="text-slate-900">{myStats.attacksRemaining}</strong> attacks</span>
            <span>🂠 <strong className="text-slate-900">{myStats.deckCount}</strong> in deck</span>
            <button
              className="underline text-slate-600 hover:text-slate-900"
              onClick={() => setDiscardOpen(true)}
            >
              🗂 {myStats.discardPile.length} in discard
            </button>
          </div>
        )}
      </div>

      {/* Player detail modal */}
      {inspecting && (
        <Dialog open onOpenChange={(open) => !open && setInspecting(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{inspecting.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="destructive">❤ {inspecting.currentHealth}/{inspecting.maxHealth} HP</Badge>
                <Badge variant="gold">💰 {inspecting.gold} gold</Badge>
                <Badge variant="attention">👁 {inspecting.attentionPoints} attention</Badge>
              </div>

              {inspecting.tools.length > 0 && (
                <div>
                  <div className="font-bold text-slate-900 mb-1">Tools</div>
                  <div className="flex gap-1 flex-wrap">
                    {inspecting.tools.map((t) => (
                      <Badge key={t} variant="secondary">{t.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {inspecting.artifacts.length > 0 && (
                <div>
                  <div className="font-bold text-slate-900 mb-1">Artifacts</div>
                  <ul className="space-y-1">
                    {inspecting.artifacts.map((a) => (
                      <li key={a.id} className="flex justify-between">
                        <span>{a.name}</span>
                        <Badge variant="secondary">+{a.reputationPoints} rep</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {inspecting.achievements.length > 0 && (
                <div>
                  <div className="font-bold text-slate-900 mb-1">Achievements</div>
                  <ul className="space-y-1">
                    {inspecting.achievements.map((a) => (
                      <li key={a.code} className="flex justify-between">
                        <span>🏆 {a.name}</span>
                        <Badge variant="secondary">+{a.reputationPoints} rep</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {inspecting.tools.length === 0 && inspecting.artifacts.length === 0 && inspecting.achievements.length === 0 && (
                <p className="text-slate-600">Nothing to show yet.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Discard pile modal */}
      {discardOpen && myStats && (
        <Dialog open onOpenChange={(open) => !open && setDiscardOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Discard Pile ({myStats.discardPile.length})</DialogTitle>
            </DialogHeader>
            {myStats.discardPile.length === 0 ? (
              <p className="text-sm text-slate-500">Empty</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {myStats.discardPile.map((card) => (
                  <DiscardCard key={card.gameCardId} card={card} />
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function DiscardCard({ card }: { card: HandCardView }) {
  return (
    <div className="border border-slate-200 rounded p-2 text-xs bg-slate-50">
      <div className="font-semibold text-slate-900">{card.name}</div>
      {card.description && <div className="text-slate-600 mt-0.5 text-[11px]">{card.description}</div>}
      <div className="flex gap-1 mt-1 flex-wrap">
        {card.effects.map((e, i) => (
          <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">
            {e.effectType.replace(/_/g, " ")} {e.amount ? `+${e.amount}` : ""}
          </Badge>
        ))}
      </div>
      {card.isOneTimeUse && <Badge variant="destructive" className="text-[10px] mt-1">one-time</Badge>}
    </div>
  );
}
