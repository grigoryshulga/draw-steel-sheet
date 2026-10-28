import type { HeroicResourceSpec } from "./types";
import { normalizeFeatureText } from "../../lib/utils";
import { FURY_RESOURCE } from "./mechanics/fury";
import { CENSOR_RESOURCE } from "./mechanics/censor-resource";
import { CONDUIT_RESOURCE } from "./mechanics/conduit-resource";
import { NULL_RESOURCE } from "./mechanics/null-resource";
import { TALENT_RESOURCE } from "./mechanics/talent-resource";

/**
 * Героические ресурсы классов: как ресурс набирается и на что заменяется
 * с ростом уровня. Ключ — имя класса в нормализованном виде
 * (`normalizeFeatureText`: нижний регистр, без ё), значение — спецификация
 * ресурса из книги.
 *
 * Объект изменяемый — тесты подмешивают записи и убирают их после себя.
 * Неистовый и Цензор разобраны полностью: их спецификации лежат рядом с
 * механиками классов (`mechanics/fury.ts`, `mechanics/censor-resource.ts`)
 * и регистрируются здесь по нормализованному имени.
 * Остальные классы получат свои записи следующим заходом.
 */
export const CLASS_RESOURCES: Record<string, HeroicResourceSpec> = {
  [normalizeFeatureText("Неистовый")]: FURY_RESOURCE,
  [normalizeFeatureText("Цензор")]: CENSOR_RESOURCE,
  [normalizeFeatureText("Проводник")]: CONDUIT_RESOURCE,
  [normalizeFeatureText("Нуль")]: NULL_RESOURCE,
  [normalizeFeatureText("Талант")]: TALENT_RESOURCE,
};

/** Спецификация ресурса класса или `undefined`, если ресурс ещё не разобран. */
export function resourceSpecFor(
  className: string,
): HeroicResourceSpec | undefined {
  const key = normalizeFeatureText(className);
  if (!key) return undefined;
  return CLASS_RESOURCES[key];
}
