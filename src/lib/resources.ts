import { resourceSpecFor } from "../data/class-features/class-resources";
import type {
  HeroicResourceSpec,
  ResourceGain,
  TriggerEvent,
  TriggerFrequency,
} from "../data/class-features/types";
import type { Character } from "../types";
import { activeClassFeatures } from "./class-features";
import { mechanicsFor } from "../data/class-features/mechanics";
import { triggerMark } from "./runtime";
import { normalizeFeatureText } from "./utils";

/** Прибавка ресурса, готовая для листа: с источником и подписью события. */
export interface ResolvedResourceGain {
  tag: string;
  event: TriggerEvent;
  amount: string;
  frequency: TriggerFrequency;
  /** Короткая русская подпись события для UI. */
  label: string;
  /** `id` фичи или `class:<класс>` у базовых прибавок ресурса. */
  sourceId: string;
  sourceName: string;
}

/**
 * Подписи событий для листа. Термины состояний — как в правилах проекта
 * (`vitalStatus` в `src/lib/rules.ts`): «утомлён» — на половине выносливости,
 * «при смерти» — отдельное состояние на нуле. Неизвестное событие показывается
 * своим кодом, поэтому словарь неполный по типу: новые события не обязаны
 * ломать сборку.
 */
const EVENT_LABELS: Partial<Record<TriggerEvent, string>> = {
  "start-of-turn": "Начало твоего хода",
  "end-of-turn": "Конец твоего хода",
  "take-damage": "Получаешь урон",
  "lose-stamina": "Теряешь выносливость",
  "forced-movement": "Накладываешь принудительное движение",
  "combat-start": "Начинается бой",
  "deal-damage": "Наносишь урон",
  hit: "Попадаешь по цели",
  crit: "Критический удар",
  miss: "Промахиваешься",
  "ally-damaged": "Союзник получает урон",
  "adjacent-enemy-damages-you": "Смежный враг наносит тебе урон",
  "first-per-round": "Первый раз за раунд",
  winded: "Становишься утомлённым",
  dying: "Становишься при смерти",
  "spend-recovery": "Тратишь восстановление",
  "enemy-enters": "Враг входит в зону",
  "save-failed": "Проваливаешь спасбросок",
  "save-succeeded": "Проходишь спасбросок",
  respite: "Завершаешь отдых",
  victory: "Одерживаешь победу",
  "use-ability": "Используешь способность",
  "form-changed": "Меняешь форму",
  passive: "Постоянно",
};

/** Подпись события прибавки; неизвестное событие возвращается как есть. */
export function resourceGainLabel(event: TriggerEvent): string {
  return EVENT_LABELS[event] ?? event;
}

/**
 * Родительный падеж названия ресурса: в данных названия стоят в именительном
 * («Свирепость»), а фраза бейджа требует «нужно 8 свирепости». Незнакомый
 * ресурс возвращает `undefined` — вызывающий сам решает, как его назвать.
 */
const RESOURCE_GENITIVE: Record<string, string> = {
  Свирепость: "свирепости",
  Дисциплина: "дисциплины",
  Эссенция: "эссенции",
  Благочестие: "благочестия",
  Фокус: "фокуса",
  Ясность: "ясности",
  Прозрение: "прозрения",
  Драма: "драмы",
  Гнев: "гнева",
};

export function resourceGenitive(name: string): string | undefined {
  return RESOURCE_GENITIVE[name];
}

/**
 * Частота прибавки по-русски: лист не показывает коды модели.
 * `turn` — «ход», потому что прибавка на начало своего хода срабатывает
 * каждый ход, а не раз за раунд.
 */
const FREQUENCY_LABELS: Record<TriggerFrequency, string> = {
  turn: "ход",
  round: "раунд",
  encounter: "схватка",
  respite: "отдых",
  always: "всегда",
};

/** Прибавка ресурса в том виде, в каком её показывает панель ресурсов. */
export interface ResourceGainLabel {
  tag: string;
  label: string;
  amount: string;
  /** Частота по-русски: «ход», «раунд», «схватка», «отдых», «всегда». */
  frequency: string;
  /** Отмечено ли «получено» в текущем раунде (у схватки — в текущей схватке). */
  used: boolean;
}

/**
 * Прибавки основного ресурса с подписью события, количеством, частотой и
 * отметкой «получено».
 *
 * Ключ отметки — тег прибавки, а не `sourceId`: у базовых прибавок класса
 * источник один (`class:<класс>`), и общая отметка скрыла бы, какое именно
 * событие уже случилось. После замен теги уникальны (`applyGains`), поэтому
 * одна строка — одна отметка.
 */
export function resourceGainLabels(character: Character): ResourceGainLabel[] {
  return labelledGains(character, resolvedResourceGains(character));
}

/**
 * Прибавки эпического пула в том же виде, что и основного: лист показывает
 * его отдельным числом и отдельным блоком «Откуда капает».
 */
export function epicResourceGainLabels(
  character: Character,
): ResourceGainLabel[] {
  return labelledGains(character, resolvedEpicResourceGains(character));
}

function labelledGains(
  character: Character,
  gains: ResolvedResourceGain[],
): ResourceGainLabel[] {
  return gains.map((gain) => ({
    tag: gain.tag,
    label: gain.label,
    amount: gain.amount,
    frequency: FREQUENCY_LABELS[gain.frequency],
    used: triggerMark(character, gain.tag, gain.frequency).used,
  }));
}

