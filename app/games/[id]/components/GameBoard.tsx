"use client";

import { useState } from "react";
import type { GameView } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapView } from "./MapView";
import { HandDisplay } from "./HandDisplay";
import { MarketPanel } from "./MarketPanel";
import { PlayerStatusBar } from "./PlayerStatusBar";
import { ActionLog } from "./ActionLog";
import { ThreatResolver } from "./ThreatResolver";

interface Props {
  gameId: string;
  state: GameView;
  playerId: string | null;
  onPlayerSelect: (id: string) => void;
  onUpdate: () => void;
}

export function GameBoard({ gameId, state, playerId, onPlayerSelect, onUpdate }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [threatTarget, setThreatTarget] = useState<{ gameCardId: string; name: string } | null>(null);

  const me = state.players.find((p) => p.id === playerId);
  const isMyTurn = state.currentTurnPlayerId === playerId;
  const currentTurnPlayer = state.players.find((p) => p.id === state.currentTurnPlayerId);

  async function callApi(path: string, body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      onUpdate();
      return data;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }

  if (!playerId || !me) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold">Who are you?</h2>
          <p className="text-slate-600 text-sm">Choose your player to view the game:</p>
          <div className="space-y-2">
            {state.players.map((p) => (
              <Button key={p.id} variant="outline" className="w-full" onClick={() => onPlayerSelect(p.id)}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "finished") {
    const winner = state.players.find((p) => p.hasExited && !p.isDead);
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4">
          <h1 className="text-3xl font-bold">Game Over</h1>
          {winner ? (
            <p className="text-lg">
              <span className="font-semibold">{winner.name}</span> wins with {winner.currentHealth ?? 0} health remaining!
            </p>
          ) : (
            <p className="text-lg">The dungeon claimed everyone. No winner.</p>
          )}
          <div className="text-left mt-6">
            <h3 className="font-semibold mb-2">Final Standings:</h3>
            <ul className="space-y-1">
              {state.players
                .sort((a, b) => (b.reputationFinal ?? -1) - (a.reputationFinal ?? -1))
                .map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-slate-100 py-1">
                    <span>{p.name}</span>
                    <span className="text-slate-600">
                      {p.isDead ? "💀 dead (0 rep)" : `${p.reputationFinal ?? 0} reputation`}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto p-4 space-y-4">
        <PlayerStatusBar players={state.players} currentTurnPlayerId={state.currentTurnPlayerId} turnNumber={state.turnNumber} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-md px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {!isMyTurn && currentTurnPlayer && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-4 py-2 text-sm text-center">
            Waiting for <strong>{currentTurnPlayer.name}</strong>...
          </div>
        )}

        {/* Map row: action log + map side by side */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <ActionLog log={state.actionLog} />
          </div>
          <div className="col-span-9 space-y-3">
            <MapView
              map={state.map}
              players={state.players}
              currentPlayerId={playerId}
              isMyTurn={isMyTurn}
              onMove={(targetRoomId) => callApi("/move", { playerId, targetRoomId })}
              onPickupArtifact={(gameArtifactId) => callApi("/pickup-artifact", { playerId, gameArtifactId })}
              onEscape={() => callApi("/escape", { playerId })}
            />
            {isMyTurn && (
              <Button onClick={() => callApi("/end-turn", { playerId })} variant="default">
                End Turn
              </Button>
            )}
          </div>
        </div>

        {/* Market row: full width, three sections side by side */}
        <MarketPanel
          cardOffers={state.dynamicMarket}
          standardCards={state.staticMarket}
          isMyTurn={isMyTurn}
          myGold={me.gold}
          myRoomIsMarket={state.map.rooms.find((r) => r.id === me.currentRoomId)?.isMarket ?? false}
          myTools={me.tools}
          onBuyCard={(p) => callApi("/buy-card", { playerId, ...p })}
          onBuyTool={(toolCode) => callApi("/buy-tool", { playerId, toolCode })}
          onResolveThreat={(card) => setThreatTarget({ gameCardId: card.gameCardId, name: card.name })}
        />

        {/* Hand: full width */}
        <HandDisplay
          hand={state.myHand ?? []}
          isMyTurn={isMyTurn}
          onPlay={(gameCardId) => callApi("/play-card", { playerId, gameCardId })}
        />

        {threatTarget && (
          <ThreatResolver
            gameCardId={threatTarget.gameCardId}
            threatName={threatTarget.name}
            options={state.dynamicMarket.find((c) => c.gameCardId === threatTarget.gameCardId)?.resolutionOptions ?? []}
            onResolve={async (resolutionOptionId) => {
              await callApi("/resolve-threat", { playerId, gameCardId: threatTarget.gameCardId, resolutionOptionId });
              setThreatTarget(null);
            }}
            onClose={() => setThreatTarget(null)}
          />
        )}
      </div>
    </div>
  );
}
