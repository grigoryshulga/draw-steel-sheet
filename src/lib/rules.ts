import { type Tier } from "./rule-display";
export { CHARACTERISTICS, characteristicShort, TIER_ROLL_RANGES, type Tier } from "./rule-display";
import {
  CHARACTERISTIC_KEYS,
  type Character,
  type CharacteristicKey,
  type DerivedStats,
} from "../types";
import { abilityKitDamageContributions } from "./character-calculations";
import { characteristicTerms, type CalculationBreakdown, type CalculationTerm } from "./calculation-breakdown";
import { powerRollModifiers } from "./power-roll-modifiers";
import {
  effectiveCharacteristics,
  featureAbilityDamageContributions,
} from "./feature-modifiers";
import type { Ability } from "../types";

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

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Производные значения листа. */
export function deriveStats(character: Character): DerivedStats {
  const max = Math.max(0, character.stamina.max);
  // Пороги тиров и потенциал считаются по эффективным характеристикам: бонусы
  // выбранных фич добавляются поверх сохранённых значений листа.
  const characteristics = effectiveCharacteristics(character);
  const highest = Math.max(
    ...CHARACTERISTIC_KEYS.map((key) => characteristics[key]),
  );
  // Потенциал считается от высочайшей характеристики героя.
  const potencyValue = highest;
  const tierThresholds = Object.fromEntries(
    CHARACTERISTIC_KEYS.map((key) => {
      const bonus = characteristics[key];
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
  const { net, edgeBonus, tierShift, note: modifierNote } = powerRollModifiers(options.edges, options.banes);
  const numericBonus = options.bonus ?? 0;
  let note = modifierNote;

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

function characteristicValue(
  letter: string,
  characteristics: Record<CharacteristicKey, number>,
): number {
  const key = CHARACTERISTIC_BY_SHORT[letter.toUpperCase()];
  return key ? characteristics[key] : 0;
}

export interface EvaluatedDamage {
  /** Итоговые числа по каждому варианту формулы. */
  values: number[];
  /** Бросок кубика, если он есть в формуле (например, "1d6"). */
  dice: string[];
  /** Строка для отображения: "8" или "1d6 + 2". */
  display: string;
  englishDisplay?: string;
  /** Развёрнутая формула с подставленными характеристиками: "3 + 2". */
  breakdown: string;
  /** Именованные слагаемые для карточки и окна броска, включая оба способа атаки. */
  calculations?: CalculationBreakdown[];
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
  // Подставляем эффективные характеристики: бонус фичи попадает в урон.
  const characteristics = effectiveCharacteristics(character);

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
    const terms: CalculationTerm[] = [];
    let hasCharacteristic = false;

    for (const token of tokens) {
      const sign = token.trim().startsWith("-") ? -1 : 1;
      const body = token.replace(/^[+-]/, "").trim();
      if (/^\d+d\d+$/i.test(body)) {
        const die = sign < 0 ? `−${body}` : body;
        dice.push(die);
        substituted.push(die);
        terms.push({ label: "Кубики урона", value: die });
        continue;
      }
      if (/^\d+$/.test(body)) {
        const number = sign * Number(body);
        flat += number;
        substituted.push(String(number));
        const constant = terms.find((term) => term.kind === "base");
        if (constant && typeof constant.value === "number") constant.value += number;
        else terms.push({ kind: "base", label: "Базовый урон", value: number });
        continue;
      }
      const value = characteristicValue(body, characteristics);
      const key = CHARACTERISTIC_BY_SHORT[body.toUpperCase()];
      if (key) terms.push(...characteristicTerms(character, key, sign));
      hasCharacteristic = true;
      flat += sign * value;
      substituted.push(String(sign * value));
    }

    const flatPart =
      flat === 0 ? "" : ` ${flat > 0 ? "+" : "−"} ${Math.abs(flat)}`;
    const display = dice.length ? `${dice.join(" + ")}${flatPart}` : String(flat);
    const candidate: EvaluatedDamage = {
      values: [flat],
      dice,
      display,
      breakdown: hasCharacteristic
        ? substituted.join(" + ").replace(/\+ -/g, "− ")
        : variant,
      calculations: [{ label: "Урон", formula: trimmed, total: display, terms }],
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

/** Бонус одного всплеска к урону равен самой высокой эффективной характеристике. */
export function surgeDamage(character: Character): number {
  const characteristics = effectiveCharacteristics(character);
  return Math.max(
    0,
    ...CHARACTERISTIC_KEYS.map((key) => characteristics[key]),
  );
}

/** Shared by the sheet, catalog and roll results so displayed damage stays consistent. */
export function evaluateAbilityDamage(
  ability: Ability,
  tier: number,
  character: Character,
  surges = 0,
  includeEnglish = false,
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
      surges,
      includeEnglish,
    );
    const ranged = evaluateAbilityDamage(
      { ...ability, weaponMode: "ranged" },
      tier,
      character,
      surges,
      includeEnglish,
    );
    const calculations = [
      ...(melee.calculations ?? []).map((calculation) => ({ ...calculation, label: "Ближний бой" })),
      ...(ranged.calculations ?? []).map((calculation) => ({ ...calculation, label: "Дальний бой" })),
    ];
    if (melee.display === ranged.display) return { ...melee, calculations };
    return {
      values: [...melee.values, ...ranged.values],
      dice: [...melee.dice, ...ranged.dice],
      display: `${melee.display} (бл.) · ${ranged.display} (дал.)`,
      ...(includeEnglish ? { englishDisplay: `${melee.display} (melee) · ${ranged.display} (ranged)` } : {}),
      breakdown: `Ближний: ${melee.breakdown}; дальний: ${ranged.breakdown}`,
      calculations,
    };
  }
  const formula = ability.tiers[tier - 1]?.damage ?? "";
  const base = evaluateDamage(formula, character);
  // No formula means no damage tier: bonuses must not invent damage there.
  if (!formula.trim()) return base;
  const kit = abilityKitDamageContributions(ability, character, tier, includeEnglish);
  const embedded = kit.find((source) => source.includedInFormula);
  const features = featureAbilityDamageContributions(ability, character);
  const manual = character.damageModifier ?? 0;
  const surge = surgeDamageTotal(character, surges);
  const sources = [
    ...kit,
    ...features,
    ...(manual ? [{ sourceName: "Общий модификатор урона", value: manual }] : []),
    ...(surge ? [{ sourceName: `Всплески: ${clamp(surges, 0, 3)} × ${surgeDamage(character)}`, value: surge, ...(includeEnglish ? { englishName: `Surges: ${clamp(surges, 0, 3)} × ${surgeDamage(character)}` } : {}) }] : []),
  ];
  if (!sources.length) return base;
  const bonus = sources.reduce((total, source) => total + source.value, 0);
  const values = base.values.map((value) => value + bonus);
  const display = base.dice.length
    ? bonus ? `${base.display} ${bonus < 0 ? "−" : "+"} ${Math.abs(bonus)}` : base.display
    : [...new Set(values)].join(" / ");
  return {
    ...base,
    values,
    display,
    breakdown: `${base.breakdown} ${sources.map((source) =>
      `${source.value < 0 ? "−" : "+"} ${Math.abs(source.value)} (${source.sourceName})`,
    ).join(" ")}`,
    calculations: base.calculations?.map((calculation) => {
      const baseTerm = calculation.terms.find((term) => term.kind === "base" && typeof term.value === "number");
      const unembed = embedded && baseTerm;
      return {
        ...calculation,
        total: display,
        terms: [
          ...calculation.terms.map((term) => unembed && term === baseTerm ? {
            ...term, label: "Базовый урон без комплекта", value: Number(term.value) + embedded.value,
          } : term),
          ...sources.filter((source) => !unembed || source !== embedded)
            .map((source) => ({
              label: source.sourceName,
              value: source.value,
              ...("englishName" in source && source.englishName ? { englishLabel: source.englishName } : {}),
            })),
        ],
        ...(embedded ? {
          note: "Печатная формула уже включает бонус исходного комплекта. Он вычтен из базы, чтобы применить выбранный профиль один раз.",
        } : {}),
      };
    }),
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
