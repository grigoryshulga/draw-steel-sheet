import legacy from "./legacy-ids.generated.json";

/**
 * Старые транслитерированные id, которые могли попасть в сохранённые листы.
 * Новые записи используют английские scc-id; чтение старых документов идёт
 * через этот слой, чтобы не терять перки, черты и способности.
 */
type LegacyMap = Record<string, string>;

const maps = legacy as {
  abilities: LegacyMap;
  classFeatures: LegacyMap;
  ancestryFeatures: LegacyMap;
  kits: LegacyMap;
  perks: LegacyMap;
  catalog: LegacyMap;
};

export const LEGACY_ABILITY_IDS = maps.abilities;
export const LEGACY_CLASS_FEATURE_IDS = maps.classFeatures;
export const LEGACY_ANCESTRY_FEATURE_IDS = maps.ancestryFeatures;
export const LEGACY_KIT_IDS = maps.kits;
export const LEGACY_PERK_IDS = maps.perks;
export const LEGACY_CATALOG_IDS = maps.catalog;

export function canonicalAbilityId(id: string): string {
  return LEGACY_ABILITY_IDS[id] ?? id;
}

export function canonicalClassFeatureId(id: string): string {
  return LEGACY_CLASS_FEATURE_IDS[id] ?? id;
}

export function canonicalAncestryFeatureId(id: string): string {
  return LEGACY_ANCESTRY_FEATURE_IDS[id] ?? id;
}

export function canonicalKitId(id: string): string {
  return LEGACY_KIT_IDS[id] ?? id;
}

export function canonicalPerkId(id: string): string {
  return LEGACY_PERK_IDS[id] ?? id;
}

export function canonicalCatalogId(id: string): string {
  return LEGACY_CATALOG_IDS[id] ?? id;
}
