import type { Ability, Character } from "../types";
import type { FeatureStat } from "../data/feature-effects";
import { classPreset, heroicResourceName } from "../data/classes";
import { kitByName } from "../data/kits";
import {
  featureAbilityDistanceBonus,
  featureStatBonus,
  featureStatContributions,
  type FeatureContribution,
} from "./feature-modifiers";
import { echelon } from "./progression";

export { echelon };
export function kitBonus(character: Character, label: string): number {
  return Math.max(
    0,
    ...[character.kit, character.secondaryKit ?? ""].map(
      (name) =>
        parseFloat(
          kitByName(name)?.bonuses.find((b) => b.label === label)?.value ?? "",
        ) || 0,
    ),
  );
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
  if (!character.automation?.enabled) return 0;
  if (!ability.keywords.some((k) => k.toLowerCase() === "оружие")) return 0;
  const kind =
    ability.weaponMode === "ranged" && ability.keywords.includes("Дальний")
      ? "Дальний"
      : ability.keywords.some((k) => k.toLowerCase() === "ближний")
        ? "Ближний"
        : ability.keywords.some((k) => k.toLowerCase() === "дальний")
          ? "Дальний"
          : null;
  if (!kind) return 0;
  const chosen =
    kind === "Ближний"
      ? character.automation.meleeDamageKit
      : character.automation.rangedDamageKit;
  const name =
    chosen && [character.kit, character.secondaryKit].includes(chosen)
      ? chosen
      : character.kit;
  const bonus = kitByName(name)?.bonuses.find(
    (b) => b.label === `урону (${kind})`,
  );
  const embeddedKit = ability.source.startsWith("Комплект: ")
    ? kitByName(ability.source.slice(10))
    : undefined;
  const embedded = embeddedKit?.bonuses.find(
    (b) => b.label === `урону (${kind})`,
  );
  return (
    (Number(bonus?.value.split("/")[tier - 1]?.replace("+", "")) || 0) -
    (Number(embedded?.value.split("/")[tier - 1]?.replace("+", "")) || 0)
  );
}

export function abilityDistance(
  ability: Ability,
  character: Character,
): string {
  if (!character.automation?.enabled) return ability.distance;
  const weapon = ability.keywords.includes("Оружие");
  // Ranged class features never extend a selected melee mode (see feature-modifiers).
  const featureDistance = featureAbilityDistanceBonus(ability, character);
  if (!weapon && !featureDistance) return ability.distance;
  const embeddedKit = ability.source.startsWith("Комплект: ")
    ? kitByName(ability.source.slice(10))
    : undefined;
  const distance = ability.distance.replace(
    /(ближний|дальний)\s+(\d+)/gi,
    (_match, kind: string, amount: string) => {
      const label = kind.toLowerCase() === "ближний" ? "Ближний" : "Дальний";
      // Each ranged alternative is adjusted on its own; areas and melee parts keep their size.
      const kit = weapon
        ? kitBonus(character, `расстоянию (${label})`) -
          (Number(
            embeddedKit?.bonuses
              .find((b) => b.label === `расстоянию (${label})`)
              ?.value.replace("+", ""),
          ) || 0)
        : 0;
      const feature = label === "Дальний" ? featureDistance : 0;
      return `${kind} ${Number(amount) + kit + feature}`;
    },
  );
  // An area prints its size and its placement range as one line (`Куб 3 в пределах 10`).
  // Only the placement range is a distance: the area size stays as printed.
  if (featureDistance && !/(ближний|дальний)\s+\d+/i.test(ability.distance)) {
    return distance.replace(
      /(в\s+пределах)\s+(\d+)/gi,
      (match, _prefix: string, amount: string) =>
        match.replace(/\d+$/, String(Number(amount) + featureDistance)),
    );
  }
  return distance;
}
