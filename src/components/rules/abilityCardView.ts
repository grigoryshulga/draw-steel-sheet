import type { Ability, Character } from "../../types";
import {
  abilityDistance,
  abilityForcedMovementLine,
} from "../../lib/character-calculations";
import { evaluateAbilityDamage, TIER_ROLL_RANGES } from "../../lib/rules";
import { actionLabel, actionShort } from "../../data/actions";
import { inferDamageType } from "../../lib/damageType";
import {
  abilityTierRequirements,
} from "../../lib/abilities";
import {
  abilitySheetBase,
  visibleAbilityTiers,
  type AbilityOrigin,
  type AbilitySheetView,
} from "./AbilitySheet";

/**
 * Модель карточки листа: пороги тиров, урон, дистанция и принудительное
 * движение считаются для конкретного героя. Чтение правил этот модуль не
 * импортирует, поэтому справочная проекция остаётся без Character.
 */
export function abilityCardView(
  ability: Ability,
  character: Character,
  origin?: AbilityOrigin | null,
): AbilitySheetView {
  const requirements = abilityTierRequirements(ability, character);
  return {
    ...abilitySheetBase(ability),
    origin,
    trigger: ability.trigger,
    roll: requirements ? { characteristic: requirements.characteristic, bonus: requirements.totalBonus } : null,
    facts: [
      { label: "Действие", value: actionShort(ability.actionType), title: `Тип действия: ${actionLabel(ability.actionType)}` },
      {
        label: "Дист.",
        value: abilityDistance(ability, character),
        title: "Дистанция",
      },
      { label: "Цель", value: ability.target, title: "Цель" },
      { label: "Бросок", value: requirements ? `${requirements.totalBonus >= 0 ? "+" : "−"}${Math.abs(requirements.totalBonus)}` : "—", title: "Бросок силы" },
    ],
    tiers: visibleAbilityTiers(ability).map((tier) => ({
      tier: tier.tier,
      range: TIER_ROLL_RANGES[tier.tier],
      rangeTitle: "Диапазон суммы броска силы",
      damage: tier.damage
        ? {
            value: evaluateAbilityDamage(ability, tier.tier, character).display,
            type: inferDamageType(ability, tier.effect),
          }
        : undefined,
      effect: tier.effect,
    })),
    forcedMovement: abilityForcedMovementLine(ability, character),
  };
}
