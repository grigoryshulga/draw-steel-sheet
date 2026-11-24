import type { Locale } from "./locale";

const exact: Record<string, string> = {
  "Создание героя: эти выборы заданы при первом заполнении листа.": "Hero creation: these choices were made when the sheet was created.",
  "Записи о повышении этого уровня нет: выборы можно дозаполнить, они сохранятся как запись о повышении.": "There is no advancement record for this level. Complete the choices to save one.",
  "Повышение уровня недоступно.": "Level up is unavailable.",
  "Уровень героя вне допустимого диапазона 1–10; повышение уровня недоступно.": "The hero's level is outside the allowed range of 1–10; level up is unavailable.",
  "Выбор способности": "Choose an ability", "Выбор доменной способности": "Choose a domain ability", "Выбор навыка домена": "Choose a domain skill", "Выбор перка": "Choose a perk", "Выбор навыка": "Choose a skill", "Повышение характеристики": "Increase a characteristic",
  "Навык второго домена Проводника": "Second Conduit domain skill", "Новый навык": "New skill", "Героическая способность": "Heroic ability",
  "Происхождение": "Ancestry", "Культура": "Culture", "Карьера": "Career", "Класс": "Class", "Комплект": "Kit", "Навыки создания": "Creation skills", "Способности создания": "Creation abilities",
  "Все навыки уже есть у героя — новый навык не требуется.": "The hero already has every skill; no new skill is required.",
  "Для повышения Проводника 1→2 сначала выберите в приложении оба домена и домен особенности 1-го уровня. Старый лист сохранён; награды второго домена не начислены и не потеряны.": "To advance the Conduit from level 1 to 2, first select both domains and the domain for the level 1 feature. The existing sheet is preserved; second-domain rewards have not been granted or lost.",
};
const patterns: [RegExp, string][] = [
  [/^Класс «без класса» не распознан — проверенных правил повышения нет\. Измените уровень вручную\.$/, "No class is selected. There are no verified advancement rules; change the level manually."],
  [/^Класс «(.+)» не распознан — проверенных правил повышения нет\. Измените уровень вручную\.$/, "Class “$1” is not recognized. There are no verified advancement rules; change the level manually."],
  [/^Герой уже достиг (\d+)-го уровня — выше расти нельзя\.$/, "The hero has reached level $1, the maximum level."],
  [/^Для класса «(.+)» нет проверенных правил повышения до (\d+)-го уровня\. Измените уровень вручную\.$/, "There are no verified level $2 advancement rules for class “$1”. Change the level manually."],
  [/^Для класса «(.*)» нет проверенных правил (\d+)-го уровня\.$/, "There are no verified level $2 rules for class “$1”."],
  [/^Героическая способность (\d+)-го уровня$/, "Level $1 heroic ability"],
  [/^В правилах (\d+)-го уровня нет обязательных выборов для подкласса «(.+)»\. Проверьте подкласс героя\.$/, "Level $1 rules have no required choices for subclass “$2”. Check the hero's subclass."],
  [/^На (\d+)-м уровне положен классовый перк, но доступных вариантов не осталось\. Выберите перк вручную или освободите существующий\.$/, "A class perk is granted at level $1, but no options remain. Choose one manually or free an existing perk."],
  [/^Для (\d+)-го уровня положено навыков: (\d+), а доступных новых навыков (\d+)\. Добавьте навык вручную\.$/, "Level $1 grants $2 skills, but only $3 new skills are available. Add the skill manually."],
  [/^Для получения доменной способности (\d+)-го уровня сначала выберите два известных домена Проводника\. Проверьте сохранённый выбор доменов и повторите повышение; награда не потеряна\.$/, "To gain the level $1 domain ability, first select both known Conduit domains. Check the saved domains and try again; the reward is preserved."],
  [/^Классовый перк (\d+)-го уровня$/, "Level $1 class perk"], [/^Доменная способность (\d+)-го уровня$/, "Level $1 domain ability"], [/^Правила (\d+)-го уровня$/, "Level $1 rules"],
  [/^Выбор навыков \((\d+)\)$/, "Choose skills ($1)"], [/^Новые навыки \((\d+)\)$/, "New skills ($1)"], [/^\+(\d+), не выше (\d+)$/, "+$1, maximum $2"],
  [/^Повышение характеристики \(\+(\d+), не выше (\d+)\)$/, "Increase a characteristic (+$1, maximum $2)"],
  [/^сейчас ([-\d]+)$/, "currently $1"], [/^\+(\d+) к характеристике, но не выше (\d+)$/, "+$1 to a characteristic, maximum $2"],
  [/^Правила (\d+)-го уровня зависят от подкласса, а у героя он не указан\. Укажите подкласс — обязательные выборы нельзя пропустить молча\.$/, "Level $1 rules depend on a subclass. Select one before advancing; required choices cannot be skipped."],
  [/^Награды (\d+)-го уровня зависят от подкласса; пока подкласс не указан, они не начисляются\.$/, "Level $1 rewards depend on a subclass and are not granted until one is selected."],
];
export function developmentMessage(text: string, locale: Locale): string {
  if (locale === "ru" || !text) return text;
  if (exact[text]) return exact[text];
  for (const [pattern, replacement] of patterns) if (pattern.test(text)) return text.replace(pattern, replacement);
  return text;
}

/** Present validation messages from the development plan without changing stored choices. */
export function developmentIssue(message: string, level: number, stepTitle: string, locale: Locale): string {
  if (locale === "ru") return message;
  const step = developmentMessage(stepTitle, locale);
  const counts = /нужно выбрать (\d+), выбрано (\d+)/.exec(message);
  if (counts) return `Level ${level}: “${step}” requires ${counts[1]} choices; ${counts[2]} selected.`;
  if (message.includes("не заполнен шаг")) return `Level ${level}: complete “${step}”.`;
  if (message.includes("способность выбрана дважды")) return `Level ${level}: the same ability was selected in more than one step.`;
  const invalid = /вариант «(.+?)» больше не входит/.exec(message);
  if (invalid) return `Level ${level}: “${invalid[1]}” is no longer an option for “${step}”. Choose again.`;
  return developmentMessage(message, locale);
}
