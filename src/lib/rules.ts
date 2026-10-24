import {
  CHARACTERISTIC_KEYS,
  type Character,
  type CharacteristicKey,
  type DerivedStats,
} from "../types";
import { abilityKitDamageBonus } from "./character-calculations";
import { featureAbilityDamageContributions } from "./feature-modifiers";
import type { Ability } from "../types";

export const CHARACTERISTICS: {
  key: CharacteristicKey;
  short: string;
  label: string;
  testLabel: string;
}[] = [
  { key: "might", short: "М", label: "Мощь", testLabel: "Мощи" },
  { key: "agility", short: "Л", label: "Ловкость", testLabel: "Ловкости" },
  { key: "reason", short: "Р", label: "Разум", testLabel: "Разума" },
  { key: "intuition", short: "И", label: "Интуиция", testLabel: "Интуиции" },
  {
    key: "presence",
    short: "П",
    label: "Присутствие",
    testLabel: "Присутствия",
  },
];

export const CHARACTERISTIC_BY_SHORT: Record<string, CharacteristicKey> = {
  M: "might",
  A: "agility",
  R: "reason",
  I: "intuition",
  P: "presence",
};

const RUS_CHAR_MAP: Record<string, string> = {
  М: "M",
  Л: "A",
  Р: "R",
  И: "I",
  П: "P",
};

