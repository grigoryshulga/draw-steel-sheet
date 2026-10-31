import type { CharacteristicKey } from "../types";

export interface ClassPreset {
  name: string;
  /** Английское название класса из SteelCompendium. */
  originalName?: string;
  resource: string;
  staminaBase: number;
  staminaPerLevel: number;
  recoveries: number;
  potency: CharacteristicKey;
  starting: Partial<Record<CharacteristicKey, number>>;
}

/** Данные из переведённых правил draw-steel-ru (глава 08. Классы). */
export const CLASS_PRESETS: ClassPreset[] = [
  {
    name: "Неистовый",
    originalName: "Fury",
    resource: "Свирепость",
    staminaBase: 21,
    staminaPerLevel: 9,
    recoveries: 10,
    potency: "might",
    starting: { might: 2, agility: 2 },
  },
  {
    name: "Нуль",
    originalName: "Null",
    resource: "Дисциплина",
    staminaBase: 21,
    staminaPerLevel: 9,
    recoveries: 8,
    potency: "intuition",
    starting: { agility: 2, intuition: 2 },
  },
  {
    name: "Призыватель",
    originalName: "Summoner",
    resource: "Эссенция",
    staminaBase: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    potency: "reason",
    starting: { reason: 2 },
  },
  {
    name: "Проводник",
    originalName: "Conduit",
    resource: "Благочестие",
    staminaBase: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    potency: "intuition",
    starting: { intuition: 2 },
  },
  {
    name: "Тактик",
    originalName: "Tactician",
    resource: "Фокус",
    staminaBase: 21,
    staminaPerLevel: 9,
    recoveries: 10,
    potency: "reason",
    starting: { might: 2, reason: 2 },
  },
  {
    name: "Талант",
    originalName: "Talent",
    resource: "Ясность",
    staminaBase: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    potency: "reason",
    starting: { reason: 2, presence: 2 },
  },
  {
    name: "Тень",
    originalName: "Shadow",
    resource: "Прозрение",
    staminaBase: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    potency: "agility",
    starting: { agility: 2 },
  },
  {
    name: "Трубадур",
    originalName: "Troubadour",
    resource: "Драма",
    staminaBase: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    potency: "presence",
    starting: { agility: 2, presence: 2 },
  },
  {
    name: "Цензор",
    originalName: "Censor",
    resource: "Гнев",
    staminaBase: 21,
    staminaPerLevel: 9,
    recoveries: 12,
    potency: "presence",
    starting: { might: 2, presence: 2 },
  },
  {
    name: "Элементалист",
    originalName: "Elementalist",
    resource: "Эссенция",
    staminaBase: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    potency: "reason",
    starting: { reason: 2 },
  },
];

export function classPreset(name: string): ClassPreset | undefined {
  return CLASS_PRESETS.find((preset) => preset.name === name);
}

export function heroicResourceName(className: string): string {
  return classPreset(className)?.resource ?? "Героический ресурс";
}

export const ANCESTRIES = [
  "Дьявол",
  "Драконий Рыцарь",
  "Дварф",
  "Лесной Эльф",
  "Высший Эльф",
  "Хакаан",
  "Человек",
  "Меманек",
  "Орк",
  "Полдер",
  "Ревенант",
  "Рейдер Времени",
  "Таурус",
  "Ящер",
] as const;

export const CAREERS = [
  "Агент",
  "Аристократ",
  "Гладиатор",
  "Исследователь",
  "Исполнитель",
  "Лесничий",
  "Моряк",
  "Мудрец",
  "Нищий",
  "Политик",
  "Послушник",
  "Преступник",
  "Работник",
  "Ремесленник",
  "Солдат",
  "Страж",
  "Ученик Мага",
  "Фермер",
] as const;
