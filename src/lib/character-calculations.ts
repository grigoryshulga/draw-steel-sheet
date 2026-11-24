import type { Ability, Character } from "../types";
import type { FeatureStat } from "../data/feature-effects";
import { classPreset, heroicResourceName } from "../data/classes";
import { abilitySourceKit, kitByName } from "../data/kits";
import {
  effectiveCharacteristics,
  featureAbilityDistanceBonus,
  featureFieldBonus,
  featureStatBonus,
  featureStatContributions,
  type FeatureContribution,
} from "./feature-modifiers";
import { echelon } from "./progression";
import { trackFuryTurn } from "./fury-turn";
import { stormwightFormState, synchronizeStormwightForm } from "./stormwight-forms";
import { resolvedKitBonus } from "./kit-bonuses";

export { echelon };
/** Реэкспорт для UI: эффективные характеристики без прямого импорта движка. */
export { effectiveCharacteristics };
export function kitBonus(character: Character, label: string): number {
  return parseFloat(resolvedKitBonus(character, label)?.value ?? "") || 0;
}
/** Saved numeric stats; saving throws are not stored and use `featureStatBonus` directly. */
export type CalculatedStat = Exclude<FeatureStat, "save">;

type BaseValues = Record<CalculatedStat, number>;

/** Class and kit base only; ancestry traits join through the shared feature engine. */
function baseValues(character: Character): BaseValues {
  const preset = classPreset(character.className);
  const tier = echelon(character.level);
  return {
    stamina:
      (preset
        ? preset.staminaBase + preset.staminaPerLevel * (character.level - 1)
        : 0) + kitBonus(character, "выносливости") * tier,
    recoveries: preset?.recoveries ?? 0,
    speed: 5 + kitBonus(character, "скорости"),
    stability: kitBonus(character, "устойчивости"),
    disengage: 1 + kitBonus(character, "отходу"),
  };
}

export function calculatedValues(character: Character) {
  const base = baseValues(character);
  return {
    stamina: base.stamina + featureStatBonus(character, "stamina"),
    recoveries: base.recoveries + featureStatBonus(character, "recoveries"),
    speed: base.speed + featureStatBonus(character, "speed"),
    stability: base.stability + featureStatBonus(character, "stability"),
    disengage: base.disengage + featureStatBonus(character, "disengage"),
  };
}

export interface CharacterStatBreakdown {
  /** Base before class-feature automation. */
  base: number;
  contributions: FeatureContribution[];
  adjustment: number;
  /** Same clamp as the saved sheet. */
  total: number;
}

/** Explain one saved stat without re-deriving it: base + named features + manual adjustment. */
export function characterStatBreakdown(
  character: Character,
  stat: CalculatedStat,
): CharacterStatBreakdown {
  const base = baseValues(character)[stat];
  const contributions = featureStatContributions(character, stat);
  const adjustment = character.automation?.adjustments?.[stat] ?? 0;
  const featureTotal = contributions.reduce(
    (total, contribution) => total + contribution.value,
    0,
  );
  return {
    base,
    contributions,
    adjustment,
    total: Math.max(0, base + featureTotal + adjustment),
  };
}

