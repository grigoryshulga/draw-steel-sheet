import { emptyBuilderDraft, type BuilderDraft } from "./character-builder";

export const BUILDER_DRAFT_KEY = "ds-builder-draft-v1";

export function scopedStorageKey(key: string, scope: string): string {
  return scope === "local" ? key : `${key}:${scope}`;
}

/** Восстанавливает черновик, отбрасывая поля неверного формата. */
export function readBuilderDraft(key: string): BuilderDraft {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (
      stored?.version === 1 &&
      Array.isArray(stored.traits) &&
      Array.isArray(stored.abilityIds)
    ) {
      const base = emptyBuilderDraft();
      return {
        ...base,
        ...stored,
        ancestryChoices:
          stored.ancestryChoices &&
          typeof stored.ancestryChoices === "object" &&
          !Array.isArray(stored.ancestryChoices) &&
          Object.values(stored.ancestryChoices).every(
            (value) => typeof value === "string",
          )
            ? { ...stored.ancestryChoices }
            : base.ancestryChoices,
        ancestrySkills: Array.isArray(stored.ancestrySkills)
          ? stored.ancestrySkills.filter((value: unknown): value is string => typeof value === "string")
          : base.ancestrySkills,
        culture: { ...base.culture, ...stored.culture },
        characteristics: { ...base.characteristics, ...stored.characteristics },
      };
    }
  } catch {
    /* Start fresh if storage is unavailable or malformed. */
  }
  return emptyBuilderDraft();
}
