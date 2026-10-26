import {
  CLASS_FEATURE_GROUPS,
  type ClassFeatureGroup,
  type ClassFeatureOption,
} from "../data/class-feature-rules";
import {
  ANCESTRY_FEATURE_RULES,
  ancestryTraitIdsFromNames,
  type AncestryFeatureRule,
} from "../data/ancestry-feature-rules";
import type {
  FeatureAmount,
  FeatureEffect,
  FeatureField,
  FeatureFilter,
  FeatureStat,
} from "../data/class-features/types";
import type { Ability, Character, CharacteristicKey } from "../types";
import { activeClassFeatureEffects } from "./class-features";
import { featureConditionMet } from "./feature-conditions";
import { echelon } from "./progression";
import { normalizeFeatureText as normalize } from "./utils";

/** Условия фич живут в `feature-conditions`; реэкспорт — для существующих потребителей. */
export { featureConditionMet };

export interface FeatureContribution {
  sourceId: string;
  sourceName: string;
  value: number;
}

/** Один активный источник (выбор класса или черта происхождения) со всеми эффектами. */
interface ActiveFeatureSource {
  sourceId: string;
  sourceName: string;
  effects: FeatureEffect[];
}

/** Прибавка до того, как группы замещения оставят одного победителя. */
interface GroupedContribution extends FeatureContribution {
  stackingGroup?: string;
}

type FieldEffect = Extract<FeatureEffect, { kind: "field" }>;

function optionEffects(option: ClassFeatureOption): FeatureEffect[] {
  return Array.isArray(option.effects) ? option.effects : [];
}

function activeFeatureOptions(character: Character): {
  group: ClassFeatureGroup;
  option: ClassFeatureOption;
}[] {
  const automation = character.automation;
  if (!automation?.enabled) return [];
  const selections = automation.classFeatureSelections;
  if (!selections || typeof selections !== "object") return [];

  const className = normalize(character.className);
  if (!className) return [];

  const active: { group: ClassFeatureGroup; option: ClassFeatureOption }[] = [];
  for (const group of CLASS_FEATURE_GROUPS) {
    if (normalize(group.className) !== className) continue;
    const optionId = selections[group.id];
    if (typeof optionId !== "string") continue;
    const option = group.options.find((candidate) => candidate.id === optionId);
    if (option) active.push({ group, option });
  }
  return active;
}

/**
 * Canonical ancestry selection wins whenever `automation.ancestryTraitIds` is an
 * array, including `[]` (an explicit refusal of the legacy names). Without the
 * field the explicit legacy name mapping is used for the current ancestry.
 */
function selectedAncestryIds(
  character: Character,
  automation: NonNullable<Character["automation"]>,
): readonly string[] {
  const canonical = automation.ancestryTraitIds;
  if (Array.isArray(canonical)) {
    return canonical.filter((id): id is string => typeof id === "string");
  }
  return ancestryTraitIdsFromNames(
    character.ancestry,
    automation.ancestryTraits ?? [],
  );
}

/** Ancestry rules of the current ancestry only; unknown, foreign and duplicate IDs drop out. */
function activeAncestryRules(character: Character): AncestryFeatureRule[] {
  const automation = character.automation;
  if (!automation?.enabled) return [];
  const ancestry = normalize(character.ancestry ?? "");
  if (!ancestry) return [];

  const ids = new Set(selectedAncestryIds(character, automation));
  if (!ids.size) return [];

  return ANCESTRY_FEATURE_RULES.filter(
    (rule) =>
      normalize(rule.ancestryName) === ancestry && ids.has(rule.id),
  );
}

/**
 * Выборы класса, черты происхождения и особенности нового реестра в одном проходе;
 * каждый источник входит не больше одного раза. Порядок детерминирован:
 * особенности реестра добавляются в конце и уже отсортированы по `id`.
 */
