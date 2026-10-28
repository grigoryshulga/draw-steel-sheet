import type { HeroicResourceSpec } from "./types";
import { normalizeFeatureText } from "../../lib/utils";
import { FURY_RESOURCE } from "./mechanics/fury";
import { CENSOR_RESOURCE } from "./mechanics/censor-resource";
import { CONDUIT_RESOURCE } from "./mechanics/conduit-resource";
import { ELEMENTALIST_RESOURCE } from "./mechanics/elementalist-resource";
import { NULL_RESOURCE } from "./mechanics/null-resource";
import { SHADOW_RESOURCE } from "./mechanics/shadow-resource";
import { TALENT_RESOURCE } from "./mechanics/talent-resource";
import { TACTICIAN_RESOURCE } from "./mechanics/tactician-resource";
import { TROUBADOUR_RESOURCE } from "./mechanics/troubadour-resource";

/**
 * Героические ресурсы классов: как ресурс набирается и на что заменяется
 * с ростом уровня. Ключ — имя класса в нормализованном виде
 * (`normalizeFeatureText`: нижний регистр, без ё), значение — спецификация
 * ресурса из книги.
 *
 * Объект изменяемый — тесты подмешивают записи и убирают их после себя.
 * Спецификации ресурсов всех девяти классов лежат рядом с их механиками
 * (`mechanics/*-resource.ts`) и регистрируются здесь по нормализованному имени.
 */
export const CLASS_RESOURCES: Record<string, HeroicResourceSpec> = {
  [normalizeFeatureText("Неистовый")]: FURY_RESOURCE,
  [normalizeFeatureText("Цензор")]: CENSOR_RESOURCE,
  [normalizeFeatureText("Проводник")]: CONDUIT_RESOURCE,
  [normalizeFeatureText("Элементалист")]: ELEMENTALIST_RESOURCE,
  [normalizeFeatureText("Нуль")]: NULL_RESOURCE,
  [normalizeFeatureText("Тень")]: SHADOW_RESOURCE,
  [normalizeFeatureText("Талант")]: TALENT_RESOURCE,
  [normalizeFeatureText("Тактик")]: TACTICIAN_RESOURCE,
  [normalizeFeatureText("Трубадур")]: TROUBADOUR_RESOURCE,
};

/** Спецификация ресурса класса или `undefined`, если ресурс ещё не разобран. */
export function resourceSpecFor(
  className: string,
): HeroicResourceSpec | undefined {
  const key = normalizeFeatureText(className);
  if (!key) return undefined;
  return CLASS_RESOURCES[key];
}
