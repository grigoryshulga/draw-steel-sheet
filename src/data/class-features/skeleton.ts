import raw from "../class-features.generated.json";
import type { GeneratedClassFeature } from "./types";

/**
 * Скелет классовых особенностей: разобранный текст книги без механики.
 * Массив изменяемый — тесты подмешивают временные записи и убирают их после себя.
 * Собирается `node scripts/build-class-features.mjs`, руками не правится.
 */
export const GENERATED_CLASS_FEATURES = raw as GeneratedClassFeature[];