export function characteristicShort(key: CharacteristicKey): string {
  return CHARACTERISTICS.find((c) => c.key === key)?.short ?? key;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Производные значения листа. */
export function deriveStats(character: Character): DerivedStats {
  const max = Math.max(0, character.stamina.max);
  const highest = Math.max(
    ...CHARACTERISTIC_KEYS.map((key) => character.characteristics[key]),
  );
  // Потенциал считается от высочайшей характеристики героя.
  const potencyValue = highest;
  const tierThresholds = Object.fromEntries(
    CHARACTERISTIC_KEYS.map((key) => {
      const bonus = character.characteristics[key];
      return [key, { t2: 12 - bonus, t3: 17 - bonus }];
    }),
  ) as DerivedStats["tierThresholds"];

  return {
    recoveryValue: Math.floor(max / 3),
    winded: Math.floor(max / 2),
    highestCharacteristic: highest,
    potency: {
      weak: potencyValue - 2,
      average: potencyValue - 1,
      strong: potencyValue,
    },
    tierThresholds,
  };
}

export type Tier = 1 | 2 | 3;

/** Диапазоны суммы броска силы для тиров. */
export const TIER_ROLL_RANGES: Record<Tier, string> = {
  1: "≤ 11",
  2: "12–16",
  3: "17+",
};

export interface PowerRollOptions {
  characteristic: number;
  edges?: number;
  banes?: number;
  bonus?: number;
  /** Основное действие — только такие броски могут быть критическими. */
  isMainAction?: boolean;
  rng?: () => number;
  /** Physical dice use the same calculation as digital rolls. */
  dice?: readonly [number, number];
}

export interface PowerRollResult {
  die1: number;
  die2: number;
  natural: number;
  total: number;
  baseTier: Tier;
  tier: Tier;
  crit: boolean;
  net: number;
  edgeBonus: number;
  tierShift: number;
  note: string;
}

export function tierForTotal(total: number): Tier {
  if (total <= 11) return 1;
  if (total <= 16) return 2;
  return 3;
}

/**
 * Бросок силы по правилам Draw Steel.
 * Одно преимущество/помеха — ±2; двойное — сдвиг тира на один.
 * Натуральные 19–20 всегда дают третий тир.
 */
export function rollPowerRoll(options: PowerRollOptions): PowerRollResult {
  const rng = options.rng ?? Math.random;
  const die1 = options.dice?.[0] ?? Math.floor(rng() * 10) + 1;
  const die2 = options.dice?.[1] ?? Math.floor(rng() * 10) + 1;
  if (
    ![die1, die2].every((die) => Number.isInteger(die) && die >= 1 && die <= 10)
  ) {
    throw new Error("Каждый d10 должен иметь значение от 1 до 10");
  }
  const natural = die1 + die2;
  const edges = Math.max(0, options.edges ?? 0);
  const banes = Math.max(0, options.banes ?? 0);
  const net = edges - banes;
  const numericBonus = options.bonus ?? 0;

  let edgeBonus = 0;
  let tierShift = 0;
  let note = "";

  if (net === 1) {
    edgeBonus = 2;
    note = "Преимущество: +2";
  } else if (net >= 2) {
    tierShift = 1;
    note = "Двойное преимущество: +1 тир";
  } else if (net === -1) {
    edgeBonus = -2;
    note = "Помеха: −2";
  } else if (net <= -2) {
    tierShift = -1;
    note = "Двойная помеха: −1 тир";
  }

  const total = natural + options.characteristic + numericBonus + edgeBonus;
  const baseTier = tierForTotal(total);
  const crit = !!options.isMainAction && natural >= 19;

  let tier: Tier;
  if (natural >= 19) {
    tier = 3;
    note = crit
      ? "Критическое попадание: третий тир"
      : "Натуральные 19–20: третий тир";
  } else {
    tier = clamp(baseTier + tierShift, 1, 3) as Tier;
  }

  return {
    die1,
    die2,
    natural,
    total,
    baseTier,
    tier,
    crit,
    net,
    edgeBonus,
    tierShift,
    note,
  };
}

function normalizeFormula(formula: string): string {
  return formula
    .replace(/[МЛРИП]/g, (ch) => RUS_CHAR_MAP[ch] ?? ch)
    .replace(/[×х]/gi, "*");
}

function characteristicValue(letter: string, character: Character): number {
  const key = CHARACTERISTIC_BY_SHORT[letter.toUpperCase()];
  return key ? character.characteristics[key] : 0;
}

export interface EvaluatedDamage {
  /** Итоговые числа по каждому варианту формулы. */
  values: number[];
  /** Бросок кубика, если он есть в формуле (например, "1d6"). */
  dice: string[];
  /** Строка для отображения: "8" или "1d6 + 2". */
  display: string;
  /** Развёрнутая формула с подставленными характеристиками: "3 + 2". */
  breakdown: string;
}

/**
 * Вычисляет урон способности. Варианты через "или"/"|" сводятся к лучшему (по высшей характеристике),
 * кубики (остаются как есть) и характеристики M/A/R/I/P (в том числе кириллицей).
 */
export function evaluateDamage(
  formula: string,
  character: Character,
): EvaluatedDamage {
  const trimmed = formula.trim();
  if (!trimmed) {
    return { values: [], dice: [], display: "", breakdown: "" };
  }

  // Варианты формулы («М или Л») — берём самый выгодный: от высшей из характеристик.
  let best: EvaluatedDamage | null = null;

  for (const variant of expandDamageAlternatives(normalizeFormula(trimmed))) {
    const normalized = normalizeFormula(variant);
    const tokens = normalized.match(/[+-]?\s*(?:\d+d\d+|\d+|[MARIP])/gi);
    if (!tokens) {
      best ??= { values: [0], dice: [], display: "0", breakdown: variant };
      continue;
    }

    let flat = 0;
    const dice: string[] = [];
    const substituted: string[] = [];
    let hasCharacteristic = false;

    for (const token of tokens) {
      const sign = token.trim().startsWith("-") ? -1 : 1;
      const body = token.replace(/^[+-]/, "").trim();
      if (/^\d+d\d+$/i.test(body)) {
        const die = sign < 0 ? `−${body}` : body;
        dice.push(die);
        substituted.push(die);
        continue;
      }
      if (/^\d+$/.test(body)) {
        const number = sign * Number(body);
        flat += number;
        substituted.push(String(number));
        continue;
      }
      const value = characteristicValue(body, character);
      hasCharacteristic = true;
      flat += sign * value;
      substituted.push(String(sign * value));
    }

    const flatPart =
      flat === 0 ? "" : ` ${flat > 0 ? "+" : "−"} ${Math.abs(flat)}`;
    const candidate: EvaluatedDamage = {
      values: [flat],
      dice,
      display: dice.length ? `${dice.join(" + ")}${flatPart}` : String(flat),
      breakdown: hasCharacteristic
        ? substituted.join(" + ").replace(/\+ -/g, "− ")
        : variant,
    };
    if (!best || candidate.values[0] > best.values[0]) best = candidate;
  }

  return best ?? { values: [], dice: [], display: "", breakdown: "" };
}

/**
 * Разворачивает альтернативы характеристик: «5 + M, R, I или P» → четыре формулы.
 * Так же работает с «или» и слэшем.
 */
function expandDamageAlternatives(formula: string): string[] {
  let variants = [formula];
  const groupPattern = /[MARIP](?:\s*(?:,|или|\/)\s*[MARIP])+/i;

  for (let round = 0; round < 4; round += 1) {
    const next: string[] = [];
    let expanded = false;
    for (const variant of variants) {
      const match = groupPattern.exec(variant);
      if (!match) {
        next.push(variant);
        continue;
      }
      expanded = true;
      const letters = match[0].match(/[MARIP]/gi) ?? [];
      for (const letter of letters) {
        next.push(
          variant.slice(0, match.index) +
            letter +
            variant.slice(match.index + match[0].length),
        );
      }
    }
    variants = next;
    if (!expanded) break;
  }

  if (variants.length === 1) {
    const parts = formula.split(/\s+или\s+/i).map((part) => part.trim());
    if (parts.length > 1 && parts.every((part) => /\d/.test(part))) {
      return parts;
    }
  }

  return variants;
}

/** Бонус одного всплеска к урону равен самой высокой характеристике. */
export function surgeDamage(character: Character): number {
  return Math.max(
    0,
    ...CHARACTERISTIC_KEYS.map((key) => character.characteristics[key]),
  );
}

/** Shared by the sheet, catalog and roll results so displayed damage stays consistent. */
export function evaluateAbilityDamage(
  ability: Ability,
  tier: number,
  character: Character,
): EvaluatedDamage {
  if (
    !ability.weaponMode &&
    ability.keywords.includes("Ближний") &&
    ability.keywords.includes("Дальний") &&
    character.automation?.enabled
  ) {
    const melee = evaluateAbilityDamage(
      { ...ability, weaponMode: "melee" },
      tier,
      character,
    );
    const ranged = evaluateAbilityDamage(
      { ...ability, weaponMode: "ranged" },
      tier,
      character,
    );
    if (melee.display === ranged.display) return melee;
    return {
      values: [...melee.values, ...ranged.values],
      dice: [...melee.dice, ...ranged.dice],
      display: `${melee.display} (бл.) · ${ranged.display} (дал.)`,
      breakdown: `Ближний: ${melee.breakdown}; дальний: ${ranged.breakdown}`,
    };
  }
  const formula = ability.tiers[tier - 1]?.damage ?? "";
  const base = evaluateDamage(formula, character);
  // No formula means no damage tier: bonuses must not invent damage there.
  if (!formula.trim()) return base;
  const kit = abilityKitDamageBonus(ability, character, tier);
  const features = featureAbilityDamageContributions(ability, character);
  const bonus = features.reduce(
    (total, contribution) => total + contribution.value,
    kit,
  );
  if (!bonus) return base;
  const sources = [
    ...(kit
      ? [`${kit < 0 ? "−" : "+"} ${Math.abs(kit)} (комплект)`]
      : []),
    ...features.map(
      (contribution) =>
        `${contribution.value < 0 ? "−" : "+"} ${Math.abs(contribution.value)} (${contribution.sourceName})`,
    ),
  ].join(" ");
  const values = base.values.map((value) => value + bonus);
  return {
    ...base,
    values,
    display: base.dice.length
      ? `${base.display} ${bonus < 0 ? "−" : "+"} ${Math.abs(bonus)}`
      : [...new Set(values)].join(" / "),
    breakdown: `${base.breakdown} ${sources}`,
  };
}

/** Всплески: до 3 на урон, 2 всплеска — +1 к потенциалу. */
export function surgeDamageTotal(character: Character, surges: number): number {
  return surgeDamage(character) * clamp(surges, 0, 3);
}

export interface ApplyDamageResult {
  stamina: number;
  temp: number;
  absorbed: number;
}

/** Входящий урон сначала съедает временную выносливость. */
export function applyDamage(
  stamina: number,
  temp: number,
  amount: number,
): ApplyDamageResult {
  const damage = Math.max(0, Math.floor(amount));
  const absorbed = Math.min(Math.max(0, temp), damage);
  return {
    temp: Math.max(0, temp) - absorbed,
    stamina: stamina - (damage - absorbed),
    absorbed,
  };
}

export interface VitalStatus {
  label: string;
  tone: "normal" | "winded" | "dying" | "dead";
}

export function vitalStatus(character: Character): VitalStatus {
  const { current, max } = character.stamina;
  const winded = Math.floor(Math.max(0, max) / 2);
  if (max > 0 && current <= -winded) return { label: "Мёртв", tone: "dead" };
  if (current <= 0 && max > 0) return { label: "При смерти", tone: "dying" };
  if (current <= winded && max > 0) return { label: "Утомлён", tone: "winded" };
  return { label: "В строю", tone: "normal" };
}
