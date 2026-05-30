"use client";

import { useEffect, useState, useCallback, use } from "react";
import type { GameView } from "@/lib/game/types";
import { GameLobby } from "./components/GameLobby";
import { GameBoard } from "./components/GameBoard";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = use(params);
  const [state, setState] = useState<GameView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load player ID from localStorage; handle ?autoJoin=Name param
  useEffect(() => {
    const stored = localStorage.getItem(`game-${gameId}-player`);
    if (stored) {
      setPlayerId(stored);
      return;
    }
    const autoJoin = new URLSearchParams(window.location.search).get("autoJoin");
    if (autoJoin) {
      fetch(`/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerName: autoJoin }),
      })
        .then((r) => r.json())
        .then((player) => {
          if (player.id) {
            localStorage.setItem(`game-${gameId}-player`, player.id);
            setPlayerId(player.id);
            // Clean up URL param
            window.history.replaceState({}, "", `/games/${gameId}`);
          }
        })
        .catch(() => {});
    }
  }, [gameId]);

  const fetchState = useCallback(async () => {
    try {
      const url = playerId
        ? `/api/games/${gameId}?playerId=${playerId}`
        : `/api/games/${gameId}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load game");
        return;
      }
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [gameId, playerId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2500);
    return () => clearInterval(interval);
  }, [fetchState]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg px-6 py-4">
            {error}
          </div>
          <a
            href="/"
            className="inline-block text-sm text-amber-400 hover:text-amber-300 underline underline-offset-4"
          >
            ← Back to main menu
          </a>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-stone-500">Loading game...</div>
      </div>
    );
  }

  function setActivePlayer(id: string) {
    localStorage.setItem(`game-${gameId}-player`, id);
    setPlayerId(id);
  }

  if (state.status === "waiting") {
    return (
      <GameLobby
        gameId={gameId}
        state={state}
        playerId={playerId}
        onPlayerSelect={setActivePlayer}
        onUpdate={fetchState}
      />
    );
  }

  return (
    <GameBoard
      gameId={gameId}
      state={state}
      playerId={playerId}
      onPlayerSelect={setActivePlayer}
      onUpdate={fetchState}
    />
  );
}
