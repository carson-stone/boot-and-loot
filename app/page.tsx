"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      const gameRes = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapName: "The Sunken Crypt", maxPlayers: 2 }),
      });
      if (!gameRes.ok) throw new Error("Failed to create game");
      const game = await gameRes.json();

      const p1Res = await fetch(`/api/games/${game.id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerName: "Player 1" }),
      });
      if (!p1Res.ok) throw new Error("Failed to join as Player 1");
      const p1 = await p1Res.json();

      localStorage.setItem(`game-${game.id}-player`, p1.id);
      router.push(`/games/${game.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapName: "The Sunken Crypt", maxPlayers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create game");
      }
      const game = await res.json();
      router.push(`/games/${game.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    setError(null);
    if (!joinGameId || !playerName) {
      setError("Game ID and player name required");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/games/${joinGameId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to join game");
      }
      const player = await res.json();
      // Store player ID in localStorage for later use
      localStorage.setItem(`game-${joinGameId}-player`, player.id);
      router.push(`/games/${joinGameId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Boot &amp; Loot</h1>
          <p className="text-slate-600 mt-2">A multiplayer turn-based deck-building dungeon crawler</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-md px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleQuickTest}
          disabled={testing}
          className="w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
        >
          {testing ? "Setting up..." : "⚡ Quick Test — 2-player game, join as Player 1"}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Create a new game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Max players</label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} players</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? "Creating..." : "Create Game"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Join a game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Game ID</label>
                <input
                  value={joinGameId}
                  onChange={(e) => setJoinGameId(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder="Paste game ID"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Your name</label>
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder="Your adventurer's name"
                />
              </div>
              <Button onClick={handleJoin} disabled={joining} variant="outline" className="w-full">
                {joining ? "Joining..." : "Join Game"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
