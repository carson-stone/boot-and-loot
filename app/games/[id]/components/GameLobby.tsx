"use client";

import { useState } from "react";
import type { GameView } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    if (!playerName.trim()) {
      setError("Enter a name");
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to join");
      }
      const player = await res.json();
      onPlayerSelect(player.id);
      setPlayerName("");
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start");
      }
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const alreadyJoined = playerId && state.players.some((p) => p.id === playerId);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Boot &amp; Loot</h1>
          <p className="text-slate-600 mt-2">{state.map.name}</p>
          <p className="text-sm text-slate-500 mt-1">Game ID: {gameId}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-md px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Players ({state.players.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {state.players.length === 0 ? (
              <p className="text-slate-500">No players yet. Be the first!</p>
            ) : (
              <ul className="space-y-2">
                {state.players.map((p) => (
                  <li
                    key={p.id}
                    className={`px-3 py-2 rounded ${p.id === playerId ? "bg-slate-100 font-medium" : "bg-slate-50"}`}
                  >
                    {p.name}
                    {p.id === playerId && <span className="text-xs text-slate-500 ml-2">(you)</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {!alreadyJoined && (
          <Card>
            <CardHeader>
              <CardTitle>Join this game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your adventurer's name"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              />
              <Button onClick={handleJoin} disabled={joining} className="w-full">
                {joining ? "Joining..." : "Join Game"}
              </Button>
            </CardContent>
          </Card>
        )}

        {state.players.length >= 2 && (
          <Button onClick={handleStart} disabled={starting} className="w-full" size="lg">
            {starting ? "Starting..." : "Start Game"}
          </Button>
        )}
      </div>
    </div>
  );
}
