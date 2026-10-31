import { CONSUMER_ANCESTRY_FEATURES } from "../../rules/consumer-features";
import type { GeneratedAncestryFeature } from "./types";
import { canonicalAncestryFeatureId } from "../originals";

/**
 * Скелет особенностей происхождений: разобранный текст книги без механики.
 * Данные приходят из канонической проекции `generated/consumers/features.json`
 * через адаптер `src/rules/consumer-features.ts`; уровень канон трактует как 1.
 * Массив изменяемый — тесты подмешивают временные записи и убирают их после себя.
 */
export const GENERATED_ANCESTRY_FEATURES: GeneratedAncestryFeature[] =
  CONSUMER_ANCESTRY_FEATURES.map((feature) => ({
    id: feature.id,
    ...(feature.legacyId ? { legacyId: feature.legacyId } : {}),
    ...(feature.originalId ? { originalId: feature.originalId } : {}),
    ...(feature.originalName ? { originalName: feature.originalName } : {}),
    ...(feature.originalDescription
      ? { originalDescription: feature.originalDescription }
      : {}),
    ancestryName: feature.ancestryName,
    kind: feature.ancestryKind,
    name: feature.name,
    ...(feature.cost !== undefined ? { cost: feature.cost } : {}),
    articleId: feature.articleId,
    description: feature.description,
  }));

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
}

let indexedLength = -1;
let featuresByAncestry = new Map<string, GeneratedAncestryFeature[]>();

function ensureIndex(): void {
  if (indexedLength === GENERATED_ANCESTRY_FEATURES.length) return;
  featuresByAncestry = new Map();
  for (const feature of GENERATED_ANCESTRY_FEATURES) {
    const key = normalize(feature.ancestryName);
    const records = featuresByAncestry.get(key);
    if (records) records.push(feature);
    else featuresByAncestry.set(key, [feature]);
  }
  indexedLength = GENERATED_ANCESTRY_FEATURES.length;
}

/** Все записи происхождения в порядке книги: знаковые, затем купленные. */
export function ancestryFeatureRecords(
  ancestryName: string,
): GeneratedAncestryFeature[] {
  ensureIndex();
  return featuresByAncestry.get(normalize(ancestryName)) ?? [];
}

/** Запись по каноническому ID. */
export function ancestryFeatureById(
  id: string,
): GeneratedAncestryFeature | undefined {
  const canonical = canonicalAncestryFeatureId(id);
  return GENERATED_ANCESTRY_FEATURES.find(
    (feature) => feature.id === canonical || feature.legacyId === canonical,
  );
}

/** Запись по точному названию внутри происхождения. */
export function ancestryFeatureByName(
  ancestryName: string,
  name: string,
): GeneratedAncestryFeature | undefined {
  const wanted = normalize(name);
  return ancestryFeatureRecords(ancestryName).find(
    (feature) => normalize(feature.name) === wanted,
  );
}

/** Знаковые черты происхождения — они выдаются без выбора. */
export function ancestrySignatureFeatures(
  ancestryName: string,
): GeneratedAncestryFeature[] {
  return ancestryFeatureRecords(ancestryName).filter(
    (feature) => feature.kind === "signature",
  );
}

/** Купленная черта происхождения по названию, без знаковых. */
export function ancestryTraitFeature(
  ancestryName: string,
  name: string,
): GeneratedAncestryFeature | undefined {
  const feature = ancestryFeatureByName(ancestryName, name);
  return feature?.kind === "trait" ? feature : undefined;
}

/** Канонические ID выбранных по названиям черт; порядок — порядок названий. */
export function ancestryTraitIdsFromNames(
  ancestryName: string,
  names: readonly string[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const feature = ancestryFeatureRecords(ancestryName).find(
      (candidate) => candidate.kind === "trait" && candidate.name === name,
    );
    if (!feature || seen.has(feature.id)) continue;
    seen.add(feature.id);
    ids.push(feature.id);
  }
  return ids;
}
