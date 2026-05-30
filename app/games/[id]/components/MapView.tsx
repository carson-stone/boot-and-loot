"use client";

import type { MapView as MapData, PlayerSummary } from "@/lib/game/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  map: MapData;
  players: PlayerSummary[];
  currentPlayerId: string;
  isMyTurn: boolean;
  onMove: (targetRoomId: string) => void;
  onPickupArtifact: (gameArtifactId: string) => void;
  onEscape: () => void;
}

export function MapView({ map, players, currentPlayerId, isMyTurn, onMove, onPickupArtifact, onEscape }: Props) {
  const me = players.find((p) => p.id === currentPlayerId);
  const myRoomId = me?.currentRoomId;

  // Cell dimensions
  const cellSize = 150;
  const padding = 24;

  const maxX = Math.max(...map.rooms.map((r) => r.positionX ?? 0));
  const maxY = Math.max(...map.rooms.map((r) => r.positionY ?? 0));
  const svgWidth = (maxX + 1) * cellSize + padding * 2;
  const svgHeight = (maxY + 1) * cellSize + padding * 2;

  function roomCenter(room: typeof map.rooms[number]) {
    return {
      x: (room.positionX ?? 0) * cellSize + padding + cellSize / 2,
      y: (room.positionY ?? 0) * cellSize + padding + cellSize / 2,
    };
  }

  const myRoom = map.rooms.find((r) => r.id === myRoomId);
  const reachableRoomIds = new Set(
    map.connections.filter((c) => c.fromRoomId === myRoomId).map((c) => c.toRoomId),
  );

  // Stable color per player by turn order
  const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];
  function playerColor(p: PlayerSummary) {
    return PLAYER_COLORS[p.turnOrder] ?? "#64748b";
  }

  return (
    <Card>
      <CardContent className="p-2">
        <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
          <svg width={svgWidth} height={svgHeight} className="block">
            {/* Connections */}
            {map.connections.map((conn, i) => {
              const from = map.rooms.find((r) => r.id === conn.fromRoomId);
              const to = map.rooms.find((r) => r.id === conn.toRoomId);
              if (!from || !to) return null;
              const fc = roomCenter(from);
              const tc = roomCenter(to);
              const isOneWay = !map.connections.some(
                (c2) => c2.fromRoomId === conn.toRoomId && c2.toRoomId === conn.fromRoomId,
              );
              return (
                <g key={i}>
                  <line
                    x1={fc.x}
                    y1={fc.y}
                    x2={tc.x}
                    y2={tc.y}
                    stroke={conn.requiresTool ? "#dc2626" : "#94a3b8"}
                    strokeWidth={conn.requiresTool ? 2 : 1}
                    strokeDasharray={conn.requiresTool ? "4,2" : undefined}
                  />
                  {isOneWay && (
                    <polygon
                      points={`${(fc.x + tc.x) / 2 - 6},${(fc.y + tc.y) / 2 - 6} ${(fc.x + tc.x) / 2 + 6},${(fc.y + tc.y) / 2} ${(fc.x + tc.x) / 2 - 6},${(fc.y + tc.y) / 2 + 6}`}
                      fill="#94a3b8"
                      transform={`rotate(${Math.atan2(tc.y - fc.y, tc.x - fc.x) * (180 / Math.PI)}, ${(fc.x + tc.x) / 2}, ${(fc.y + tc.y) / 2})`}
                    />
                  )}
                </g>
              );
            })}

            {/* Rooms */}
            {map.rooms.map((room) => {
              const c = roomCenter(room);
              const isMyRoom = room.id === myRoomId;
              const isReachable = reachableRoomIds.has(room.id);
              const playersHere = players.filter(
                (p) => p.currentRoomId === room.id && !p.hasExited && !p.isDead,
              );

              let fill = "#f1f5f9";
              if (isMyRoom) fill = "#fef3c7";
              else if (room.isEntrance) fill = "#d1fae5";
              else if (room.isMarket) fill = "#dbeafe";
              else if (room.hasArtifactSlot && room.artifact) fill = "#fce7f3";

              return (
                <g
                  key={room.id}
                  className={isMyTurn && isReachable ? "cursor-pointer" : ""}
                  onClick={() => {
                    if (isMyTurn && isReachable) onMove(room.id);
                  }}
                >
                  <rect
                    x={c.x - 64}
                    y={c.y - 38}
                    width={128}
                    height={84}
                    fill={fill}
                    stroke={isReachable && isMyTurn ? "#0ea5e9" : "#cbd5e1"}
                    strokeWidth={isReachable && isMyTurn ? 2.5 : 1}
                    rx={8}
                  />
                  <text x={c.x} y={c.y - 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">
                    {room.name}
                  </text>
                  <text x={c.x} y={c.y - 6} textAnchor="middle" fontSize="11" fill="#475569">
                    {room.isMarket && "🏪"}
                    {room.hasArtifactSlot && room.artifact && "💎"}
                    {room.monsterCount > 0 && `👹${room.monsterCount}`}
                    {room.isEntrance && "🚪"}
                  </text>
                  {/* Player tokens — colored circles with initial, spread horizontally */}
                  {playersHere.map((p, idx) => {
                    const total = playersHere.length;
                    const spread = (total - 1) * 26;
                    const tx = c.x - spread / 2 + idx * 26;
                    const ty = c.y + 24;
                    const isMe = p.id === currentPlayerId;
                    return (
                      <g key={p.id}>
                        {isMe && <circle cx={tx} cy={ty} r={15} fill="white" stroke={playerColor(p)} strokeWidth={2.5} />}
                        <circle cx={tx} cy={ty} r={11} fill={playerColor(p)} />
                        <text
                          x={tx}
                          y={ty + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill="white"
                        >
                          {p.name[0]?.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Current room actions */}
        {myRoom && (
          <div className="border-t border-slate-200 pt-3 mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <span className="text-slate-600">You're in:</span>{" "}
              <span className="font-semibold text-slate-900">{myRoom.name}</span>
              {myRoom.monsterCount > 0 && (
                <Badge variant="threat" className="ml-2">
                  {myRoom.monsterCount} monster{myRoom.monsterCount > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {myRoom.artifact && me && me.artifactCount < (me.tools.includes("backpack") ? 2 : 1) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isMyTurn}
                  onClick={() => onPickupArtifact(myRoom.artifact!.id)}
                >
                  Grab {myRoom.artifact.name} (+{myRoom.artifact.reputationPoints})
                </Button>
              )}
              {myRoom.isExit && (
                <Button size="sm" variant="default" disabled={!isMyTurn} onClick={onEscape}>
                  🚪 Escape!
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
