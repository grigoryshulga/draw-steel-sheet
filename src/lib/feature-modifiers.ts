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
  FeatureCondition,
  FeatureEffect,
  FeatureField,
  FeatureFilter,
  FeatureStat,
} from "../data/class-features/types";
import type { Ability, Character, CharacteristicKey } from "../types";
import { echelon } from "./progression";

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

/**
 * `runtime` появится в `Character` позже; читаем его через структурный взгляд,
 * чтобы не опережать задачу о состоянии схватки.
 */
interface CharacterRuntimeLike {
  forms?: string[];
  resources?: Record<string, number>;
}

/** Keyword/class/ancestry comparisons ignore case, surrounding whitespace and ё/е spelling. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

/** Названия опций по ID: нужны условию `keyValue`, где данные пишут имя группы. */
const CLASS_FEATURE_OPTION_NAMES = new Map<string, string>(
  CLASS_FEATURE_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.id, option.name] as const),
  ),
);

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

/** Class choices plus ancestry traits in one pass; each rule contributes at most once. */
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
 * Временный тестовый хук: эффекты характеристик без источника и без оговорок
 * `automation.enabled`. Удаляется в задаче 5 вместе с ключом в `Character`.
 */
function testCharacteristicEffects(character: Character): FeatureEffect[] {
  const hook = character.automation?.characteristicEffectsForTest;
  return Array.isArray(hook) ? hook : [];
}

/**
 * Характеристики, по которым считаются пороги тиров, потенциал и формулы урона:
 * сохранённые значения плюс бонусы фич (только при `automation.enabled`) и
 * эффекты временного тестового хука. Сохранённая запись не меняется.
 */
export function effectiveCharacteristics(
  character: Character,
): Record<CharacteristicKey, number> {
  return applyCharacteristicEffects(character.characteristics, [
    ...activeCharacteristicEffects(character),
    ...testCharacteristicEffects(character),
  ]);
}

function hasAnyKit(character: Character): boolean {
  return [character.kit, character.secondaryKit ?? ""].some(
    (name) => typeof name === "string" && name.trim() !== "",
  );
}

function runtimeOf(character: Character): CharacterRuntimeLike {
  return (character as Character & { runtime?: CharacterRuntimeLike }).runtime ?? {};
}

/** Текущее значение героического ресурса по имени: лист героя, затем runtime. */
function currentResourceValue(character: Character, name: string): number {
  const wanted = normalize(name);
  const sheetResource = character.heroicResource;
  if (
    sheetResource &&
    typeof sheetResource.name === "string" &&
    normalize(sheetResource.name) === wanted
  ) {
    return typeof sheetResource.current === "number" ? sheetResource.current : 0;
  }
  const resources = runtimeOf(character).resources;
  if (!resources || typeof resources !== "object") return 0;
  for (const [key, value] of Object.entries(resources)) {
    if (normalize(key) === wanted && typeof value === "number") return value;
  }
  return 0;
}

/** Значения ключевых групп, выбранные героем: и ID опции, и её название. */
function selectedKeyValues(character: Character): Set<string> {
  const selected = new Set<string>();
  const selections = character.automation?.classFeatureSelections;
  if (!selections || typeof selections !== "object") return selected;

  for (const optionId of Object.values(selections)) {
    if (typeof optionId !== "string") continue;
    selected.add(normalize(optionId));
    const name = CLASS_FEATURE_OPTION_NAMES.get(optionId);
    if (name) selected.add(normalize(name));
  }
  return selected;
}

/**
 * Условия эффекта. Снаряжение читается только из флагов автоматизации: проза
 * оружия/брони, заметки инвентаря и `automation.enabled` на условие не влияют.
 * Функция ничего не меняет в герое.
 */
export function featureConditionMet(
  character: Character,
  condition?: FeatureCondition,
): boolean {
  if (!condition) return true;

  const equipment = condition.equipment;
  if (equipment) {
    const flags = character.automation?.equipment;
    if (equipment.lightArmor === true && flags?.lightArmor !== true) return false;
    if (equipment.lightWeapon === true && flags?.lightWeapon !== true) return false;
  }
  if (condition.noKit && hasAnyKit(character)) return false;
  if (
    condition.minLevel !== undefined &&
    (typeof character.level !== "number" || character.level < condition.minLevel)
  ) {
    return false;
  }
  if (condition.keyValue?.length) {
    const selected = selectedKeyValues(character);
    const matched = condition.keyValue.some((value) =>
      selected.has(normalize(value)),
    );
    if (!matched) return false;
  }
  if (condition.resourceAtLeast) {
    const { name, value } = condition.resourceAtLeast;
    if (currentResourceValue(character, name) < value) return false;
  }
  if (condition.formActive) {
    const wanted = normalize(condition.formActive);
    const forms = runtimeOf(character).forms ?? [];
    if (!forms.some((form) => typeof form === "string" && normalize(form) === wanted)) {
      return false;
    }
  }
  return true;
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
  const base = resolveFeatureAmount(character, effect.value);
  const scaled = base + (effect.perEchelon ?? 0) * echelon(character.level);
  return effect.cap === undefined ? scaled : Math.min(scaled, effect.cap);
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
