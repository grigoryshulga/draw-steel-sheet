import type { Ability, Character } from "../../types";
import {
  abilityDistance,
  abilityForcedMovementLine,
} from "../../lib/character-calculations";
import { evaluateAbilityDamage, TIER_ROLL_RANGES } from "../../lib/rules";
import { inferDamageType } from "../../lib/damageType";
import {
  abilityTierRequirements,
  tierRequirementText,
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
    facts: [
      {
        label: "Дист.",
        value: abilityDistance(ability, character),
        title: "Дистанция",
      },
      { label: "Цель", value: ability.target, title: "Цель" },
    ],
    tiers: visibleAbilityTiers(ability).map((tier) => ({
      tier: tier.tier,
      range: requirements
        ? tierRequirementText(requirements, tier.tier)
        : TIER_ROLL_RANGES[tier.tier],
      rangeTitle: requirements
        ? "Нужно выбросить на 2d10"
        : "Диапазон суммы броска силы",
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