/**
 * Прибавка по тегу отметки — из основного пула или эпического. Тег — ключ
 * отметки, поэтому действие журнала находит по нему подпись и частоту.
 */
export function resourceGainByTag(
  character: Character,
  tag: string,
): ResolvedResourceGain | undefined {
  return [...resolvedResourceGains(character), ...resolvedEpicResourceGains(character)].find(
    (gain) => gain.tag === tag,
  );
}

/** Название эпического пула класса, если он уже открыт герою. */
export function epicResourceName(character: Character): string | undefined {
  if (resolvedEpicResourceGains(character).length === 0) return undefined;
  return resourceSpecFor(character.className ?? "")?.epic?.name;
}

/** Прибавка вместе с источником: из чего она пришла и на каком уровне. */
interface SourcedGain {
  gain: ResourceGain;
  sourceId: string;
  sourceName: string;
  /** 0 — базовые прибавки ресурса класса, выше — уровень фичи. */
  level: number;
}

/** Базовые прибавки пула ресурса: их источник — сам класс, не фича. */
function specGains(
  className: string,
  spec: HeroicResourceSpec,
): SourcedGain[] {
  const sourceId = `class:${normalizeFeatureText(className)}`;
  return spec.gains.map((gain) => ({
    gain,
    sourceId,
    sourceName: spec.name,
    level: 0,
  }));
}

/** Прибавки ресурса класса; пусто, если ресурс ещё не разобран. */
function baseGains(character: Character): SourcedGain[] {
  const className = character.className ?? "";
  const spec = resourceSpecFor(className);
  return spec ? specGains(className, spec) : [];
}

/**
 * Прибавки активных фич. Порядок задаёт `activeClassFeatures`: по возрастанию
 * уровня фичи, при равенстве — по её `id`; он же отсекает фичи выше уровня
 * героя. Список не зависит от `automation.enabled`: это не расчёт, а то, что
 * лист показывает всегда.
 */
function featureGains(character: Character): SourcedGain[] {
  return activeClassFeatures(character).flatMap((feature) =>
    (feature.mechanics?.resource?.gains ?? []).map((gain) => ({
      gain,
      sourceId: feature.id,
      sourceName: feature.name,
      level: feature.level,
    })),
  );
}

/**
 * Применение прибавок по порядку: прибавка с `replaces` удаляет из уже
 * собранного списка все перечисленные теги, а не первую попавшуюся запись,
 * и добавляется сама. Две замены одного тега поэтому не оставляют дублей.
 */
function applyGains(
  base: SourcedGain[],
  additions: SourcedGain[],
): ResolvedResourceGain[] {
  const collected: SourcedGain[] = [];
  for (const entry of [...base, ...additions]) {
    const replaces = entry.gain.replaces ?? [];
    if (replaces.length > 0) {
      const replaced = new Set(replaces);
      for (let index = collected.length - 1; index >= 0; index -= 1) {
        if (replaced.has(collected[index].gain.tag)) collected.splice(index, 1);
      }
    }
    collected.push(entry);
  }
  return collected.map(({ gain, sourceId, sourceName }) => ({
    tag: gain.tag,
    event: gain.event,
    amount: gain.amount,
    frequency: gain.frequency,
    label: sourceId.startsWith("conduit.feature.1.blagochestie-i-effekt-domena-")
      ? domainGainLabel(sourceId, gain.event)
      : resourceGainLabel(gain.event),
    sourceId,
    sourceName,
  }));
}

/** Domain gains need the book's event subject/context as well as its event code. */
function domainGainLabel(sourceId: string, event: TriggerEvent): string {
  const trigger = mechanicsFor(sourceId)?.trigger;
  const domainLabel = trigger?.label?.replace(/^Благочестие домена\s*/u, "Домен ");
  const eventLabel = event === "dying"
    ? "Существо становится при смерти"
    : event === "passive"
      ? "Ведущий тратит Раздор (пассивное событие)"
      : event === "spend-recovery"
        ? "Существо восстанавливает Выносливость"
        : resourceGainLabel(event);
  return `${domainLabel ?? "Домен"}: ${eventLabel}`;
}

/**
 * Прибавки основного ресурса героя: базовые из спецификации класса плюс
 * прибавки механик активных фич, которые заменяют теги по пути.
 * `amount` остаётся строкой (`"1d3"`, `"1d3 + 1"`, `"= Мощь"`) — лист
 * показывает её как есть, без арифметики.
 */
export function resolvedResourceGains(
  character: Character,
): ResolvedResourceGain[] {
  return applyGains(baseGains(character), featureGains(character));
}

/**
 * Прибавки эпического ресурса — отдельный пул: лист показывает его рядом
 * с основным, а замены механик основного пула к нему не применяются.
 * Эпический пул открывается на своём уровне (`epic.level`, по умолчанию 10-й)
 * — до него прибавок нет.
 */
export function resolvedEpicResourceGains(
  character: Character,
): ResolvedResourceGain[] {
  const className = character.className ?? "";
  const epic = resourceSpecFor(className)?.epic;
  if (!epic) return [];
  const level = typeof character.level === "number" ? character.level : 0;
  if (level < (epic.level ?? 10)) return [];
  return applyGains(specGains(className, epic), []);
}
