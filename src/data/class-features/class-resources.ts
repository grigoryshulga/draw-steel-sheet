import type { HeroicResourceSpec } from "./types";
import { normalizeFeatureText } from "../../lib/utils";

/**
 * Героические ресурсы классов: как ресурс набирается и на что заменяется
 * с ростом уровня. Ключ — имя класса в нормализованном виде
 * (`normalizeFeatureText`: нижний регистр, без ё), значение — спецификация
 * ресурса из книги.
 *
 * Объект изменяемый — тесты подмешивают записи и убирают их после себя.
 * Наполняется по классам: данные Неистового приходят отдельным заходом.
 * Движок накопления прибавок живёт в `src/lib/resources.ts`.
 */
export const CLASS_RESOURCES: Record<string, HeroicResourceSpec> = {};

/** Спецификация ресурса класса или `undefined`, если ресурс ещё не разобран. */
export function resourceSpecFor(
  className: string,
): HeroicResourceSpec | undefined {
  const key = normalizeFeatureText(className);
  if (!key) return undefined;
  return CLASS_RESOURCES[key];
}
