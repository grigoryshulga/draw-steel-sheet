import type { HeroicResourceSpec } from "./types";
import { normalizeFeatureText } from "../../lib/utils";
import { FURY_RESOURCE } from "./mechanics/fury";

/**
 * Героические ресурсы классов: как ресурс набирается и на что заменяется
 * с ростом уровня. Ключ — имя класса в нормализованном виде
 * (`normalizeFeatureText`: нижний регистр, без ё), значение — спецификация
 * ресурса из книги.
 *
 * Объект изменяемый — тесты подмешивают записи и убирают их после себя.
 * Неистовый разобран полностью: его спецификация лежит в `mechanics/fury.ts`
 * рядом с механиками класса и регистрируется здесь по нормализованному имени.
 * Остальные восемь классов получат свои записи следующим заходом.
 */
export const CLASS_RESOURCES: Record<string, HeroicResourceSpec> = {
  [normalizeFeatureText("Неистовый")]: FURY_RESOURCE,
};

/** Спецификация ресурса класса или `undefined`, если ресурс ещё не разобран. */
export function resourceSpecFor(
  className: string,
): HeroicResourceSpec | undefined {
  const key = normalizeFeatureText(className);
  if (!key) return undefined;
  return CLASS_RESOURCES[key];
}
