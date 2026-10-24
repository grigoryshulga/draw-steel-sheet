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
  FeatureCondition,
  FeatureEffect,
  FeatureStat,
} from "../data/feature-effects";
import type { Ability, Character } from "../types";
import { echelon } from "./progression";

export interface FeatureContribution {
  sourceId: string;
  sourceName: string;
  value: number;
}

/** One active rule (class choice or ancestry trait) with all of its effects. */
interface ActiveFeatureSource {
  sourceId: string;
  sourceName: string;
  effects: FeatureEffect[];
}

/** A contribution before stacking groups reduce it to one winning source. */
interface GroupedContribution extends FeatureContribution {
  stackingGroup?: string;
}

type AbilityEffect = Extract<FeatureEffect, { kind: "damage" | "distance" }>;
type StatEffect = Extract<FeatureEffect, { kind: "stat" }>;

/** Keyword/class/ancestry comparisons ignore case, surrounding whitespace and ё/е spelling. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

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

function hasAnyKit(character: Character): boolean {
  return [character.kit, character.secondaryKit ?? ""].some(
    (name) => typeof name === "string" && name.trim() !== "",
  );
}

/**
 * Equipment condition only: a required flag must be exactly `true` and `noKit`
 * requires both kit slots to be blank. It does not read weapon/armor prose,
 * inventory notes or automation.enabled, and it never mutates the character.
 */
export function featureConditionMet(
  character: Character,
  condition?: FeatureCondition,
): boolean {
  if (!condition) return true;
  if (condition.equipment) {
    if (character.automation?.equipment?.[condition.equipment] !== true) {
      return false;
    }
  }
  if (condition.noKit && hasAnyKit(character)) return false;
  return true;
}

function statValue(effect: StatEffect, level: number): number {
  return effect.value + (effect.perEchelon ?? 0) * echelon(level);
}

function statContributions(
  character: Character,
  stat: FeatureStat,
): GroupedContribution[] {
  const contributions: GroupedContribution[] = [];
  for (const source of activeFeatureSources(character)) {
    for (const effect of source.effects) {
      if (effect.kind !== "stat" || effect.stat !== stat) continue;
      if (!featureConditionMet(character, effect.when)) continue;
      contributions.push({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        value: statValue(effect, character.level),
        stackingGroup: effect.stackingGroup,
      });
    }
  }
  return contributions;
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

export function featureStatContributions(
  character: Character,
  stat: FeatureStat,
): FeatureContribution[] {
  return applyStackingGroups(statContributions(character, stat));
}

/** Sum of all active feature effects for one stat; saved maxima and adjustments stay untouched. */
export function featureStatBonus(character: Character, stat: FeatureStat): number {
  return featureStatContributions(character, stat).reduce(
    (total, contribution) => total + contribution.value,
    0,
  );
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

function abilityEffectContributions(
  ability: Ability,
  character: Character,
  kind: AbilityEffect["kind"],
): FeatureContribution[] {
  const contributions: FeatureContribution[] = [];
  for (const source of activeFeatureSources(character)) {
    for (const effect of source.effects) {
      if (effect.kind !== kind) continue;
      if (!matchesAllKeywords(ability, effect.keywords)) continue;
      if (!featureConditionMet(character, effect.when)) continue;
      contributions.push({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        value: effect.value,
      });
    }
  }
  return contributions;
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
 * Damage modifiers apply only to abilities with a damage formula. `rolledOnly`
 * effects (the default) also need a power roll; an explicit `rolledOnly: false`
 * additionally allows a non-roll ability whose printed damage is numeric.
 * The caller still decides which tiers are actual damage tiers.
 */
export function featureAbilityDamageContributions(
  ability: Ability,
  character: Character,
): FeatureContribution[] {
  if (!hasDamageFormula(ability)) return [];
  const rolled = hasRollCharacteristics(ability);
  if (!rolled && !hasNumericDamageFormula(ability)) return [];

  const contributions: FeatureContribution[] = [];
  for (const source of activeFeatureSources(character)) {
    for (const effect of source.effects) {
      if (effect.kind !== "damage") continue;
      if (effect.rolledOnly !== false && !rolled) continue;
      if (!matchesAllKeywords(ability, effect.keywords)) continue;
      if (!featureConditionMet(character, effect.when)) continue;
      contributions.push({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        value: effect.value,
      });
    }
  }
  return contributions;
}

export function featureAbilityDamageBonus(
  ability: Ability,
  character: Character,
): number {
  return featureAbilityDamageContributions(ability, character).reduce(
    (total, contribution) => total + contribution.value,
    0,
  );
}

/**
 * Ranged distance modifiers never apply to a selected melee mode, even when the
 * ability still lists the ranged keyword from its dual-mode print.
 */
export function featureAbilityDistanceContributions(
  ability: Ability,
  character: Character,
): FeatureContribution[] {
  if (ability.weaponMode === "melee") return [];
  return abilityEffectContributions(ability, character, "distance");
}

export function featureAbilityDistanceBonus(
  ability: Ability,
  character: Character,
): number {
  return featureAbilityDistanceContributions(ability, character).reduce(
    (total, contribution) => total + contribution.value,
    0,
  );
}
