import { heldDiscipline } from "./discipline";
import type { Character } from "../../types";
import type { ActionPreview } from "../game-actions";
import { CLASS_FEATURE_SYNTHETIC_ROWS } from "../../data/class-features/legacy-rows";
import { applyDamage } from "../rules";

export const NULL_ENHANCEMENTS = [
  "Гравитационное разрушение",
  "Инерционный якорь",
  "Синаптический разрыв",
] as const;
type Enhancement = (typeof NULL_ENHANCEMENTS)[number];
export interface NullState {
  peakDiscipline: number;
  fieldActive: boolean;
  enhancement?: Enhancement;
  enhancementTurn?: number;
  enhancedTurn?: number;
}
export interface TalentState {
  consequences: string[];
  damageTurn?: number;
  waiveStrainDamage: boolean;
}
export type NullTalentAction =
  | { kind: "null-field"; active: boolean }
  | { kind: "null-enhance"; enhancement: Enhancement }
  | { kind: "talent-consequence-add"; text: string }
  | { kind: "talent-consequence-remove"; index: number }
  | { kind: "talent-waive-strain"; waive: boolean };
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
export function normalizeNullState(value: unknown): NullState {
  const v = record(value);
  return {
    peakDiscipline: Math.min(99, integer(v.peakDiscipline) ?? 0),
    fieldActive: v.fieldActive === true,
    ...(NULL_ENHANCEMENTS.includes(v.enhancement as Enhancement)
      ? {
          enhancement: v.enhancement as Enhancement,
          enhancementTurn: integer(v.enhancementTurn),
        }
      : {}),
    enhancedTurn: integer(v.enhancedTurn),
  };
}
export function normalizeTalentState(value: unknown): TalentState {
  const v = record(value);
  return {
    consequences: Array.isArray(v.consequences)
      ? v.consequences
          .filter((s): s is string => typeof s === "string" && !!s.trim())
          .slice(0, 50)
          .map((s) => s.slice(0, 500))
      : [],
    damageTurn: integer(v.damageTurn),
    waiveStrainDamage: v.waiveStrainDamage === true,
  };
}
export const nullState = (c: Character) =>
  normalizeNullState(c.classMechanics?.null);
export const talentState = (c: Character) =>
  normalizeTalentState(c.classMechanics?.talent);
