import type { Ability } from "../types";

export type DamageTypeKey =
  | "acid"
  | "cold"
  | "corruption"
  | "fire"
  | "holy"
  | "lightning"
  | "poison"
  | "psychic"
  | "sonic";

export interface DamageType {
  key: DamageTypeKey;
  label: string;
  pattern: RegExp;
}

const DAMAGE_TYPES: DamageType[] = [
  { key: "acid", label: "Кислота", pattern: /кислот/i },
  { key: "cold", label: "Холод", pattern: /(холод|мороз|ледян|льд)/i },
  { key: "corruption", label: "Порча", pattern: /(порч|некрот|гнил)/i },
  { key: "fire", label: "Огонь", pattern: /(огон|огн[еяю]|пламен)/i },
  { key: "holy", label: "Святой", pattern: /(свят|божествен)/i },
  { key: "lightning", label: "Молния", pattern: /(молни|электрич|разряд)/i },
  { key: "poison", label: "Яд", pattern: /(?<![а-яё])яд(?:а|у|ом|е|ов|ы|о)?(?![а-яё])/i },
  { key: "psychic", label: "Психический", pattern: /(психи|псионич|ментальн)/i },
  { key: "sonic", label: "Звук", pattern: /(звук|громов|акустич)/i },
];

/**
 * Пытается определить тип урона по тексту тира, эффекту, названию и ключевым словам.
 * Данные правил не всегда содержат структурный тип, поэтому это эвристика.
 */
export function inferDamageType(
  ability: Pick<Ability, "name" | "keywords" | "effect">,
  tierEffect = "",
): DamageType | undefined {
  const text = [
    tierEffect,
    ability.effect,
    ability.keywords.join(" "),
    ability.name,
  ].join(" ");
  return DAMAGE_TYPES.find((type) => type.pattern.test(text));
}
