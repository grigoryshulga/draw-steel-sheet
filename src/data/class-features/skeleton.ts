import { CONSUMER_CLASS_FEATURES } from "../../rules/consumer-features";
import {
  CLASS_FEATURE_STRUCTURE,
  CLASS_FEATURE_SYNTHETIC_ROWS,
} from "./legacy-rows";
import type { GeneratedClassFeature } from "./types";
import { canonicalClassFeatureId } from "../originals";

/**
 * Скелет классовых особенностей: разобранный текст книги без механики.
 * Основные записи приходят из канонической проекции
 * `generated/consumers/features.json`; 82 строки таблиц, которые канон оставил
 * внутри Markdown родителей, лежат в рукописном `legacy-rows.ts` вместе со
 * структурой вложенности и групп выбора.
 * Массив изменяемый — тесты подмешивают временные записи и убирают их после себя.
 */
function structureFor(feature: { id: string; legacyId?: string }) {
  const abilityVariant = feature.id.replace(/^feature\./, "feature.ability.");
  const structure =
    CLASS_FEATURE_STRUCTURE[feature.legacyId ?? feature.id] ??
    CLASS_FEATURE_STRUCTURE[feature.id] ??
    CLASS_FEATURE_STRUCTURE[abilityVariant] ??
    {};
  return {
    ...structure,
    ...(structure.parentId
      ? { parentId: canonicalClassFeatureId(structure.parentId) }
      : {}),
  };
}

export const GENERATED_CLASS_FEATURES: GeneratedClassFeature[] = [
  ...CONSUMER_CLASS_FEATURES.map((feature) => ({
    id: feature.id,
    ...(feature.legacyId ? { legacyId: feature.legacyId } : {}),
    ...(feature.originalId ? { originalId: feature.originalId } : {}),
    ...(feature.originalName ? { originalName: feature.originalName } : {}),
    ...(feature.originalDescription
      ? { originalDescription: feature.originalDescription }
      : {}),
    className: feature.className,
    level: feature.level,
    name: feature.name,
    ...structureFor(feature),
    articleId: feature.articleId,
    description: feature.description,
  })),
  ...CLASS_FEATURE_SYNTHETIC_ROWS.map((row) => ({
    ...row,
    id: canonicalClassFeatureId(row.id),
    ...(row.parentId
      ? { parentId: canonicalClassFeatureId(row.parentId) }
      : {}),
  })),
];
