import { mechanicsFor } from "../data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../data/class-features/skeleton";
import type {
  FeatureCondition,
  FeatureEffect,
  FeatureKeyGroup,
  FeatureMechanics,
  GeneratedClassFeature,
  TriggerEvent,
  TriggerFrequency,
} from "../data/class-features/types";
import type { Character } from "../types";
import {
  featureConditionMet,
  selectedGroupValue,
  selectionGroupFor,
} from "./feature-conditions";
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
 * Таблица групп выбора (`SELECTION_GROUPS`) и `selectionGroupFor` живут в
 * `feature-conditions`: их спрашивают и активация записей, и условия эффектов.
 * Здесь остаётся реэкспорт, чтобы панель листа не тянула модуль условий.
 */
export { selectionGroupFor } from "./feature-conditions";

/** Ключ группы выбора для записи или `undefined`, если класс не в таблице. */
function selectionGroupId(
  feature: GeneratedClassFeature,
  keyedBy: FeatureKeyGroup,
): string | undefined {
  return selectionGroupFor(feature.className, keyedBy);
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
  // У комплемента скелетная запись остаётся на уровне выбора (1/4/7),
  // но сам дар зарабатывается уровнем позже (2/5/8). Сначала определяем
  // runtime-уровень, чтобы он не появлялся в панели преждевременно.
  const earnedLevel = conduitComplementLevel(feature, character) ?? feature.level;
  if (earnedLevel > level) return false;
  // Domain piety records predate keyedBy. Their book condition describes one
  // domain, while the character must have a complete, distinct valid pair.
  if (feature.id.startsWith("conduit.feature.1.blagochestie-i-effekt-domena-")) {
    const pair = conduitDomainPair(character);
    const domain = mechanicsFor(feature.id)?.when?.keyValue?.[0];
    return !!pair && !!domain && pair.some(
      (value) => normalizeFeatureText(value) === normalizeFeatureText(domain),
    );
  }
  // Старый builder и сохранённые листы хранят выбор молитвы как option ID.
  // В скелете эти записи не keyedBy, поэтому связываем каждый legacy ID с
  // конкретным стабильным ID записи, не извлекая ключ из текста описания.
  if (Object.values(CONDUIT_PRAYER_FEATURES).includes(feature.id)) {
    const selected = character.automation?.classFeatureSelections?.["conduit.prayer"];
    return typeof selected === "string" && CONDUIT_PRAYER_FEATURES[selected] === feature.id;
  }
  // Старые листы хранят выбор оберега как option ID. Как и молитвы,
  // записи оберегов в скелете не keyedBy, поэтому активируем ровно выбранную.
  if (Object.values(CONDUIT_SANCTUARY_FEATURES).includes(feature.id)) {
    const selected = character.automation?.classFeatureSelections?.["conduit.sanctuary"];
    return typeof selected === "string" && CONDUIT_SANCTUARY_FEATURES[selected] === feature.id;
  }
  if (!feature.keyedBy) return true;

  const groupId = selectionGroupId(feature, feature.keyedBy);
  // Класса нет в таблице групп — выборам не доверяем и фильтрацию не применяем.
  if (!groupId) return true;

  // Явный выбор перекрывает разрешённый для класса фолбэк из selectedGroupValue.
  if (className === normalizeFeatureText("Проводник") && feature.keyedBy === "domain") {
    return conduitDomainFeatureActive(feature, character) || conduitComplementLevel(feature, character) !== undefined;
  }
  const selected = selectedGroupValue(character, groupId);
  return keyValueMatches(selected, feature.keyValue);
}

const CONDUIT_PRAYER_FEATURES: Record<string, string> = {
  "conduit.prayer.destruction": "conduit.feature.1.molitva-o-razrushenii",
  "conduit.prayer.distance": "conduit.feature.1.molitva-o-distantsii",
  "conduit.prayer.soldier": "conduit.feature.1.molitva-o-masterstve-soldata",
  "conduit.prayer.speed": "conduit.feature.1.molitva-o-skorosti",
  "conduit.prayer.steel": "conduit.feature.1.molitva-o-stali",
};

const CONDUIT_SANCTUARY_FEATURES: Record<string, string> = {
  "conduit.sanctuary.bastion": "conduit.feature.1.obereg-bastiona",
  "conduit.sanctuary.reaction": "conduit.feature.1.obereg-reaktsii",
  "conduit.sanctuary.refuge": "conduit.feature.1.obereg-svyatilishcha",
  "conduit.sanctuary.spirits": "conduit.feature.1.obereg-dukhov",
};

