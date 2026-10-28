import {
  CLASS_FEATURE_GROUPS,
} from "../data/class-feature-rules";
import { GENERATED_CLASS_FEATURES } from "../data/class-features/skeleton";
import type { FeatureCondition, FeatureKeyGroup } from "../data/class-features/types";
import type { Character } from "../types";
import { normalizeFeatureText as normalize } from "./utils";
import { currentRuntime } from "./runtime";

/**
 * Условия, при которых действует эффект или триггер классовой особенности.
 *
 * Модуль отдельный от `feature-modifiers`, потому что условия нужны и списку
 * триггеров (`src/lib/class-features.ts`): движок модификаторов сам зависит от
 * этого списка, и общий импорт замкнул бы модули в цикл.
 */

/**
 * Названия опций по ID: нужны условию `keyValue`, где данные пишут имя группы.
 */
const CLASS_FEATURE_OPTION_NAMES = new Map<string, string>(
  CLASS_FEATURE_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.id, option.name] as const),
  ),
);

/**
 * Какая группа владеет вариантом: по ID и по русскому названию. Нужно, чтобы
 * значение, положенное не в свою группу (например, оберег в выборе аугментации),
 * не активировало чужую особенность. Название попадает в карту, только если оно
 * однозначно.
 */
function optionOwnerMaps(): {
  byId: Map<string, string>;
  byName: Map<string, string>;
} {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const group of CLASS_FEATURE_GROUPS) {
    for (const option of group.options) {
      byId.set(option.id, group.id);
      const name = normalize(option.name);
      if (byName.has(name) && byName.get(name) !== group.id) ambiguous.add(name);
      else byName.set(name, group.id);
    }
  }
  for (const name of ambiguous) byName.delete(name);
  return { byId, byName };
}

const { byId: OPTION_OWNER_BY_ID, byName: OPTION_OWNER_BY_NAME } =
  optionOwnerMaps();

function hasAnyKit(character: Character): boolean {
  return [character.kit, character.secondaryKit ?? ""].some(
    (name) => typeof name === "string" && name.trim() !== "",
  );
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
  const resources = currentRuntime(character).resources;
  if (!resources || typeof resources !== "object") return 0;
  for (const [key, value] of Object.entries(resources)) {
    if (normalize(key) === wanted && typeof value === "number") return value;
  }
  return 0;
}

/**
 * Ключи групп выбора в `automation.classFeatureSelections`; ключ класса — в
 * нижнем регистре. Ключи не выводятся из `id` записи: приложение пишет свои
 * `conduit.prayer`, `talent.augmentation` (см. `classFeatureSelectionsFromDraft`),
 * и угаданный `<слаг>.<группа>` не совпал бы с ними, а в случае совпадения имени
 * задублировал бы бонусы старого реестра.
 *
 * У Проводника выбор доменов добавлен для корректной фильтрации записей, у
 * Цензора — орден и домен. Класс без записи в таблице по выборам не
 * фильтруется вовсе — это зафиксировано тестом.
 *
 * Таблица живёт в модуле условий, потому что условия (`when.keyValue`) и
 * активация записей обязаны отвечать на вопрос «какой выбор здесь действует»
 * одинаково. Группа ищется по паре «класс + вид группы»: у Цензора их две
 * (орден и домен), и общий для класса ответ был бы неверным.
 */
const SELECTION_GROUPS: Record<
  string,
  Partial<Record<FeatureKeyGroup, string>>
> = {
  неистовый: { aspect: "fury.aspect" },
  проводник: { domain: "conduit.domain" },
  // У Цензора два независимых выбора: орден (подкласс) и один домен.
  цензор: { order: "censor.order", domain: "censor.domain" },
  талант: { tradition: "talent.tradition" },
};

/**
 * Ключ группы выбора для класса и вида группы. `undefined` — класса нет в
 * таблице: тогда выборы не фильтруются (старое поведение), а панель листа не
 * показывает такие записи, потому что не может понять, выбраны ли они.
 */
export function selectionGroupFor(
  className: string,
  keyedBy: FeatureKeyGroup,
): string | undefined {
  return SELECTION_GROUPS[normalize(className)]?.[keyedBy];
}

/**
 * Группы выбора, значение которых приложение пока не записывает в
 * `automation.classFeatureSelections`: у Неистового аспект и у Проводника
 * домены могут читаться из `character.subclass`. Ключ — `id` группы, значение
 * — класс, для которого разрешён фолбэк к подклассу.
 */
