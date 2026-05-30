"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EffectView, ResolutionOptionView } from "@/lib/game/types";

interface CardData {
  name: string;
  cardType: string;
  costGold: number;
  isOneTimeUse?: boolean;
  isKillableThreat?: boolean;
  description: string | null;
  effects: EffectView[];
  resolutionOptions?: ResolutionOptionView[];
  available?: number; // for static market stock count
}

interface GameCardTileProps {
  card: CardData;
  action?: {
    label: string;
    variant?: "default" | "outline" | "destructive";
    disabled?: boolean;
    onClick: () => void;
  };
}

function effectLabel(e: EffectView): string {
  const type = e.effectType;
  const n = e.amount;
  switch (type) {
    case "gain_gold":                            return `💰 +${n}`;
    case "gain_movement":                        return `👟 +${n}`;
    case "gain_attack":                          return `⚔️ +${n}`;
    case "gain_attention":                       return `👁 +${n}`;
    case "draw_cards":                           return `🂠 draw ${n}`;
    case "heal":                                 return `❤️ heal ${n}`;
    case "remove_attention":                     return `👁 −${n}`;
    case "redirect_attention_to_filler":         return `👁 convert ${n} to Luck in the Fray`;
    case "all_others_gain_attention":            return `👁 others +${n}`;
    case "all_others_lose_gold_this_turn":       return `💰 others −${n}`;
    case "multiply_gold_this_turn":              return `💰 ×${n} this turn`;
    case "multiply_attack_this_turn":            return `⚔️ ×${n} this turn`;
    case "reduce_attention_generated_this_turn": return `👁 −${n} generated`;
    case "all_cards_zero_attention_this_turn":   return `👁 0 this turn`;
    case "prevent_damage_this_turn":             return `🛡 ${n} dmg prevented`;
    case "conditional_gain_attack_if_card_type_played": {
      const p = e.parametersJson as Record<string, unknown>;
      return `⚔️ +${p.bonus} (${p.threshold}+ ${p.card_type}s)`;
    }
    case "grant_market_access_this_turn":        return `🏪 market access`;
    default: return type.replace(/_/g, " ");
  }
}

const TYPE_COLORS: Record<string, string> = {
  monster:   "bg-red-100 text-red-800",
  device:    "bg-blue-100 text-blue-800",
  companion: "bg-green-100 text-green-800",
  spell:     "bg-purple-100 text-purple-800",
};

export function GameCardTile({ card, action }: GameCardTileProps) {
  const typeColor = TYPE_COLORS[card.cardType] ?? "bg-slate-100 text-slate-800";
  const isThreat = card.isKillableThreat;

  return (
    <div
      className={`w-44 h-60 shrink-0 flex flex-col rounded-lg border-2 p-3 text-xs ${
        isThreat
          ? "border-red-300 bg-red-50"
          : card.isOneTimeUse
          ? "border-amber-400 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      {/* Header row: name + cost */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="font-bold text-sm text-slate-900 leading-tight">{card.name}</div>
        {card.costGold > 0 && (
          <span className="text-xs font-semibold text-amber-700 shrink-0">{card.costGold}g</span>
        )}
      </div>

      {/* Type + flags */}
      <div className="flex gap-1 flex-wrap mb-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColor}`}>
          {card.cardType}
        </span>
        {card.isOneTimeUse && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
            one-time
          </span>
        )}
        {isThreat && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">
            threat
          </span>
        )}
        {card.available !== undefined && (
          <span className="text-[10px] text-slate-500">×{card.available}</span>
        )}
      </div>

      {/* Description */}
      {card.description && (
        <p className="text-slate-700 leading-snug mb-2">{card.description}</p>
      )}

      {/* Effects */}
      {card.effects.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-2">
          {card.effects.map((e, i) => (
            <span key={i} className="text-slate-900 font-medium">
              {effectLabel(e)}
            </span>
          ))}
        </div>
      )}

      {/* Resolution options (threats) */}
      {card.resolutionOptions && card.resolutionOptions.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-2">
          {card.resolutionOptions.map((opt) => (
            <div key={opt.id} className="text-[10px] text-slate-600 leading-snug">
              <span className="font-semibold text-slate-800">{opt.label}:</span>{" "}
              {[
                opt.costAttacks > 0 && `⚔️ ${opt.costAttacks}`,
                opt.costGold > 0 && `💰 ${opt.costGold}`,
                opt.costAttention > 0 && `👁 ${opt.costAttention}`,
                opt.costHealth > 0 && `❤️ ${opt.costHealth}`,
              ]
                .filter(Boolean)
                .join(" + ")}
              {" → "}
              {[
                opt.rewardGold > 0 && `💰 ${opt.rewardGold}`,
                opt.rewardReputation > 0 && `🏆 ${opt.rewardReputation}`,
                typeof opt.rewardJson.remove_attention === "number" && opt.rewardJson.remove_attention > 0 && `👁 −${opt.rewardJson.remove_attention}`,
                typeof opt.rewardJson.gain_attention === "number" && opt.rewardJson.gain_attention > 0 && `👁 +${opt.rewardJson.gain_attention}`,
              ]
                .filter(Boolean)
                .join(" + ") || "—"}
            </div>
          ))}
        </div>
      )}

      {/* Spacer + action button pinned to bottom */}
      <div className="mt-auto pt-2">
        {action && (
          <Button
            size="sm"
            variant={action.variant ?? "outline"}
            className="w-full h-7 text-xs"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
