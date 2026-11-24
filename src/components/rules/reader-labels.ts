import type { Locale } from "../../i18n/locale";

const labels: Record<string, string> = {
  "Неистовый": "Fury", "Нуль": "Null", "Призыватель": "Summoner", "Проводник": "Conduit", "Тактик": "Tactician", "Талант": "Talent", "Тень": "Shadow", "Трубадур": "Troubadour", "Цензор": "Censor", "Элементалист": "Elementalist",
  "Расходуемые": "Consumables", "Сокровища с Уровнем": "Leveled Treasures", "Безделушки": "Trinkets", "Артефакты": "Artifacts", "Исследовательские Проекты": "Research Projects", "Ремесленные Проекты": "Crafting Projects", "Другие Проекты": "Other Projects", "Список Комплектов": "Kit List", "Титулы": "Titles",
  "Ремесло": "Crafting", "Исследование": "Exploration", "Межличностные": "Interpersonal", "Интрига": "Intrigue", "Знания": "Lore", "Сверхъестественные": "Supernatural",
  "Правила ведущего": "Director’s Rules", "Справочник · Классы": "Reference · Classes", "Сверхъестественное": "Supernatural",
  "Как играть": "How to Play", "Создание героя": "Hero Creation", "Между боями": "Between Battles", "Ведущему": "Director",
  "Введение": "Introduction", "Основы": "The Basics", "Тесты": "Tests", "Ведение Боя": "Combat", "Переговоры": "Negotiation",
  "Создание Героя": "Hero Creation", "Происхождения": "Ancestries", "Предыстория": "Background", "Способности": "Abilities", "Нюансы": "Details",
  "Проекты Отдыха": "Respite Projects", "Награды": "Rewards", "Для Ведущего": "For the Director", "Монстры: правила ведущего": "Monsters: Director's Rules",
  "Бестиарий": "Bestiary", "Помощники": "Retainers", "Динамическая местность": "Dynamic Terrain", "О Проекте": "About", "Классы": "Classes", "Комплекты": "Kits", "Перки": "Perks",
};
const sections: Record<string, string> = { classes: "Classes", ancestries: "Ancestries", careers: "Careers", kits: "Kits", perks: "Perks", treasure: "Treasure", title: "Titles", project: "Projects", monsters: "Monsters", retainers: "Retainers", terrain: "Terrain", glossary: "Glossary" };
export function readerLabel(value: string, locale: Locale): string {
  if (locale === "ru") return value;
  const prefix = /^(\d+\.\s*)(.*)$/.exec(value);
  return prefix ? prefix[1] + (labels[prefix[2]] ?? prefix[2]) : labels[value] ?? value;
}
export function sectionTitle(id: string, fallback: string, locale: Locale): string {
  return locale === "en" ? sections[id] ?? fallback : fallback;
}
