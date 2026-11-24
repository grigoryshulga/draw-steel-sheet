import { resourceLabel } from "./resource-language";
import type { Locale } from "./locale";

/** Translate known presentation messages only; unknown authored text stays intact. */
const exact: Record<string, string> = {
  "Сначала начните битву": "Start combat first", "Ход уже начался": "Your turn has already started", "Свой ход ещё не начат": "Your turn has not started yet",
  "Введите количество урона больше нуля": "Enter damage greater than zero", "Восстановления закончились": "No recoveries remain", "Количество исцеления должно быть больше нуля": "Healing must be greater than zero", "Выносливость уже максимальна": "Stamina is already at maximum",
  "Введите временную выносливость больше нуля": "Enter temporary stamina greater than zero", "Текущий запас уже не меньше: временная выносливость не складывается": "The current pool is already at least as large; temporary stamina does not stack", "Значение не изменилось": "The value has not changed",
  "Битва уже началась": "Combat has already started", "Битва ещё не началась": "Combat has not started yet", "Растущая свирепость доступна Неистовому": "Growing Ferocity is available to the Fury", "Ваш ход уже начался": "Your turn has already started", "Ваш ход ещё не начался": "Your turn has not started yet",
  "Сначала выберите комплект буревестника": "Choose a stormwight kit first", "Неизвестная форма": "Unknown form", "Эта форма уже принята": "Already in this form", "Для свободного превращения нужна 1 свирепость": "A free transformation requires 1 ferocity",
  "Этой способности больше нет у героя": "The hero no longer has this ability", "Выберите от 0 до 3 всплесков": "Choose between 0 and 3 surges", "Проверьте дополнительный расход ресурса": "Check the additional resource cost", "Проверьте стоимость способности": "Check the ability cost",
  "Действие уже недоступно для отмены": "This action can no longer be undone", "Состояние схватки уже изменилось. Сначала отмените более позднее действие или исправьте его вручную.": "The encounter state has changed. Undo the later action first or correct it manually.", "Классовое состояние уже изменилось. Сначала отмените более позднее действие.": "The class state has changed. Undo the later action first.", "Затронутые значения уже изменены. Сначала отмените более позднее действие или исправьте их вручную.": "Affected values have changed. Undo the later action first or correct them manually.", "Максимум ресурса изменился. Используйте ручную коррекцию.": "The resource maximum has changed. Adjust it manually.", "Это действие уже применено": "This action has already been applied", "Нет действий для отмены": "There are no actions to undo",
  "Начало своего хода": "Start of turn", "Конец своего хода": "End of turn", "Потрачено восстановление": "Recovery spent", "Временная выносливость": "Temporary stamina", "Коррекция выносливости": "Adjust stamina", "Отдых": "Respite", "Начало битвы": "Combat begins", "Конец битвы": "Combat ends", "Восстановления": "Recoveries", "Жетоны героя": "Hero tokens", "Эпический ресурс": "Epic resource", "Всплески": "Surges", "Способность": "Ability", "Истинная форма": "True form",
  "Свободный манёвр: −1 свирепость.": "Free maneuver: −1 ferocity.", "Превращение: манёвр.": "Transformation: maneuver.", "Первое превращение в гибрида в этой битве: 10 временной выносливости (запасы не складываются).": "First hybrid transformation this combat: 10 temporary stamina (pools do not stack).",
  "Начался новый ход героя; эффекты начала хода обновлены.": "The hero’s turn began; start-of-turn effects were updated.", "Применены последствия конца хода героя.": "End-of-turn effects were applied.", "Началась новая битва, отметки триггеров сняты.": "A new combat began and trigger marks were cleared.", "Битва завершена.": "Combat ended.", "Достигнутые пороги свирепости сохраняются до конца этого хода.": "Ferocity thresholds reached remain until the end of this turn.", "Удержанные пороги сняты. Преимущества определяются текущей свирепостью.": "Retained thresholds were cleared. Benefits use current ferocity.",
  "Доступно только Нулю": "Available only to the Null", "Доступно только Таланту": "Available only to the Talent", "Нельзя поддерживать поле при смерти": "The field cannot be maintained while dying", "Состояние поля не изменилось": "The field state has not changed", "Выберите усиление поля": "Choose a field enhancement", "Сначала включите Поле нуля": "Activate the Null Field first", "Усиление доступно в свой ход": "Enhancement is available on your turn", "Поле уже усилено в этот ход": "The field was already enhanced this turn", "Нужна 1 дисциплина": "Requires 1 discipline", "Опишите последствие (до 500 символов)": "Describe the consequence (up to 500 characters)", "Последствие уже снято": "The consequence has already ended", "Отказ от урона доступен с 10-го уровня": "Waiving damage is available at level 10",
  "Гравитационное разрушение": "Gravitic Disruption", "Инерционный якорь": "Inertial Anchor", "Синаптический разрыв": "Synaptic Break",
  "Поле нуля включено": "Null Field activated", "Поле нуля выключено": "Null Field deactivated", "Добавлено последствие возбужденности": "Strain consequence added", "Последствие возбужденности завершено": "Strain consequence ended", "Урон возбужденности отключён": "Strain damage disabled", "Урон возбужденности включён": "Strain damage enabled",
  "Эта механика недоступна вашему классу.": "This mechanic is unavailable to your class.", "Сначала выберите осуждённую цель.": "Choose a judged target first.", "Нужен 1 гнев.": "Requires 1 wrath.", "Выберите отмеченную цель.": "Choose a marked target.", "У вашей доктрины нет доступного преимущества метки.": "Your doctrine has no available mark benefit.", "Нет Восстановлений.": "No recoveries remain.", "Получение благочестия доступно в начале вашего хода в бою.": "Piety can be gained at the start of your turn in combat.", "Решение о молитве уже принято на этот ход.": "The prayer decision has already been made this turn.", "Благочестие в начале этого хода уже получено.": "Start-of-turn piety has already been gained.", "Перед броском выберите, будете ли вы молиться.": "Choose whether to pray before rolling.", "Укажите результат 1d3 от 1 до 3.": "Enter a 1d3 result from 1 to 3.", "Укажите результат 1d6 психического урона.": "Enter the 1d6 psychic damage roll.", "Благочестие превысит предел ввода 99. Сначала скорректируйте ресурс.": "Piety would exceed the input limit of 99. Adjust the resource first.", "Эффект выбранного домена сейчас недоступен.": "The selected domain effect is unavailable.", "Неизвестное действие.": "Unknown action.",
  "Свирепость": "Ferocity", "Дисциплина": "Discipline", "Эссенция": "Essence", "Фокус": "Focus", "Ясность": "Clarity", "Прозрение": "Insight", "Драма": "Drama", "Гнев": "Wrath", "Героический ресурс": "Heroic resource",
  "Выступления доступны Трубадуру.": "Routines are available to the Troubadour.", "Выступление нельзя поддерживать: герой оглушён, мёртв или застигнут врасплох.": "The routine cannot be maintained while the hero is dazed, dead, or surprised.", "Выступление выбирают в начале раунда боя.": "Choose a routine at the start of a combat round.", "Этого выступления нет среди способностей героя.": "The hero does not have this routine.", "Второе выступление должно отличаться от первого и требует особенности «Медли».": "The second routine must differ from the first and requires Medley.", "Выступление уже выбрано в этом раунде. Следующая смена — в начале нового раунда.": "A routine was already chosen this round. Change it at the start of the next round.", "Поддержание доступно Элементалисту.": "Sustaining is available to the Elementalist.", "Укажите целое количество полученного урона от 1 до 9999.": "Enter a whole amount of damage from 1 to 9999.", "Вне боя поддержание длится число раундов, равное Победам; ведите его отдельно.": "Outside combat, sustaining lasts a number of rounds equal to Victories; track it separately.", "У героя нет такой способности с поддержанием.": "The hero has no such sustained ability.", "Укажите цель или область поддержания.": "Enter the target or area being sustained.", "Эта способность уже поддерживается.": "This ability is already sustained.", "Суммарное поддержание сделает прибавку эссенции отрицательной.": "The total sustain cost would make essence gain negative.",
  "Выступление прекращено": "Routine ended", "Выступление недоступно": "Routine unavailable", "Выступление доступно": "Routine available", "Выступление выбрано": "Routine selected", "Все поддержания прекращены": "All sustained effects ended", "Поддержание прекращено": "Sustained effect ended", "Начат новый ход для учёта урона": "New turn started for damage tracking", "Учтён урон для поддержания": "Damage recorded for sustaining", "Поддержание начато": "Sustaining started",
  "Смежная цель начинает смещаться: свободный удар ближнего боя; скорость 0 до конца текущего хода.": "An adjacent target starts shifting: make a melee free strike; its speed is 0 until the end of the current turn.", "Бросок силы цели в пределах 10 клеток: помеха.": "A target within 10 squares takes a bane on its power roll.", "Способность цели в пределах 10 клеток с одной целью: потенциал −1.": "A single-target ability used by a target within 10 squares has −1 potency.", "Ваш урон способностью ближнего боя: цель спровоцирована вами до конца её следующего хода.": "When your melee ability deals damage, the target is taunted by you until the end of its next turn.", "Наносящее урон существо может потратить Восстановление.": "The creature dealing damage can spend a Recovery.", "После вашего урона способностью ближнего боя цель спровоцирована вами до конца её следующего хода.": "After your melee ability deals damage, the target is taunted by you until the end of its next turn.",
  "Суд": "Judgment", "Суд завершён.": "Judgment ended.", "Суд: свободный триггер": "Judgment: free triggered action", "Метка": "Mark", "Метки завершены.": "Marks ended.", "Преимущество метки": "Mark benefit", "Молитва": "Prayer", "Вы молитесь перед броском 1d3.": "You pray before rolling 1d3.", "Вы получаете благочестие без молитвы.": "You gain piety without praying.", "Благочестие": "Piety", "Эффект молитвы": "Prayer effect",
};