function activeFeatureSources(character: Character): ActiveFeatureSource[] {
  const sources: ActiveFeatureSource[] = activeFeatureOptions(character).map(
    ({ option }) => ({
      sourceId: option.id,
      sourceName: option.name,
      effects: optionEffects(option),
    }),
  );
  for (const rule of activeAncestryRules(character)) {
    sources.push({
      sourceId: rule.id,
      sourceName: rule.name,
      effects: Array.isArray(rule.effects) ? rule.effects : [],
    });
  }

  // Классовые особенности дают эффекты только при включённом авторасчёте,
  // как и остальные источники; показ фич на листе от флага не зависит.
  if (!character.automation?.enabled) return sources;

  const seen = new Set(sources.map((source) => source.sourceId));
  for (const feature of activeClassFeatureEffects(character)) {
    if (seen.has(feature.sourceId)) continue;
    seen.add(feature.sourceId);
    sources.push(feature);
  }
  return sources;
}

/**
 * Чистое сложение бонусов характеристик: сохранённая запись не меняется,
 * эффекты других видов игнорируются.
 */
export function applyCharacteristicEffects(
  base: Record<CharacteristicKey, number>,
  effects: readonly FeatureEffect[],
): Record<CharacteristicKey, number> {
  const result = { ...base };
  for (const effect of effects) {
    if (effect.kind !== "characteristic") continue;
    const value = Number.isFinite(effect.value) ? effect.value : 0;
    const current = result[effect.key];
    result[effect.key] = (typeof current === "number" ? current : 0) + value;
  }
  return result;
}

/** Эффекты характеристик активных источников героя (только при `automation.enabled`). */
function activeCharacteristicEffects(character: Character): FeatureEffect[] {
  return activeFeatureSources(character).flatMap((source) => source.effects);
}

/** Нулевая запись-база для подсчёта одних только прибавок. */
const ZERO_CHARACTERISTICS: Record<CharacteristicKey, number> = {
  might: 0,
  agility: 0,
  reason: 0,
  intuition: 0,
  presence: 0,
};

/** Сумма прибавок активных источников к одной характеристике. */
export function featureCharacteristicBonus(
  character: Character,
  key: CharacteristicKey,
): number {
  return applyCharacteristicEffects(
    ZERO_CHARACTERISTICS,
    activeCharacteristicEffects(character),
  )[key];
}

/**
 * Характеристики, по которым считаются пороги тиров, потенциал и формулы урона:
 * сохранённые значения плюс бонусы активных фич (только при `automation.enabled`).
 * Сохранённая запись не меняется.
 */
export function effectiveCharacteristics(
  character: Character,
): Record<CharacteristicKey, number> {
  return applyCharacteristicEffects(
    character.characteristics,
    activeCharacteristicEffects(character),
  );
}

/** Значение эффекта: число как есть, характеристика или уровень героя. */
export function resolveFeatureAmount(
  character: Character,
  amount: FeatureAmount,
): number {
  if (typeof amount === "number") {
    return Number.isFinite(amount) ? amount : 0;
  }
  if ("characteristic" in amount) {
    const value = character.characteristics?.[amount.characteristic];
    return typeof value === "number" ? value : 0;
  }
  return typeof character.level === "number" ? character.level : 0;
}

/**
 * Итоговое число эффекта: показатель (характеристика, уровень или число),
 * плюс поправка на эшелон, затем предел. Одно правило для движка и панели:
 * лист не должен считать то же число второй раз по-своему.
 */
export function resolveFeatureValue(
  character: Character,
  effect: { value: FeatureAmount; perEchelon?: number; cap?: number },
): number {
  const base = resolveFeatureAmount(character, effect.value);
  const scaled = base + (effect.perEchelon ?? 0) * echelon(character.level);
  return effect.cap === undefined ? scaled : Math.min(scaled, effect.cap);
}

function normalizedKeywords(keywords: readonly string[]): Set<string> {
  return new Set(
    keywords
      .filter((keyword): keyword is string => typeof keyword === "string")
      .map(normalize),
  );
}

