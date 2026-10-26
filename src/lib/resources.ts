import { resourceSpecFor } from "../data/class-features/class-resources";
import type {
  HeroicResourceSpec,
  ResourceGain,
  TriggerEvent,
  TriggerFrequency,
} from "../data/class-features/types";
import type { Character } from "../types";
import { activeClassFeatures } from "./class-features";
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
    label: resourceGainLabel(gain.event),
    sourceId,
    sourceName,
  }));
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
 */
export function resolvedEpicResourceGains(
  character: Character,
): ResolvedResourceGain[] {
  const className = character.className ?? "";
  const epic = resourceSpecFor(className)?.epic;
  if (!epic) return [];
  return applyGains(specGains(className, epic), []);
}
