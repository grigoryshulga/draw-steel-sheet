import type { Character } from "../../types";
import type { ActionPreview } from "../game-actions";
import { applyDamage, deriveStats } from "../rules";
import { activeClassFeatures } from "../class-features";

export interface CensorState {
  target: string;
  orderBenefitTurn?: number;
  lastEffect?: string;
}
export interface TacticianState {
  targets: string[];
  lastEffect?: string;
}
export interface ConduitState {
  prayer?: boolean;
  resolvedTurn?: number;
  domainAvailable?: boolean;
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 200) : "";
export function normalizeCensorState(value: unknown): CensorState {
  const v = record(value);
  return {
    target: text(v.target),
    ...(Number.isSafeInteger(v.orderBenefitTurn)
      ? { orderBenefitTurn: v.orderBenefitTurn as number }
      : {}),
    ...(text(v.lastEffect) ? { lastEffect: text(v.lastEffect) } : {}),
  };
}
export function normalizeTacticianState(value: unknown): TacticianState {
  const v = record(value);
  return {
    targets: Array.isArray(v.targets)
      ? [...new Set(v.targets.map(text).filter(Boolean))].slice(0, 20)
      : [],
    ...(text(v.lastEffect) ? { lastEffect: text(v.lastEffect) } : {}),
  };
}
export function normalizeConduitState(value: unknown): ConduitState {
  const v = record(value);
  return {
    ...(typeof v.prayer === "boolean" ? { prayer: v.prayer } : {}),
    ...(Number.isSafeInteger(v.resolvedTurn)
      ? { resolvedTurn: v.resolvedTurn as number }
      : {}),
    domainAvailable: v.domainAvailable === true,
  };
}
export type TargetsPrayerAction =
  | { kind: "censor-target"; target: string }
  | {
      kind: "censor-reaction";
      effect: "main-action" | "shift" | "bane" | "potency" | "taunt";
    }
  | { kind: "tactician-targets"; targets: string[] }
  | {
      kind: "tactician-benefit";
      target: string;
      effect: "damage" | "recovery" | "shift" | "taunt" | "doctrine";
      self?: boolean;
      featureId?: string;
    }
  | { kind: "conduit-prayer"; pray: boolean }
  | { kind: "conduit-roll"; die: number; damageDie?: number }
  | { kind: "conduit-domain"; domain: string };