function matchesAllKeywords(ability: Ability, required: string[]): boolean {
  const available = normalizedKeywords(ability.keywords ?? []);
  const needed = required.filter((keyword) => typeof keyword === "string");
  return needed.every((keyword) => available.has(normalize(keyword)));
}

/** Фильтр способности; без способности проходят только пустые фильтры. */
function matchesFilter(ability: Ability | undefined, filter?: FeatureFilter): boolean {
  if (!filter) return true;
  if (filter.keywords?.length) {
    if (!ability || !matchesAllKeywords(ability, filter.keywords)) return false;
  }
  if (filter.mode && ability?.weaponMode !== filter.mode) return false;
  return true;
}

function hasRollCharacteristics(ability: Ability): boolean {
  return (
    Array.isArray(ability.rollCharacteristics) &&
    ability.rollCharacteristics.length > 0
  );
}

function hasDamageFormula(ability: Ability): boolean {
  return (
    Array.isArray(ability.tiers) &&
    ability.tiers.some(
      (tier) => typeof tier?.damage === "string" && tier.damage.trim() !== "",
    )
  );
}

/** A rolled-flat formula such as "3" or "3 + Р" — never a dice expression. */
function hasNumericDamageFormula(ability: Ability): boolean {
  return (
    Array.isArray(ability.tiers) &&
    ability.tiers.some(
      (tier) =>
        typeof tier?.damage === "string" &&
        tier.damage.trim() !== "" &&
        !/\d+\s*d\s*\d+/i.test(tier.damage),
    )
  );
}

/**
 * Damage modifiers apply only to abilities with a damage formula and either a
 * power roll or, for an explicit `rolledOnly: false` effect, a numeric printed
 * damage formula. The caller still decides which tiers are damage tiers.
 */
function rolledDamageAllows(ability: Ability | undefined, effect: FieldEffect): boolean {
  if (!ability || !hasDamageFormula(ability)) return false;
  const rolled = hasRollCharacteristics(ability);
  if (!rolled && !hasNumericDamageFormula(ability)) return false;
  if (effect.rolledOnly !== false && !rolled) return false;
  return true;
}

function fieldEffectValue(
  character: Character,
  effect: FieldEffect,
): number {
  return resolveFeatureValue(character, effect);
}

/** Один эффект подходит под поле, фильтр, условия и правила способности. */
function fieldEffectValueIfActive(
  effect: FeatureEffect,
  character: Character,
  field: FeatureField,
  ability?: Ability,
): number | undefined {
  if (effect.kind !== "field" || effect.field !== field) return undefined;

  // Расстояние дальнобойных бонусов не действует на выбранный ближний режим.
  if (field === "distance" && ability?.weaponMode === "melee") return undefined;
  if (field === "rolledDamage" && !rolledDamageAllows(ability, effect)) return undefined;
  if (!matchesFilter(ability, effect.filter)) return undefined;
  if (!featureConditionMet(character, effect.when)) return undefined;

  return fieldEffectValue(character, effect);
}

/**
 * Effects in one stacking group never add up: only the highest value is kept and
 * the winning source is the one shown. Equal values keep the deterministic first.
 */
function applyStackingGroups(
  contributions: readonly GroupedContribution[],
): FeatureContribution[] {
  const winnerByGroup = new Map<string, number>();
  contributions.forEach((contribution, index) => {
    const group = contribution.stackingGroup;
    if (!group) return;
    const winner = winnerByGroup.get(group);
    if (winner === undefined || contribution.value > contributions[winner].value) {
      winnerByGroup.set(group, index);
    }
  });

  const kept: FeatureContribution[] = [];
  contributions.forEach((contribution, index) => {
    const group = contribution.stackingGroup;
    if (group && winnerByGroup.get(group) !== index) return;
    kept.push({
      sourceId: contribution.sourceId,
      sourceName: contribution.sourceName,
      value: contribution.value,
    });
  });
  return kept;
}