const CONDUIT_DOMAINS = [
  "Созидание", "Смерть", "Судьба", "Знание", "Жизнь", "Любовь",
  "Природа", "Защита", "Буря", "Солнце", "Хитрость", "Война",
];
function validDomains(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((part) =>
    CONDUIT_DOMAINS.find(
      (domain) => normalizeFeatureText(domain) === normalizeFeatureText(part.trim()),
    ) ?? "",
  );
}
function conduitDomainPair(character: Character): string[] | undefined {
  const selections = character.automation?.classFeatureSelections ?? {};
  const raw = typeof selections["conduit.domain"] === "string"
    ? selections["conduit.domain"]
    : character.subclass;
  const pair = validDomains(raw);
  return pair.length === 2 && pair[0] && pair[1] &&
    normalizeFeatureText(pair[0]) !== normalizeFeatureText(pair[1])
    ? pair
    : undefined;
}
function conduitChoice(character: Character, key: string, pair: string[]): string | undefined {
  const raw = character.automation?.classFeatureSelections?.[key];
  if (typeof raw !== "string") return undefined;
  const choice = validDomains(raw);
  return choice.length === 1 && choice[0] && pair.some(
    (domain) => normalizeFeatureText(domain) === normalizeFeatureText(choice[0]),
  )
    ? choice[0]
    : undefined;
}
function conduitDomainFeatureActive(feature: GeneratedClassFeature, character: Character): boolean {
  const pair = conduitDomainPair(character);
  if (!pair || !feature.keyValue) return false;
  const level = feature.level;
  if ([2, 6, 9].includes(level)) {
    const selected = conduitChoice(character, `conduit.ability.domain.${level}`, pair);
    return !!selected && keyValueMatches(selected, feature.keyValue);
  }
  if (![1, 4, 7].includes(level)) return false;
  const selected = conduitChoice(character, `conduit.domain.${level}`, pair);
  return !!selected && keyValueMatches(selected, feature.keyValue);
}

/** Уровневый комплемент ссылается на ту же запись скелета; сам скелет неизменяем. */
function conduitComplementLevel(feature: GeneratedClassFeature, character: Character): number | undefined {
  if (
    !feature.keyedBy ||
    normalizeFeatureText(feature.className) !== normalizeFeatureText("Проводник") ||
    ![1, 4, 7].includes(feature.level)
  ) return undefined;
  const pair = conduitDomainPair(character);
  if (!pair || !feature.keyValue) return undefined;
  const selected = conduitChoice(character, `conduit.domain.${feature.level}`, pair);
  if (!selected) return undefined;
  const complement = pair.find((domain) => normalizeFeatureText(domain) !== normalizeFeatureText(selected));
  return complement && keyValueMatches(complement, feature.keyValue) ? feature.level + 1 : undefined;
}

/**
 * Статичные условия показа особенности: аспект, минимальный уровень, форма.
 * Динамические условия (`resourceAtLeast`) и снаряжение список не фильтруют:
 * порог свирепости меняется по ходу боя, а фича остаётся частью листа.
 */
function showConditions(
  condition?: FeatureCondition,
): FeatureCondition | undefined {
  if (!condition) return undefined;
  const statics: FeatureCondition = {};
  if (condition.keyValue?.length) statics.keyValue = condition.keyValue;
  if (condition.minLevel !== undefined) statics.minLevel = condition.minLevel;
  if (condition.formActive) statics.formActive = condition.formActive;
  return Object.keys(statics).length > 0 ? statics : undefined;
}

/**
 * Индекс реестра: нормализованное имя класса → его записи. Строится лениво
 * и пересобирается, когда меняется длина массива (тесты подмешивают записи),
 * чтобы не сканировать 844 записи на каждый вызов или каждый рендер.
 */
let indexedLength = -1;
let featuresByClass = new Map<string, GeneratedClassFeature[]>();
/** Версия реестра: растёт при пересборке индекса и сбрасывает кэши по герою. */
let registryVersion = 0;

function classFeatureRecords(className: string): GeneratedClassFeature[] {
  if (indexedLength !== GENERATED_CLASS_FEATURES.length) {
    featuresByClass = new Map();
    for (const feature of GENERATED_CLASS_FEATURES) {
      const key = normalizeFeatureText(feature.className);
      const records = featuresByClass.get(key);
      if (records) records.push(feature);
      else featuresByClass.set(key, [feature]);
    }
    indexedLength = GENERATED_CLASS_FEATURES.length;
    registryVersion += 1;
  }
  return featuresByClass.get(normalizeFeatureText(className)) ?? [];
}

