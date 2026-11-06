import { ancestrySignatureFeatures } from "../data/ancestry-features/skeleton";
import type { Character } from "../types";
import { passiveClassFeatures, type FeatureSheetItem } from "./class-feature-view";

/** Знаковые черты выдаются происхождением, независимо от сохранённых выборов. */
export function sheetFeatures(character: Character): FeatureSheetItem[] {
  const signatures: FeatureSheetItem[] = ancestrySignatureFeatures(character.ancestry).map(
    (feature) => ({
      id: feature.id,
      name: feature.name,
      level: 1,
      source: `Происхождение · ${feature.ancestryName}`,
      category: "ancestry",
      passive: true,
      summary: "",
      detail: feature.description,
      badges: [],
    }),
  );
  return [...signatures, ...passiveClassFeatures(character)];
}
