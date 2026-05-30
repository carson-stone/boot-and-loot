"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EffectView, ResolutionOptionView } from "@/lib/game/types";

interface CardData {
  name: string;
  cardType: string;
  costGold: number;
  costFocus: number;
  isOneTimeUse?: boolean;
  isKillableThreat?: boolean;
  description: string | null;
  effects: EffectView[];
  resolutionOptions?: ResolutionOptionView[];
  available?: number;
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
    case "gain_gold":                            return `💰 +${n} gold`;
    case "gain_focus":                           return `🔵 +${n} focus`;
    case "gain_movement":                        return `👟 +${n}`;
    case "gain_attack":                          return `⚔️ +${n}`;
    case "gain_attention":                       return `👁 +${n}`;
    case "draw_cards":                           return `🂠 draw ${n}`;
    case "heal":                                 return `❤️ heal ${n}`;
    case "remove_attention":                     return `👁 −${n}`;
    case "redirect_attention_to_filler":         return `👁 convert ${n} to Luck`;
    case "all_others_gain_attention":            return `👁 others +${n}`;
    case "all_others_lose_gold":                 return `💰 steal ${n} from each`;
    case "multiply_gold_this_turn":              return `💰 ×${n} this turn`;
    case "multiply_focus_this_turn":             return `🔵 ×${n} this turn`;
    case "multiply_attack_this_turn":            return `⚔️ ×${n} this turn`;
    case "reduce_attention_generated_this_turn": return `👁 −${n} generated`;
    case "all_cards_zero_attention_this_turn":   return `👁 0 this turn`;
    case "prevent_damage_this_turn":             return `🛡 prevent ${n} dmg`;
    case "conditional_gain_attack_if_card_type_played": {
      const p = e.parametersJson as Record<string, unknown>;
      return `⚔️ +${p.bonus} (${p.threshold}+ ${p.card_type}s)`;
    }
    case "grant_market_access_this_turn": return `🏪 market access`;
    case "scripted": {
      const p = e.parametersJson as Record<string, unknown>;
      return `✨ ${String(p.script_id ?? "special")}`;
    }
    default: return type.replace(/_/g, " ");
  }
}

const TYPE_STYLES: Record<string, { badge: string; border: string; bg: string }> = {
  monster:   { badge: "bg-red-900 text-red-200 border-red-700",     border: "border-red-700",    bg: "bg-red-950/30" },
  device:    { badge: "bg-blue-900 text-blue-200 border-blue-700",  border: "border-stone-600",  bg: "bg-amber-50" },
  companion: { badge: "bg-green-900 text-green-200 border-green-700", border: "border-stone-600", bg: "bg-amber-50" },
  spell:     { badge: "bg-purple-900 text-purple-200 border-purple-700", border: "border-purple-700", bg: "bg-purple-950/20" },
  treasure:  { badge: "bg-yellow-900 text-yellow-200 border-yellow-700", border: "border-yellow-700", bg: "bg-yellow-950/20" },
};

export function GameCardTile({ card, action }: GameCardTileProps) {
  const typeStyle = TYPE_STYLES[card.cardType] ?? TYPE_STYLES.device!;
  const isThreat = card.isKillableThreat;
  const cardBg = isThreat ? "bg-red-950/40" : "bg-amber-50";
  const cardBorder = isThreat ? "border-red-700" : "border-amber-700";
  const textPrimary = isThreat ? "text-red-100" : "text-stone-900";
  const textSecondary = isThreat ? "text-red-300" : "text-stone-400";

  return (
    <div
      className={`w-44 h-60 shrink-0 flex flex-col rounded-lg border-2 ${cardBorder} ${cardBg} p-3 text-xs shadow-md relative`}
      style={isThreat ? {} : { backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className={`font-display font-bold text-[13px] leading-tight ${textPrimary}`}>{card.name}</div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {card.costFocus > 0 && <span className="text-[10px] font-bold text-blue-600">🔵{card.costFocus}</span>}
          {card.costGold > 0 && <span className="text-[10px] font-bold text-amber-700">💰{card.costGold}</span>}
        </div>
      </div>

      {/* Type + flags */}
      <div className="flex gap-1 flex-wrap mb-1.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeStyle.badge}`}>
          {card.cardType}
        </span>
        {card.isOneTimeUse && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-800 text-amber-100 border border-amber-600">
            use once
          </span>
        )}
        {card.available !== undefined && (
          <span className={`text-[10px] ${textSecondary}`}>×{card.available}</span>
        )}
      </div>

      {/* Description */}
      {card.description && (
        <p className={`text-[11px] italic leading-snug mb-1.5 ${textSecondary}`}>{card.description}</p>
      )}

      {/* Effects */}
      {card.effects.length > 0 && (
        <div className={`flex flex-col gap-0.5 mb-1.5 font-medium text-[11px] ${textPrimary}`}>
          {card.effects.map((e, i) => <span key={i}>{effectLabel(e)}</span>)}
        </div>
      )}

      {/* Resolution options (threats) */}
      {card.resolutionOptions && card.resolutionOptions.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-1.5">
          {card.resolutionOptions.map((opt) => (
            <div key={opt.id} className="text-[10px] text-red-300 leading-snug">
              <span className="font-semibold text-red-200">{opt.label}:</span>{" "}
              {[
                opt.costAttacks > 0 && `⚔️${opt.costAttacks}`,
                opt.costGold > 0 && `💰${opt.costGold}`,
                opt.costAttention > 0 && `👁${opt.costAttention}`,
                opt.costHealth > 0 && `❤️${opt.costHealth}`,
              ].filter(Boolean).join("+")}
              {" → "}
              {[
                opt.rewardGold > 0 && `💰${opt.rewardGold}`,
                opt.rewardReputation > 0 && `🏆${opt.rewardReputation}`,
                typeof opt.rewardJson?.gain_attention === "number" && opt.rewardJson.gain_attention > 0 && `👁+${opt.rewardJson.gain_attention}`,
              ].filter(Boolean).join("+") || "—"}
            </div>
          ))}
        </div>
      )}

      {/* Action button pinned to bottom */}
      <div className="mt-auto pt-1.5">
        {action && (
          <Button
            size="sm"
            variant={action.variant ?? "default"}
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
