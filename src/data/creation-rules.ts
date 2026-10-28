import { SKILL_GROUPS } from "./skills";

export interface SkillSlot {
  label: string;
  options: string[];
  fixed?: string;
}
const allSkills = SKILL_GROUPS.flatMap((g) => g.skills);
export const ALL_CREATION_SKILLS = allSkills;
const groups = (...keys: string[]) =>
  SKILL_GROUPS.filter((g) => keys.includes(g.key)).flatMap((g) => g.skills);
const slot = (...keys: string[]): SkillSlot => ({
  label: "Навык",
  options: groups(...keys),
});
const fixed = (name: string): SkillSlot => ({
  label: name,
  options: [name],
  fixed: name,
});
const twice = (...keys: string[]) => [slot(...keys), slot(...keys)];

export const CAREER_SKILL_SLOTS: Record<string, SkillSlot[]> = {
  Агент: [fixed("Скрытность"), slot("interpersonal"), slot("intrigue")],
  Аристократ: [slot("interpersonal"), slot("lore")],
  Гладиатор: twice("exploration"),
  Исследователь: [fixed("Навигация"), ...twice("exploration")],
  Исполнитель: [
    { label: "Музыка или Выступление", options: ["Музыка", "Выступление"] },
    ...twice("interpersonal"),
  ],
  Лесничий: [fixed("Природа"), slot("exploration"), slot("intrigue")],
  Моряк: [fixed("Плавание"), ...twice("exploration")],
  Мудрец: twice("lore"),
  Нищий: [fixed("Слухи"), slot("exploration"), slot("interpersonal")],
  Политик: twice("interpersonal"),
  Послушник: [fixed("Религия"), ...twice("lore")],
  Преступник: [fixed("Криминальный мир"), ...twice("intrigue")],
  Работник: [fixed("Стойкость"), ...twice("crafting", "exploration")],
  Ремесленник: twice("crafting"),
  Солдат: [slot("exploration"), slot("intrigue")],
  Страж: [fixed("Внимательность"), ...twice("intrigue")],
  "Ученик Мага": [fixed("Магия"), ...twice("lore")],
  Фермер: [fixed("Обращение с животными"), ...twice("exploration")],
};
export const CLASS_SKILL_SLOTS: Record<string, SkillSlot[]> = {
  Неистовый: [fixed("Природа"), ...twice("exploration", "intrigue")],
  Нуль: [fixed("Псионика"), ...twice("interpersonal", "lore")],
  Проводник: twice("interpersonal", "lore"),
  Тактик: [
    fixed("Лидерство"),
    ...Array.from({ length: 2 }, () => ({
      label: "Навык тактика",
      options: [
        ...new Set([
          ...groups("exploration"),
          "Внимательность",
          "Архитектура",
          "Кузнечное дело",
          "Бравада",
          "Культура",
          "Эмпатия",
          "Оперение",
          "Механика",
          "Монстры",
          "Поиск",
          "Стратегия",
        ]),
      ],
    })),
  ],
  Талант: [
    fixed("Псионика"),
    fixed("Чтение личности"),
    ...twice("interpersonal", "lore"),
  ],
  Тень: [
    fixed("Скрытность"),
    fixed("Подкрадывание"),
    ...Array.from({ length: 5 }, () => ({
      label: "Навык тени",
      options: [
        ...groups("exploration", "interpersonal", "intrigue"),
        "Криминальный мир",
      ],
    })),
  ],
  Трубадур: [
    fixed("Чтение личности"),
    ...twice("interpersonal"),
    slot("intrigue", "lore"),
  ],
  Цензор: twice("interpersonal", "lore"),
  Элементалист: [
    fixed("Магия"),
    slot("crafting", "lore"),
    ...twice("crafting", "lore"),
  ],
};
export function cultureSkillSlot(text: string): SkillSlot {
  const rule = text.split("Варианты навыков:")[1]?.split("(*Быстрый")[0] ?? "";
  const keys = [
    ["ремесл", "crafting"],
    ["исследован", "exploration"],
    ["межличност", "interpersonal"],
    ["интриг", "intrigue"],
    ["знани", "lore"],
  ]
    .filter(([stem]) => rule.toLowerCase().includes(stem))
    .map(([, key]) => key);
  const named = allSkills.filter((name) =>
    rule.toLowerCase().includes(name.toLowerCase()),
  );
  // Military upbringing lists individual skills rather than granting their whole groups.
  const military = rule.includes("Оперение") && rule.includes("Стратегия");
  return {
    label: "Навык культуры",
    options: [...new Set([...(military ? [] : groups(...keys)), ...named])],
  };
}
export const CLASS_SIGNATURE_COUNTS: Record<string, number> = {
  Неистовый: 1,
  Нуль: 2,
  Проводник: 2,
  Тактик: 0,
  Талант: 2,
  Тень: 1,
  Трубадур: 1,
  Цензор: 1,
  Элементалист: 2,
};
export const KIT_CLASSES = [
  "Неистовый",
  "Тактик",
  "Тень",
  "Трубадур",
  "Цензор",
];
export const SUBCLASS_SKILL_SLOTS: Record<string, SkillSlot[]> = {
  Берсерк: [fixed("Лифтинг")],
  Разоритель: [fixed("Скрытность")],
  Буревестник: [fixed("Выслеживание")],
  Хронокинетик: [slot("lore")],
  Криокинетик: [slot("crafting")],
  Метакинетик: [slot("exploration")],
  Повстанец: [slot("intrigue")],
  Воевода: [slot("lore")],
  Авангард: [slot("interpersonal")],
  "Коллегия Черного Пепла": [fixed("Магия")],
  "Коллегия Едкой Алхимии": [fixed("Алхимия")],
  "Коллегия Маски Арлекина": [fixed("Обман")],
  Автор: [fixed("Бравада")],
  Дуэлянт: [fixed("Гимнастика")],
  Виртуоз: [fixed("Музыка")],
  Экзорцист: [fixed("Чтение личности")],
  Оракул: [fixed("Магия")],
  Идеал: [fixed("Лидерство")],
};
export const DOMAIN_SKILL_SLOTS: Record<string, SkillSlot> = {
  Созидание: slot("crafting"),
  Смерть: slot("lore"),
  Судьба: slot("lore"),
  Знание: slot("lore"),
  Жизнь: slot("exploration"),
  Любовь: slot("interpersonal"),
  Природа: slot("exploration"),
  Защита: slot("exploration"),
  Буря: slot("exploration"),
  Солнце: slot("lore"),
  Хитрость: slot("intrigue"),
  Война: slot("exploration"),
};
export const CLASS_GRANTED_ABILITIES: Record<string, string[]> = {
  Нуль: ["Поле Нуля", "Инерционный Щит"],
  Проводник: ["Исцеляющая Благодать", "Луч Гнева"],
  Тактик: ["Метка", "Бей Сейчас"],
  Талант: ["Шип Разума"],
  Трубадур: ["Хореография", "Живительный Лимерик"],
  Цензор: ["Суд", "Моя Жизнь за Твою"],
  Элементалист: ["Бросок Элемента", "Практическая Магия"],
};
export const SUBCLASS_GRANTED_ABILITIES: Record<string, string[]> = {
  Берсерк: ["Линии Силы"],
  Разоритель: ["Неземные Рефлексы"],
  Буревестник: ["Яростное Изменение"],
  Повстанец: ["Продвинутая Тактика"],
  Воевода: ["Прикрытие"],
  Авангард: ["Парирование"],
  Хронопатия: ["Ускорение", "Снова"],
  Телекинез: ["Малый Телекинез", "Отражение"],
  Телепатия: ["Петля Обратной Связи", "Удаленная Помощь"],
  "Коллегия Черного Пепла": [
    "Телепортация Черного Пепла",
    "Во Всей Этой Неразберихе",
  ],
  "Коллегия Едкой Алхимии": [
    "Смазать Клинок",
    "Дымовая Бомба",
    "Защитный Перекат",
  ],
  "Коллегия Маски Арлекина": ["Я не Угроза", "Умный Трюк"],
  Автор: ["Мизансцена", "Драматический Монолог", "Око за Око"],
  Дуэлянт: ["Акробатика", "Звездная Сила", "Рипост"],
  Виртуоз: [
    "Мощный Аккорд",
    "Гармонизация",
    "Громовая Мать",
    "Баллада о Звере",
  ],
  Земля: ["Побудить Землю", "Кожа Как Стены Замка"],
  Огонь: ["Возврат к Бесформенности", "Взрывная Помощь"],
  Зелень: ["Воспоминание о Дыхании Рассвета"],
  Пустота: ["Незаметное Перемещение", "Разделенное Чувство Пустоты"],
};
export const DOMAIN_GRANTED_ABILITIES: Record<string, string[]> = {
  Созидание: ["Руки Творца"],
  Смерть: ["Могильная Речь"],
  Природа: ["Верный Друг"],
};
export function canUseKit(className: string, subclass: string): boolean {
  return (
    KIT_CLASSES.includes(className) &&
    !(className === "Неистовый" && subclass === "Буревестник")
  );
}
