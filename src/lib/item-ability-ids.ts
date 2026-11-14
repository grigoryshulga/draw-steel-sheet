import { canonicalAbilityId } from "../data/originals";

export function normalizeItemAbilityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200).map(canonicalAbilityId))].slice(0, 16);
}
