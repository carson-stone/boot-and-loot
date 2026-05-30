"use client";

import { useState } from "react";
import type { GameView } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { MapView } from "./MapView";
import { HoverHand } from "./HoverHand";
import { LootSection, EssentialsSection, ToolsSection } from "./MarketPanel";
import { GameCardTile } from "./GameCardTile";
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
  const myRoom = state.map.rooms.find((r) => r.id === me?.currentRoomId);

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
    const sorted = state.players
      .map((p) => ({ ...p, rep: p.artifacts.reduce((s, a) => s + a.reputationPoints, 0) + p.achievements.reduce((s, a) => s + a.reputationPoints, 0) }))
      .sort((a, b) => b.rep - a.rep);
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-stone-800 border border-stone-600 rounded-xl p-8 text-center space-y-4 shadow-2xl">
          <h1 className="font-display text-4xl text-amber-300">The Dungeon Falls Silent</h1>
          <ul className="mt-6 text-left space-y-2">
            {sorted.map((p, i) => (
              <li key={p.id} className="flex justify-between border-b border-stone-700 py-2">
                <span className="text-stone-200">{i === 0 && "👑 "}{p.name}{p.isDead ? " 💀" : ""}</span>
                <span className="text-amber-400 font-semibold">{p.isDead ? "0 rep" : `${p.rep} rep`}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const cardProps = {
    isMyTurn,
    myGold: me.gold,
    myFocus: isMyTurn ? (state.myStats?.focusRemaining ?? 0) : 0,
    onBuyCard: (p: { gameCardId?: string; cardDefinitionId?: string }) => callApi("/buy-card", { playerId, ...p }),
    onResolveThreat: (card: MarketCardView) => setThreatTarget({ gameCardId: card.gameCardId, name: card.name, options: card.resolutionOptions }),
  };

  return (
    <div className="h-screen bg-stone-950 flex flex-col overflow-hidden">
      {/* Full-width top bar */}
      <div className="px-4 pt-3 space-y-3">
        <PlayerStatusBar
          players={state.players}
          currentTurnPlayerId={state.currentTurnPlayerId}
          turnNumber={state.turnNumber}
          myPlayerId={playerId}
          myStats={isMyTurn ? state.myStats : null}
          isMyTurn={isMyTurn}
          onEndTurn={() => callApi("/end-turn", { playerId })}
        />

        <TurnRecap log={state.actionLog} currentTurnNumber={state.turnNumber} currentTurnPlayerId={state.currentTurnPlayerId} />

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg px-4 py-2 text-sm">{error}</div>
        )}
      </div>

      {/* 4/5-column content area */}
      <div className="flex gap-3 px-4 pb-4 pt-3 flex-1 min-h-0 overflow-hidden">
        {/* Col 1: Hand (collapses to tab) */}
        <HoverHand
          hand={state.myHand ?? []}
          isMyTurn={isMyTurn}
          onPlay={(gameCardId) => callApi("/play-card", { playerId, gameCardId })}
        />

        {/* Col 2: Map */}
        <div className="flex-1 min-w-0">
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
          {/* Debug log below map */}
          <div className="mt-2">
            <button onClick={() => setShowLog(!showLog)} className="text-xs text-stone-500 hover:text-stone-300 transition-colors">
              {showLog ? "▲ Hide" : "▼ Show"} action log
            </button>
            {showLog && <div className="mt-2"><ActionLog log={state.actionLog} players={state.players} /></div>}
          </div>
        </div>

        {/* Col 3: Loot + Essentials — same height as siblings, scrollable */}
        <div className="w-56 shrink-0 self-stretch flex flex-col bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
          <div className="overflow-y-auto flex-1 min-h-0">
            {/* Loot */}
            <div className="px-2 pt-3 pb-1 sticky top-0 bg-stone-900 z-10 border-b border-stone-800">
              <span className="font-display text-sm font-semibold tracking-wide text-amber-200">Loot</span>
            </div>
            <div className="px-2 py-2 flex flex-col gap-2">
              {state.dynamicMarket.length === 0
                ? <p className="text-xs text-stone-400 italic">Empty</p>
                : state.dynamicMarket.map((card) =>
                    card.isKillableThreat ? (
                      <GameCardTile key={card.gameCardId} card={card} action={{ label: "Resolve", variant: "destructive", disabled: !isMyTurn, onClick: () => cardProps.onResolveThreat(card) }} />
                    ) : (
                      <GameCardTile key={card.gameCardId} card={card} action={{ label: card.isOneTimeUse ? "Use" : "Buy", variant: "outline", disabled: !isMyTurn || cardProps.myFocus < card.costFocus || cardProps.myGold < card.costGold, onClick: () => cardProps.onBuyCard({ gameCardId: card.gameCardId }) }} />
                    )
                  )
              }
            </div>
            {/* Essentials */}
            <div className="px-2 pt-2 pb-1 sticky top-[37px] bg-stone-900 z-10 border-t border-b border-stone-800">
              <span className="font-display text-sm font-semibold tracking-wide text-amber-200">Essentials</span>
            </div>
            <div className="px-2 py-2 flex flex-col gap-2">
              {state.staticMarket.map((card) => (
                <GameCardTile key={card.cardDefinitionId} card={{ ...card, available: card.available }} action={{ label: "Buy", variant: "outline", disabled: !isMyTurn || cardProps.myFocus < card.costFocus || cardProps.myGold < card.costGold || card.available === 0, onClick: () => cardProps.onBuyCard({ cardDefinitionId: card.cardDefinitionId }) }} />
              ))}
            </div>
          </div>
        </div>

        {/* Col 4: Market (tools) */}
        <div className="w-56 shrink-0">
          <ToolsSection
            isMyTurn={isMyTurn}
            myGold={me.gold}
            myRoomIsMarket={myRoom?.isMarket ?? false}
            myTools={me.tools}
            onBuyTool={(toolCode) => callApi("/buy-tool", { playerId, toolCode })}
          />
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
