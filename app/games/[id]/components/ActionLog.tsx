"use client";

import type { ActionLogView, PlayerSummary } from "@/lib/game/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useEffect } from "react";

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

interface Props {
  log: ActionLogView[];
  players: PlayerSummary[];
}

export function ActionLog({ log, players }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  function playerColor(name: string): string {
    const p = players.find((p) => p.name === name);
    return PLAYER_COLORS[p?.turnOrder ?? 0] ?? "#64748b";
  }

  const turns: { turnNumber: number; playerName: string; entries: ActionLogView[] }[] = [];
  for (const entry of log) {
    const last = turns[turns.length - 1];
    if (!last || last.turnNumber !== entry.turnNumber) {
      turns.push({ turnNumber: entry.turnNumber, playerName: entry.playerName, entries: [entry] });
    } else {
      last.entries.push(entry);
    }
  }

  return (
    <div className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-stone-700">
        <span className="font-display text-xs text-stone-300 tracking-widest uppercase">Action Log</span>
      </div>
      <ScrollArea className="h-64 px-3 py-2">
        {turns.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No actions yet.</p>
        ) : (
          <div className="space-y-3">
            {turns.map((turn) => (
              <div key={turn.turnNumber}>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  Turn {turn.turnNumber} —
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: playerColor(turn.playerName) }} />
                  <span style={{ color: playerColor(turn.playerName) }}>{turn.playerName}</span>
                </div>
                <ul className="space-y-0.5">
                  {formatTurnEntries(turn.entries).map((line, i) => (
                    <li
                      key={i}
                      className={`text-xs ${
                        line.indent ? "text-stone-400 pl-4" : "text-stone-400 pl-2 border-l border-stone-700"
                      }`}
                    >
                      {line.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface LogLine { text: string; indent: boolean; }

function formatTurnEntries(entries: ActionLogView[]): LogLine[] {
  const lines: LogLine[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i]!;
    const d = entry.details as Record<string, unknown>;
    if (entry.type === "play_card") {
      const cardName = (d.card_name as string) ?? "a card";
      const effects: string[] = [];
      while (i + 1 < entries.length && entries[i + 1]!.type === "effect_resolved") {
        i++;
        effects.push(formatEffect(entries[i]!.details as Record<string, unknown>));
      }
      lines.push({ text: `Played ${cardName}`, indent: false });
      for (const eff of effects) lines.push({ text: eff, indent: true });
    } else if (entry.type === "effect_resolved") {
      lines.push({ text: formatEffect(d), indent: true });
    } else {
      lines.push({ text: formatEntry(entry.type, d), indent: false });
    }
    i++;
  }
  return lines;
}

function formatEffect(d: Record<string, unknown>): string {
  const type = d.effect_type as string;
  const details = d.details as Record<string, unknown> | undefined;
  const amt = (details?.amount ?? d.amount ?? 0) as number;
  switch (type) {
    case "gain_gold":               return `💰 +${amt} gold`;
    case "gain_focus":              return `🔵 +${amt} focus`;
    case "gain_movement":           return `👟 +${amt} movement`;
    case "gain_attack":             return `⚔️ +${amt} attack`;
    case "gain_attention":          return `👁 +${amt} attention`;
    case "draw_cards":              return `🂠 drew ${amt}`;
    case "heal":                    return `❤️ healed ${amt}`;
    case "remove_attention":        return `👁 −${amt} attention`;
    case "redirect_attention_to_filler": return `👁 converted ${amt} to Luck`;
    case "all_others_gain_attention": return `👁 others +${amt} attention`;
    case "all_others_lose_gold":    return `💰 stole ${amt} gold from each`;
    case "multiply_gold_this_turn": return `💰 gold ×${(details?.factor ?? amt) as number}`;
    case "multiply_focus_this_turn": return `🔵 focus ×${(details?.factor ?? amt) as number}`;
    default: return type.replace(/_/g, " ");
  }
}

function formatEntry(type: string, d: Record<string, unknown>): string {
  switch (type) {
    case "move": {
      const to = (d.to_room_name ?? d.to_room_id) as string;
      const dmg = d.damage_taken as number | undefined;
      return `Moved to ${to}${dmg ? ` · took ${dmg} damage` : ""}`;
    }
    case "buy_card": return `Bought ${(d.card_name ?? "card") as string} (${(d.focus_paid as number) > 0 ? `${d.focus_paid}F` : ""}${(d.gold_paid as number) > 0 ? `${d.gold_paid}G` : ""})`;
    case "buy_tool": return `Bought ${(d.tool_name ?? d.tool_code) as string}`;
    case "pickup_artifact": return `Picked up ${(d.artifact_name ?? "artifact") as string}`;
    case "defeat_threat": return `Defeated ${(d.threat_name ?? "threat") as string} via ${d.label as string}`;
    case "horde_attack":  return "⚠️ Horde attack!";
    case "escape":        return "🚪 Escaped";
    default: return type.replace(/_/g, " ");
  }
}
