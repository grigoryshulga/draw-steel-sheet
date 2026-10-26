import { CLASS_FEATURE_GROUPS } from "../data/class-feature-rules";
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

/** Названия опций старого реестра: выбор может хранить ID вместо названия. */
const CLASS_FEATURE_OPTION_NAMES = new Map<string, string>(
  CLASS_FEATURE_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.id, option.name] as const),
  ),
);

/**
 * id группы выбора собирается из id записи: `<слаг класса>.<группа>`,
 * например `fury.aspect` для аспекта Неистового.
 */
function selectionGroupId(
  feature: GeneratedClassFeature,
  keyedBy: FeatureKeyGroup,
): string {
  const classSlug = feature.id.split(".")[0] ?? "";
  return classSlug ? `${classSlug}.${keyedBy}` : keyedBy;
}

/**
 * Значение выбранного варианта группы. Ключ группы — `<слаг класса>.<группа>`,
 * например `fury.aspect` для аспекта Неистового.
 */
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
  const values = value
    .split(",")
    .map(normalizeFeatureText)
    .filter(Boolean);
  const name = CLASS_FEATURE_OPTION_NAMES.get(value);
  if (name) values.push(normalizeFeatureText(name));
  return values;
}

/**
 * Совпадение выбранного значения с `keyValue` записи. `keyValue` может
 * перечислять варианты через запятую («Берсерк, Разоритель»); сравнение идёт
 * по ID и названию без учёта регистра, пробелов по краям и ё/е.
 */
function keyValueMatches(selected: string | undefined, keyValue?: string): boolean {
  if (!keyValue) return true;
  if (selected === undefined) return false;
  const wanted = new Set(chosenValues(keyValue));
  return chosenValues(selected).some((value) => wanted.has(value));
}

/**
 * Правило активации: класс героя, его уровень и — только когда у записи задан
 * `keyedBy` — выбранный вариант этой группы. `parentId` на активацию не влияет:
 * вложенная запись активна по своим правилам. Пороговые строки таблиц
 * (`keyValue` — число) разбираются без `keyedBy` и активны по уровню.
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

  const selections = character.automation?.classFeatureSelections;
  if (!selections || typeof selections !== "object") return false;
  const selected = selectedValueFor(
    selections,
    selectionGroupId(feature, feature.keyedBy),
  );
  return keyValueMatches(selected, feature.keyValue);
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
