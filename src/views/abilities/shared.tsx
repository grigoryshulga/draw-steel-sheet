import type { Ability, AbilityKind, Character } from "../../types";
import { ABILITY_KINDS } from "../../data/actions";
import { characteristicShort } from "../../lib/rules";
import { formatBonus } from "../../lib/utils";
import {
  abilityTierRequirements,
  tierRequirementText,
} from "../../lib/abilities";
import { makeId } from "../../data/templates";

/** «1 способность / 2 способности / 5 способностей». */
export function pluralAbilities(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "способность";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "способности";
  return "способностей";
}

/** Тон чипа для вида способности. */
export function kindTone(
  kind: AbilityKind,
): "default" | "accent" | "blue" | "magenta" {
  return (ABILITY_KINDS.find((item) => item.key === kind)?.tone ??
    "default") as "default" | "accent" | "blue" | "magenta";
}

/** Поиск по названию, ключевым словам, флейвору, дистанции, цели и эффектам. */
export function matchesQuery(ability: Ability, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    ability.name,
    ability.keywords.join(" "),
    ability.flavor,
    ability.distance,
    ability.target,
    ability.trigger,
    ability.effect,
    ability.tiers.map((tier) => `${tier.damage} ${tier.effect}`).join(" "),
    ability.source,
  ]
    .join(" ")
    .toLowerCase();
  return query.split(/\s+/).every((token) => haystack.includes(token));
}

/** Пустая способность для редактора. */
export function blankAbility(): Ability {
  return {
    id: makeId(),
    name: "",
    flavor: "",
    actionType: "main",
    kind: "other",
    keywords: [],
    distance: "",
    target: "",
    rollCharacteristics: [],
    preferredCharacteristic: "",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "" },
      { damage: "", effect: "" },
      { damage: "", effect: "" },
    ],
    effect: "",
    source: "",
    notes: "",
  };
}

/** Ключ для сопоставления «уже в листе» (имя + источник). */
export function ownershipKey(name: string, source: string): string {
  return `${name.trim().toLowerCase()}|${source.trim().toLowerCase()}`;
}

/** Строка броска: «М или Л +1». */
export function rollSummary(
  ability: Pick<Ability, "rollCharacteristics" | "rollBonus">,
): string {
  const parts = ability.rollCharacteristics.map((key) =>
    characteristicShort(key),
  );
  if (parts.length === 0) return "—";
  let text = parts.join(" или ");
  if (ability.rollBonus !== 0)
    text += `${ability.rollBonus > 0 ? " +" : " −"}${Math.abs(ability.rollBonus)}`;
  return text;
}
/**
 * Какие натуральные значения 2d10 нужны для попадания в каждый тир.
 * Показываем только для способностей с броском.
 */
export function TierRequirementSummary({
  ability,
  character,
}: {
  ability: Ability;
  character: Character;
}) {
  const req = abilityTierRequirements(ability, character);
  if (!req) return null;
  const source = `${characteristicShort(req.characteristic)} ${formatBonus(req.characteristicBonus)}`;
  return (
    <div
      className="abil-tier-req"
      title={`Натуральный бросок 2d10: ${source}, бонус способности ${formatBonus(req.rollBonus)}`}
    >
      <span className="abil-tier-req-title">Порог 2d10</span>
      <span className="abil-tier-req-item" data-tier="1">
        Т1 {tierRequirementText(req, 1)}
      </span>
      <span className="abil-tier-req-item" data-tier="2">
        Т2 {tierRequirementText(req, 2)}
      </span>
      <span className="abil-tier-req-item" data-tier="3">
        Т3 {tierRequirementText(req, 3)}
      </span>
      <span className="abil-tier-req-source">
        {source}
        {req.rollBonus !== 0 && ` · бонус ${formatBonus(req.rollBonus)}`}
      </span>
    </div>
  );
}