/**
 * Кэш разрешённого состояния по объекту героя. Герой неизменяем: любое
 * изменение листа даёт новый объект, поэтому кэш не устаревает. Версия
 * реестра защищает тесты, которые подмешивают записи в скелет.
 */
interface CachedState<T> {
  version: number;
  value: T;
}

function memoByCharacter<T>(
  cache: WeakMap<Character, CachedState<T>>,
  character: Character,
  compute: () => T,
): T {
  const cached = cache.get(character);
  if (cached && cached.version === registryVersion) return cached.value;
  const value = compute();
  cache.set(character, { version: registryVersion, value });
  return value;
}

/** Версия реестра: меняется при пересборке индекса и сбрасывает кэши. */
export function classFeatureRegistryVersion(): number {
  return registryVersion;
}

/**
 * Сброс индекса реестра и кэшей по героям. Нужен только тестам, которые
 * подмешивают записи в скелет: в приложении реестр неизменяем.
 */
export function invalidateClassFeatureRegistry(): void {
  indexedLength = -1;
  registryVersion += 1;
}

/** Пересобирает индекс реестра, если скелет изменился. */
function syncRegistry(character: Character): void {
  classFeatureRecords(character.className ?? "");
}

const ACTIVE_CACHE = new WeakMap<Character, CachedState<ActiveClassFeature[]>>();
const TRIGGERS_CACHE = new WeakMap<Character, CachedState<ActiveTrigger[]>>();
const EFFECTS_CACHE = new WeakMap<
  Character,
  CachedState<ActiveClassFeatureEffects[]>
>();

/**
 * Активные особенности класса: по `level`, затем по `id`, без дублей.
 * От `automation.enabled` список не зависит — лист показывает фичи всегда,
 * а гейт авторасчёта стоит на эффектах в движке.
 */
export function activeClassFeatures(character: Character): ActiveClassFeature[] {
  // Синхронизация индекса до чтения кэша: подмешанная запись скелета
  // увеличивает версию реестра и делает старые записи кэша недействительными.
  syncRegistry(character);
  return memoByCharacter(ACTIVE_CACHE, character, () => {
    const seen = new Set<string>();
    const active: ActiveClassFeature[] = [];
    for (const feature of classFeatureRecords(character.className ?? "")) {
      if (seen.has(feature.id)) continue;
      if (!isActiveClassFeature(feature, character)) continue;
      const mechanics = mechanicsFor(feature.id);
      // Статичные условия (аспект, уровень, форма) скрывают чужую фичу из списка;
      // динамический порог ресурса оставляет её видимой — его показывает лист.
      const prayer = feature.id.startsWith("conduit.feature.1.blagochestie-i-effekt-domena-");
      if (!prayer && !featureConditionMet(character, showConditions(mechanics?.when))) continue;
      seen.add(feature.id);
      active.push({
        id: feature.id,
        name: feature.name,
        level: conduitComplementLevel(feature, character) ?? feature.level,
        className: feature.className,
        ...(feature.keyedBy ? { keyedBy: feature.keyedBy } : {}),
        ...(feature.keyValue ? { keyValue: feature.keyValue } : {}),
        description: feature.description,
        mechanics,
      });
    }
    return active.sort(
      (a, b) => a.level - b.level || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  });
}

/** Триггеры активных особенностей: по одной записи на триггер фичи. */
export function classFeatureTriggers(character: Character): ActiveTrigger[] {
  syncRegistry(character);
  return memoByCharacter(TRIGGERS_CACHE, character, () => {
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
  });
}

/**
 * Эффекты активных особенностей для движка модификаторов. Фичи без механики
 * и без эффектов источником не считаются. `automation.enabled` проверяет
 * движок, а не эта функция: она отвечает только «что активно».
 */
export function activeClassFeatureEffects(
  character: Character,
): ActiveClassFeatureEffects[] {
  syncRegistry(character);
  return memoByCharacter(EFFECTS_CACHE, character, () =>
    activeClassFeatures(character).flatMap((feature) => {
      const effects = feature.mechanics?.effects;
      if (!effects?.length) return [];
      return [
        {
          sourceId: feature.id,
          sourceName: feature.name,
          effects: [...effects],
        },
      ];
    }),
  );
}
