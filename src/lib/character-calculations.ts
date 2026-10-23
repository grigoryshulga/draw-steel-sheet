import type { Ability, Character } from "../types";
import { classPreset, heroicResourceName } from "../data/classes";
import { kitByName } from "../data/kits";

export function echelon(level: number): number {
  return Math.min(4, 1 + Math.floor((Math.max(1, level) - 1) / 3));
}
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
export function calculatedValues(character: Character) {
  const preset = classPreset(character.className);
  const traits = new Set(character.automation?.ancestryTraits ?? []);
  const tier = echelon(character.level);
  const naturalSpeed = traits.has("Молниеносная ловкость")
    ? 7
    : traits.has("Звериные ноги") || traits.has("Стремительный")
      ? 6
      : 5;
  return {
    stamina:
      (preset
        ? preset.staminaBase + preset.staminaPerLevel * (character.level - 1)
        : 0) +
      kitBonus(character, "выносливости") * tier +
      (traits.has("Искра с твоей кожи") ? 6 * tier : 0),
    recoveries:
      (preset?.recoveries ?? 0) + (traits.has("Запас прочности") ? 2 : 0),
    speed: naturalSpeed + kitBonus(character, "скорости"),
    stability:
      kitBonus(character, "устойчивости") +
      (traits.has("Заземленность") ? 1 : 0),
    disengage:
      1 +
      kitBonus(character, "отходу") +
      (traits.has("Грациозное отступление") ? 1 : 0),
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
  if (!next.automation?.enabled) return next;
  let automation = next.automation;
  if (
    previous.automation?.enabled &&
    previous.ancestry !== next.ancestry &&
    previous.automation.ancestryTraits === next.automation.ancestryTraits
  ) {
    automation = { ...automation, ancestryTraits: [] };
    next = { ...next, automation };
  }
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
  if (!character.automation?.enabled || !ability.keywords.includes("Оружие"))
    return ability.distance;
  const embeddedKit = ability.source.startsWith("Комплект: ")
    ? kitByName(ability.source.slice(10))
    : undefined;
  return ability.distance.replace(
    /(ближний|дальний)\s+(\d+)/gi,
    (_match, kind: string, amount: string) => {
      const label = kind.toLowerCase() === "ближний" ? "Ближний" : "Дальний";
      return `${kind} ${Number(amount) + kitBonus(character, `расстоянию (${label})`) - (Number(embeddedKit?.bonuses.find((b) => b.label === `расстоянию (${label})`)?.value.replace("+", "")) || 0)}`;
    },
  );
}
