"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinGameId, setJoinGameId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState<string | null>(null);

  async function handleQuickTest() {
    setError(null);
    setTesting(true);
    try {
      const gameRes = await fetch("/api/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapName: "The Sunken Crypt", maxPlayers: 2 }) });
      if (!gameRes.ok) throw new Error("Failed to create game");
      const game = await gameRes.json();
      const p1Res = await fetch(`/api/games/${game.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerName: "Player 1" }) });
      if (!p1Res.ok) throw new Error("Failed to join");
      const p1 = await p1Res.json();
      localStorage.setItem(`game-${game.id}-player`, p1.id);
      router.push(`/games/${game.id}`);
    } catch (e) { setError((e as Error).message); } finally { setTesting(false); }
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapName: "The Sunken Crypt", maxPlayers }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      const game = await res.json();
      router.push(`/games/${game.id}`);
    } catch (e) { setError((e as Error).message); } finally { setCreating(false); }
  }

  async function handleJoin() {
    setError(null);
    if (!joinGameId || !playerName) { setError("Game ID and name required"); return; }
    setJoining(true);
    try {
      const res = await fetch(`/api/games/${joinGameId}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerName }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      const player = await res.json();
      localStorage.setItem(`game-${joinGameId}-player`, player.id);
      router.push(`/games/${joinGameId}`);
    } catch (e) { setError((e as Error).message); } finally { setJoining(false); }
  }

  const inputCls = "w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-sm text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-600";
  const panelCls = "bg-stone-800 border border-stone-700 rounded-xl p-6 space-y-4";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-5xl text-amber-300 tracking-wider">Boot &amp; Loot</h1>
          <p className="text-stone-400 text-sm tracking-wide">A multiplayer deck-building dungeon crawler · 2–5 players</p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg px-4 py-2 text-sm text-center">{error}</div>
        )}

        {/* Quick test */}
        <button
          onClick={handleQuickTest}
          disabled={testing}
          className="w-full border border-dashed border-stone-600 rounded-lg py-3 text-sm text-stone-500 hover:border-amber-700 hover:text-amber-500 transition-colors"
        >
          {testing ? "Setting up…" : "⚡ Quick Test — 2-player game, join as Player 1"}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Create */}
          <div className={panelCls}>
            <h2 className="font-display text-amber-400 tracking-wide">Descend</h2>
            <div>
              <label className="text-xs text-stone-400 block mb-1 tracking-wide uppercase">Party size</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className={inputCls}
              >
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} adventurers</option>)}
              </select>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "Opening the dungeon…" : "Create Game"}
            </Button>
          </div>

          {/* Join */}
          <div className={panelCls}>
            <h2 className="font-display text-amber-400 tracking-wide">Join the Fray</h2>
            <div>
              <label className="text-xs text-stone-400 block mb-1 tracking-wide uppercase">Game ID</label>
              <input value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} placeholder="Paste game ID" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1 tracking-wide uppercase">Your name</label>
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your adventurer's name" className={inputCls} />
            </div>
            <Button onClick={handleJoin} disabled={joining} variant="outline" className="w-full">
              {joining ? "Entering…" : "Join Game"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
