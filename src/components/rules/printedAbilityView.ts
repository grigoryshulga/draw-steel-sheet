import type { ReactNode } from "react";
import { damageTypeByKey } from "../../lib/damageType";
import { TIER_ROLL_RANGES, type Tier } from "../../lib/rule-display";
import type { DistanceMode, PrintedAbility, PrintedRoll } from "../../rules/printed-ability";
import type { AbilitySheetView, AbilityTierView } from "./AbilitySheet";

export interface AbilityCardModifiers {
  distance: Partial<Record<DistanceMode, number>>;
  roll: string;
  rollTitle?: string;
  forcedMovement: string;
}

type MarkdownRenderer = (text: string) => ReactNode;
const letters = { might: "M", agility: "A", reason: "R", intuition: "I", presence: "P" };

export function printedTiers(roll: PrintedRoll, calculatedTiers?: AbilityTierView[], markdown?: MarkdownRenderer): AbilityTierView[] {
  return roll.tiers.map((row, index) => {
    const tier = (index + 1) as Tier;
    const calculated = calculatedTiers?.find(item => item.tier === tier)?.damage;
    const printed = row.damage;
    const damage = printed && {
      type: damageTypeByKey(printed.type),
      value: calculated?.englishValue ?? calculated?.value ?? printed.value,
      calculations: calculated?.calculations?.map(calc => ({ ...calc, englishFormula: printed.value })),
    };
    return {
      tier, range: TIER_ROLL_RANGES[tier], rangeTitle: "Power roll range", damage,
      effect: row.effect, effectContent: row.richEffect && markdown ? markdown(row.effect) : undefined,
    };
  });
}

export function printedAbilityView(
  base: AbilitySheetView,
  card: PrintedAbility,
  modifiers = base.cardModifiers,
  markdown?: MarkdownRenderer,
): AbilitySheetView {
  const { facts, roll } = card;
  const distance = facts?.distance.map(part =>
    typeof part === "string" ? part : part.value + (modifiers?.distance[part.mode] ?? 0),
  ).join("");
  const rollValue = modifiers?.roll ?? (roll?.characteristic ? letters[roll.characteristic] : roll?.title);
  return {
    ...base,
    flavor: card.flavor,
    facts: facts ? [
      { id: "action", label: "Action", value: facts.action },
      { id: "distance", label: "Distance", value: distance ?? "" },
      { id: "target", label: "Target", value: facts.target },
      {
        id: "roll", label: "Power roll", value: rollValue ?? "—",
        characteristic: modifiers ? undefined : roll?.characteristic,
        title: [roll?.title, modifiers?.rollTitle].filter(Boolean).join(" · ") || "Power roll",
      },
    ] : [],
    keywords: facts?.keywords ?? [],
    tiers: roll ? printedTiers(roll, modifiers ? base.tiers : undefined, markdown) : [],
    beforeRollContent: card.beforeRoll && markdown?.(card.beforeRoll),
    effect: card.effect ?? "",
    trigger: card.trigger,
    forcedMovement: modifiers?.forcedMovement ?? "",
  };
}
