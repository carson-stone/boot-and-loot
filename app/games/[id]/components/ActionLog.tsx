"use client";

import type { ActionLogView } from "@/lib/game/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  log: ActionLogView[];
}

export function ActionLog({ log }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Action Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[60vh]">
          {log.length === 0 ? (
            <p className="text-xs text-slate-500">No actions yet.</p>
          ) : (
            <ul className="space-y-1">
              {log.map((entry, i) => (
                <li key={i} className="text-xs border-l-2 border-slate-200 pl-2 py-1">
                  <span className="text-slate-500 mr-1">{entry.type}:</span>
                  <span className="text-slate-700">{formatDetails(entry)}</span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function formatDetails(entry: ActionLogView): string {
  const d = entry.details;
  switch (entry.type) {
    case "play_card":
      return "card played";
    case "effect_resolved":
      return `${d.effect_type ?? "effect"}`;
    case "move":
      return `moved (cost ${d.movement_cost})`;
    case "buy_card":
      return `bought card (${d.gold_paid}g)`;
    case "buy_tool":
      return `bought ${d.tool_code} (${d.gold_paid}g)`;
    case "pickup_artifact":
      return "picked up artifact";
    case "defeat_threat":
      return `defeated threat via ${d.label}`;
    case "horde_attack":
      return "horde attack!";
    case "escape":
      return "escaped";
    default:
      return JSON.stringify(d).slice(0, 60);
  }
}
