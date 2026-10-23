import type { AbilityKind, ActionType } from "../types";

export const ACTION_TYPES: {
  key: ActionType;
  label: string;
  short: string;
  hint: string;
}[] = [
  {
    key: "main",
    label: "Основное действие",
    short: "Основное",
    hint: "Одно основное действие за ход. Сюда входят удары и большинство способностей.",
  },
  {
    key: "maneuver",
    label: "Маневр",
    short: "Маневр",
    hint: "Один маневр за ход: захват, отталкивание, передышка, помощь.",
  },
  {
    key: "move",
    label: "Действие движения",
    short: "Движение",
    hint: "Одно действие движения за ход: перемещение, отход, езда.",
  },
  {
    key: "trigger",
    label: "Триггер",
    short: "Триггер",
    hint: "Срабатывает по условию. Один триггер за раунд.",
  },
  {
    key: "free-trigger",
    label: "Свободный триггер",
    short: "Своб. триггер",
    hint: "Срабатывает по условию и не расходует лимит триггеров.",
  },
  {
    key: "free-maneuver",
    label: "Свободный маневр",
    short: "Своб. маневр",
    hint: "Простые действия в свой ход: открыть дверь, взять предмет.",
  },
  {
    key: "none",
    label: "Без действия",
    short: "Без действия",
    hint: "Не требует действия — обычно вне вашего хода.",
  },
];

export const ABILITY_KINDS: { key: AbilityKind; label: string; tone: string }[] = [
  { key: "signature", label: "Знаковая", tone: "accent" },
  { key: "heroic", label: "Героическая", tone: "magenta" },
  { key: "free-strike", label: "Свободный удар", tone: "blue" },
  { key: "other", label: "Другая", tone: "default" },
];

export function actionLabel(type: ActionType): string {
  return ACTION_TYPES.find((item) => item.key === type)?.label ?? type;
}

export function actionShort(type: ActionType): string {
  return ACTION_TYPES.find((item) => item.key === type)?.short ?? type;
}

export function kindLabel(kind: AbilityKind): string {
  return ABILITY_KINDS.find((item) => item.key === kind)?.label ?? kind;
}

export const CLASS_NAMES = [
  "Базовые",
  "Неистовый",
  "Нуль",
  "Призыватель",
  "Проводник",
  "Тактик",
  "Талант",
  "Тень",
  "Трубадур",
  "Цензор",
  "Элементалист",
];
