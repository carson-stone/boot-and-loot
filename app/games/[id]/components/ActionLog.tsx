"use client";

import type { ActionLogView, PlayerSummary } from "@/lib/game/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useEffect } from "react";

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

interface Props {
  log: ActionLogView[];
  players: PlayerSummary[];
}

export function ActionLog({ log, players }: Props) {
  function playerColor(name: string): string {
    const p = players.find((p) => p.name === name);
    return PLAYER_COLORS[p?.turnOrder ?? 0] ?? "#64748b";
  }
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  // Group entries by turn
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Action Log</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[60vh] px-4 pb-4">
          {turns.length === 0 ? (
            <p className="text-xs text-slate-600 pt-2">No actions yet.</p>
          ) : (
            <div className="space-y-3 pt-1">
              {turns.map((turn) => (
                <div key={turn.turnNumber}>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    Turn {turn.turnNumber} —
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: playerColor(turn.playerName) }}
                    />
                    <span style={{ color: playerColor(turn.playerName) }}>{turn.playerName}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {formatTurnEntries(turn.entries).map((line, i) => (
                      <li
                        key={i}
                        className={`text-xs pl-2 py-0.5 ${
                          line.indent
                            ? "text-slate-500 pl-5 border-l border-slate-100"
                            : "text-slate-900 border-l-2 border-slate-300"
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
      </CardContent>
    </Card>
  );
}

interface LogLine {
  text: string;
  indent: boolean;
}

function formatTurnEntries(entries: ActionLogView[]): LogLine[] {
  const lines: LogLine[] = [];
  let i = 0;

  while (i < entries.length) {
    const entry = entries[i]!;
    const d = entry.details as Record<string, unknown>;

    if (entry.type === "play_card") {
      const cardName = (d.card_name as string) ?? "a card";
      // Collect subsequent effect_resolved entries for this card
      const effects: string[] = [];
      while (i + 1 < entries.length && entries[i + 1]!.type === "effect_resolved") {
        i++;
        effects.push(formatEffect(entries[i]!.details as Record<string, unknown>));
      }
      lines.push({ text: `Played ${cardName}`, indent: false });
      for (const eff of effects) {
        lines.push({ text: eff, indent: true });
      }
    } else if (entry.type === "effect_resolved") {
      // Orphaned effect (shouldn't normally happen)
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
  const amount = d.amount as number | undefined;
  const details = d.details as Record<string, unknown> | undefined;
  const amt = (details?.amount ?? amount ?? 0) as number;

  switch (type) {
    case "gain_gold":               return `💰 +${amt} gold`;
    case "gain_focus":              return `🔵 +${amt} focus`;
    case "gain_movement":           return `+${amt} movement`;
    case "gain_attack":             return `+${amt} attack`;
    case "gain_attention":          return `+${amt} attention`;
    case "draw_cards":              return `draw ${amt} card${amt !== 1 ? "s" : ""}`;
    case "heal":                    return `healed ${amt} HP`;
    case "remove_attention":        return `-${amt} attention`;
    case "redirect_attention_to_filler": return `converted ${amt} attention to Luck in the Fray`;
    case "all_others_gain_attention": return `all others +${amt} attention`;
    case "all_others_lose_gold":    return `steal ${amt} gold from each player`;
    case "multiply_gold_this_turn": return `💰 gold ×${(details?.factor ?? amount) as number} this turn`;
    case "multiply_focus_this_turn": return `🔵 focus ×${(details?.factor ?? amount) as number} this turn`;
    case "multiply_attack_this_turn": return `attacks ×${(details?.factor ?? amount) as number} this turn`;
    case "reduce_attention_generated_this_turn": return `attention generated −${amt} this turn`;
    case "all_cards_zero_attention_this_turn": return `0 attention generated this turn`;
    case "prevent_damage_this_turn": return `prevent ${amt} damage this turn`;
    case "conditional_gain_attack_if_monsters_played": {
      const bonus = (details?.bonus ?? 0) as number;
      const threshold = (details?.threshold ?? 0) as number;
      return `+${bonus} attack if ${threshold}+ monsters played`;
    }
    case "grant_market_access_this_turn": return `market access from anywhere`;
    default: return type.replace(/_/g, " ");
  }
}

function formatEntry(type: string, d: Record<string, unknown>): string {
  switch (type) {
    case "move": {
      const from = (d.from_room_name ?? d.from_room_id) as string;
      const to = (d.to_room_name ?? d.to_room_id) as string;
      const cost = d.movement_cost as number;
      const dmg = d.damage_taken as number | undefined;
      let s = `Moved ${from} → ${to} (${cost} movement)`;
      if (dmg) s += ` · took ${dmg} damage`;
      return s;
    }
    case "buy_card": {
      const name = (d.card_name ?? "card") as string;
      return `Bought ${name} (${d.gold_paid as number}g)`;
    }
    case "buy_tool": {
      const name = (d.tool_name ?? d.tool_code ?? "tool") as string;
      return `Bought ${name} (${d.gold_paid as number}g)`;
    }
    case "pickup_artifact": {
      const name = (d.artifact_name ?? "artifact") as string;
      return `Picked up ${name}`;
    }
    case "defeat_threat": {
      const name = (d.threat_name ?? "threat") as string;
      return `Defeated ${name} via ${d.label as string}`;
    }
    case "horde_attack":   return "⚠️ Horde attack!";
    case "escape":         return "🚪 Escaped the dungeon";
    default:               return type.replace(/_/g, " ");
  }
}
