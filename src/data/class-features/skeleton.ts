import { CONSUMER_CLASS_FEATURES } from "../../rules/consumer-features";
import {
  CLASS_FEATURE_STRUCTURE,
  CLASS_FEATURE_SYNTHETIC_ROWS,
} from "./legacy-rows";
import type { GeneratedClassFeature } from "./types";

/**
 * Скелет классовых особенностей: разобранный текст книги без механики.
 * Основные записи приходят из канонической проекции
 * `generated/consumers/features.json`; 82 строки таблиц, которые канон оставил
 * внутри Markdown родителей, лежат в рукописном `legacy-rows.ts` вместе со
 * структурой вложенности и групп выбора.
 * Массив изменяемый — тесты подмешивают временные записи и убирают их после себя.
 */
export const GENERATED_CLASS_FEATURES: GeneratedClassFeature[] = [
  ...CONSUMER_CLASS_FEATURES.map((feature) => ({
    id: feature.id,
    className: feature.className,
    level: feature.level,
    name: feature.name,
    ...(CLASS_FEATURE_STRUCTURE[feature.id] ?? {}),
    articleId: feature.articleId,
    description: feature.description,
  })),
  ...CLASS_FEATURE_SYNTHETIC_ROWS,
];
