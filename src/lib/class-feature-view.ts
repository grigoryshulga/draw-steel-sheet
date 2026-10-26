import { GENERATED_CLASS_FEATURES } from "../data/class-features/skeleton";
import type {
  FeatureChoice,
  FeatureCondition,
  FeatureEffect,
  FeatureField,
  FeatureKeyGroup,
  TriggerFrequency,
} from "../data/class-features/types";
import type { Character, CharacteristicKey } from "../types";
import {
  activeClassFeatures,
  classFeatureTriggers,
  selectionGroupFor,
  type ActiveClassFeature,
} from "./class-features";
import { featureConditionMet, selectedGroupValue } from "./feature-conditions";
import { resolveFeatureAmount } from "./feature-modifiers";
import { echelon } from "./progression";
import { CHARACTERISTICS, deriveStats } from "./rules";
import { triggerMark } from "./runtime";
import { normalizeFeatureText } from "./utils";

/**
 * Всё, что лист показывает об активных особенностях класса: группы по уровням,
 * числа, разрешённые в конкретику, бейджи триггеров и условий, счётчик
 * доступных срабатываний.
 *
 * Модуль чистый: он ничего не меняет ни в герое, ни в состоянии схватки и не
 * зависит от авторасчёта — при выключенном `automation.enabled` панель всё
 * равно показывает фичи, бейджи и числа-описания, а сохранённые значения листа
 * не трогает (их меняет только движок модификаторов).
 */

/** Вид бейджа: срабатывание, условие, иммунитет, выбор, выдача. */
export type FeatureBadgeKind =
  | "trigger"
  | "threshold"
  | "immunity"
  | "choice"
  | "grant";

export interface FeatureSheetBadge {
  kind: FeatureBadgeKind;
  label: string;
  /** Условие выполнено / срабатывание ещё доступно в этом раунде. */
  active: boolean;
}

/** Отметка триггера: частота и состояние на текущий раунд или схватку. */
export interface FeatureSheetTrigger {
  label: string;
  frequency: TriggerFrequency;
  /** Отмечено в текущем раунде (или схватке у частоты `encounter`). */
  used: boolean;
  /** Сколько раз отмечено за текущий раунд (схватку). */
  count: number;
}

export interface FeatureSheetItem {
  id: string;
  name: string;
  level: number;
  /** Числа механики, разрешённые в конкретику: «скорость +3 (Ловкость)». */
  summary: string;
  badges: FeatureSheetBadge[];
  trigger?: FeatureSheetTrigger;
}

export interface FeatureSheetGroup {
  level: number;
  /** Заголовок группы: «Уровень 2». */
  title: string;
  features: FeatureSheetItem[];
}

/** Незакрытая группа выбора: лист предлагает её, пока значения нет. */
export interface FeatureSheetChoice {
  /** Ключ в `automation.classFeatureSelections`. */
  group: string;
  /** Русское название группы: «Аспект». */
  label: string;
  options: string[];
}

/** Подписи числовых полей листа: как эффект читается в строке описания. */
const FIELD_LABELS: Record<FeatureField, string> = {
  stamina: "выносливость",
  recoveries: "восстановления",
  recoveryValue: "ценность восстановления",
  speed: "скорость",
  stability: "устойчивость",
  save: "спасбросок",
  disengage: "отход",
  rolledDamage: "урон способности",
  freeStrikeDamage: "урон свободного удара",
  distance: "дальность",
  push: "толчок",
  pull: "притягивание",
  slide: "скольжение",
  potency: "потенция",
};

/** Названия групп выбора подкласса. */
const KEY_GROUP_LABELS: Record<FeatureKeyGroup, string> = {
  aspect: "Аспект",
  order: "Орден",
  domain: "Домен",
  tradition: "Традиция",
  doctrine: "Доктрина",
  college: "Коллегия",
  troupe: "Труппа",
  specialization: "Специализация",
};

const KEY_GROUP_KINDS = Object.keys(KEY_GROUP_LABELS) as FeatureKeyGroup[];

function characteristicLabel(key: CharacteristicKey): string {
  return CHARACTERISTICS.find((meta) => meta.key === key)?.label ?? key;
}

/** Последний сегмент ключа группы, если он называет вид группы выбора. */
function keyGroupKind(group: string): FeatureKeyGroup | undefined {
  const last = group.split(".").pop();
  return KEY_GROUP_KINDS.find((kind) => kind === last);
}

