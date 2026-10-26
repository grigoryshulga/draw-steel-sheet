import type { Character, CharacterRuntime } from "../types";
import type { TriggerFrequency } from "../data/class-features/types";
import { applyDamage, deriveStats } from "./rules";
import { heroicResourceName } from "../data/classes";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "./class-features";
import { epicResourceName, resourceGainByTag } from "./resources";
import { beginEncounter, beginRound, currentRuntime, markTrigger } from "./runtime";

export type HealthOperation =
  "damage" | "heal" | "temporary" | "recovery" | "rest" | "adjust";
export type ResourceName =
  | "heroicResource"
  | "surges"
  | "heroTokens"
  | "recoveries"
  | "epic";
export type GameAction =
  | { kind: HealthOperation; amount?: number }
  | { kind: "resource"; resource: ResourceName; value: number }
  | { kind: "round" }
  | { kind: "encounter" }
  | { kind: "trigger"; featureId: string; used: boolean }
  | {
      kind: "ability";
      abilityId: string;
      surges: number;
      additionalCost?: number;
      waiveCost?: boolean;
      result?: string;
    };

export type ActionPreview =
  | { ok: true; next: Character; label: string; detail: string }
  | { ok: false; reason: string };

/** У героического ресурса нет игрового максимума — только технический предел ввода. */
const MAX_HEROIC_RESOURCE = 99;
/** Талант может уводить ясность в минус — до −(1 + Разум); остальным ресурс не уйти ниже нуля. */
export function heroicResourceFloor(character: Character): number {
  return character.className === "Талант"
    ? -(1 + Math.max(0, character.characteristics.reason))
    : 0;
}
/** Подпись триггера по id фичи или по тегу прибавки ресурса. */
function triggerName(character: Character, featureId: string): string {
  const feature = classFeatureTriggers(character).find(
    (item) => item.featureId === featureId,
  )?.name;
  if (feature) return feature;
  // Прибавка ресурса отмечается тегом: подпись и частота берутся из неё.
  return resourceGainByTag(character, featureId)?.label ?? featureId;
}

/**
 * Частота отметки: у «раз за схватку» отметка живёт до новой схватки, у
 * остальных — до нового раунда.
 *
 * Берётся из механики фичи напрямую: список `classFeatureTriggers` отфильтрован
 * выполненными условиями, и невыполненный encounter-триггер получил бы
 * раундовую отметку, которую снял бы ближайший новый раунд. У прибавки
 * ресурса частота своя — её тег и есть ключ отметки.
 */
function triggerFrequency(
  character: Character,
  featureId: string,
): TriggerFrequency {
  const feature = activeClassFeatures(character).find(
    (item) => item.id === featureId,
  )?.mechanics?.trigger?.frequency;
  if (feature) return feature;
  // Прибавки ресурса отмечаются тегом: у «раз за схватку» отметка должна
  // пережить новый раунд, поэтому частота берётся из самой прибавки.
  return resourceGainByTag(character, featureId)?.frequency ?? "round";
}

const invalid = (reason: string): ActionPreview => ({ ok: false, reason });
const validAmount = (amount: number | undefined) =>
  amount !== undefined &&
  Number.isSafeInteger(amount) &&
  amount >= 0 &&
  amount <= 9999;

