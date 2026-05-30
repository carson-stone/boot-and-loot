"use client";

import { useState } from "react";
import type { PlayerSummary, MyTurnStats, HandCardView } from "@/lib/game/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameCardTile } from "./GameCardTile";

interface Props {
  players: PlayerSummary[];
  currentTurnPlayerId: string | null;
  turnNumber: number | null;
  myPlayerId: string | null;
  myStats: MyTurnStats | null;
  isMyTurn: boolean;
  onEndTurn: () => void;
}

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

export function PlayerStatusBar({ players, currentTurnPlayerId, turnNumber, myPlayerId, myStats, isMyTurn, onEndTurn }: Props) {
  const currentTurnPlayer = players.find((p) => p.id === currentTurnPlayerId);
  const [inspecting, setInspecting] = useState<PlayerSummary | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  return (
    <>
      <div className="bg-stone-900 border border-stone-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-sm font-semibold tracking-wide text-amber-200">Adventurers</h2>
          {turnNumber && <span className="text-xs text-stone-300 font-display tracking-wide">Turn {turnNumber}</span>}
        </div>

        {/* Turn callout */}
        {isMyTurn ? (
          <div className="flex items-center justify-between bg-amber-950/60 border border-amber-800 rounded px-3 py-1.5 mb-2">
            <span className="text-xs font-semibold text-amber-300">⚡ Your turn</span>
            <Button size="sm" variant="outline" className="h-6 text-xs border-amber-700 text-amber-300 hover:bg-amber-900 py-0 px-2" onClick={onEndTurn}>
              End Turn →
            </Button>
          </div>
        ) : currentTurnPlayer && (
          <div className="flex items-center bg-stone-800 border border-stone-700 rounded px-3 py-1.5 mb-2">
            <span className="text-xs text-stone-400">Waiting for <span className="text-amber-400 font-semibold">{currentTurnPlayer.name}</span>…</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {players.map((p) => {
            const isActive = p.id === currentTurnPlayerId;
            const isMe = p.id === myPlayerId;
            const color = PLAYER_COLORS[p.turnOrder] ?? "#64748b";
            return (
              <button
                key={p.id}
                onClick={() => setInspecting(p)}
                className={`p-2 rounded border text-left w-full transition-colors hover:border-amber-600 ${
                  isActive ? "border-amber-600 bg-amber-950/40" : "border-stone-600 bg-stone-800"
                } ${p.isDead ? "opacity-40" : ""} ${p.hasExited ? "border-green-700 bg-green-950/20" : ""}`}
              >
                <div className="text-sm font-semibold text-stone-100 truncate flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {p.name}
                  {isMe && <span className="text-[9px] text-stone-300 font-normal">(you)</span>}
                  {p.isDead && " 💀"}
                  {p.hasExited && " 🚪"}
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <Badge variant="destructive" className="text-[10px]">❤ {p.currentHealth}/{p.maxHealth}</Badge>
                  <Badge variant="gold" className="text-[10px]">💰 {p.gold}</Badge>
                  <Badge variant="attention" className="text-[10px]">👁 {p.attentionPoints}</Badge>
                </div>
                <div className="text-[10px] text-stone-300 mt-1">
                  Hand: {p.handCount} · Artifacts: {p.artifactCount}
                  {p.achievements.length > 0 && ` · 🏆${p.achievements.length}`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Current player turn resources */}
        {myStats && (
          <div className="mt-2 pt-2 border-t border-stone-700 flex flex-wrap gap-3 text-xs text-stone-400">
            <span>🔵 <strong className="text-stone-200">{myStats.focusRemaining}</strong> focus</span>
            <span>⚡ <strong className="text-stone-200">{myStats.movementRemaining}</strong> movement</span>
            <span>⚔ <strong className="text-stone-200">{myStats.attacksRemaining}</strong> attacks</span>
            <span>🂠 <strong className="text-stone-200">{myStats.deckCount}</strong> in deck</span>
            <button
              className="text-stone-300 underline hover:text-stone-300"
              onClick={() => setDiscardOpen(true)}
            >
              🗂 {myStats.discardPile.length} discarded
            </button>
          </div>
        )}
      </div>

      {/* Player inspect modal */}
      {inspecting && (
        <Dialog open onOpenChange={(open) => !open && setInspecting(null)}>
          <DialogContent className="max-w-md bg-stone-900 border-stone-600">
            <DialogHeader>
              <DialogTitle className="font-display text-amber-300">{inspecting.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="destructive">❤ {inspecting.currentHealth}/{inspecting.maxHealth}</Badge>
                <Badge variant="gold">💰 {inspecting.gold} gold</Badge>
                <Badge variant="attention">👁 {inspecting.attentionPoints}</Badge>
              </div>

              {inspecting.tools.length > 0 && (
                <div>
                  <div className="font-bold text-amber-400 text-xs uppercase tracking-wider mb-1.5">Tools</div>
                  <div className="flex gap-1 flex-wrap">
                    {inspecting.tools.map((t) => (
                      <Badge key={t} variant="secondary">{t.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {inspecting.artifacts.length > 0 && (
                <div>
                  <div className="font-bold text-amber-400 text-xs uppercase tracking-wider mb-1.5">Artifacts</div>
                  <ul className="space-y-1">
                    {inspecting.artifacts.map((a) => (
                      <li key={a.id} className="flex justify-between">
                        <span className="text-stone-300">{a.name}</span>
                        <Badge variant="gold">+{a.reputationPoints} rep</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {inspecting.achievements.length > 0 && (
                <div>
                  <div className="font-bold text-amber-400 text-xs uppercase tracking-wider mb-1.5">Achievements</div>
                  <ul className="space-y-1">
                    {inspecting.achievements.map((a) => (
                      <li key={a.code} className="flex justify-between">
                        <span className="text-stone-300">🏆 {a.name}</span>
                        <Badge variant="gold">+{a.reputationPoints} rep</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {inspecting.tools.length === 0 && inspecting.artifacts.length === 0 && inspecting.achievements.length === 0 && (
                <p className="text-stone-300 italic">Nothing to show yet.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Discard pile modal */}
      {discardOpen && myStats && (
        <Dialog open onOpenChange={(open) => !open && setDiscardOpen(false)}>
          <DialogContent className="max-w-4xl bg-stone-900 border-stone-600">
            <DialogHeader>
              <DialogTitle className="font-display text-amber-300">Discard Pile ({myStats.discardPile.length})</DialogTitle>
            </DialogHeader>
            {myStats.discardPile.length === 0 ? (
              <p className="text-sm text-stone-300 italic">Empty</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {myStats.discardPile.map((card: HandCardView) => (
                  <GameCardTile key={card.gameCardId} card={card} />
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
