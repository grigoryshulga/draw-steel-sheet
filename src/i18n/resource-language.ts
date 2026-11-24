import type { Locale } from "./locale";

const labels: Record<string, string> = {
  "Домен Созидание: Существо в пределах 10 клеток использует способность по области": "Creation domain: A creature within 10 squares uses an area ability",
  "Домен Смерть: Не-миньон в пределах 10 клеток снижает Выносливость до 0 или соло-существо там становится утомлённым": "Death domain: A non-minion within 10 squares is reduced to 0 Stamina or a solo creature there becomes winded",
  "Домен Судьба: Союзник в пределах 10 клеток получает третий тир или враг там получает первый тир броска силы": "Fate domain: An ally within 10 squares gets tier 3 or an enemy there gets tier 1 on a power roll",
  "Домен Знание: Ведущий тратит Раздор": "Knowledge domain: The Director spends Malice",
  "Домен Жизнь: Существо в пределах 10 клеток восстанавливает Выносливость": "Life domain: A creature within 10 squares regains Stamina",
  "Домен Любовь: Вы или союзник в пределах 10 клеток используете помощь в атаке или способность, нацеленную на союзника": "Love domain: You or an ally within 10 squares uses Aid Attack or an ability targeting an ally",
  "Домен Природа: Вы или существо в пределах 10 клеток получаете кислотный, холодный, огненный, молниевый, ядовитый или звуковой урон": "Nature domain: You or a creature within 10 squares takes acid, cold, fire, lightning, poison, or sonic damage",
  "Домен Защита: Вы или союзник в пределах 10 клеток получаете временную Выносливость или применяете триггер снижения урона, помехи либо двойной помехи врагу": "Protection domain: You or an ally within 10 squares gains temporary Stamina or uses a trigger to reduce damage or impose a bane or double bane on an enemy",
  "Домен Буря: Враг в пределах 10 клеток подвергается принудительному движению": "Storm domain: An enemy within 10 squares is force moved",
  "Домен Солнце: Враг в пределах 10 клеток получает огненный или святой урон": "Sun domain: An enemy within 10 squares takes fire or holy damage",
  "Домен Хитрость: Вы или существо в пределах 10 клеток совершаете помощь в атаке или тест Скрытности": "Trickery domain: You or a creature within 10 squares uses Aid Attack or makes a Hide test",
  "Домен Война: Вы или существо в пределах 10 клеток получает за один ход урон больше 10 + ваш уровень": "War domain: You or a creature within 10 squares takes more than 10 + your level damage in one turn",
  "Начало боевой встречи": "Start of a combat encounter",
  "Начало боевой встречи или стрессовой ситуации": "Start of a combat encounter or stressful situation",
  "Начало твоего хода в бою": "Start of your turn in combat",
  "Начало твоего хода": "Start of your turn",
  "Первый раз за раунд: наносишь урон осуждённому": "First time per round: you damage your judged target",
  "Первый раз за раунд: осуждённый наносит тебе урон": "First time per round: your judged target damages you",
  "Первый раз за раунд: вы или союзник наносите урон отмеченному": "First time per round: you or an ally damage your marked target",
  "Первый раз за раунд: союзник в 10 клетках использует героическую способность": "First time per round: an ally within 10 uses a heroic ability",
  "Первый раз за раунд: враг в Поле нуля использует основное действие": "First time per round: an enemy in your Null Field uses a main action",
  "Первый раз за раунд: Ведущий использует способность за Раздор": "First time per round: the Director uses an ability that costs Malice",
  "Первый раз за раунд: урон со всплесками": "First time per round: deal damage with surges",
  "Первый раз за раунд: урон в 10 клетках (кроме нетипового и святого)": "First time per round: damage within 10 squares (except untyped or holy)",
  "Первый раз за раунд: существо подвергается принудительному движению": "First time per round: a creature is force moved",
  "Первый раз: три героя используют способности в один ход": "First time: three heroes use abilities in one turn",
  "Первый раз: герой становится утомлённым": "First time: a hero becomes winded",
  "Существо в линии воздействия выбрасывает 19–20": "A creature in line of effect rolls 19–20",
  "Герой умирает": "A hero dies",
  "Завершаешь отдых": "Complete a respite",
  "Конец твоего хода": "End of your turn", "Получаешь урон": "Take damage", "Теряешь выносливость": "Lose stamina",
  "Накладываешь принудительное движение": "Force move a creature", "Начинается бой": "Combat begins", "Наносишь урон": "Deal damage",
  "Попадаешь по цели": "Hit a target", "Критический удар": "Critical hit", "Промахиваешься": "Miss", "Союзник получает урон": "An ally takes damage",
  "Смежный враг наносит тебе урон": "An adjacent enemy damages you", "Первый раз за раунд": "First time per round", "Становишься утомлённым": "Become winded",
  "Становишься при смерти": "Become dying", "Тратишь восстановление": "Spend a recovery", "Враг входит в зону": "An enemy enters the area",
  "Проваливаешь спасбросок": "Fail a saving throw", "Проходишь спасбросок": "Succeed on a saving throw", "Одерживаешь победу": "Gain a victory",
  "Используешь способность": "Use an ability", "Меняешь форму": "Change form", "Постоянно": "Always",
  "Если молишься в начале хода": "If you pray at the start of your turn",
};
const resources: Record<string, string> = { "Героический ресурс": "Heroic resource", Свирепость: "Ferocity", Дисциплина: "Discipline", Эссенция: "Essence", Благочестие: "Piety", Фокус: "Focus", Ясность: "Clarity", Прозрение: "Insight", Драма: "Drama", Гнев: "Wrath", Добродетель: "Virtue", Аплодисменты: "Applause", Видение: "Vision", Веяние: "Rudiment", "Божественная сила": "Divinity", Командование: "Command", Уловка: "Guile", Порядок: "Order", "Первозданная сила": "Primordial Power" };
export const resourceLabel = (value: string, locale: Locale) => locale === "en" ? labels[value] ?? value : value;
export const resourceName = (value: string, locale: Locale) => locale === "en" ? resources[value] ?? value : value;
export const resourceAmount = (value: string, locale: Locale) => locale === "en" ? value.replace("Победы", "Victories").replace("Опыт", "XP").replace("Мощь", "Might") : value;
export const resourceFrequency = (value: string, locale: Locale) => locale === "en" ? ({ ход: "turn", раунд: "round", схватка: "encounter", отдых: "respite", всегда: "always" } as Record<string, string>)[value] ?? value : value;
export function resourceHelpLine(line: string, locale: Locale): string {
  if (locale !== "en") return line;
  if (line === "Остаток пропадает в конце боя.") return "Any remaining resource is lost at the end of combat.";
  const locked = line.match(/^Эпический пул «(.+)» откроется на (\d+)-м уровне\.$/);
  if (locked) return `Epic resource “${resourceName(locked[1], locale)}” unlocks at level ${locked[2]}.`;
  const epic = line.match(/^Эпический пул «(.+)»: (.+)\.$/);
  if (epic) return `Epic resource “${resourceName(epic[1], locale)}”: ${epic[2].split("; ").map(part => { const [event, amount] = part.split(" — "); return amount ? `${resourceLabel(event, locale)} — ${resourceAmount(amount, locale)}` : part; }).join("; ")}.`;
  const thresholds = line.match(/^Пороги (.+): (.+)$/);
  if (thresholds) return `Resource thresholds: ${thresholds[2]}`;
  return line;
}