/** One preview is used by the UI and re-evaluated against the latest hero at commit. */
export function previewGameAction(
  character: Character,
  action: GameAction,
): ActionPreview {
  const { stamina, recoveries, heroicResource } = character;
  const resourceName = heroicResourceName(character.className);
  const finish = (
    label: string,
    detail: string,
    patch: Partial<Character>,
  ): ActionPreview => ({
    ok: true,
    label,
    detail,
    next: { ...character, ...patch },
  });
  switch (action.kind) {
    case "damage": {
      if (!validAmount(action.amount) || !action.amount)
        return invalid("Введите количество урона больше нуля");
      const result = applyDamage(stamina.current, stamina.temp, action.amount);
      return finish(
        `Урон: ${action.amount}`,
        `${result.absorbed} поглощено временной выносливостью. Выносливость: ${stamina.current} → ${result.stamina}; временная: ${stamina.temp} → ${result.temp}.`,
        { stamina: { ...stamina, current: result.stamina, temp: result.temp } },
      );
    }
    case "heal":
    case "recovery": {
      const isRecovery = action.kind === "recovery";
      if (isRecovery && recoveries.current <= 0)
        return invalid("Восстановления закончились");
      const amount = isRecovery
        ? deriveStats(character).recoveryValue
        : action.amount;
      if (!validAmount(amount) || !amount)
        return invalid("Количество исцеления должно быть больше нуля");
      if (stamina.current >= stamina.max)
        return invalid("Выносливость уже максимальна");
      const current = Math.min(stamina.max, stamina.current + amount);
      return finish(
        isRecovery
          ? "Потрачено восстановление"
          : `Исцеление: +${current - stamina.current}`,
        `Выносливость: ${stamina.current} → ${current}.${isRecovery ? ` Восстановления: ${recoveries.current} → ${recoveries.current - 1}.` : ""}`,
        {
          stamina: { ...stamina, current },
          ...(isRecovery
            ? { recoveries: { ...recoveries, current: recoveries.current - 1 } }
            : {}),
        },
      );
    }
    case "temporary": {
      if (!validAmount(action.amount) || !action.amount)
        return invalid("Введите временную выносливость больше нуля");
      const temp = Math.max(stamina.temp, action.amount);
      if (temp === stamina.temp)
        return invalid(
          "Текущий запас уже не меньше: временная выносливость не складывается",
        );
      return finish(
        "Временная выносливость",
        `Временная выносливость: ${stamina.temp} → ${temp}. Сохраняется больший запас; значения не складываются.`,
        { stamina: { ...stamina, temp } },
      );
    }
    case "adjust": {
      if (
        !Number.isSafeInteger(action.amount) ||
        action.amount! < -9999 ||
        action.amount! > stamina.max
      )
        return invalid(`Укажите текущее значение от −9999 до ${stamina.max}`);
      if (action.amount === stamina.current)
        return invalid("Значение не изменилось");
      return finish(
        "Коррекция выносливости",
        `Выносливость: ${stamina.current} → ${action.amount}. Временный запас не меняется.`,
        { stamina: { ...stamina, current: action.amount! } },
      );
    }
    case "rest":
      return finish(
        "Отдых",
        `Выносливость: ${stamina.current} → ${stamina.max}; временная: ${stamina.temp} → 0; восстановления: ${recoveries.current} → ${recoveries.max}; ${resourceName}: ${heroicResource.current} → 0; всплески: ${character.surges} → 0.`,
        {
          stamina: { ...stamina, current: stamina.max, temp: 0 },
          recoveries: { ...recoveries, current: recoveries.max },
          heroicResource: { ...heroicResource, current: 0 },
          surges: 0,
        },
      );
    case "resource": {
      const max =
        action.resource === "heroicResource"
          ? MAX_HEROIC_RESOURCE
          : action.resource === "recoveries"
            ? recoveries.max
            : 99;
      const min =
        action.resource === "heroicResource"
          ? heroicResourceFloor(character)
          : 0;
      if (
        !Number.isSafeInteger(action.value) ||
        action.value < min ||
        action.value > max
      )
        return invalid(`Укажите значение от ${min} до ${max}`);
      const before =
        action.resource === "heroicResource"
          ? heroicResource.current
          : action.resource === "recoveries"
            ? recoveries.current
            : character[action.resource];
      if (before === action.value) return invalid("Значение не изменилось");
      const label =
        action.resource === "heroicResource"
          ? resourceName
          : action.resource === "recoveries"
            ? "Восстановления"
            : action.resource === "heroTokens"
              ? "Жетоны героя"
              : action.resource === "epic"
                ? (epicResourceName(character) ?? "Эпический ресурс")
                : "Всплески";
      const patch =
        action.resource === "heroicResource"
          ? { heroicResource: { ...heroicResource, current: action.value } }
          : action.resource === "recoveries"
            ? { recoveries: { ...recoveries, current: action.value } }
            : { [action.resource]: action.value };
      return finish(label, `${label}: ${before} → ${action.value}.`, patch);
    }
    case "round": {
      const runtime = currentRuntime(beginRound(character));
      const removed =
        Object.keys(currentRuntime(character).triggers).length -
        Object.keys(runtime.triggers).length;
      return finish(
        `Новый раунд ${runtime.round}`,
        `Раунд: ${runtime.round - 1} → ${runtime.round}.${removed ? ` Снято отметок раунда: ${removed}.` : ""}`,
        { runtime },
      );
    }
    case "encounter": {
      const runtime = currentRuntime(beginEncounter(character));
      return finish(
        `Новая схватка ${runtime.encounter}`,
        `Схватка: ${runtime.encounter - 1} → ${runtime.encounter}. Отметки триггеров сняты, раунд остаётся ${runtime.round}.`,
        { runtime },
      );
    }
    case "trigger": {
      const name = triggerName(character, action.featureId);
      const frequency = triggerFrequency(character, action.featureId);
      const runtime = currentRuntime(character);
      if (!action.used && !runtime.triggers[action.featureId])
        return invalid(`Отметка «${name}» не стоит`);
      const nextRuntime = currentRuntime(
        markTrigger(character, action.featureId, action.used, frequency),
      );
      const mark = nextRuntime.triggers[action.featureId];
      return finish(
        action.used ? `Отмечено: ${name}` : `Отметка снята: ${name}`,
        action.used
          ? `${frequency === "encounter" ? `Схватка ${nextRuntime.encounter}` : `Раунд ${nextRuntime.round}`}${mark?.count && mark.count > 1 ? `, ${mark.count}-й раз` : ""}.`
          : `Триггер снова доступен в ${frequency === "encounter" ? `схватке ${nextRuntime.encounter}` : `раунде ${nextRuntime.round}`}.`,
        { runtime: nextRuntime },
      );
    }
    case "ability": {
      const ability = character.abilities.find(
        (item) => item.id === action.abilityId,
      );
      if (!ability) return invalid("Этой способности больше нет у героя");
      if (
        !Number.isSafeInteger(action.surges) ||
        action.surges < 0 ||
        action.surges > 3
      )
        return invalid("Выберите от 0 до 3 всплесков");
      if (!validAmount(action.additionalCost ?? 0))
        return invalid("Проверьте дополнительный расход ресурса");
      const cost = action.waiveCost
        ? 0
        : ability.resourceCost + (action.additionalCost ?? 0);
      if (!validAmount(cost)) return invalid("Проверьте стоимость способности");
      if (heroicResource.current - cost < heroicResourceFloor(character))
        return invalid(
          `Не хватает ресурса: нужно ${cost}, доступно ${heroicResource.current}`,
        );
      if (character.surges < action.surges)
        return invalid(
          `Не хватает всплесков: нужно ${action.surges}, доступно ${character.surges}`,
        );
      return finish(
        ability.name || "Способность",
        [
          action.result,
          `${resourceName}: ${heroicResource.current} → ${heroicResource.current - cost}.`,
          `Всплески: ${character.surges} → ${character.surges - action.surges}.`,
          action.waiveCost ? "Без расхода ресурса (ручное исключение)." : "",
        ]
          .filter(Boolean)
          .join(" "),
        {
          heroicResource: {
            ...heroicResource,
            current: heroicResource.current - cost,
          },
          surges: character.surges - action.surges,
        },
      );
    }
  }
}

