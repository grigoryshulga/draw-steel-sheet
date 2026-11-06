import type { Character } from "../types";

export const MAX_CHARACTER_LEVEL = 10;
export const LEVEL_UP_XP_STEP = 16;

export function levelUpXpRequirement(toLevel: number): number {
  if (!Number.isFinite(toLevel)) return 0;
  return Math.max(0, (Math.floor(toLevel) - 1) * LEVEL_UP_XP_STEP);
}

/** XP display does not require constructing every ability/perk choice for a level. */
export function levelUpProgress(character: Pick<Character, "level" | "xp" | "xpThreshold">) {
  const fromLevel = Number.isSafeInteger(character.level) ? character.level : 1;
  const toLevel = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, fromLevel + 1));
  const custom = character.xpThreshold;
  const xpRequired = custom?.level === toLevel && Number.isSafeInteger(custom.value) &&
    custom.value >= 0 && custom.value <= 999999 ? custom.value : levelUpXpRequirement(toLevel);
  const xp = Number.isFinite(character.xp) ? Number(character.xp) : 0;
  return { fromLevel, toLevel, xpRequired, xpMissing: Math.max(0, xpRequired - xp) };
}