function collectFieldContributions(
  sources: readonly ActiveFeatureSource[],
  character: Character,
  field: FeatureField,
  ability?: Ability,
): FeatureContribution[] {
  const contributions: GroupedContribution[] = [];
  for (const source of sources) {
    for (const effect of source.effects) {
      const value = fieldEffectValueIfActive(effect, character, field, ability);
      if (value === undefined) continue;
      contributions.push({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        value,
        stackingGroup: effect.kind === "field" ? effect.stackingGroup : undefined,
      });
    }
  }
  return applyStackingGroups(contributions);
}

/**
 * Чистый расчёт по готовому списку эффектов: без источников, `automation.enabled`
 * и без обращения к выбору фич. Источник в прибавках остаётся пустым.
 */
export function fieldEffectContributions(
  effects: readonly FeatureEffect[],
  character: Character,
  field: FeatureField,
  ability?: Ability,
): FeatureContribution[] {
  return collectFieldContributions(
    [{ sourceId: "", sourceName: "", effects: [...effects] }],
    character,
    field,
    ability,
  );
}

/** Прибавки активных источников героя (выборы класса и черты происхождения). */
export function featureFieldContributions(
  character: Character,
  field: FeatureField,
  ability?: Ability,
): FeatureContribution[] {
  return collectFieldContributions(
    activeFeatureSources(character),
    character,
    field,
    ability,
  );
}

/** Сумма прибавок активных источников по одному полю. */
export function featureFieldBonus(
  character: Character,
  field: FeatureField,
  ability?: Ability,
): number {
  return featureFieldContributions(character, field, ability).reduce(
    (total, contribution) => total + contribution.value,
    0,
  );
}

export function featureStatContributions(
  character: Character,
  stat: FeatureStat,
): FeatureContribution[] {
  return featureFieldContributions(character, stat);
}

/** Sum of all active feature effects for one stat; saved maxima and adjustments stay untouched. */
export function featureStatBonus(character: Character, stat: FeatureStat): number {
  return featureFieldBonus(character, stat);
}

/** Иммунитет к урону, который даёт активная особенность. */
export interface FeatureDamageImmunity {
  sourceId: string;
  sourceName: string;
  types: string[];
  value: number;
}

/**
 * Иммунитеты к урону активных источников: значение — показатель из эффекта,
 * умноженный на `multiplier`. Усиливающая запись заменяет базовую с тем же
 * набором типов (Элементальная форма → Воплощение Хаоса), а не складывается
 * с ней — книга говорит «увеличивается до», а не «добавляется».
 */
export function featureDamageImmunities(
  character: Character,
): FeatureDamageImmunity[] {
  const best = new Map<string, FeatureDamageImmunity>();
  for (const source of activeFeatureSources(character)) {
    for (const effect of source.effects) {
      if (effect.kind !== "damageImmunity") continue;
      if (!featureConditionMet(character, effect.when)) continue;
      const value =
        resolveFeatureValue(character, effect) * (effect.multiplier ?? 1);
      const key = effect.types.map(normalize).sort().join("|");
      const current = best.get(key);
      if (current && current.value >= value) continue;
      best.set(key, {
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        types: [...effect.types],
        value,
      });
    }
  }
  return [...best.values()];
}

export function featureAbilityDamageContributions(
  ability: Ability,
  character: Character,
): FeatureContribution[] {
  return featureFieldContributions(character, "rolledDamage", ability);
}

export function featureAbilityDamageBonus(
  ability: Ability,
  character: Character,
): number {
  return featureFieldBonus(character, "rolledDamage", ability);
}

/**
 * Ranged distance modifiers never apply to a selected melee mode, even when the
 * ability still lists the ranged keyword from its dual-mode print.
 */
export function featureAbilityDistanceContributions(
  ability: Ability,
  character: Character,
): FeatureContribution[] {
  return featureFieldContributions(character, "distance", ability);
}

export function featureAbilityDistanceBonus(
  ability: Ability,
  character: Character,
): number {
  return featureFieldBonus(character, "distance", ability);
}
