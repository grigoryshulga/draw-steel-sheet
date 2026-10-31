import type { OriginalFields } from "../types";
import skillOriginals from "./skills-originals.generated.json";

export type SkillTone = "yellow" | "green" | "blue" | "magenta" | "accent";

/** Английские оригиналы навыков из SteelCompendium, ключ — русское название. */
export const SKILL_ORIGINALS: Record<string, OriginalFields> =
  skillOriginals as Record<string, OriginalFields>;

/** Цвет группы навыков — один и тот же на листе, в развитии и в билдере. */
export const SKILL_GROUP_TONES: Record<SkillGroup["key"], SkillTone> = {
  crafting: "yellow",
  exploration: "green",
  interpersonal: "blue",
  intrigue: "magenta",
  lore: "accent",
};

export interface SkillGroup {
  key: "crafting" | "exploration" | "interpersonal" | "intrigue" | "lore";
  label: string;
  skills: string[];
}

/** Навыки из главы 12 (1208. Группы Навыков). */
export const SKILL_GROUPS: SkillGroup[] = [
  {
    key: "crafting",
    label: "Ремесло",
    skills: [
      "Алхимия",
      "Архитектура",
      "Кузнечное дело",
      "Плотничество",
      "Кулинария",
      "Оперение",
      "Фальсификация",
      "Ювелирное дело",
      "Механика",
      "Портное дело",
    ],
  },
  {
    key: "exploration",
    label: "Исследование",
    skills: [
      "Скалолазание",
      "Вождение",
      "Стойкость",
      "Гимнастика",
      "Первая помощь",
      "Прыжки",
      "Лифтинг",
      "Навигация",
      "Езда",
      "Плавание",
    ],
  },
  {
    key: "interpersonal",
    label: "Межличностные",
    skills: [
      "Бравада",
      "Эмпатия",
      "Флирт",
      "Азарт",
      "Обращение с животными",
      "Допрос",
      "Запугивание",
      "Лидерство",
      "Обман",
      "Музыка",
      "Выступление",
      "Убеждение",
      "Чтение личности",
    ],
  },
  {
    key: "intrigue",
    label: "Интрига",
    skills: [
      "Внимательность",
      "Запрятывание",
      "Маскировка",
      "Подслушивание",
      "Мастер ускользания",
      "Скрытность",
      "Взлом замков",
      "Карманное дело",
      "Саботаж",
      "Поиск",
      "Подкрадывание",
      "Выслеживание",
    ],
  },
  {
    key: "lore",
    label: "Знания",
    skills: [
      "Криминальный мир",
      "Культура",
      "История",
      "Магия",
      "Монстры",
      "Природа",
      "Псионика",
      "Религия",
      "Слухи",
      "Общество",
      "Стратегия",
      "Мультивселенная",
    ],
  },
];
