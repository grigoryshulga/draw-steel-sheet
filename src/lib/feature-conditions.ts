import {
  CLASS_FEATURE_GROUPS,
} from "../data/class-feature-rules";
import type { FeatureCondition } from "../data/class-features/types";
import type { Character } from "../types";
import { normalizeFeatureText as normalize } from "./utils";

/**
 * Условия, при которых действует эффект или триггер классовой особенности.
 *
 * Модуль отдельный от `feature-modifiers`, потому что условия нужны и списку
 * триггеров (`src/lib/class-features.ts`): движок модификаторов сам зависит от
 * этого списка, и общий импорт замкнул бы модули в цикл.
 */

/**
 * `runtime` появится в `Character` позже; читаем его через структурный взгляд,
 * чтобы не опережать задачу о состоянии схватки.
 */
export interface CharacterRuntimeLike {
  forms?: string[];
  resources?: Record<string, number>;
}

/** Названия опций по ID: нужны условию `keyValue`, где данные пишут имя группы. */
const CLASS_FEATURE_OPTION_NAMES = new Map<string, string>(
  CLASS_FEATURE_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.id, option.name] as const),
  ),
);

function hasAnyKit(character: Character): boolean {
  return [character.kit, character.secondaryKit ?? ""].some(
    (name) => typeof name === "string" && name.trim() !== "",
  );
}

function runtimeOf(character: Character): CharacterRuntimeLike {
  return (character as Character & { runtime?: CharacterRuntimeLike }).runtime ?? {};
}

/** Текущее значение героического ресурса по имени: лист героя, затем runtime. */
function currentResourceValue(character: Character, name: string): number {
  const wanted = normalize(name);
  const sheetResource = character.heroicResource;
  if (
    sheetResource &&
    typeof sheetResource.name === "string" &&
    normalize(sheetResource.name) === wanted
  ) {
    return typeof sheetResource.current === "number" ? sheetResource.current : 0;
  }
  const resources = runtimeOf(character).resources;
  if (!resources || typeof resources !== "object") return 0;
  for (const [key, value] of Object.entries(resources)) {
    if (normalize(key) === wanted && typeof value === "number") return value;
  }
  return 0;
}

/**
 * Группы выбора, значение которых приложение пока не записывает в
 * `automation.classFeatureSelections`: у Неистового аспект выбирается как
 * подкласс героя (`character.subclass`). Ключ — `id` группы, значение — поле
 * `Character`, откуда брать выбор, пока задача 9 не начнёт писать его в выборы.
 */
const SUBCLASS_BACKED_GROUPS: Record<string, "subclass"> = {
  "fury.aspect": "subclass",
};

/** Явный выбор группы из `automation.classFeatureSelections`, если он есть. */
function explicitSelection(
  character: Character,
  groupId: string,
): string | undefined {
  const selections = character.automation?.classFeatureSelections;
  if (!selections || typeof selections !== "object") return undefined;
  const wanted = normalize(groupId);
  for (const [key, value] of Object.entries(selections)) {
    if (typeof value !== "string") continue;
    if (normalize(key) === wanted) return value;
  }
  return undefined;
}

/**
 * Выбранное значение группы с фолбэком: сначала явный выбор в
 * `automation.classFeatureSelections`, затем поле, которое пишет приложение
 * (`character.subclass` для `fury.aspect` — аспект Неистового). Явный выбор
 * всегда перекрывает фолбэк, поэтому два источника не показывают два правила
 * сразу. Общая точка для активации фич и для условий эффектов.
 */
export function selectedGroupValue(
  character: Character,
  groupId: string,
): string | undefined {
  const explicit = explicitSelection(character, groupId);
  if (explicit !== undefined) return explicit;

  const field = SUBCLASS_BACKED_GROUPS[normalize(groupId)];
  if (field !== "subclass") return undefined;
  const subclass = character.subclass;
  return typeof subclass === "string" && subclass.trim() !== "" ? subclass : undefined;
}

/** Значения ключевых групп, выбранные героем: и ID опции, и её название. */
function selectedKeyValues(character: Character): Set<string> {
  const selected = new Set<string>();
  const selections = character.automation?.classFeatureSelections;
  if (selections && typeof selections === "object") {
    for (const optionId of Object.values(selections)) {
      if (typeof optionId !== "string") continue;
      selected.add(normalize(optionId));
      const name = CLASS_FEATURE_OPTION_NAMES.get(optionId);
      if (name) selected.add(normalize(name));
    }
  }
  // Фолбэк для групп, которые приложение хранит вне выборов (аспект → подкласс).
  for (const groupId of Object.keys(SUBCLASS_BACKED_GROUPS)) {
    const value = selectedGroupValue(character, groupId);
    if (value !== undefined) selected.add(normalize(value));
  }
  return selected;
}

/**
 * Условия эффекта. Снаряжение читается только из флагов автоматизации: проза
 * оружия/брони, заметки инвентаря и `automation.enabled` на условие не влияют.
 * Функция ничего не меняет в герое.
 */
export function featureConditionMet(
  character: Character,
  condition?: FeatureCondition,
): boolean {
  if (!condition) return true;

  const equipment = condition.equipment;
  if (equipment) {
    const flags = character.automation?.equipment;
    if (equipment.lightArmor === true && flags?.lightArmor !== true) return false;
    if (equipment.lightWeapon === true && flags?.lightWeapon !== true) return false;
  }
  if (condition.noKit && hasAnyKit(character)) return false;
  if (
    condition.minLevel !== undefined &&
    (typeof character.level !== "number" || character.level < condition.minLevel)
  ) {
    return false;
  }
  if (condition.keyValue?.length) {
    const selected = selectedKeyValues(character);
    const matched = condition.keyValue.some((value) =>
      selected.has(normalize(value)),
    );
    if (!matched) return false;
  }
  if (condition.resourceAtLeast) {
    const { name, value } = condition.resourceAtLeast;
    if (currentResourceValue(character, name) < value) return false;
  }
  if (condition.formActive) {
    const wanted = normalize(condition.formActive);
    const forms = runtimeOf(character).forms ?? [];
    if (!forms.some((form) => typeof form === "string" && normalize(form) === wanted)) {
      return false;
    }
  }
  return true;
}
