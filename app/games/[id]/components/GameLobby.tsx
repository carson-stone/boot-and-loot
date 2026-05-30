"use client";

import { useState } from "react";
import type { GameView } from "@/lib/game/types";
import { Button } from "@/components/ui/button";

interface Props {
  gameId: string;
  state: GameView;
  playerId: string | null;
  onPlayerSelect: (id: string) => void;
  onUpdate: () => void;
}

export function GameLobby({ gameId, state, playerId, onPlayerSelect, onUpdate }: Props) {
  const [playerName, setPlayerName] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (!playerName.trim()) { setError("Enter a name"); return; }
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerName }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      const player = await res.json();
      onPlayerSelect(player.id);
      setPlayerName("");
      onUpdate();
    } catch (e) { setError((e as Error).message); } finally { setJoining(false); }
  }

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      onUpdate();
    } catch (e) { setError((e as Error).message); } finally { setStarting(false); }
  }

  const alreadyJoined = playerId && state.players.some((p) => p.id === playerId);
  const inputCls = "w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-sm text-stone-200 placeholder:text-stone-300 focus:outline-none focus:border-amber-600";

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center">
          <h1 className="font-display text-4xl text-amber-300 tracking-wider">Boot &amp; Loot</h1>
          <p className="text-stone-300 text-sm mt-1">{state.map.name}</p>
          <p className="text-stone-400 text-xs mt-0.5">Game ID: {gameId}</p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded px-3 py-2 text-sm">{error}</div>
        )}

        {/* Quick test: open as Player 2 */}
        {state.players.length === 1 && (
          <button
            onClick={() => window.open(`/games/${gameId}?autoJoin=Player+2`, "_blank")}
            className="w-full border border-dashed border-stone-600 rounded py-2 text-sm text-stone-300 hover:border-amber-700 hover:text-amber-500 transition-colors"
          >
            ⚡ Open as Player 2 →
          </button>
        )}

        {/* Player list */}
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-amber-400 text-sm tracking-wide">
            Adventurers ({state.players.length} / {state.map.name ? 5 : "?"})
          </h2>
          {state.players.length === 0 ? (
            <p className="text-stone-300 text-sm italic">No one yet. Be the first.</p>
          ) : (
            <ul className="space-y-1.5">
              {state.players.map((p) => (
                <li key={p.id} className={`px-3 py-1.5 rounded text-sm ${p.id === playerId ? "bg-stone-700 text-stone-100 font-semibold" : "text-stone-400"}`}>
                  {p.name}
                  {p.id === playerId && <span className="text-xs text-stone-300 ml-2">(you)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Join form */}
        {!alreadyJoined && (
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-5 space-y-3">
            <h2 className="font-display text-amber-400 text-sm tracking-wide">Enter the Dungeon</h2>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Your adventurer's name"
              className={inputCls}
            />
            <Button onClick={handleJoin} disabled={joining} className="w-full">
              {joining ? "Entering…" : "Join Game"}
            </Button>
          </div>
        )}

        {/* Start */}
        {state.players.length >= 2 && (
          <Button onClick={handleStart} disabled={starting} className="w-full" size="lg">
            {starting ? "Opening the dungeon…" : "⚔ Start Game"}
          </Button>
        )}
      </div>
    </div>
  );
}
