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

  // Load player ID from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`game-${gameId}-player`);
    setPlayerId(stored);
  }, [gameId]);

  // Polling
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
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-md px-6 py-4">
          {error}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-slate-500">Loading game...</div>
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
