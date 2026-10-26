import type { FeatureMechanics } from "../types";
import { FURY_MECHANICS } from "./fury";

/**
 * Реестр механик классовых особенностей: ключ — `id` записи скелета.
 * Объект изменяемый — тесты подмешивают записи и убирают их после себя.
 * Наполняется по классам: записи из `fury.ts` (и следующих файлов классов)
 * вливаются сюда через `Object.assign(FEATURE_MECHANICS, ...)`.
 */
export const FEATURE_MECHANICS: Record<string, FeatureMechanics> = {
  ...FURY_MECHANICS,
};

/** Механика фичи или `undefined`, если она описана только прозой или ещё не разобрана. */
export function mechanicsFor(id: string): FeatureMechanics | undefined {
  return FEATURE_MECHANICS[id];
}

export { FURY_MECHANICS, FURY_RESOURCE } from "./fury";
export { NOT_YET, TEXT_ONLY } from "./exceptions";
export type { FeatureMechanics };