const values = (c: Character) => ({
  stamina: c.stamina.current,
  temp: c.stamina.temp,
  recoveries: c.recoveries.current,
  resource: c.heroicResource.current,
  surges: c.surges,
  tokens: c.heroTokens,
});
type ValueKey = keyof ReturnType<typeof values>;

/**
 * Состояние схватки в виде строки: по полям и с сортировкой ключей, чтобы
 * пересборка объекта (импорт, нормализация) не мешала отмене.
 */
function runtimeKey(runtime: CharacterRuntime | undefined): string {
  if (!runtime) return "нет";
  return JSON.stringify([
    runtime.round,
    runtime.encounter,
    Object.keys(runtime.triggers)
      .sort()
      .map((id) => [id, runtime.triggers[id]]),
    [...runtime.forms].sort(),
    Object.keys(runtime.resources)
      .sort()
      .map((name) => [name, runtime.resources[name]]),
  ]);
}

export interface GameHistoryEntry {
  id: string;
  characterId: string;
  label: string;
  detail: string;
  at: number;
  undone: boolean;
  changes: { key: ValueKey; before: number; after: number }[];
  limits: { stamina: number; recoveries: number; resource: number };
  /** Состояние схватки до и после действия, если действие его меняло; поля не было — `undefined`. */
  runtime?: { before?: CharacterRuntime; after?: CharacterRuntime };
}

