import type { Ability, Character, CharacteristicKey } from "../types";

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
  const key = preferredCharacteristic(ability as Ability);
  if (!key) return null;

  const characteristicBonus = character.characteristics[key];
  const totalBonus = characteristicBonus + ability.rollBonus;
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
