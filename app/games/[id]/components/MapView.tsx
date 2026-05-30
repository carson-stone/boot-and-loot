"use client";

import { useState } from "react";
import type { MapView as MapData, PlayerSummary, RoomView } from "@/lib/game/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  map: MapData;
  players: PlayerSummary[];
  currentPlayerId: string;
  isMyTurn: boolean;
  movementRemaining: number;
  myTools: string[];
  onMove: (targetRoomId: string) => void;
  onPickupArtifact: (gameArtifactId: string) => void;
  onEscape: () => void;
}

export function MapView({ map, players, currentPlayerId, isMyTurn, movementRemaining, myTools, onMove, onPickupArtifact, onEscape }: Props) {
  const me = players.find((p) => p.id === currentPlayerId);
  const myRoomId = me?.currentRoomId;
  const [inspectArtifact, setInspectArtifact] = useState<RoomView["artifact"]>(null);

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

  // Room rect: x ± 64, y -38 to +46 (matches the <rect> dimensions)
  const ROOM_HW = 64; // half-width
  const ROOM_HT = 38; // half-height top
  const ROOM_HB = 46; // half-height bottom

  // Returns the point where a line from `center` toward `other` exits the room rectangle.
  function roomEdge(center: {x: number; y: number}, other: {x: number; y: number}) {
    const dx = other.x - center.x;
    const dy = other.y - center.y;
    if (dx === 0 && dy === 0) return center;
    const ts: number[] = [];
    if (dx > 0) ts.push(ROOM_HW / dx);
    else if (dx < 0) ts.push(-ROOM_HW / dx);
    if (dy > 0) ts.push(ROOM_HB / dy);
    else if (dy < 0) ts.push(ROOM_HT / (-dy));
    const t = Math.min(...ts);
    return { x: center.x + t * dx, y: center.y + t * dy };
  }

  const myRoom = map.rooms.find((r) => r.id === myRoomId);
  const reachableRoomIds = new Set(
    map.connections
      .filter((c) =>
        c.fromRoomId === myRoomId &&
        c.movementCost <= movementRemaining &&
        (!c.requiresTool || myTools.includes(c.requiresTool))
      )
      .map((c) => c.toRoomId),
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
            {/* Connections — deduplicate bidirectional pairs: only draw once per room pair */}
            {map.connections
              .filter((conn) => {
                // For bidirectional pairs, only keep the one where fromRoomId < toRoomId
                // (arbitrary but stable tiebreak so exactly one direction is drawn)
                const hasReverse = map.connections.some(
                  (c2) => c2.fromRoomId === conn.toRoomId && c2.toRoomId === conn.fromRoomId,
                );
                return !hasReverse || conn.fromRoomId < conn.toRoomId;
              })
              .map((conn, i) => {
              const from = map.rooms.find((r) => r.id === conn.fromRoomId);
              const to = map.rooms.find((r) => r.id === conn.toRoomId);
              if (!from || !to) return null;
              const fc = roomCenter(from);
              const tc = roomCenter(to);
              // Clip line to room edges so it doesn't visually pass through rooms
              const p1 = roomEdge(fc, tc);
              const p2 = roomEdge(tc, fc);
              // One-way = no reverse connection exists at all
              const isOneWay = !map.connections.some(
                (c2) => c2.fromRoomId === conn.toRoomId && c2.toRoomId === conn.fromRoomId,
              );
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;
              return (
                <g key={i}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={conn.requiresTool ? "#dc2626" : "#94a3b8"}
                    strokeWidth={conn.requiresTool ? 2 : 1}
                    strokeDasharray={conn.requiresTool ? "6,3" : undefined}
                  />
                  {isOneWay && (
                    <polygon
                      points={`${mx - 6},${my - 6} ${mx + 6},${my} ${mx - 6},${my + 6}`}
                      fill="#94a3b8"
                      transform={`rotate(${Math.atan2(tc.y - fc.y, tc.x - fc.x) * (180 / Math.PI)}, ${mx}, ${my})`}
                    />
                  )}
                  {conn.requiresTool && (
                    <text x={mx} y={my + 5} textAnchor="middle" fontSize="14">
                      🔑
                    </text>
                  )}
                  {conn.movementCost > 1 && (
                    <g>
                      <circle cx={mx} cy={my - (conn.requiresTool ? 18 : 0)} r={10} fill="#0f172a" opacity="0.75" />
                      <text
                        x={mx}
                        y={my - (conn.requiresTool ? 18 : 0) + 4}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill="white"
                      >
                        {conn.movementCost}
                      </text>
                    </g>
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
                    height={92}
                    fill={fill}
                    stroke={isReachable && isMyTurn ? "#0ea5e9" : "#cbd5e1"}
                    strokeWidth={isReachable && isMyTurn ? 2.5 : 1}
                    rx={8}
                  />
                  <text x={c.x} y={c.y - 20} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e293b">
                    {room.name}
                  </text>
                  <text x={c.x} y={c.y - 4} textAnchor="middle" fontSize="14" fill="#475569">
                    {room.isMarket && "🏪"}
                    {room.hasArtifactSlot && room.artifact && (
                      <>{"💎"}</>
                    )}
                    {room.monsterCount > 0 && `👹${room.monsterCount}`}
                    {room.isEntrance && "🚪"}
                  </text>
                  {/* Rep value beneath artifact icon — clickable */}
                  {room.artifact && (
                    <text
                      x={c.x}
                      y={c.y + 10}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="#be185d"
                      className="cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setInspectArtifact(room.artifact); }}
                    >
                      +{room.artifact.reputationPoints} rep ›
                    </text>
                  )}
                  {/* Player tokens — colored circles with initial, spread horizontally */}
                  {playersHere.map((p, idx) => {
                    const total = playersHere.length;
                    const spread = (total - 1) * 26;
                    const tx = c.x - spread / 2 + idx * 26;
                    const ty = c.y + 34;
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

        {/* Legend */}
        <div className="border-t border-slate-200 pt-2 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">Rooms:</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 mr-1 align-middle" />Your room</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300 mr-1 align-middle" />Entrance / Exit</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 mr-1 align-middle" />Market</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-pink-100 border border-pink-300 mr-1 align-middle" />Artifact</span>
          <span><span className="inline-block w-3 h-3 rounded-sm border-2 border-sky-400 mr-1 align-middle" />Reachable</span>
          <span>💎 Artifact present &nbsp; 👹 Monsters</span>
          <span className="font-semibold text-slate-900">Tunnels:</span>
          <span className="flex items-center gap-1">
            <svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#94a3b8" strokeWidth="1.5" /></svg>
            Normal
          </span>
          <span className="flex items-center gap-1">
            <svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#dc2626" strokeWidth="2" strokeDasharray="6,3" /></svg>
            Requires 🔑
          </span>
          <span className="flex items-center gap-1">
            <svg width="28" height="8">
              <line x1="0" y1="4" x2="22" y2="4" stroke="#94a3b8" strokeWidth="1.5" />
              <polygon points="16,1 22,4 16,7" fill="#94a3b8" />
            </svg>
            One-way
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold">2</span>
            Costs 2 movement
          </span>
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

      {/* Artifact inspect modal */}
      {inspectArtifact && (
        <Dialog open onOpenChange={(open) => !open && setInspectArtifact(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>💎 {inspectArtifact.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="text-2xl font-bold text-pink-700">+{inspectArtifact.reputationPoints} reputation</div>
              {inspectArtifact.description && (
                <p className="text-slate-700">{inspectArtifact.description}</p>
              )}
              {inspectArtifact.flavorText && (
                <p className="text-slate-500 italic border-l-2 border-slate-200 pl-3">{inspectArtifact.flavorText}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
