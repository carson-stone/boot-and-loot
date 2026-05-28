"use client";

import type { ResolutionOptionView } from "@/lib/game/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  gameCardId: string;
  threatName: string;
  options: ResolutionOptionView[];
  onResolve: (resolutionOptionId: string) => void;
  onClose: () => void;
}

export function ThreatResolver({ threatName, options, onResolve, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve: {threatName}</DialogTitle>
          <DialogDescription>Choose how to handle this threat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onResolve(opt.id)}
              className="w-full text-left border border-slate-200 rounded-md p-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold">{opt.label}</div>
                <div className="flex gap-1 flex-wrap">
                  {opt.rewardGold > 0 && <Badge variant="gold">+{opt.rewardGold}g</Badge>}
                  {opt.rewardReputation > 0 && (
                    <Badge variant="default">+{opt.rewardReputation} rep</Badge>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-600 flex gap-1 flex-wrap">
                {opt.costAttacks > 0 && <span>⚔ {opt.costAttacks} attacks</span>}
                {opt.costGold > 0 && <span>💰 {opt.costGold} gold</span>}
                {opt.costAttention > 0 && <span>👁 {opt.costAttention} attention</span>}
                {opt.costHealth > 0 && <span>❤ {opt.costHealth} health</span>}
                {Object.entries(opt.specialCostJson).map(([k, v]) => (
                  <span key={k}>
                    {k.replace(/_/g, " ")}: {String(v)}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
