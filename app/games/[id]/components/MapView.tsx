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
    <Card className="h-full flex flex-col">
      <CardContent className="p-2 flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="overflow-auto flex-1 min-h-0">
          <svg width={svgWidth} height={svgHeight} className="block" style={{ background: "#141210" }}>
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
              // One-way = no reverse connection exists at all
              const isOneWay = !map.connections.some(
                (c2) => c2.fromRoomId === conn.toRoomId && c2.toRoomId === conn.fromRoomId,
              );
              const mx = (fc.x + tc.x) / 2;
              const my = (fc.y + tc.y) / 2;
              return (
                <g key={i}>
                  <line
                    x1={fc.x}
                    y1={fc.y}
                    x2={tc.x}
                    y2={tc.y}
                    stroke={conn.requiresTool ? "#dc2626" : "#57534e"}
                    strokeWidth={conn.requiresTool ? 2 : 1.5}
                  />
                  {isOneWay && (
                    <polygon
                      points={`${mx - 6},${my - 6} ${mx + 6},${my} ${mx - 6},${my + 6}`}
                      fill="#57534e"
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

              let fill = "#3a3028";
              if (isMyRoom) fill = "#6b4418";
              else if (room.isEntrance) fill = "#1e4a28";
              else if (room.isMarket) fill = "#1e284a";

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
                    stroke={isReachable && isMyTurn ? "#c9a84c" : "#57534e"}
                    strokeWidth={isReachable && isMyTurn ? 2.5 : 1}
                    rx={8}
                  />
                  <text x={c.x} y={c.y - 20} textAnchor="middle" fontSize="13" fontWeight="700" fill="#e8d5b0">
                    {room.name}
                  </text>
                  <text x={c.x} y={c.y - 4} textAnchor="middle" fontSize="14" fill="#a8956e">
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
        <div className="border-t border-stone-700 pt-2 mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-stone-300">
          <span className="font-display text-stone-200 tracking-wide">Rooms:</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded-sm" style={{background:"#6b4418"}} /> Current room</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded-sm" style={{background:"#1e4a28"}} /> Entrance</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded-sm" style={{background:"#1e284a"}} /> Market</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded-sm border-2" style={{borderColor:"#c9a84c", background:"transparent"}} /> Reachable</span>
          <span>💎 Artifact &nbsp; 👹 Monsters</span>
          <span className="font-display text-stone-200 tracking-wide">Tunnels:</span>
          <span className="flex items-center gap-1">
            <svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#dc2626" strokeWidth="2.5" /></svg>
            Requires 🔑
          </span>
          <span className="flex items-center gap-1">
            <svg width="28" height="8">
              <line x1="0" y1="4" x2="22" y2="4" stroke="#57534e" strokeWidth="1.5" />
              <polygon points="16,1 22,4 16,7" fill="#57534e" />
            </svg>
            One-way
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-stone-700 text-stone-200 text-[9px] font-bold">2</span>
            Costs 2 movement
          </span>
        </div>


        {/* Current room actions */}
        {myRoom && (
          <div className="border-t border-stone-700 pt-3 mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <span className="text-stone-400">You're in:</span>{" "}
              <span className="font-semibold text-stone-100">{myRoom.name}</span>
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
              {myRoom.isExit && me && me.artifactCount > 0 && (
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