/** Герой без поля `runtime`: отмена действия, которое его и завело. */
function withoutRuntime(character: Character): Character {
  const copy = { ...character };
  delete copy.runtime;
  return copy;
}

export function undoReason(
  character: Character,
  entry: GameHistoryEntry,
): string | undefined {
  if (entry.characterId !== character.id || entry.undone)
    return "Действие уже недоступно для отмены";
  if (
    entry.runtime &&
    runtimeKey(character.runtime) !== runtimeKey(entry.runtime.after)
  )
    return "Состояние схватки уже изменилось. Сначала отмените более позднее действие или исправьте его вручную.";
  const current = values(character);
  if (entry.changes.some((change) => current[change.key] !== change.after))
    return "Затронутые значения уже изменены. Сначала отмените более позднее действие или исправьте их вручную.";
  const limits = {
    stamina: character.stamina.max,
    recoveries: character.recoveries.max,
    resource: MAX_HEROIC_RESOURCE,
  };
  if (
    entry.changes.some(
      (change) =>
        change.key in limits &&
        entry.limits[change.key as keyof typeof limits] !==
          limits[change.key as keyof typeof limits],
    )
  )
    return "Максимум ресурса изменился. Используйте ручную коррекцию.";
}

/** Keeps a session journal and idempotent receipts; never restores a whole character snapshot. */
export function createGameSession() {
  let history: GameHistoryEntry[] = [];
  const receipts = new Set<string>();
  return {
    entries: () => history,
    reset: () => {
      history = [];
      receipts.clear();
    },
    perform(
      character: Character,
      action: GameAction,
      id: string,
    ): ActionPreview {
      if (receipts.has(id)) return invalid("Это действие уже применено");
      const result = previewGameAction(character, action);
      if (!result.ok) return result;
      const before = values(character);
      const after = values(result.next);
      const changes = (Object.keys(before) as ValueKey[])
        .filter((key) => before[key] !== after[key])
        .map((key) => ({ key, before: before[key], after: after[key] }));
      const runtimeChanged =
        runtimeKey(character.runtime) !== runtimeKey(result.next.runtime);
      history = [
        {
          id,
          characterId: character.id,
          label: result.label,
          detail: result.detail,
          at: Date.now(),
          undone: false,
          changes,
          limits: {
            stamina: character.stamina.max,
            recoveries: character.recoveries.max,
            resource: MAX_HEROIC_RESOURCE,
          },
          ...(runtimeChanged
            ? { runtime: { before: character.runtime, after: result.next.runtime } }
            : {}),
        },
        ...history,
      ].slice(0, 30);
      receipts.add(id);
      return result;
    },
    undo(character: Character): ActionPreview {
      const entry = history.find((item) => !item.undone);
      if (!entry) return invalid("Нет действий для отмены");
      const reason = undoReason(character, entry);
      if (reason) return invalid(reason);
      const restored = values(character);
      for (const change of entry.changes) restored[change.key] = change.before;
      const next: Character = {
        ...character,
        stamina: {
          ...character.stamina,
          current: restored.stamina,
          temp: restored.temp,
        },
        recoveries: { ...character.recoveries, current: restored.recoveries },
        heroicResource: {
          ...character.heroicResource,
          current: restored.resource,
        },
        surges: restored.surges,
        heroTokens: restored.tokens,
      };
      const reverted = entry.runtime
        ? entry.runtime.before
          ? { ...next, runtime: entry.runtime.before }
          : withoutRuntime(next)
        : next;
      history = history.map((item) =>
        item.id === entry.id ? { ...item, undone: true } : item,
      );
      return {
        ok: true,
        label: `Отменено: ${entry.label}`,
        detail: entry.detail,
        next: reverted,
      };
    },
  };
}
