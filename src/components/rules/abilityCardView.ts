import type { Ability, Character } from "../../types";
import {
  abilityDistance,
  abilityForcedMovementLine,
} from "../../lib/character-calculations";
import { characteristicShort, evaluateAbilityDamage, TIER_ROLL_RANGES } from "../../lib/rules";
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
  const alternatives = requirements
    ? ability.rollCharacteristics.filter((key) => key !== requirements.characteristic).map(characteristicShort)
    : [];
  const bonus = requirements
    ? `${requirements.totalBonus >= 0 ? "+" : "−"}${Math.abs(requirements.totalBonus)}`
    : "—";
  const rollValue = alternatives.length ? `${bonus} · или ${alternatives.join(" или ")}` : bonus;
  const rollTitle = requirements
    ? `Бросок силы: ${characteristicShort(requirements.characteristic)} ${bonus}${alternatives.length ? `; также ${alternatives.join(" или ")}` : ""}`
    : "Бросок силы";
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
      { label: "Бросок", value: rollValue, title: rollTitle },
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
