"use client";

import { useState } from "react";
import type { GameView } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { MapView } from "./MapView";
import { HoverHand } from "./HoverHand";
import { MarketPanel } from "./MarketPanel";
import { PlayerStatusBar } from "./PlayerStatusBar";
import { TurnRecap } from "./TurnRecap";
import { ActionLog } from "./ActionLog";
import { ThreatResolver } from "./ThreatResolver";
import type { MarketCardView } from "@/lib/game/types";

interface Props {
  gameId: string;
  state: GameView;
  playerId: string | null;
  onPlayerSelect: (id: string) => void;
  onUpdate: () => void;
}

export function GameBoard({ gameId, state, playerId, onPlayerSelect, onUpdate }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [threatTarget, setThreatTarget] = useState<{ gameCardId: string; name: string; options: MarketCardView["resolutionOptions"] } | null>(null);
  const [showLog, setShowLog] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h2 className="font-display text-2xl text-amber-300">Who are you?</h2>
          <p className="text-stone-400 text-sm">Choose your adventurer:</p>
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
    const sortedPlayers = state.players
      .map((p) => ({
        ...p,
        rep: p.artifacts.reduce((s, a) => s + a.reputationPoints, 0) + p.achievements.reduce((s, a) => s + a.reputationPoints, 0),
      }))
      .sort((a, b) => b.rep - a.rep);

    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-stone-800 border border-stone-600 rounded-xl p-8 text-center space-y-4 shadow-2xl">
          <h1 className="font-display text-4xl text-amber-300">The Dungeon Falls Silent</h1>
          <div className="mt-6 text-left">
            <h3 className="font-display text-sm text-amber-400 tracking-widest uppercase mb-3">Final Standings</h3>
            <ul className="space-y-2">
              {sortedPlayers.map((p, i) => (
                <li key={p.id} className="flex justify-between border-b border-stone-700 py-2">
                  <span className="text-stone-200">
                    {i === 0 && "👑 "}{p.name}{p.isDead ? " 💀" : ""}
                  </span>
                  <span className="text-amber-400 font-semibold">
                    {p.isDead ? "0 reputation" : `${p.rep} reputation`}
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
    <div className="min-h-screen bg-stone-950">
      {/* Sticky hand — fixed left edge */}
      <HoverHand
        hand={state.myHand ?? []}
        isMyTurn={isMyTurn}
        onPlay={(gameCardId) => callApi("/play-card", { playerId, gameCardId })}
      />

      <div className="max-w-[1400px] mx-auto px-4 py-3 space-y-3">
        {/* Player status */}
        <PlayerStatusBar
          players={state.players}
          currentTurnPlayerId={state.currentTurnPlayerId}
          turnNumber={state.turnNumber}
          myPlayerId={playerId}
          myStats={isMyTurn ? state.myStats : null}
        />

        {/* Turn banner */}
        {isMyTurn ? (
          <div className="flex items-center justify-between bg-amber-900/60 border border-amber-700 rounded-lg px-5 py-3">
            <span className="font-display text-amber-200 tracking-wide">⚡ Your Turn</span>
            <Button onClick={() => callApi("/end-turn", { playerId })} variant="outline" className="border-amber-600 text-amber-200 hover:bg-amber-800">
              End Turn →
            </Button>
          </div>
        ) : currentTurnPlayer && (
          <div className="bg-stone-800 border border-stone-600 rounded-lg px-5 py-3 text-center text-stone-400 text-sm">
            Waiting for <span className="text-amber-300 font-semibold">{currentTurnPlayer.name}</span>…
          </div>
        )}

        {/* Last turn recap (collapsed by default) */}
        <TurnRecap
          log={state.actionLog}
          currentTurnNumber={state.turnNumber}
          currentTurnPlayerId={state.currentTurnPlayerId}
        />

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Map — full width */}
        <MapView
          map={state.map}
          players={state.players}
          currentPlayerId={playerId}
          isMyTurn={isMyTurn}
          movementRemaining={isMyTurn ? (state.myStats?.movementRemaining ?? 0) : 0}
          myTools={me.tools}
          onMove={(targetRoomId) => callApi("/move", { playerId, targetRoomId })}
          onPickupArtifact={(gameArtifactId) => callApi("/pickup-artifact", { playerId, gameArtifactId })}
          onEscape={() => callApi("/escape", { playerId })}
        />

        {/* Market */}
        <MarketPanel
          cardOffers={state.dynamicMarket}
          standardCards={state.staticMarket}
          isMyTurn={isMyTurn}
          myGold={me.gold}
          myFocus={isMyTurn ? (state.myStats?.focusRemaining ?? 0) : 0}
          myRoomIsMarket={state.map.rooms.find((r) => r.id === me.currentRoomId)?.isMarket ?? false}
          myTools={me.tools}
          onBuyCard={(p) => callApi("/buy-card", { playerId, ...p })}
          onBuyTool={(toolCode) => callApi("/buy-tool", { playerId, toolCode })}
          onResolveThreat={(card) => setThreatTarget({ gameCardId: card.gameCardId, name: card.name, options: card.resolutionOptions })}
        />

        {/* Debug: action log toggle */}
        <div>
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
          >
            {showLog ? "▲ Hide" : "▼ Show"} action log
          </button>
          {showLog && (
            <div className="mt-2">
              <ActionLog log={state.actionLog} players={state.players} />
            </div>
          )}
        </div>
      </div>

      {threatTarget && (
        <ThreatResolver
          gameCardId={threatTarget.gameCardId}
          threatName={threatTarget.name}
          options={threatTarget.options}
          onResolve={async (resolutionOptionId) => {
            await callApi("/resolve-threat", { playerId, gameCardId: threatTarget.gameCardId, resolutionOptionId });
            setThreatTarget(null);
          }}
          onClose={() => setThreatTarget(null)}
        />
      )}
    </div>
  );
}