const patterns: [RegExp, string][] = [
  [/^(\d+) поглощено временной выносливостью\. Выносливость: (.+?) → (.+?); временная: (.+?) → (.+?)\.$/, "$1 absorbed by temporary stamina. Stamina: $2 → $3; temporary: $4 → $5."],
  [/^Выносливость: (.+?) → (.+?)\. Восстановления: (.+?) → (.+?)\.$/, "Stamina: $1 → $2. Recoveries: $3 → $4."],
  [/^Выносливость: (.+?) → (.+?)\. Временный запас не меняется\.$/, "Stamina: $1 → $2. Temporary stamina is unchanged."],
  [/^Выносливость: (.+?) → (.+?)\.$/, "Stamina: $1 → $2."],
  [/^Временная выносливость: (.+?) → (.+?)\. Сохраняется больший запас; значения не складываются\.$/, "Temporary stamina: $1 → $2. Keep the larger pool; values do not stack."],
  [/^Битва завершена\. Свирепость: (.+?) → 0; удержанные пороги сняты\.$/, "Combat ended. Ferocity: $1 → 0; retained thresholds cleared."],
  [/^Раунд: (.+?) → (.+?)\. Снято отметок раунда: (.+?)\.$/, "Round: $1 → $2. Round marks cleared: $3."], [/^Раунд: (.+?) → (.+?)\.$/, "Round: $1 → $2."],
  [/^Схватка: (.+?) → (.+?)\. Отметки триггеров сняты, раунд остаётся (.+?)\.$/, "Encounter: $1 → $2. Trigger marks cleared; the round remains $3."],
  [/^(Раунд|Схватка) (\d+), (\d+)-й раз\.$/, "$1 $2, occurrence $3."], [/^Раунд (\d+)\.$/, "Round $1."], [/^Схватка (\d+)\.$/, "Encounter $1."],
  [/^Триггер снова доступен в раунде (\d+)\.$/, "Trigger available again in round $1."], [/^Триггер снова доступен в схватке (\d+)\.$/, "Trigger available again in encounter $1."],
  [/^Основное действие цели в линии воздействия: (\d+) святого урона\.$/, "Target’s main action within line of effect: $1 holy damage."],
  [/^Дополнительный урон: (\d+)\.$/, "Extra damage: $1."], [/^Наносящее урон существо может сместиться до (\d+) клеток\.$/, "The creature dealing damage can shift up to $1 squares."],
  [/^Телепортация до (\d+) клеток ближе к цели; линия воздействия к месту назначения не нужна\.$/, "Teleport up to $1 squares closer to the target; no line of effect to the destination is required."],
  [/^(\d+) святого урона цели\.$/, "$1 holy damage to the target."], [/^Вертикальное притягивание цели до (\d+) клеток\.$/, "Pull the target vertically up to $1 squares."],
  [/^(\d+) урона; Выносливость не изменяется$/, "$1 damage; stamina is unchanged"],
  [/^Урон: (.+)$/, "Damage: $1"], [/^Исцеление: (.+)$/, "Healing: $1"],
  [/^Укажите текущее значение от −9999 до (.+)$/, "Enter a current value from −9999 to $1"], [/^Укажите значение от (.+) до (.+)$/, "Enter a value from $1 to $2"],
  [/^Не хватает ресурса: нужно (.+), доступно (.+)$/, "Not enough resource: $1 required, $2 available"], [/^Не хватает всплесков: нужно (.+), доступно (.+)$/, "Not enough surges: $1 required, $2 available"],
  [/^Новый раунд (\d+)$/, "New round $1"], [/^Новая схватка (\d+)$/, "New encounter $1"],  [/^Отметка «(.+)» не стоит$/, "No mark is set for “$1”"],
  [/^Метка позволяет выбрать не более (\d+) целей\.$/, "Mark allows at most $1 targets."], [/^Нужно фокуса: (\d+)\.$/, "Requires $1 focus."], [/^Осуждён: (.+)\.$/, "Judged: $1."], [/^(.+): −1 дисциплина$/, "$1: −1 discipline"],
];