export const nullDiscipline = heldDiscipline;
export const effectiveNullDiscipline = nullDiscipline;
export function nullMastery(c: Character) {
  const tradition = c.subclass.includes("Хронокинетик")
    ? "chronokinetic"
    : c.subclass.includes("Криокинетик")
      ? "cryokinetic"
      : c.subclass.includes("Метакинетик")
        ? "metakinetic"
        : undefined;
  if (!tradition) return [];
  const discipline = nullDiscipline(c);
  return [2, 4, 6, 8, 10, 12].map((threshold) => {
    const level =
      threshold < 8 ? 1 : threshold === 8 ? 4 : threshold === 10 ? 7 : 10;
    const feature = CLASS_FEATURE_SYNTHETIC_ROWS.find(
      (row) =>
        row.id ===
        `feature.null.level-${level}.${tradition}-mastery-${threshold}`,
    );
    const replaced =
      (threshold === 4 && c.level >= 4 && discipline >= 8) ||
      (threshold === 6 && c.level >= 7 && discipline >= 10);
    return {
      threshold,
      level,
      active: c.level >= level && discipline >= threshold && !replaced,
      replaced,
      text: feature?.description ?? "",
    };
  });
}
function withNull(c: Character, state: NullState): Character {
  return { ...c, classMechanics: { ...c.classMechanics, null: state } };
}
function withTalent(c: Character, state: TalentState): Character {
  return { ...c, classMechanics: { ...c.classMechanics, talent: state } };
}
export function previewNullTalent(
  c: Character,
  action: NullTalentAction,
): ActionPreview {
  const invalid = (reason: string): ActionPreview => ({ ok: false, reason });
  const done = (next: Character, label: string): ActionPreview => ({
    ok: true,
    next,
    label,
    detail: label,
  });
  if (action.kind.startsWith("null-") && c.className !== "Нуль")
    return invalid("Доступно только Нулю");
  if (action.kind.startsWith("talent-") && c.className !== "Талант")
    return invalid("Доступно только Таланту");
  const n = nullState(c),
    t = talentState(c),
    turn = c.runtime?.turn ?? 0;
  switch (action.kind) {
    case "null-field":
      if (action.active && c.stamina.current <= 0)
        return invalid("Нельзя поддерживать поле при смерти");
      if (n.fieldActive === action.active)
        return invalid("Состояние поля не изменилось");
      return done(
        withNull(c, {
          ...n,
          fieldActive: action.active,
          ...(!action.active
            ? { enhancement: undefined, enhancementTurn: undefined }
            : {}),
        }),
        action.active ? "Поле нуля включено" : "Поле нуля выключено",
      );
    case "null-enhance": {
      if (!NULL_ENHANCEMENTS.includes(action.enhancement))
        return invalid("Выберите усиление поля");
      if (!n.fieldActive) return invalid("Сначала включите Поле нуля");
      if (!c.runtime?.turnActive)
        return invalid("Усиление доступно в свой ход");
      if (n.enhancedTurn === turn)
        return invalid("Поле уже усилено в этот ход");
      if (c.heroicResource.current < 1) return invalid("Нужна 1 дисциплина");
      return done(
        withNull(
          {
            ...c,
            heroicResource: {
              ...c.heroicResource,
              current: c.heroicResource.current - 1,
            },
          },
          {
            ...n,
            peakDiscipline: nullDiscipline(c),
            enhancement: action.enhancement,
            enhancementTurn: turn,
            enhancedTurn: turn,
          },
        ),
        `${action.enhancement}: −1 дисциплина`,
      );
    }
    case "talent-consequence-add": {
      const text = action.text.trim();
      if (!text || text.length > 500 || t.consequences.length >= 50)
        return invalid("Опишите последствие (до 500 символов)");
      return done(
        withTalent(c, { ...t, consequences: [...t.consequences, text] }),
        "Добавлено последствие возбужденности",
      );
    }
    case "talent-consequence-remove":
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= t.consequences.length
      )
        return invalid("Последствие уже снято");
      return done(
        withTalent(c, {
          ...t,
          consequences: t.consequences.filter((_, i) => i !== action.index),
        }),
        "Последствие возбужденности завершено",
      );
    case "talent-waive-strain":
      if (c.level < 10)
        return invalid("Отказ от урона доступен с 10-го уровня");
      return done(
        withTalent(c, { ...t, waiveStrainDamage: action.waive }),
        action.waive
          ? "Урон возбужденности отключён"
          : "Урон возбужденности включён",
      );
  }
}
export function transitionNullTalent(
  c: Character,
  event:
    | "turn-start"
    | "turn-end"
    | "combat-start"
    | "combat-end"
    | "rest"
    | "resource-change",
): Character {
  if (c.className === "Нуль") {
    const n = nullState(c);
    if (c.stamina.current <= 0) {
      n.fieldActive = false;
      n.enhancement = undefined;
      n.enhancementTurn = undefined;
    }
    if (event === "turn-start")
      return withNull(c, {
        ...n,
        peakDiscipline: Math.max(n.peakDiscipline, c.heroicResource.current),
        enhancement: undefined,
        enhancementTurn: undefined,
      });
    if (event === "turn-end" || event === "combat-end" || event === "rest")
      return withNull(c, {
        ...n,
        peakDiscipline: Math.max(0, c.heroicResource.current),
        ...(event !== "turn-end" ? { enhancedTurn: undefined } : {}),
      });
    return withNull(c, {
      ...n,
      peakDiscipline: Math.max(n.peakDiscipline, c.heroicResource.current),
    });
  }
  if (c.className === "Талант" && event === "turn-end") {
    const t = talentState(c),
      turn = c.runtime?.turn ?? 0;
    if (t.damageTurn === turn) return c;
    const amount =
      c.level >= 10 && t.waiveStrainDamage
        ? 0
        : Math.max(0, -c.heroicResource.current);
    const damage = applyDamage(c.stamina.current, c.stamina.temp, amount);
    return withTalent(
      {
        ...c,
        stamina: { ...c.stamina, current: damage.stamina, temp: damage.temp },
      },
      { ...t, damageTurn: turn },
    );
  }
  if (c.className === "Талант" && event === "combat-start")
    return withTalent(c, { ...talentState(c), damageTurn: undefined });
  return c;
}
