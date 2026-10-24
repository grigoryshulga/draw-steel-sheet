import {
  CLASS_FEATURE_GROUPS,
  type ClassFeatureGroup,
  type ClassFeatureOption,
  type FeatureEffect,
  type FeatureStat,
} from "../data/class-feature-rules";
import type { Ability, Character } from "../types";

export interface FeatureContribution {
  sourceId: string;
  sourceName: string;
  value: number;
}

interface ActiveFeatureOption {
  group: ClassFeatureGroup;
  option: ClassFeatureOption;
}

type AbilityEffect = Extract<FeatureEffect, { kind: "damage" | "distance" }>;

/** Keyword/class comparisons ignore case, surrounding whitespace and ё/е spelling. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

/** Draw Steel echelons start at levels 1/4/7/10. */
function featureEchelon(level: number): number {
  if (!Number.isFinite(level)) return 1;
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel >= 10) return 4;
  if (safeLevel >= 7) return 3;
  if (safeLevel >= 4) return 2;
  return 1;
}

function optionEffects(option: ClassFeatureOption): FeatureEffect[] {
  return Array.isArray(option.effects) ? option.effects : [];
}

/**
 * Resolve selections once. Effects are active only for enabled automation, the
 * current class and a known group/option pair; unknown or foreign IDs are ignored.
 */
function activeFeatureOptions(character: Character): ActiveFeatureOption[] {
  const automation = character.automation;
  if (!automation?.enabled) return [];
  const selections = automation.classFeatureSelections;
  if (!selections || typeof selections !== "object") return [];

  const className = normalize(character.className);
  if (!className) return [];

  const active: ActiveFeatureOption[] = [];
  for (const group of CLASS_FEATURE_GROUPS) {
    if (normalize(group.className) !== className) continue;
    const optionId = selections[group.id];
    if (typeof optionId !== "string") continue;
    const option = group.options.find((candidate) => candidate.id === optionId);
    if (option) active.push({ group, option });
  }
  return active;
}

function statContribution(
  option: ClassFeatureOption,
  effect: Extract<FeatureEffect, { kind: "stat" }>,
  echelon: number,
): FeatureContribution {
  return {
    sourceId: option.id,
    sourceName: option.name,
    value: effect.value + (effect.perEchelon ?? 0) * echelon,
  };
}

export function featureStatContributions(
  character: Character,
  stat: FeatureStat,
): FeatureContribution[] {
  const echelon = featureEchelon(character.level);
  const contributions: FeatureContribution[] = [];
  for (const { option } of activeFeatureOptions(character)) {
    for (const effect of optionEffects(option)) {
      if (effect.kind !== "stat" || effect.stat !== stat) continue;
      contributions.push(statContribution(option, effect, echelon));
    }
  }
  return contributions;
}

/** Sum of all active class-feature effects for one stat; saved maxima and adjustments stay untouched. */
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
  for (const { option } of activeFeatureOptions(character)) {
    for (const effect of optionEffects(option)) {
      if (effect.kind !== kind) continue;
      if (!matchesAllKeywords(ability, effect.keywords)) continue;
      contributions.push({
        sourceId: option.id,
        sourceName: option.name,
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

/**
 * Damage modifiers apply only to abilities with a power roll and a damage
 * formula; the caller decides which tiers are actual damage tiers.
 */
export function featureAbilityDamageContributions(
  ability: Ability,
  character: Character,
): FeatureContribution[] {
  if (!hasRollCharacteristics(ability) || !hasDamageFormula(ability)) return [];
  return abilityEffectContributions(ability, character, "damage");
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