export function localizeGameMessage(text: string, locale: Locale = "ru"): string {
  if (locale === "ru" || !text) return text;
  if (text.startsWith("Отменено: ")) return `Undone: ${localizeGameMessage(text.slice(10), locale)}`;
  const mark = /^(Отмечено|Отметка снята): (.+)$/.exec(text);
  if (mark) return `${mark[1] === "Отмечено" ? "Marked" : "Mark cleared"}: ${resourceLabel(mark[2], locale)}`;
  if (exact[text]) return exact[text];
  // These fixed generated formats can contain an author-provided result prefix.
  // Translate only the known suffix, never the free-text prefix itself.
  const ability = /^(.*?)(Свирепость|Дисциплина|Эссенция|Благочестие|Фокус|Ясность|Прозрение|Драма|Гнев|Героический ресурс): ([-\d]+) → ([-\d]+)\. Всплески: ([-\d]+) → ([-\d]+)\.( Без расхода ресурса \(ручное исключение\)\.)?$/.exec(text);
  if (ability && exact[ability[2].trim()]) {
    const prefix = ability[1].replace(/^2d10: (\d+) \+ (\d+); итог ([-\d]+), тир (\d+)\.(?: Урон: (.+?)\.)? /, (_match, a: string, b: string, total: string, tier: string, damage: string | undefined) => `2d10: ${a} + ${b}; total ${total}, tier ${tier}.${damage ? ` Damage: ${damage}.` : ""} `).replace(/^Без броска\. /, "No roll. ");
    return `${prefix}${exact[ability[2].trim()]}: ${ability[3]} → ${ability[4]}. Surges: ${ability[5]} → ${ability[6]}.${ability[7] ? " No resource spent (manual override)." : ""}`;
  }
  if (/^Выносливость: .*; временная: .*; восстановления: .*; .*; всплески: .*; победы: .*; опыт: /.test(text)) {
    return text.replace(/^Выносливость:/, "Stamina:").replace("; временная:", "; temporary:")
      .replace("; восстановления:", "; recoveries:").replace("; всплески:", "; surges:")
      .replace("; победы:", "; victories:").replace("; опыт:", "; XP:")
      .replace(/; ([^:;]+): ([-\d]+) → 0; surges:/, (_match, name: string, value: string) => `; ${exact[name.trim()] || name}: ${value} → 0; surges:`);
  }
  const enhancement = /^(Гравитационное разрушение|Инерционный якорь|Синаптический разрыв): −1 дисциплина$/.exec(text);
  if (enhancement) return `${exact[enhancement[1]]}: −1 discipline`;
  const form = /^(Форма животного|Форма гибрида): (.+)$/.exec(text);
  if (form) return `${form[1] === "Форма животного" ? "Animal form" : "Hybrid form"}: ${form[2]}`;
  const transform = /^(Свободный манёвр: −1 свирепость\.|Превращение: манёвр\.)(?: (Первое превращение в гибрида в этой битве: 10 временной выносливости \(запасы не складываются\)\.))?$/.exec(text);
  if (transform) return [exact[transform[1]], transform[2] && exact[transform[2]]].filter(Boolean).join(" ");
  const restriction = /^В форме (ворона|крысы) доступны только «Аспект дикой природы» и Скрытность\. Смените форму, чтобы использовать эту способность\.$/.exec(text);
  if (restriction) return `In ${restriction[1] === "ворона" ? "raven" : "rat"} form, only Aspect of the Wild and Hide are available. Change form to use this ability.`;
  const piety = /^\+(\d+) благочестия\.(?: (\d+) психического урона, который нельзя уменьшить\.)?( Доступен эффект одного домена\.)?$/.exec(text);
  if (piety) return `+${piety[1]} piety.${piety[2] ? ` ${piety[2]} psychic damage that cannot be reduced.` : ""}${piety[3] ? " One domain effect is available." : ""}`;
  const sustained = /^(.*), поддержание (\d+)$/.exec(text);
  if (sustained) return `${sustained[1]}, sustain ${sustained[2]}`;
  const judged = /^Осуждён: (.+?)\.(?: (.+))?$/.exec(text);
  if (judged) return `Judged: ${judged[1]}.${judged[2] ? ` ${localizeGameMessage(judged[2], locale)}` : ""}`;
  const resourceChange = /^([^:]+): (−?[-\d]+) → (−?[-\d]+)\.$/.exec(text);
  if (resourceChange && exact[resourceChange[1]]) return `${exact[resourceChange[1]]}: ${resourceChange[2]} → ${resourceChange[3]}.`;
  for (const [pattern, replacement] of patterns) if (pattern.test(text)) return text.replace(pattern, replacement).replace(/^Раунд /, "Round ").replace(/^Схватка /, "Encounter ");
  return text;
}