/** Recompute from inputs, never from previously applied bonuses. Direct edits become explicit adjustments. */
export function recalculateCharacter(
  previous: Character,
  next: Character,
): Character {
  next = trackFuryTurn(previous, next);
  next = synchronizeStormwightForm(previous, next);
  const resourceName = heroicResourceName(next.className);
  if (next.heroicResource.name !== resourceName) {
    next = {
      ...next,
      heroicResource: { ...next.heroicResource, name: resourceName },
    };
  }
  if (!next.automation) return next;
  let automation = next.automation;
  // A class change invalidates the old feature choices even while automation is off,
  // so a stale selection cannot come back when it is turned on again. Only an
  // explicit replacement in the same operation keeps new selections.
  if (
    previous.className !== next.className &&
    previous.automation?.classFeatureSelections &&
    previous.automation.classFeatureSelections ===
      automation.classFeatureSelections
  ) {
    automation = { ...automation, classFeatureSelections: {} };
    next = { ...next, automation };
  }
  // A disabled sheet keeps its saved numbers and manual adjustments as they are,
  // but a stale ancestry choice is still invalidated: names and IDs that were not
  // explicitly replaced in this operation are cleared, so nothing comes back later.
  if (previous.automation && previous.ancestry !== next.ancestry) {
    const previousAutomation = previous.automation;
    const namesReplaced =
      previousAutomation.ancestryTraits !== automation.ancestryTraits;
    const idsReplaced =
      previousAutomation.ancestryTraitIds !== automation.ancestryTraitIds;
    const selectionsReplaced =
      previousAutomation.ancestryFeatureSelections !==
      automation.ancestryFeatureSelections;
    if (!selectionsReplaced) {
      automation = { ...automation, ancestryFeatureSelections: {} };
    }
    if (!idsReplaced) {
      if (namesReplaced) {
        // Explicit new legacy names must be able to resolve, so drop the old canonical IDs.
        const withoutIds = { ...automation };
        delete withoutIds.ancestryTraitIds;
        automation = withoutIds;
      } else {
        automation = { ...automation, ancestryTraits: [], ancestryTraitIds: [] };
      }
    } else if (!namesReplaced) {
      // Explicit new canonical IDs win; stale legacy names are cleared.
      automation = { ...automation, ancestryTraits: [] };
    }
    next = { ...next, automation };
  }
  // A disabled sheet keeps its saved numbers and manual adjustments as they are.
  if (!automation.enabled) return next;
  const calculated = calculatedValues(next);
  const adjustments = { ...automation.adjustments };
  const fields = {
    stamina: [previous.stamina.max, next.stamina.max],
    recoveries: [previous.recoveries.max, next.recoveries.max],
    speed: [Number(previous.speed), Number(next.speed)],
    stability: [Number(previous.stability), Number(next.stability)],
    disengage: [Number(previous.disengage), Number(next.disengage)],
  };
  if (previous.automation?.enabled) {
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      const [before, after] = fields[key];
      if (before !== after && Number.isFinite(after))
        adjustments[key] = after - calculated[key];
    }
  }
  const value = (key: keyof typeof calculated) =>
    Math.max(0, calculated[key] + (adjustments[key] ?? 0));
  return {
    ...next,
    automation: { ...automation, adjustments },
    stamina: {
      ...next.stamina,
      max: value("stamina"),
      current: Math.min(next.stamina.current, value("stamina")),
    },
    recoveries: {
      ...next.recoveries,
      max: value("recoveries"),
      current: Math.min(next.recoveries.current, value("recoveries")),
    },
    speed: String(value("speed")),
    stability: String(value("stability")),
    disengage: String(value("disengage")),
  };
}

/** Kit signatures already include their own kit bonuses in the translated book. */
export function abilityKitDamageBonus(
  ability: Ability,
  character: Character,
  tier: number,
): number {
  return abilityKitDamageContributions(ability, character, tier).reduce((total, source) => total + source.value, 0);
}

/** Printed kit damage is removed before applying the currently selected profile. */
export interface KitDamageContribution extends FeatureContribution {
  includedInFormula?: boolean;
  englishName?: string;
}

export function abilityKitDamageContributions(
  ability: Ability,
  character: Character,
  tier: number,
  includeEnglish = false,
): KitDamageContribution[] {
  if (!character.automation?.enabled) return [];
  if (!ability.keywords.some((k) => k.toLowerCase() === "оружие")) return [];
  const kind =
    ability.weaponMode === "ranged" && ability.keywords.includes("Дальний")
      ? "Дальний"
      : ability.keywords.some((k) => k.toLowerCase() === "ближний")
        ? "Ближний"
        : ability.keywords.some((k) => k.toLowerCase() === "дальний")
          ? "Дальний"
          : null;
  if (!kind) return [];
  const bonus = resolvedKitBonus(character, `урону (${kind})`);
  const embeddedKit = abilitySourceKit(ability);
  const selectedKit = kitByName(character.kit);
  // Preserve printed damage until a legacy Stormwight family is resolved.
  if (selectedKit?.variants?.some((variant) => variant.id === embeddedKit?.id)) return [];
  if (!selectedKit && embeddedKit?.familyId && ability.source !== `Комплект: ${embeddedKit.name}`) return [];
  const embedded = embeddedKit?.bonuses.find(
    (b) => b.label === `урону (${kind})`,
  );
  const embeddedValue = Number(embedded?.value.split("/")[tier - 1]?.replace("+", "")) || 0;
  return [
    ...(embeddedKit && embeddedValue ? [{
      sourceId: embeddedKit.id,
      sourceName: `Встроенный бонус: ${embeddedKit.name}`,
      ...(includeEnglish ? { englishName: `Included bonus: ${embeddedKit.originalName ?? embeddedKit.name}` } : {}),
      value: -embeddedValue,
      includedInFormula: true,
    }] : []),
    ...(bonus ? [{
      sourceId: bonus.kit.id,
      sourceName: `Комплект: ${bonus.kit.name}`,
      ...(includeEnglish ? { englishName: `Kit: ${bonus.kit.originalName ?? bonus.kit.name}` } : {}),
      value: Number(bonus.value.split("/")[tier - 1]?.replace("+", "")) || 0,
    }] : []),
  ];
}

