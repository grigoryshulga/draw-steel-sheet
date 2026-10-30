import raw from "../ancestry-features.generated.json";
import type { GeneratedAncestryFeature } from "./types";

/**
 * Скелет особенностей происхождений: разобранный текст книги без механики.
 * Собирается `node scripts/build-ancestry-features.mjs`, руками не правится.
 * Массив изменяемый — тесты подмешивают временные записи и убирают их после себя.
 */
export const GENERATED_ANCESTRY_FEATURES =
  raw as GeneratedAncestryFeature[];

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
  return GENERATED_ANCESTRY_FEATURES.find((feature) => feature.id === id);
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
