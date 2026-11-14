import { recordElementalistDamage } from "./class-mechanics/routines-magic";
import { previewClassMechanic, transitionClassMechanics, type ClassMechanicAction } from "./class-mechanics";
import type { Character, CharacterRuntime, StormwightForm } from "../types";
import type { TriggerFrequency } from "../data/class-features/types";
import { applyDamage, deriveStats } from "./rules";
import { heroicResourceName } from "../data/classes";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "./class-features";
import { ancestryAbilityEntries } from "./ancestry-features";
import { epicResourceName, resourceGainByTag } from "./resources";
import { beginEncounter, beginRound, currentRuntime, markTrigger, withoutFuryTurn } from "./runtime";
import { currentFerocity, trackFuryTurn } from "./fury-turn";
import { STORMWIGHT_HYBRID_STAMINA, stormwightAbilityRestriction, stormwightFormState, withStormwightForm } from "./stormwight-forms";

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
  | { kind: "turn-start" | "turn-end" }
  | { kind: "class-mechanic"; action: ClassMechanicAction }
  | { kind: "encounter" }
  | { kind: "combat-start" }
  | { kind: "combat-end" }
  | { kind: "fury-turn-start" }
  | { kind: "fury-turn-end" }
  | { kind: "stormwight-form"; form: StormwightForm; hybridSize?: "1S" | "1M"; freeManeuver?: boolean }
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
function previewBaseGameAction(
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
    next: trackFuryTurn(character, { ...character, ...patch }),
  });
  switch (action.kind) {
    case "class-mechanic": return previewClassMechanic(character, action.action);
    case "turn-start": {
      const runtime = currentRuntime(character);
      if (!runtime.combatActive) return invalid("Сначала начните битву");
      if (runtime.turnActive) return invalid("Ход уже начался");
      const next = transitionClassMechanics({ ...character, runtime: { ...runtime, turn: (runtime.turn ?? 0) + 1, turnActive: true } }, "turn-start");
      return { ok: true, next, label: "Начало своего хода", detail: "Начался новый ход героя; эффекты начала хода обновлены." };
    }
    case "turn-end": {
      const runtime = currentRuntime(character);
      if (!runtime.turnActive) return invalid("Свой ход ещё не начат");
      const next = transitionClassMechanics(character, "turn-end");
      return { ok: true, next: { ...next, runtime: { ...currentRuntime(next), turnActive: false } }, label: "Конец своего хода", detail: "Применены последствия конца хода героя." };
    }
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
        `Выносливость: ${stamina.current} → ${stamina.max}; временная: ${stamina.temp} → 0; восстановления: ${recoveries.current} → ${recoveries.max}; ${resourceName}: ${heroicResource.current} → 0; всплески: ${character.surges} → 0; победы: ${character.victories} → 0; опыт: ${character.xp} → ${character.xp + character.victories}.`,
        {
          stamina: { ...stamina, current: stamina.max, temp: 0 },
          recoveries: { ...recoveries, current: recoveries.max },
          heroicResource: { ...heroicResource, current: 0 },
          surges: 0,
          xp: character.xp + character.victories,
          victories: 0,
          ...(character.runtime?.furyTurn ? { runtime: withoutFuryTurn(currentRuntime(character)) } : {}),
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
    case "combat-start": {
      if (currentRuntime(character).combatActive) return invalid("Битва уже началась");
      const runtime = { ...currentRuntime(beginEncounter(character)), round: 1, combatActive: true, turnActive: false };
      return finish("Начало битвы", "Началась новая битва, отметки триггеров сняты.", { runtime });
    }
    case "combat-end": {
      const runtime = currentRuntime(character);
      if (!runtime.combatActive) return invalid("Битва ещё не началась");
      return finish("Конец битвы", character.className === "Неистовый"
        ? `Битва завершена. Свирепость: ${heroicResource.current} → 0; удержанные пороги сняты.`
        : "Битва завершена.", {
        runtime: { ...withoutFuryTurn(runtime), combatActive: false, turnActive: false },
        heroicResource: { ...heroicResource, current: 0 },
      });
    }
    case "fury-turn-start": {
      if (character.className !== "Неистовый") return invalid("Растущая свирепость доступна Неистовому");
      const runtime = currentRuntime(character);
      if (runtime.furyTurn?.active) return invalid("Ваш ход уже начался");
      const triggers = Object.fromEntries(Object.entries(runtime.triggers).filter(
        ([id]) => triggerFrequency(character, id) !== "turn",
      ));
      return finish("Начало своего хода", "Достигнутые пороги свирепости сохраняются до конца этого хода.", {
        runtime: { ...runtime, triggers, furyTurn: { active: true, peak: currentFerocity(character) } },
      });
    }
    case "fury-turn-end": {
      const runtime = currentRuntime(character);
      if (character.className !== "Неистовый" || !runtime.furyTurn?.active) return invalid("Ваш ход ещё не начался");
      return finish("Конец своего хода", "Удержанные пороги сняты. Преимущества определяются текущей свирепостью.", {
        runtime: withoutFuryTurn(runtime),
      });
    }
    case "stormwight-form": {
      const state = stormwightFormState(character);
      if (!state) return invalid("Сначала выберите комплект буревестника");
      if (!["true", "animal", "hybrid"].includes(action.form)
        || action.hybridSize !== undefined && !["1S", "1M"].includes(action.hybridSize)) return invalid("Неизвестная форма");
      const sameSize = action.form !== "hybrid" || !state.chooseHybridSize || !action.hybridSize || action.hybridSize === state.hybridSize;
      if (state.form === action.form && sameSize) return invalid("Эта форма уже принята");
      const cost = action.freeManeuver ? 1 : 0;
      if (heroicResource.current < cost) return invalid("Для свободного превращения нужна 1 свирепость");
      let next = withStormwightForm(character, action.form, state.chooseHybridSize ? action.hybridSize : undefined);
      const runtime = currentRuntime(next);
      const firstHybrid = action.form === "hybrid" && state.form !== "hybrid" && state.hybridStamina
        && runtime.combatActive && runtime.triggers[STORMWIGHT_HYBRID_STAMINA]?.encounter !== runtime.encounter;
      if (firstHybrid) next = markTrigger(next, STORMWIGHT_HYBRID_STAMINA, true, "encounter");
      const temporary = firstHybrid && character.automation?.enabled ? 10 : 0;
      const name = action.form === "true" ? "Истинная форма" : `${action.form === "animal" ? "Форма животного" : "Форма гибрида"}: ${state.kit.animalForm}`;
      return finish(name, [
        action.freeManeuver ? "Свободный манёвр: −1 свирепость." : "Превращение: манёвр.",
        temporary ? "Первое превращение в гибрида в этой битве: 10 временной выносливости (запасы не складываются)." : "",
      ].filter(Boolean).join(" "), {
        runtime: currentRuntime(next),
        heroicResource: { ...heroicResource, current: heroicResource.current - cost },
        ...(temporary ? { stamina: { ...stamina, temp: Math.max(stamina.temp, temporary) } } : {}),
      });
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
      // Способность происхождения не хранится в `character.abilities`: она
      // выводится из черты, но применяется на листе так же, как остальные.
      const ability =
        character.abilities.find((item) => item.id === action.abilityId) ??
        ancestryAbilityEntries(character).find(
          (entry) => entry.ability.id === action.abilityId,
        )?.ability;
      if (!ability) return invalid("Этой способности больше нет у героя");
      const formRestriction = stormwightAbilityRestriction(character, ability);
      if (formRestriction) return invalid(formRestriction);
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

/** One transaction keeps state, resource changes and undo in sync. */
export function previewGameAction(character: Character, action: GameAction): ActionPreview {
  // Capture an attained threshold before spending the resource.
  const before = action.kind === "turn-start" || action.kind === "turn-end"
    ? character : transitionClassMechanics(character, "resource-change");
  const result = previewBaseGameAction(before, action);
  if (!result.ok) return result;
  let next = result.next;
  if (action.kind === "damage") next = recordElementalistDamage(next, action.amount ?? 0);
  if (action.kind === "combat-start" || action.kind === "combat-end" || action.kind === "rest") {
    next = transitionClassMechanics(next, action.kind);
    if (action.kind === "rest") next = { ...next, runtime: { ...currentRuntime(next), turnActive: false } };
  }
  if (action.kind !== "turn-end") next = transitionClassMechanics(next, "resource-change");
  return { ...result, next };
}

const values = (c: Character) => ({
  stamina: c.stamina.current,
  temp: c.stamina.temp,
  recoveries: c.recoveries.current,
  resource: c.heroicResource.current,
  surges: c.surges,
  tokens: c.heroTokens,
  xp: c.xp,
  victories: c.victories,
});
type ValueKey = keyof ReturnType<typeof values>;

/**
 * Состояние схватки в виде строки: по полям и с сортировкой ключей, чтобы
 * пересборка объекта (импорт, нормализация) не мешала отмене.
 */
function stateKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stateKey).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stateKey(v)]));
  return JSON.stringify(value) ?? "undefined";
}

function runtimeKey(runtime: CharacterRuntime | undefined): string {
  if (!runtime) return "нет";
  return JSON.stringify([
    runtime.round,
    runtime.encounter,
    !!runtime.combatActive,
    runtime.furyTurn ? [runtime.furyTurn.active, runtime.furyTurn.peak] : null,
    runtime.stormwight ? [runtime.stormwight.kitId, runtime.stormwight.form, runtime.stormwight.trueSize, runtime.stormwight.hybridSize] : null,
    runtime.turn,
    runtime.turnActive,
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
  classMechanics?: { before?: Character["classMechanics"]; after?: Character["classMechanics"] };
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
  if (entry.classMechanics && stateKey(character.classMechanics) !== stateKey(entry.classMechanics.after))
    return "Классовое состояние уже изменилось. Сначала отмените более позднее действие.";
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
          ...(stateKey(character.classMechanics) !== stateKey(result.next.classMechanics)
            ? { classMechanics: { before: character.classMechanics, after: result.next.classMechanics } } : {}),
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
        xp: restored.xp,
        victories: restored.victories,
      };
      if (entry.classMechanics) {
        if (entry.classMechanics.before === undefined) delete next.classMechanics;
        else next.classMechanics = entry.classMechanics.before;
      }
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
