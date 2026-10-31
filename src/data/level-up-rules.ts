import { CANONICAL_LEVEL_UP_RULES } from "../rules/consumer-level-up";
import type { CharacteristicKey, OriginalFields } from "../types";

export interface LevelUpFeature extends OriginalFields {
  id: string;
  name: string;
  description: string;
}

export interface LevelUpAbilityGroup {
  id: string;
  label: string;
  count: number;
  abilityIds: string[];
  subclasses?: string[];
  allowedLevels?: number[];
}

export interface LevelUpRule {
  className: string;
  level: number;
  articleId: string;
  title: string;
  features: LevelUpFeature[];
  characteristics?: {
    set?: Partial<Record<CharacteristicKey, number>>;
    increaseAll?: { amount: number; cap: number };
    choice?: { amount: number; cap: number };
  };
  skillCount: number;
  abilityChoices: LevelUpAbilityGroup[];
  grantedAbilities: { abilityIds: string[]; subclasses?: string[] }[];
}

export const LEVEL_UP_RULES: LevelUpRule[] = CANONICAL_LEVEL_UP_RULES;

export function levelUpRule(
  className: string,
  level: number,
): LevelUpRule | undefined {
  return LEVEL_UP_RULES.find(
    (rule) => rule.className === className && rule.level === level,
  );
}