/** Части значения выбора: `keyValue` и ответ игрока могут перечислять варианты. */
function splitValues(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Варианты групп выбора класса — один проход по скелету на весь вызов.
 * Кэш не держим: реестр изменяемый (тесты подмешивают записи), а проход
 * дешёвый — класс читается один раз, а не на каждый бейдж.
 */
interface SheetContext {
  character: Character;
  className: string;
  options: Map<FeatureKeyGroup, string[]>;
}

function sheetContext(character: Character): SheetContext {
  const className = character.className ?? "";
  const wanted = normalizeFeatureText(className);
  const options = new Map<FeatureKeyGroup, string[]>();
  const seen = new Map<FeatureKeyGroup, Set<string>>();
  if (wanted) {
    for (const feature of GENERATED_CLASS_FEATURES) {
      if (normalizeFeatureText(feature.className) !== wanted) continue;
      const kind = feature.keyedBy;
      if (!kind) continue;
      const keys = seen.get(kind) ?? new Set<string>();
      const values = options.get(kind) ?? [];
      for (const value of splitValues(feature.keyValue)) {
        const key = normalizeFeatureText(value);
        if (keys.has(key)) continue;
        keys.add(key);
        values.push(value);
      }
      seen.set(kind, keys);
      options.set(kind, values);
    }
  }
  return { character, className, options };
}

/**
 * Варианты группы в порядке книги: сначала те, что перечислены в механиках
 * выбора (там они идут по тексту), затем остальные из скелета.
 */
function orderedOptions(options: string[], choice: FeatureChoice): string[] {
  const wanted = new Map(
    choice.options.map((option, index) => [
      normalizeFeatureText(option.label),
      index,
    ]),
  );
  const rank = (value: string) =>
    wanted.get(normalizeFeatureText(value)) ?? Number.MAX_SAFE_INTEGER;
  return [...options].sort((left, right) => rank(left) - rank(right));
}

/**
 * Название группы для условий `keyValue`: значения условия ищутся среди
 * вариантов групп класса, поэтому у пороговых строк таблиц, у которых нет
 * своего `keyedBy`, аспект всё равно подписан как аспект.
 */
function groupLabelForValues(
  context: SheetContext,
  values: string[],
): string | undefined {
  const wanted = values.map(normalizeFeatureText);
  for (const kind of KEY_GROUP_KINDS) {
    const options = new Set(
      (context.options.get(kind) ?? []).map(normalizeFeatureText),
    );
    if (options.size === 0) continue;
    if (wanted.every((value) => options.has(value))) {
      return KEY_GROUP_LABELS[kind];
    }
  }
  return undefined;
}

/** Эффект с числовым значением: поле листа или иммунитет к урону. */
type NumericEffect = Extract<
  FeatureEffect,
  { kind: "field" | "damageImmunity" }
>;

/** Число эффекта с поправкой на эшелон и пределом, как в движке модификаторов. */
function resolvedEffectValue(
  character: Character,
  effect: NumericEffect,
): number {
  const base = resolveFeatureAmount(character, effect.value);
  const scaled =
    base +
    ("perEchelon" in effect ? (effect.perEchelon ?? 0) : 0) *
      echelon(character.level);
  return "cap" in effect && effect.cap !== undefined
    ? Math.min(scaled, effect.cap)
    : scaled;
}

/** Пометка источника числа: показатель характеристики или уровень героя. */
function amountSource(effect: NumericEffect): string | undefined {
  if (typeof effect.value !== "object") return undefined;
  return "characteristic" in effect.value
    ? characteristicLabel(effect.value.characteristic)
    : "уровень";
}

/**
 * Винительный падеж типов урона для фразы «иммунитет к огню 6». Словарь
 * неполный: незнакомый тип показывается как есть — это не ошибка данных.
 */
const DAMAGE_TYPE_DATIVE: Record<string, string> = {
  кислота: "кислоте",
  холод: "холоду",
  порча: "порче",
  огонь: "огню",
  молния: "молнии",
  яд: "яду",
  звук: "звуку",
};

/**
 * Описание одного эффекта числами листа. Неизвестные виды эффектов (владение)
 * описываются отдельно: это выдача, а не число.
 */
function describeEffect(character: Character, effect: FeatureEffect): string | undefined {
  switch (effect.kind) {
    case "field": {
      const value = resolvedEffectValue(character, effect);
      const source = amountSource(effect);
      const filter = effect.filter?.keywords?.length
        ? ` — способности «${effect.filter.keywords.join(", ")}»`
        : "";
      return `${FIELD_LABELS[effect.field]} +${value}${source ? ` (${source})` : ""}${filter}`;
    }
    case "characteristic": {
      // Порог тира считается по эффективным характеристикам: он показывает,
      // каким станет бросок 2d10 после бонуса особенности.
      const threshold = deriveStats(character).tierThresholds[effect.key].t3;
      return `${characteristicLabel(effect.key)} +${effect.value}, порог тира ${threshold}`;
    }
    case "damageImmunity": {
      const value = resolvedEffectValue(character, effect) * (effect.multiplier ?? 1);
      const types = effect.types.filter(Boolean);
      if (types.length === 0) return `иммунитет ${value}`;
      if (types.length === 1) {
        const dative = DAMAGE_TYPE_DATIVE[normalizeFeatureText(types[0])];
        return dative
          ? `иммунитет к ${dative} ${value}`
          : `иммунитет ${value} (${types[0]})`;
      }
      return `иммунитет ${value}: ${types.join(", ")}`;
    }
    case "proficiency": {
      const parts = [...(effect.armor ?? []), ...(effect.weapons ?? [])];
      if (effect.treasures) parts.push("клады");
      return parts.length > 0 ? `владение: ${parts.join(", ")}` : undefined;
    }
    default:
      return undefined;
  }
}

/** Условие, при котором действует эффект: `when` есть у полей и иммунитетов. */
function effectCondition(effect: FeatureEffect): FeatureCondition | undefined {
  return "when" in effect ? effect.when : undefined;
}

/**
 * Эффект относится к текущему выбору героя. Отсекается только чужой выбор
 * (`keyValue`): порог ресурса, форма или снаряжение числа не прячут — про них
 * говорит бейдж условия, а число остаётся тем, что герой получит.
 */
function effectConditionApplied(
  character: Character,
  condition: FeatureCondition | undefined,
): boolean {
  if (!condition?.keyValue?.length) return true;
  return featureConditionMet(character, { keyValue: condition.keyValue });
}

/** Бейджи одного условия: чем оно требует и выполнено ли оно сейчас. */
function conditionBadges(
  context: SheetContext,
  condition: FeatureCondition | undefined,
): FeatureSheetBadge[] {
  if (!condition) return [];
  const badges: FeatureSheetBadge[] = [];
  const push = (kind: FeatureBadgeKind, label: string, part: FeatureCondition) =>
    badges.push({
      kind,
      label,
      active: featureConditionMet(context.character, part),
    });

  if (condition.keyValue?.length) {
    const word = groupLabelForValues(context, condition.keyValue);
    push(
      "choice",
      word
        ? `${word.toLowerCase()}: ${condition.keyValue.join(", ")}`
        : `выбор: ${condition.keyValue.join(" или ")}`,
      { keyValue: condition.keyValue },
    );
  }
  if (condition.minLevel !== undefined) {
    push("threshold", `нужно ${condition.minLevel}-й уровень`, {
      minLevel: condition.minLevel,
    });
  }
  if (condition.resourceAtLeast) {
    const { name, value } = condition.resourceAtLeast;
    push("threshold", `нужно ${value} ${name}`, {
      resourceAtLeast: condition.resourceAtLeast,
    });
  }
  if (condition.formActive) {
    push("threshold", `нужна форма «${condition.formActive}»`, {
      formActive: condition.formActive,
    });
  }
  if (condition.equipment) {
    if (condition.equipment.lightArmor) {
      push("threshold", "нужна лёгкая броня", { equipment: condition.equipment });
    }
    if (condition.equipment.lightWeapon) {
      push("threshold", "нужно лёгкое оружие", { equipment: condition.equipment });
    }
  }
  if (condition.noKit) push("threshold", "без комплекта", { noKit: true });
  return badges;
}

/** Слияние одинаковых бейджей: один и тот же порог показывается один раз. */
function mergeBadges(badges: FeatureSheetBadge[]): FeatureSheetBadge[] {
  const merged = new Map<string, FeatureSheetBadge>();
  for (const badge of badges) {
    const key = `${badge.kind}|${badge.label}`;
    const previous = merged.get(key);
    merged.set(
      key,
      previous
        ? { ...previous, active: previous.active && badge.active }
        : badge,
    );
  }
  return [...merged.values()];
}

/** Запись листа по одной активной особенности. */
function sheetItem(
  context: SheetContext,
  feature: ActiveClassFeature,
): FeatureSheetItem {
  const { character } = context;
  const mechanics = feature.mechanics;
  const parts: string[] = [];
  const badges: FeatureSheetBadge[] = [];
  const conditions: (FeatureCondition | undefined)[] = [mechanics?.when];

  for (const effect of mechanics?.effects ?? []) {
    // Эффект чужого аспекта — это вторая половина правила, а не то, что герой
    // получает: его условия видны бейджем, а числа в описание не попадают.
    const foreign = !effectConditionApplied(character, effectCondition(effect));
    const text = foreign ? undefined : describeEffect(character, effect);
    if (text) parts.push(text);
    if (effect.kind === "conditionImmunity") {
      const conditions = effect.conditions.filter(Boolean);
      if (conditions.length > 0) {
        badges.push({
          kind: "immunity",
          label: `иммунитет к состояниям: ${conditions.join(", ")}`,
          active: !foreign,
        });
      }
    }
    conditions.push(effectCondition(effect));
  }

  for (const badge of conditions.flatMap((condition) =>
    conditionBadges(context, condition),
  )) {
    badges.push(badge);
  }

  const choice = mechanics?.choice;
  if (choice) {
    const kind = keyGroupKind(choice.group);
    const selected = selectedGroupValue(character, choice.group);
    // Группы способностей приложение ведёт списком способностей, а не
    // выборами: бейдж называет сам выбор, но не выдаёт его за сделанный.
    if (kind) {
      badges.push({
        kind: "choice",
        label: `${KEY_GROUP_LABELS[kind].toLowerCase()}: ${selected ?? "не выбран"}`,
        active: selected !== undefined,
      });
    } else if (selected !== undefined) {
      badges.push({ kind: "choice", label: `выбор: ${selected}`, active: true });
    } else {
      badges.push({
        kind: "choice",
        label: `выбор из ${choice.options.length} способностей`,
        active: true,
      });
    }
  }

  // Вложенная запись аспекта: видна только выбранному варианту, и это то, что
  // игрок должен видеть сразу — почему фича вообще на листе.
  if (feature.keyedBy && feature.keyValue) {
    badges.push({
      kind: "choice",
      label: `${KEY_GROUP_LABELS[feature.keyedBy].toLowerCase()}: ${feature.keyValue}`,
      active: true,
    });
  }

  let trigger: FeatureSheetTrigger | undefined;
  const triggerSpec = mechanics?.trigger;
  if (triggerSpec && featureConditionMet(character, triggerSpec.when)) {
    const mark = triggerMark(character, feature.id, triggerSpec.frequency);
    trigger = {
      label: triggerSpec.label,
      frequency: triggerSpec.frequency,
      used: mark.used,
      count: mark.count,
    };
    badges.push({
      kind: "trigger",
      label: `сработает: ${triggerSpec.label}`,
      active: !mark.used,
    });
    for (const badge of conditionBadges(context, triggerSpec.when)) {
      badges.push(badge);
    }
  }

  const merged = mergeBadges(badges);
  if (parts.length === 0 && merged.length === 0) {
    // Прибавку ресурса лист считает в панели ресурсов; здесь она только
    // называется, чтобы строка не осталась пустой.
    merged.push({
      kind: "grant",
      label: mechanics?.resource ? "прибавка ресурса" : "по тексту правил",
      active: true,
    });
  }

  return {
    id: feature.id,
    name: feature.name,
    level: feature.level,
    summary: parts.join("; "),
    badges: merged,
    ...(trigger ? { trigger } : {}),
  };
}

/**
 * Запись попадает в панель, только если даёт механику: эффекты, триггер,
 * выбор или прибавки ресурса. Контейнеры ("Свирепость", "Растущая
 * свирепость", "Особенности аспекта N-го уровня") и служебные заголовки
 * скелета остаются за бортом: их дети идут отдельными строками и без родителя
 * читаются нормально.
 */
function givesMechanics(feature: ActiveClassFeature): boolean {
  const mechanics = feature.mechanics;
  if (!mechanics) return false;
  if (
    mechanics.effects?.length ||
    mechanics.trigger ||
    mechanics.choice ||
    mechanics.resource
  ) {
    return true;
  }
  // Пороговая строка таблицы Растущей свирепости: её механика — само условие
  // достижения порога, поэтому строка остаётся (бейдж «нужно N Свирепость»).
  return mechanics.when?.resourceAtLeast !== undefined;
}

/**
 * Запись с `keyedBy` у класса без зарегистрированной группы выборов: панель не
 * может понять, выбрана она или нет, и чужие правила выглядели бы выбранными.
 * Такие записи остаются в общем движке, но на лист не попадают.
 */
function needsUnknownSelection(
  character: Character,
  feature: ActiveClassFeature,
): boolean {
  if (!feature.keyedBy) return false;
  return selectionGroupFor(character.className ?? "", feature.keyedBy) === undefined;
}

/** Особенность, которую лист показывает строкой: есть механика и ясен выбор. */
function isSheetFeature(
  character: Character,
  feature: ActiveClassFeature,
): boolean {
  return givesMechanics(feature) && !needsUnknownSelection(character, feature);
}

/**
 * Группы особенностей по уровням: только активные записи с механикой, поэтому
 * уровней выше героя в списке нет. Внутри группы порядок задаёт
 * `activeClassFeatures` (уровень, затем `id`).
 */
export function classFeatureGroupsForSheet(
  character: Character,
): FeatureSheetGroup[] {
  const context = sheetContext(character);
  const byLevel = new Map<number, FeatureSheetItem[]>();
  for (const feature of activeClassFeatures(character)) {
    if (!isSheetFeature(character, feature)) continue;
    const item = sheetItem(context, feature);
    const items = byLevel.get(item.level) ?? [];
    items.push(item);
    byLevel.set(item.level, items);
  }
  return [...byLevel.entries()]
    .sort(([left], [right]) => left - right)
    .map(([level, features]) => ({
      level,
      title: `Уровень ${level}`,
      features,
    }));
}

/**
 * Раскрытие групп по уровням: по умолчанию открыта группа ровно того уровня,
 * на котором герой, а клики игрока переопределяют только тронутые группы.
 * Смена уровня пересчитывает умолчание, не сбрасывая явные клики.
 */
export function featureLevelOpenState(
  groups: FeatureSheetGroup[],
  characterLevel: number,
  overrides: Readonly<Record<number, boolean>> = {},
): Record<number, boolean> {
  const level = typeof characterLevel === "number" ? characterLevel : 0;
  const state: Record<number, boolean> = {};
  for (const group of groups) {
    state[group.level] =
      overrides[group.level] ?? (group.level === level);
  }
  return state;
}

/**
 * Сколько триггеров доступно и ещё не отмечено в этом раунде (у частоты
 * `encounter` — в этой схватке).
 */
export function triggerBadgeCounts(character: Character): number {
  return classFeatureTriggers(character).filter(
    (trigger) =>
      !triggerMark(character, trigger.featureId, trigger.frequency).used,
  ).length;
}

/**
 * Группы выбора, значение которых ещё не записано ни в
 * `automation.classFeatureSelections`, ни в поле, которым приложение хранит
 * выбор (`character.subclass` для аспекта Неистового). Варианты берутся из
 * скелета — лист не придумывает названий аспектов.
 */
export function classFeatureChoicesForSheet(
  character: Character,
): FeatureSheetChoice[] {
  const context = sheetContext(character);
  const choices: FeatureSheetChoice[] = [];
  const seen = new Set<string>();
  for (const feature of activeClassFeatures(character)) {
    const choice = feature.mechanics?.choice;
    if (!choice || seen.has(choice.group)) continue;
    const kind = keyGroupKind(choice.group);
    if (!kind) continue;
    // Группу выбора предлагаем только если она зарегистрирована для класса:
    // иначе запись выбора ни на что не повлияет.
    if (selectionGroupFor(context.className, kind) !== choice.group) continue;
    seen.add(choice.group);
    if (selectedGroupValue(character, choice.group) !== undefined) continue;
    const options = context.options.get(kind) ?? [];
    if (options.length === 0) continue;
    choices.push({
      group: choice.group,
      label: KEY_GROUP_LABELS[kind],
      options: orderedOptions(options, choice),
    });
  }
  return choices;
}