const SUBCLASS_BACKED_GROUPS: Record<string, string> = {
  "fury.aspect": "Неистовый",
  "conduit.domain": "Проводник",
  // Орден Цензора — это его подкласс: билдер пишет его название в
  // `character.subclass`, отдельного поля у приложения нет.
  "censor.order": "Цензор",
  // Традиция Таланта — его подкласс: билдер пишет название в `subclass`.
  "talent.tradition": "Талант",
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
 * `automation.classFeatureSelections`, затем подкласс для зарегистрированных
 * групп и классов. Явный выбор всегда перекрывает фолбэк. Общая точка для
 * активации фич и для условий эффектов.
 */
export function selectedGroupValue(
  character: Character,
  groupId: string,
): string | undefined {
  const explicit = explicitSelection(character, groupId);
  if (explicit !== undefined) return explicit;

  const fallbackClass = SUBCLASS_BACKED_GROUPS[normalize(groupId)];
  if (!fallbackClass || normalize(character.className ?? "") !== normalize(fallbackClass)) {
    return undefined;
  }
  const subclass = character.subclass;
  return typeof subclass === "string" && subclass.trim() !== "" ? subclass : undefined;
}

/** Значения ключевых групп, выбранные героем: и ID опции, и её название. */
function selectedKeyValues(
  character: Character,
  conditionValues: string[],
): Set<string> {
  const selected = new Set<string>();
  const className = normalize(character.className ?? "");
  const groupsByValue = new Map<string, Set<string>>();
  for (const feature of GENERATED_CLASS_FEATURES) {
    if (!feature.keyedBy || !feature.keyValue) continue;
    const registeredGroup = selectionGroupFor(feature.className, feature.keyedBy);
    if (!registeredGroup) continue;
    for (const conditionValue of conditionValues) {
      const wanted = normalize(conditionValue);
      if (
        [feature.keyValue, ...feature.keyValue.split(",")].some(
          (value) => normalize(value) === wanted,
        )
      ) {
        const groups = groupsByValue.get(wanted) ?? new Set<string>();
        groups.add(registeredGroup);
        groupsByValue.set(wanted, groups);
      }
    }
  }
  const hasKnownOwner = (value: string) => groupsByValue.has(normalize(value));
  const selections = character.automation?.classFeatureSelections;
  if (selections && typeof selections === "object") {
    for (const [groupId, optionId] of Object.entries(selections)) {
      if (typeof optionId !== "string") continue;
      const normalizedOption = normalize(optionId);
      // Значение известной опции принадлежит только своей группе. Значение из
      // неизвестной группы сохраняем как раньше: старые листы и будущие классы
      // не должны терять выбор.
      const ownerGroup =
        OPTION_OWNER_BY_ID.get(optionId) ??
        OPTION_OWNER_BY_NAME.get(normalizedOption);
      if (ownerGroup && normalize(ownerGroup) !== normalize(groupId)) continue;

      const ownerClass = SUBCLASS_BACKED_GROUPS[normalize(groupId)];
      const owners = groupsByValue.get(normalizedOption);
      // Старые option ID остаются глобальными; именованные значения привязаны
      // к своей группе, а неизвестные старые группы сохраняют прежнее поведение.
      if (
        CLASS_FEATURE_OPTION_NAMES.has(optionId) ||
        !ownerClass ||
        (className === normalize(ownerClass) &&
          (!owners || owners.has(normalize(groupId))))
      ) {
        selected.add(normalizedOption);
      }
      const name = CLASS_FEATURE_OPTION_NAMES.get(optionId);
      if (name && !hasKnownOwner(name)) selected.add(normalize(name));

      // Запятая разделяет пару доменов только у Проводника: у остальных групп
      // одно значение, и «Традиция, Традиция» не должна активировать обе.
      if (
        ownerClass &&
        className === normalize(ownerClass) &&
        normalize(groupId) === "conduit.domain"
      ) {
        for (const value of optionId.split(",")) {
          const normalized = normalize(value);
          const owners = groupsByValue.get(normalized);
          if (!owners || owners.has(normalize(groupId))) selected.add(normalized);
        }
      }
    }
  }
  // Фолбэк для групп, которые приложение хранит в subclass. Пара доменов
  // Проводника — единственная группа, где запятая разделяет два значения;
  // традиция/орден/аспект — всегда один выбор.
  for (const groupId of Object.keys(SUBCLASS_BACKED_GROUPS)) {
    const value = selectedGroupValue(character, groupId);
    if (value === undefined) continue;
    const values =
      normalize(groupId) === "conduit.domain" ? value.split(",") : [value];
    for (const part of values) {
      const normalizedValue = normalize(part);
      if (!normalizedValue) continue;
      const owners = groupsByValue.get(normalizedValue);
      if (!owners || owners.has(normalize(groupId))) selected.add(normalizedValue);
    }
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
    const selected = selectedKeyValues(character, condition.keyValue);
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
    const forms = currentRuntime(character).forms;
    if (
      !Array.isArray(forms) ||
      !forms.some(
        (form) => typeof form === "string" && normalize(form) === wanted,
      )
    ) {
      return false;
    }
  }
  return true;
}
