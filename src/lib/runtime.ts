import type { Character, CharacterRuntime } from "../types";
import type { TriggerFrequency } from "../data/class-features/types";

/**
 * Состояние схватки героя: раунд, номер схватки, отметки триггеров, формы и
 * дополнительные пулы ресурсов.
 *
 * Поле `Character.runtime` необязательное: старые листы остаются как есть, а
 * первое действие заводит его через `withRuntime`. Поэтому все функции ниже
 * читают состояние через `currentRuntime` и никогда не мутируют исходного героя.
 */

/** Состояние по умолчанию: первый раунд первой схватки, ничего не отмечено. */
export function defaultRuntime(): CharacterRuntime {
  return { round: 1, encounter: 1, triggers: {}, forms: [], resources: {} };
}

/** Текущее состояние схватки; у старого листа — значения по умолчанию. */
export function currentRuntime(character: Character): CharacterRuntime {
  const runtime = character.runtime;
  if (!runtime) return defaultRuntime();
  return {
    round: runtime.round,
    encounter: runtime.encounter,
    triggers: runtime.triggers,
    forms: runtime.forms,
    resources: runtime.resources,
  };
}

/** Герой с новым состоянием схватки; исходный объект не меняется. */
function withRuntime(character: Character, runtime: CharacterRuntime): Character {
  return { ...character, runtime };
}

/**
 * Новый раунд: номер растёт, отметки текущего раунда снимаются. Отметки схватки
 * (у которых заполнено только `encounter`) остаются до конца схватки.
 */
export function beginRound(character: Character): Character {
  const runtime = currentRuntime(character);
  const triggers = Object.fromEntries(
    Object.entries(runtime.triggers).filter(
      ([, mark]) => mark?.round === undefined,
    ),
  );
  return withRuntime(character, {
    ...runtime,
    round: runtime.round + 1,
    triggers,
  });
}

/** Новая схватка: номер растёт, отметки триггеров очищаются целиком. */
export function beginEncounter(character: Character): Character {
  const runtime = currentRuntime(character);
  return withRuntime(character, {
    ...runtime,
    encounter: runtime.encounter + 1,
    triggers: {},
  });
}

/**
 * Отметка триггера: `used` ставит отметку текущего раунда, повторная отметка
 * увеличивает `count`, а `false` снимает отметку совсем.
 *
 * У триггера с частотой `encounter` отметка хранится номером схватки, а не
 * раунда: `beginRound` снимает только отметки раунда, поэтому срабатывание
 * «раз за схватку» переживает смену раунда, а `beginEncounter` его чистит.
 */
export function markTrigger(
  character: Character,
  featureId: string,
  used: boolean,
  frequency: TriggerFrequency = "round",
): Character {
  const runtime = currentRuntime(character);
  const triggers = { ...runtime.triggers };
  if (!used) {
    delete triggers[featureId];
  } else if (frequency === "encounter") {
    const previous = triggers[featureId];
    const sameEncounter = previous?.encounter === runtime.encounter;
    triggers[featureId] = {
      encounter: runtime.encounter,
      count: sameEncounter ? (previous?.count ?? 0) + 1 : 1,
    };
  } else {
    const previous = triggers[featureId];
    const sameRound = previous?.round === runtime.round;
    triggers[featureId] = {
      round: runtime.round,
      count: sameRound ? (previous?.count ?? 0) + 1 : 1,
    };
  }
  return withRuntime(character, { ...runtime, triggers });
}