const fail = (reason: string): ActionPreview => ({ ok: false, reason });
const turn = (c: Character) => c.runtime?.turn ?? 0;
export function tacticianMarkLimit(c: Character): number {
  return c.level >= 5 && /Воевода|Mastermind/i.test(c.subclass) ? 2 : 1;
}
export function conduitDomains(c: Character) {
  return activeClassFeatures(c).filter((f) =>
    f.id.startsWith("feature.conduit.level-1.domain-piety-and-effects."),
  );
}
export function previewTargetsPrayer(
  c: Character,
  a: TargetsPrayerAction,
): ActionPreview {
  const finish = (
    label: string,
    detail: string,
    patch: Partial<Character>,
  ): ActionPreview => ({ ok: true, next: { ...c, ...patch }, label, detail });
  const mechanics = c.classMechanics ?? {};
  if (
    (a.kind.startsWith("censor-") && c.className !== "Цензор") ||
    (a.kind.startsWith("tactician-") && c.className !== "Тактик") ||
    (a.kind.startsWith("conduit-") && c.className !== "Проводник")
  )
    return fail("Эта механика недоступна вашему классу.");
  const cs = normalizeCensorState(mechanics.censor),
    ts = normalizeTacticianState(mechanics.tactician),
    ps = normalizeConduitState(mechanics.conduit);
  if (a.kind === "censor-target") {
    const target = text(a.target),
      first = target && cs.orderBenefitTurn !== turn(c);
    const p = 2 * c.characteristics.presence;
    const benefit = /Экзорцист|Exorcist/i.test(c.subclass)
      ? `Телепортация до ${p} клеток ближе к цели; линия воздействия к месту назначения не нужна.`
      : /Оракул|Oracle/i.test(c.subclass)
        ? `${p} святого урона цели.`
        : `Вертикальное притягивание цели до ${p} клеток.`;
    return finish(
      "Суд",
      target
        ? `Осуждён: ${target}.${first ? " " + benefit : ""}`
        : "Суд завершён.",
      {
        classMechanics: {
          ...mechanics,
          censor: {
            ...cs,
            target,
            ...(first
              ? { orderBenefitTurn: turn(c), lastEffect: benefit }
              : {}),
          },
        },
      },
    );
  }
  if (a.kind === "censor-reaction") {
    if (!cs.target) return fail("Сначала выберите осуждённую цель.");
    if (a.effect !== "main-action" && c.heroicResource.current < 1)
      return fail("Нужен 1 гнев.");
    const effects = {
      "main-action": `Основное действие цели в линии воздействия: ${2 * c.characteristics.presence} святого урона.`,
      shift:
        "Смежная цель начинает смещаться: свободный удар ближнего боя; скорость 0 до конца текущего хода.",
      bane: "Бросок силы цели в пределах 10 клеток: помеха.",
      potency:
        "Способность цели в пределах 10 клеток с одной целью: потенциал −1.",
      taunt:
        "Ваш урон способностью ближнего боя: цель спровоцирована вами до конца её следующего хода.",
    };
    return finish("Суд: свободный триггер", effects[a.effect], {
      heroicResource: {
        ...c.heroicResource,
        current:
          c.heroicResource.current - (a.effect === "main-action" ? 0 : 1),
      },
      classMechanics: {
        ...mechanics,
        censor: { ...cs, lastEffect: effects[a.effect] },
      },
    });
  }
  if (a.kind === "tactician-targets") {
    const targets = [...new Set(a.targets.map(text).filter(Boolean))];
    if (targets.length > tacticianMarkLimit(c))
      return fail(
        `Метка позволяет выбрать не более ${tacticianMarkLimit(c)} целей.`,
      );
    return finish("Метка", targets.join(", ") || "Метки завершены.", {
      classMechanics: { ...mechanics, tactician: { ...ts, targets } },
    });
  }
  if (a.kind === "tactician-benefit") {
    if (!ts.targets.includes(a.target))
      return fail("Выберите отмеченную цель.");
    const cost = a.effect === "doctrine" ? 2 : 1;
    if (c.heroicResource.current < cost) return fail(`Нужно фокуса: ${cost}.`);
    const r = c.characteristics.reason;
    let detail = {
      damage: `Дополнительный урон: ${2 * r}.`,
      recovery: "Наносящее урон существо может потратить Восстановление.",
      shift: `Наносящее урон существо может сместиться до ${r} клеток.`,
      taunt:
        "После вашего урона способностью ближнего боя цель спровоцирована вами до конца её следующего хода.",
      doctrine: "",
    }[a.effect];
    if (a.effect === "doctrine") {
      const feature = activeClassFeatures(c).find(
        (f) =>
          f.description.includes("Преимущество метки:") && f.id === a.featureId,
      );
      if (!feature)
        return fail("У вашей доктрины нет доступного преимущества метки.");
      detail = feature.description;
    }
    if (a.effect === "recovery" && a.self && c.recoveries.current < 1)
      return fail("Нет Восстановлений.");
    return finish("Преимущество метки", detail, {
      heroicResource: {
        ...c.heroicResource,
        current: c.heroicResource.current - cost,
      },
      ...(a.effect === "recovery" && a.self
        ? {
            recoveries: { ...c.recoveries, current: c.recoveries.current - 1 },
            stamina: {
              ...c.stamina,
              current: Math.min(
                c.stamina.max,
                c.stamina.current + deriveStats(c).recoveryValue,
              ),
            },
          }
        : {}),
      classMechanics: {
        ...mechanics,
        tactician: { ...ts, lastEffect: detail },
      },
    });
  }
  if (!c.runtime?.combatActive || !c.runtime?.turnActive)
    return fail("Получение благочестия доступно в начале вашего хода в бою.");
  if (a.kind === "conduit-prayer") {
    if (ps.resolvedTurn === turn(c) || ps.prayer !== undefined)
      return fail("Решение о молитве уже принято на этот ход.");
    return finish(
      "Молитва",
      a.pray
        ? "Вы молитесь перед броском 1d3."
        : "Вы получаете благочестие без молитвы.",
      { classMechanics: { ...mechanics, conduit: { ...ps, prayer: a.pray } } },
    );
  }
  if (a.kind === "conduit-roll") {
    if (
      ps.resolvedTurn === turn(c) ||
      c.runtime.triggers["start-of-turn"]?.turn === turn(c)
    )
      return fail("Благочестие в начале этого хода уже получено.");
    if (ps.prayer === undefined)
      return fail("Перед броском выберите, будете ли вы молиться.");
    if (!Number.isInteger(a.die) || a.die < 1 || a.die > 3)
      return fail("Укажите результат 1d3 от 1 до 3.");
    if (
      ps.prayer &&
      a.die === 1 &&
      (!Number.isInteger(a.damageDie) || a.damageDie! < 1 || a.damageDie! > 6)
    )
      return fail("Укажите результат 1d6 психического урона.");
    const gain =
      a.die + (ps.prayer ? (a.die === 3 ? 2 : 1) + (c.level >= 10 ? 1 : 0) : 0);
    if (c.heroicResource.current + gain > 99)
      return fail(
        "Благочестие превысит предел ввода 99. Сначала скорректируйте ресурс.",
      );
    const damage = ps.prayer && a.die === 1 ? a.damageDie! + c.level : 0;
    return finish(
      "Благочестие",
      `+${gain} благочестия.${damage ? ` ${damage} психического урона, который нельзя уменьшить.` : ""}${ps.prayer && a.die === 3 ? " Доступен эффект одного домена." : ""}`,
      {
        heroicResource: {
          ...c.heroicResource,
          current: c.heroicResource.current + gain,
        },
        stamina: {
          ...c.stamina,
          current: applyDamage(c.stamina.current, c.stamina.temp, damage)
            .stamina,
          temp: applyDamage(c.stamina.current, c.stamina.temp, damage).temp,
        },
        runtime: {
          ...c.runtime,
          triggers: {
            ...c.runtime.triggers,
            "start-of-turn": { turn: turn(c), encounter: c.runtime.encounter },
          },
        },
        classMechanics: {
          ...mechanics,
          conduit: {
            ...ps,
            resolvedTurn: turn(c),
            domainAvailable: ps.prayer && a.die === 3,
          },
        },
      },
    );
  }
  if (a.kind === "conduit-domain") {
    const domain = conduitDomains(c).find((f) => f.id === a.domain);
    if (!ps.domainAvailable || !domain)
      return fail("Эффект выбранного домена сейчас недоступен.");
    return finish("Эффект молитвы", domain.description, {
      classMechanics: {
        ...mechanics,
        conduit: { ...ps, domainAvailable: false },
      },
    });
  }
  return fail("Неизвестное действие.");
}
export function transitionTargetsPrayer(
  c: Character,
  event:
    | "turn-start"
    | "turn-end"
    | "combat-start"
    | "combat-end"
    | "rest"
    | "resource-change",
): Character {
  const m = c.classMechanics;
  if (!m) return c;
  if (event === "combat-end" || event === "rest" || event === "combat-start") {
    if (c.className === "Цензор")
      return { ...c, classMechanics: { ...m, censor: { target: "" } } };
    if (c.className === "Тактик")
      return { ...c, classMechanics: { ...m, tactician: { targets: [] } } };
    if (c.className === "Проводник")
      return { ...c, classMechanics: { ...m, conduit: {} } };
  }
  if (event === "turn-start" && c.className === "Проводник")
    return { ...c, classMechanics: { ...m, conduit: {} } };
  if (
    event === "resource-change" &&
    c.className === "Тактик" &&
    c.stamina.current <= 0 &&
    m.tactician
  )
    return {
      ...c,
      classMechanics: { ...m, tactician: { ...m.tactician, targets: [] } },
    };
  return c;
}
