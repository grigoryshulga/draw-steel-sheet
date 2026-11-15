import type { Ability, Character, CharacteristicKey } from "../types";
import { characteristicTerms, type CalculationBreakdown } from "./calculation-breakdown";
import { effectiveCharacteristics } from "./feature-modifiers";
import { CHARACTERISTICS } from "./rule-display";
import { powerRollModifiers } from "./power-roll-modifiers";

export type AbilityWithPreferred = Omit<Ability, "preferredCharacteristic"> & {
  preferredCharacteristic?: CharacteristicKey | "";
};

/** Выбирает валидную предпочтительную характеристику, с откатом на первую доступную. */
export function preferredCharacteristic(
  ability: Pick<Ability, "rollCharacteristics" | "preferredCharacteristic">,
): CharacteristicKey | null {
  if (
    ability.preferredCharacteristic &&
    ability.rollCharacteristics.includes(ability.preferredCharacteristic)
  ) {
    return ability.preferredCharacteristic;
  }
  return ability.rollCharacteristics[0] ?? null;
}

/** Достраивает поле у старых сохранённых и каталожных способностей. */
export function normalizeAbility(ability: AbilityWithPreferred): Ability {
  const preferred = preferredCharacteristic(ability as Ability);
  return {
    ...ability,
    preferredCharacteristic: preferred ?? "",
  };
}

export interface AbilityTierRequirements {
  characteristic: CharacteristicKey;
  /** Бонус характеристики героя. */
  characteristicBonus: number;
  /** Дополнительный бонус самой способности. */
  rollBonus: number;
  /** Итоговый бонус к натуральному броску 2d10. */
  totalBonus: number;
  /** Максимальный натуральный бросок для Т1. */
  t1Max: number;
  /** Минимальный натуральный бросок для Т2. */
  t2Min: number;
  /** Максимальный натуральный бросок для Т2. */
  t2Max: number;
  /** Минимальный натуральный бросок для Т3. */
  t3Min: number;
}

export interface AbilityRollBreakdown extends CalculationBreakdown {
  characteristic: CharacteristicKey;
  characteristicBonus: number;
  totalBonus: number;
}

export function abilityRollBreakdown(
  ability: Pick<Ability, "rollCharacteristics" | "preferredCharacteristic" | "rollBonus">,
  character: Character,
  options: { characteristic?: CharacteristicKey; additionalBonus?: number; edges?: number; banes?: number } = {},
): AbilityRollBreakdown | null {
  const key = options.characteristic && ability.rollCharacteristics.includes(options.characteristic)
    ? options.characteristic : preferredCharacteristic(ability);
  if (!key) return null;
  const characteristicBonus = effectiveCharacteristics(character)[key];
  const modifiers = powerRollModifiers(options.edges, options.banes);
  const additional = options.additionalBonus ?? 0;
  const totalBonus = characteristicBonus + ability.rollBonus + additional + modifiers.edgeBonus;
  return {
    label: CHARACTERISTICS.find((entry) => entry.key === key)?.label ?? key,
    characteristic: key,
    characteristicBonus,
    totalBonus,
    total: `2d10 ${totalBonus >= 0 ? "+" : "−"}${Math.abs(totalBonus)}`,
    terms: [
      ...characteristicTerms(character, key),
      ...(ability.rollBonus ? [{ label: "Бонус способности", value: ability.rollBonus }] : []),
      ...(additional ? [{ label: "Поправка к этому броску", value: additional }] : []),
      ...(modifiers.edgeBonus ? [{ label: modifiers.edgeBonus > 0 ? "Преимущество" : "Помеха", value: modifiers.edgeBonus }] : []),
    ],
    ...(modifiers.tierShift ? { note: `${modifiers.note}. Сдвиг тира применяется после сложения; к сумме броска не прибавляется.` } : {}),
  };
}

/**
 * Какие натуральные значения 2d10 нужны для Т1/Т2/Т3 с учётом
 * предпочтительной характеристики и бонуса способности.
 *
 * Т2 начинается с суммы 12, Т3 — с 17, поэтому вычитаем бонус броска.
 */
export function abilityTierRequirements(
  ability: Pick<Ability, "rollCharacteristics" | "preferredCharacteristic" | "rollBonus">,
  character: Character,
): AbilityTierRequirements | null {
  const breakdown = abilityRollBreakdown(ability, character);
  if (!breakdown) return null;
  const { characteristic: key, characteristicBonus, totalBonus } = breakdown;
  const t2Min = 12 - totalBonus;
  const t3Min = 17 - totalBonus;

  return {
    characteristic: key,
    characteristicBonus,
    rollBonus: ability.rollBonus,
    totalBonus,
    t1Max: t2Min - 1,
    t2Min,
    t2Max: t3Min - 1,
    t3Min,
  };
}

/** Компактная строка требуемого натурального броска для одного тира. */
export function tierRequirementText(
  requirements: AbilityTierRequirements,
  tier: 1 | 2 | 3,
): string {
  if (tier === 1) return `≤ ${requirements.t1Max}`;
  if (tier === 2) return `${requirements.t2Min}–${requirements.t2Max}`;
  return `${requirements.t3Min}+`;
}
