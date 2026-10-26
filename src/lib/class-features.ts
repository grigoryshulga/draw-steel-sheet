import { mechanicsFor } from "../data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../data/class-features/skeleton";
import type {
  FeatureEffect,
  FeatureKeyGroup,
  FeatureMechanics,
  GeneratedClassFeature,
  TriggerEvent,
  TriggerFrequency,
} from "../data/class-features/types";
import type { Character } from "../types";
import { featureConditionMet } from "./feature-conditions";
import { normalizeFeatureText } from "./utils";

/** Активная особенность класса: то, что лист показывает герою прямо сейчас. */
export interface ActiveClassFeature {
  id: string;
  name: string;
  level: number;
  className: string;
  keyedBy?: FeatureKeyGroup;
  keyValue?: string;
  description: string;
  /** `undefined` — фича описана только прозой или её механика ещё не разобрана. */
  mechanics: FeatureMechanics | undefined;
}

/** Один триггер активной особенности. */
export interface ActiveTrigger {
  featureId: string;
  name: string;
  level: number;
  event: TriggerEvent;
  frequency: TriggerFrequency;
  label: string;
  detail: string;
}

/** Эффекты одной активной особенности — источник для движка модификаторов. */
export interface ActiveClassFeatureEffects {
  sourceId: string;
  sourceName: string;
  effects: FeatureEffect[];
}

/**
 * Ключи групп выбора в `automation.classFeatureSelections`; ключ класса — в нижнем
 * регистре. Ключи не выводятся из `id` записи: приложение пишет свои
 * `conduit.prayer`, `talent.augmentation` (см. `classFeatureSelectionsFromDraft`),
 * и угаданный `<слаг>.<группа>` не совпал бы с ними, а в случае совпадения имени
 * задублировал бы бонусы старого реестра.
 *
 * В таблице одна запись — Неистовый (его механики разобраны в этом заходе).
 * Остальные восемь классов перечислены в `NOT_YET`: механик у них нет, эффектов
 * они не дают и дублировать нечего; при следующем заходе они получат здесь свои
 * записи, а старый реестр удалится вместе с ними. Класс без записи в таблице
 * по выборам не фильтруется вовсе — это зафиксировано тестом.
 */
const SELECTION_GROUPS: Record<
  string,
  Partial<Record<FeatureKeyGroup, string>>
> = {
  неистовый: { aspect: "fury.aspect" },
};

/** Ключ группы выбора для записи или `undefined`, если класс не в таблице. */
function selectionGroupId(
  feature: GeneratedClassFeature,
  keyedBy: FeatureKeyGroup,
): string | undefined {
  return SELECTION_GROUPS[normalizeFeatureText(feature.className)]?.[keyedBy];
}

/** Значение выбранного варианта группы по её ключу (`fury.aspect`). */
function selectedValueFor(
  selections: Record<string, string>,
  groupId: string,
): string | undefined {
  const wanted = normalizeFeatureText(groupId);
  for (const [key, value] of Object.entries(selections)) {
    if (typeof value !== "string") continue;
    if (normalizeFeatureText(key) === wanted) return value;
  }
  return undefined;
}

/** Части значения выбора: строка может перечислять варианты через запятую. */
function chosenValues(value: string): string[] {
  return value
    .split(",")
    .map(normalizeFeatureText)
    .filter(Boolean);
}

/**
 * Совпадение выбранного значения с `keyValue` записи. `keyValue` может
 * перечислять варианты через запятую («Берсерк, Разоритель»); сравнение идёт
 * по названию варианта без учёта регистра, пробелов по краям и ё/е.
 */
function keyValueMatches(selected: string | undefined, keyValue?: string): boolean {
  if (!keyValue) return true;
  if (selected === undefined) return false;
  const wanted = new Set(chosenValues(keyValue));
  return chosenValues(selected).some((value) => wanted.has(value));
}

/**
 * Правило активации: класс героя, его уровень и — только когда у записи задан
 * `keyedBy` и класс есть в таблице групп — выбранный вариант этой группы.
 * `parentId` на активацию не влияет: вложенная запись активна по своим правилам.
 * Пороговые строки таблиц (`keyValue` — число) разбираются без `keyedBy`
 * и активны по уровню.
 */
function isActiveClassFeature(
  feature: GeneratedClassFeature,
  character: Character,
): boolean {
  const className = normalizeFeatureText(character.className ?? "");
  if (!className || normalizeFeatureText(feature.className) !== className) {
    return false;
  }
  const level = typeof character.level === "number" ? character.level : 0;
  if (feature.level > level) return false;
  if (!feature.keyedBy) return true;

  const groupId = selectionGroupId(feature, feature.keyedBy);
  // Класса нет в таблице групп — выборам не доверяем и фильтрацию не применяем.
  if (!groupId) return true;

  const selections = character.automation?.classFeatureSelections;
  if (!selections || typeof selections !== "object") return false;
  return keyValueMatches(
    selectedValueFor(selections, groupId),
    feature.keyValue,
  );
}

/**
 * Активные особенности класса: по `level`, затем по `id`, без дублей.
 * От `automation.enabled` список не зависит — лист показывает фичи всегда,
 * а гейт авторасчёта стоит на эффектах в движке.
 */
export function activeClassFeatures(character: Character): ActiveClassFeature[] {
  const seen = new Set<string>();
  const active: ActiveClassFeature[] = [];
  for (const feature of GENERATED_CLASS_FEATURES) {
    if (seen.has(feature.id)) continue;
    if (!isActiveClassFeature(feature, character)) continue;
    seen.add(feature.id);
    active.push({
      id: feature.id,
      name: feature.name,
      level: feature.level,
      className: feature.className,
      ...(feature.keyedBy ? { keyedBy: feature.keyedBy } : {}),
      ...(feature.keyValue ? { keyValue: feature.keyValue } : {}),
      description: feature.description,
      mechanics: mechanicsFor(feature.id),
    });
  }
  return active.sort(
    (a, b) => a.level - b.level || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Триггеры активных особенностей: по одной записи на триггер фичи. */
export function classFeatureTriggers(character: Character): ActiveTrigger[] {
  const triggers: ActiveTrigger[] = [];
  for (const feature of activeClassFeatures(character)) {
    const trigger = feature.mechanics?.trigger;
    if (!trigger) continue;
    // Пороговые строки таблиц активируются по уровню, а не выбором аспекта:
    // аспект и порог ресурса проверяются условием триггера.
    if (!featureConditionMet(character, trigger.when)) continue;
    triggers.push({
      featureId: feature.id,
      name: feature.name,
      level: feature.level,
      event: trigger.event,
      frequency: trigger.frequency,
      label: trigger.label,
      detail: trigger.detail,
    });
  }
  return triggers;
}

/**
 * Эффекты активных особенностей для движка модификаторов. Фичи без механики
 * и без эффектов источником не считаются. `automation.enabled` проверяет
 * движок, а не эта функция: она отвечает только «что активно».
 */
export function activeClassFeatureEffects(
  character: Character,
): ActiveClassFeatureEffects[] {
  return activeClassFeatures(character).flatMap((feature) => {
    const effects = feature.mechanics?.effects;
    if (!effects?.length) return [];
    return [
      {
        sourceId: feature.id,
        sourceName: feature.name,
        effects: [...effects],
      },
    ];
  });
}