export function abilityDistanceModifiers(ability: Ability, character: Character) {
  if (!character.automation?.enabled) return { melee: 0, ranged: 0, within: 0 };
  const weapon = ability.keywords.includes("Оружие");
  const feature = featureAbilityDistanceBonus(ability, character);
  const embedded = weapon ? abilitySourceKit(ability) : undefined;
  const kit = (mode: string) => {
    if (!weapon) return 0;
    const label = `расстоянию (${mode})`;
    const printed = Number(embedded?.bonuses.find(bonus => bonus.label === label)?.value) || 0;
    return kitBonus(character, label) - printed;
  };
  const form = weapon ? stormwightFormState(character)?.meleeDistanceBonus ?? 0 : 0;
  return { melee: kit("Ближний") + form, ranged: kit("Дальний") + feature, within: feature };
}

export function abilityDistance(ability: Ability, character: Character, delta = abilityDistanceModifiers(ability, character)): string {
  if (!character.automation?.enabled) return ability.distance;
  if (/(ближний|дальний)\s+\d+/i.test(ability.distance)) {
    return ability.distance.replace(/(ближний|дальний)\s+(\d+)/gi, (_match, kind: string, amount: string) =>
      `${kind} ${Number(amount) + (kind.toLowerCase() === "ближний" ? delta.melee : delta.ranged)}`);
  }
  return ability.distance.replace(/(в\s+пределах)\s+(\d+)/gi, (match, _kind: string, amount: string) =>
    match.replace(/\d+$/, String(Number(amount) + delta.within)));
}

/** Прибавки к принудительному движению от активных особенностей героя. */
export interface AbilityForcedMovement {
  push: number;
  pull: number;
  slide: number;
}

/**
 * Добавка к толчку, притягиванию и швырянию от особенностей (например, порог
 * Растущей свирепости у Неистового). Текст тиров способности не меняется:
 * добавка живёт отдельной строкой под тирами.
 *
 * Считает движок модификаторов, поэтому при выключенном авторасчёте все три
 * поля — нули, как и у расстояния способности: сохранённые значения листа
 * остаются как есть.
 */
export function abilityForcedMovement(
  ability: Ability,
  character: Character,
): AbilityForcedMovement {
  return {
    push: featureFieldBonus(character, "push", ability),
    pull: featureFieldBonus(character, "pull", ability),
    slide: featureFieldBonus(character, "slide", ability),
  };
}

/** Подписи манёвров в порядке статьи: толчок, притягивание, швыряние. */
const FORCED_MOVEMENT_LABELS: readonly (readonly [
  keyof AbilityForcedMovement,
  string,
])[] = [
  ["push", "Толчок"],
  ["pull", "Притягивание"],
  ["slide", "Швыряние"],
];

/**
 * Строка под тирами: только ненулевые прибавки, с явным знаком;
 * при нулях строка пустая и карточка её не рисует.
 */
export function forcedMovementSummary(
  movement: AbilityForcedMovement,
  language: "ru" | "en" = "ru",
): string {
  return FORCED_MOVEMENT_LABELS.filter(([key]) => movement[key] !== 0)
    .map(
      ([key, label]) =>
        `${language === "en" ? ({ push: "Push", pull: "Pull", slide: "Slide" } as const)[key] : label} ${movement[key] > 0 ? "+" : "−"}${Math.abs(movement[key])}`,
    )
    .join(" · ");
}

/**
 * Есть ли в тексте способности принудительное движение: толчок, швыряние
 * или сдвиг. Это эвристика показа строки, а не разбор эффектов в структуру:
 * бонусы всё равно считаются только по полям `push`/`pull`/`slide`.
 */
export function abilityHasForcedMovement(ability: Ability): boolean {
  const text = [
    ability.effect,
    ...ability.tiers.map((tier) => `${tier.damage} ${tier.effect}`),
  ].join(" ");
  return /толч|швыр|сдвиг/iu.test(text);
}

/**
 * Строка принудительного движения для карточки: пусто, если способность
 * никого не двигает или у героя нет прибавок к манёврам.
 */
export function abilityForcedMovementLine(
  ability: Ability,
  character: Character,
): string {
  if (!abilityHasForcedMovement(ability)) return "";
  return forcedMovementSummary(abilityForcedMovement(ability, character));
}
