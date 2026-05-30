"use client";

import { useState } from "react";
import type { ActionLogView } from "@/lib/game/types";

interface Props {
  log: ActionLogView[];
  currentTurnNumber: number | null;
  currentTurnPlayerId: string | null;
}

function buildNarrative(entries: ActionLogView[]): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < entries.length) {
    const e = entries[i]!;
    const d = e.details as Record<string, unknown>;

    if (e.type === "play_card") {
      const name = (d.card_name as string) ?? "a card";
      const effects: string[] = [];
      while (i + 1 < entries.length && entries[i + 1]!.type === "effect_resolved") {
        i++;
        const ed = entries[i]!.details as Record<string, unknown>;
        const ef = ed.effect_type as string;
        const amt = (ed.amount ?? 0) as number;
        if (ef === "gain_gold") effects.push(`+${amt} gold`);
        else if (ef === "gain_focus") effects.push(`+${amt} focus`);
        else if (ef === "gain_movement") effects.push(`+${amt} movement`);
        else if (ef === "gain_attack") effects.push(`+${amt} attack`);
        else if (ef === "draw_cards") effects.push(`drew ${amt}`);
        else if (ef === "heal") effects.push(`healed ${amt}`);
        else if (ef === "remove_attention") effects.push(`−${amt} attention`);
        else if (ef === "all_others_gain_attention") effects.push(`others +${amt} attention`);
      }
      lines.push(`Played ${name}${effects.length ? ` → ${effects.join(", ")}` : ""}`);
    } else if (e.type === "move") {
      const to = (d.to_room_name ?? d.to_room_id) as string;
      const dmg = d.damage_taken as number | undefined;
      lines.push(`Moved to ${to}${dmg ? ` (took ${dmg} damage)` : ""}`);
    } else if (e.type === "buy_card") {
      const name = (d.card_name ?? "a card") as string;
      const f = (d.focus_paid as number) ?? 0;
      const g = (d.gold_paid as number) ?? 0;
      const cost = [f > 0 && `${f}F`, g > 0 && `${g}G`].filter(Boolean).join("+");
      lines.push(`Bought ${name}${cost ? ` (${cost})` : ""}`);
    } else if (e.type === "buy_tool") {
      lines.push(`Bought ${(d.tool_name ?? d.tool_code) as string}`);
    } else if (e.type === "pickup_artifact") {
      lines.push(`Picked up ${(d.artifact_name ?? "an artifact") as string}`);
    } else if (e.type === "defeat_threat") {
      lines.push(`Defeated ${(d.threat_name ?? "a threat") as string} via ${d.label as string}`);
    } else if (e.type === "horde_attack") {
      lines.push(`⚠️ Horde attack!`);
    } else if (e.type === "escape") {
      lines.push(`🚪 Escaped the dungeon`);
    }
    i++;
  }
  return lines;
}

export function TurnRecap({ log, currentTurnNumber, currentTurnPlayerId }: Props) {
  const [open, setOpen] = useState(false);

  if (!currentTurnNumber || currentTurnNumber <= 1) return null;

  const prevTurnNumber = currentTurnNumber - 1;
  const prevEntries = log.filter((e) => e.turnNumber === prevTurnNumber);
  if (prevEntries.length === 0) return null;

  const playerName = prevEntries[0]!.playerName;
  const lines = buildNarrative(prevEntries);
  if (lines.length === 0) return null;

  return (
    <div className="bg-stone-800 border border-stone-600 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-stone-400 hover:text-stone-200 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-display tracking-wide">
          Last turn — <span className="text-amber-300">{playerName}</span>
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1">
          {lines.map((line, i) => (
            <div key={i} className="text-xs text-stone-300 flex gap-2">
              <span className="text-stone-600 shrink-0">›</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
