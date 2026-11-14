import type { Ability, Character } from "../../types";
import type { ActionPreview } from "../game-actions";
import { resolvedResourceGains } from "../resources";

export interface TroubadourState {
  activeRoutineId?: string;
  activeRoutineIds?: string[];
  selectedRound?: number;
  incapacitated?: boolean;
}
export interface ElementalistState {
  sustained: { abilityId: string; target: string }[];
  damageThisTurn: number;
  lastGainTurn?: number;
  lastGainEncounter?: number;
}
export type RoutinesMagicAction =
  | { kind: "troubadour-select"; abilityId: string; secondAbilityId?: string }
  | { kind: "troubadour-stop" }
  | { kind: "troubadour-incapacitated"; value: boolean }
  | { kind: "elementalist-sustain"; abilityId: string; target: string }
  | { kind: "elementalist-stop"; abilityId: string }
  | { kind: "elementalist-stop-all" }
  | { kind: "elementalist-damage"; amount: number }
  | { kind: "elementalist-reset-damage" };

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
export function normalizeTroubadourState(value: unknown): TroubadourState {
  const state = record(value);
  return {
    activeRoutineIds: Array.isArray(state.activeRoutineIds)
      ? [
          ...new Set(
            state.activeRoutineIds.filter(
              (id): id is string => typeof id === "string",
            ),
          ),
        ].slice(0, 2)
      : typeof state.activeRoutineId === "string"
        ? [state.activeRoutineId]
        : [],
    incapacitated: state.incapacitated === true,
    ...(typeof state.activeRoutineId === "string"
      ? { activeRoutineId: state.activeRoutineId }
      : {}),
    ...(integer(state.selectedRound) !== undefined
      ? { selectedRound: integer(state.selectedRound) }
      : {}),
  };
}
export function normalizeElementalistState(value: unknown): ElementalistState {
  const state = record(value);
  const seen = new Set<string>();
  const sustained: ElementalistState["sustained"] = [];
  if (Array.isArray(state.sustained))
    for (const raw of state.sustained) {
      const entry = record(raw);
      if (
        typeof entry.abilityId !== "string" ||
        typeof entry.target !== "string" ||
        seen.has(entry.abilityId)
      )
        continue;
      seen.add(entry.abilityId);
      sustained.push({
        abilityId: entry.abilityId,
        target: entry.target.slice(0, 300),
      });
    }
  return {
    sustained,
    damageThisTurn: integer(state.damageThisTurn) ?? 0,
    lastGainTurn: integer(state.lastGainTurn),
    lastGainEncounter: integer(state.lastGainEncounter),
  };
}
export function troubadourRoutines(character: Character): Ability[] {
  return character.abilities.filter((ability) =>
    ability.keywords.some((word) =>
      /^(выступление|performance|routine)$/i.test(word),
    ),
  );
}
/** Only an explicit priced sustain clause is a supported persistent effect. */
export function persistentCost(ability: Ability): number | undefined {
  const match = `${ability.effect}\n${ability.notes}`.match(
    /(?:Поддержание|Persistent)\s*\*{0,2}\s*(\d+)\s*\*{0,2}\s*:/i,
  );
  return match ? Number(match[1]) : undefined;
}
export function elementalistPersistentAbilities(
  character: Character,
): Ability[] {
  return character.abilities.filter(
    (ability) => persistentCost(ability) !== undefined,
  );
}
export function routineUnavailableReason(
  character: Character,
): string | undefined {
  if (
    character.classMechanics?.troubadour?.incapacitated ||
    character.conditions.dazed?.active ||
    character.conditions.surprised?.active ||
    character.conditions.dead?.active ||
    (character.stamina.max > 0 &&
      character.stamina.current <= -Math.floor(character.stamina.max / 2))
  ) {
    return "Выступление нельзя поддерживать: герой оглушён, мёртв или застигнут врасплох.";
  }
  return undefined;
}
function elementalistState(character: Character): ElementalistState {
  const state = normalizeElementalistState(
    character.classMechanics?.elementalist,
  );
  const owned = new Set(
    elementalistPersistentAbilities(character).map((ability) => ability.id),
  );
  return {
    ...state,
    sustained: state.sustained.filter((entry) => owned.has(entry.abilityId)),
  };
}
function withElementalist(
  character: Character,
  state: ElementalistState,
): Character {
  return {
    ...character,
    classMechanics: { ...character.classMechanics, elementalist: state },
  };
}
function withTroubadour(
  character: Character,
  state: TroubadourState,
): Character {
  return {
    ...character,
    classMechanics: { ...character.classMechanics, troubadour: state },
  };
}
export function elementalistSustainCost(character: Character): number {
  const abilities = elementalistPersistentAbilities(character);
  return elementalistState(character).sustained.reduce(
    (sum, entry) =>
      sum +
      (persistentCost(
        abilities.find((ability) => ability.id === entry.abilityId)!,
      ) ?? 0),
    0,
  );
}
export function elementalistBaseTurnGain(character: Character): number {
  return resolvedResourceGains(character)
    .filter((gain) => gain.event === "start-of-turn")
    .reduce(
      (sum, gain) =>
        sum + (/^\d+$/.test(gain.amount.trim()) ? Number(gain.amount) : 0),
      0,
    );
}
export function elementalistStartTurnGain(
  character: Character,
  grossGain = elementalistBaseTurnGain(character),
): number {
  return Math.max(0, grossGain - elementalistSustainCost(character));
}
/** One resolved hit or an explicitly grouped total from a single creature turn. Never infer grouping across creature turns. */
export function recordElementalistDamage(
  character: Character,
  amount: number,
): Character {
  if (
    character.className !== "Элементалист" ||
    !Number.isSafeInteger(amount) ||
    amount < 0
  )
    return character;
  const state = elementalistState(character);
  const damageThisTurn = amount;
  return withElementalist(character, {
    ...state,
    damageThisTurn,
    sustained:
      damageThisTurn >= 5 * Math.max(0, character.characteristics.reason)
        ? []
        : state.sustained,
  });
}
export function previewRoutinesMagic(
  character: Character,
  action: RoutinesMagicAction,
): ActionPreview {
  const fail = (reason: string): ActionPreview => ({ ok: false, reason });
  const finish = (
    next: Character,
    label: string,
    detail = label,
  ): ActionPreview => ({ ok: true, next, label, detail });
  if (action.kind.startsWith("troubadour-")) {
    if (character.className !== "Трубадур")
      return fail("Выступления доступны Трубадуру.");
    if (action.kind === "troubadour-stop")
      return finish(
        withTroubadour(character, {
          ...normalizeTroubadourState(character.classMechanics?.troubadour),
          activeRoutineId: undefined,
          activeRoutineIds: [],
        }),
        "Выступление прекращено",
      );
    if (action.kind === "troubadour-incapacitated")
      return finish(
        withTroubadour(character, {
          ...normalizeTroubadourState(character.classMechanics?.troubadour),
          incapacitated: action.value,
          ...(action.value
            ? { activeRoutineId: undefined, activeRoutineIds: [] }
            : {}),
        }),
        action.value ? "Выступление недоступно" : "Выступление доступно",
      );
    if (action.kind !== "troubadour-select")
      return fail("Неизвестное действие.");
    if (!character.runtime?.combatActive)
      return fail("Выступление выбирают в начале раунда боя.");
    const reason = routineUnavailableReason(character);
    if (reason) return fail(reason);
    const ability = troubadourRoutines(character).find(
      (item) => item.id === action.abilityId,
    );
    if (!ability)
      return fail("Этого выступления нет среди способностей героя.");
    const second = action.secondAbilityId
      ? troubadourRoutines(character).find(
          (item) => item.id === action.secondAbilityId,
        )
      : undefined;
    if (
      action.secondAbilityId &&
      (!second || character.level < 5 || second.id === ability.id)
    )
      return fail(
        "Второе отличающееся выступление доступно с 5-го уровня благодаря «Медли».",
      );
    const state = normalizeTroubadourState(
      character.classMechanics?.troubadour,
    );
    const round = character.runtime?.round ?? 1;
    if (state.selectedRound === round)
      return fail(
        "Выступление уже выбрано в этом раунде. Следующая смена — в начале нового раунда.",
      );
    return finish(
      withTroubadour(character, {
        ...state,
        activeRoutineId: ability.id,
        activeRoutineIds: second ? [ability.id, second.id] : [ability.id],
        selectedRound: round,
      }),
      "Выступление выбрано",
      ability.name,
    );
  }
  if (character.className !== "Элементалист")
    return fail("Поддержание доступно Элементалисту.");
  const state = elementalistState(character);
  if (action.kind === "elementalist-stop-all")
    return finish(
      withElementalist(character, { ...state, sustained: [] }),
      "Все поддержания прекращены",
    );
  if (action.kind === "elementalist-stop")
    return finish(
      withElementalist(character, {
        ...state,
        sustained: state.sustained.filter(
          (entry) => entry.abilityId !== action.abilityId,
        ),
      }),
      "Поддержание прекращено",
    );
  if (action.kind === "elementalist-reset-damage")
    return finish(
      withElementalist(character, { ...state, damageThisTurn: 0 }),
      "Начат новый ход для учёта урона",
    );
  if (action.kind === "elementalist-damage") {
    if (
      !Number.isSafeInteger(action.amount) ||
      action.amount <= 0 ||
      action.amount > 9999
    )
      return fail("Укажите целое количество полученного урона от 1 до 9999.");
    return finish(
      recordElementalistDamage(character, action.amount),
      "Учтён урон для поддержания",
      `${action.amount} урона; Выносливость не изменяется`,
    );
  }
  if (action.kind !== "elementalist-sustain")
    return fail("Неизвестное действие.");
  if (!character.runtime?.combatActive)
    return fail(
      "Вне боя поддержание длится число раундов, равное Победам; ведите его отдельно.",
    );
  const ability = elementalistPersistentAbilities(character).find(
    (item) => item.id === action.abilityId,
  );
  if (!ability) return fail("У героя нет такой способности с поддержанием.");
  if (!action.target.trim())
    return fail("Укажите цель или область поддержания.");
  if (state.sustained.some((entry) => entry.abilityId === action.abilityId))
    return fail("Эта способность уже поддерживается.");
  const cost = persistentCost(ability)!;
  if (
    elementalistSustainCost(character) + cost >
    elementalistBaseTurnGain(character)
  )
    return fail(
      "Суммарное поддержание сделает прибавку эссенции отрицательной.",
    );
  return finish(
    withElementalist(character, {
      ...state,
      sustained: [
        ...state.sustained,
        { abilityId: ability.id, target: action.target.trim().slice(0, 300) },
      ],
    }),
    "Поддержание начато",
    `${ability.name}: ${action.target.trim()}, поддержание ${cost}`,
  );
}
export function transitionRoutinesMagic(
  character: Character,
  event:
    | "turn-start"
    | "turn-end"
    | "combat-start"
    | "combat-end"
    | "rest"
    | "resource-change",
): Character {
  const clear =
    event === "combat-end" || event === "combat-start" || event === "rest";
  if (character.className === "Трубадур") {
    const state = normalizeTroubadourState(
      character.classMechanics?.troubadour,
    );
    const owned = (state.activeRoutineIds ?? []).every((id) =>
      troubadourRoutines(character).some((ability) => ability.id === id),
    );
    return clear || routineUnavailableReason(character) || !owned
      ? withTroubadour(character, {
          incapacitated: clear ? false : state.incapacitated,
          selectedRound: clear ? undefined : state.selectedRound,
        })
      : character;
  }
  if (character.className !== "Элементалист") return character;
  let state = elementalistState(character);
  if (clear)
    return withElementalist(character, { sustained: [], damageThisTurn: 0 });
  // The table has no global creature-turn feed. Keep only the latest explicitly
  // checked hit/turn total and clear its display at personal turn boundaries.
  if (event === "turn-end")
    return withElementalist(character, { ...state, damageThisTurn: 0 });
  if (event !== "turn-start") return withElementalist(character, state);
  const turn = character.runtime?.turn ?? 0;
  const encounter = character.runtime?.encounter ?? 1;
  if (state.lastGainTurn === turn && state.lastGainEncounter === encounter)
    return character;
  const gain = elementalistStartTurnGain(character);
  state = {
    ...state,
    damageThisTurn: 0,
    lastGainTurn: turn,
    lastGainEncounter: encounter,
  };
  let next = withElementalist(character, state);
  if (character.runtime?.combatActive)
    next = {
      ...next,
      heroicResource: {
        ...character.heroicResource,
        current: Math.min(99, character.heroicResource.current + gain),
      },
      runtime: {
        ...character.runtime,
        triggers: {
          ...character.runtime.triggers,
          "start-of-turn": {
            turn,
            round: character.runtime.round,
            encounter,
            count: 1,
          },
        },
      },
    };
  return next;
}
