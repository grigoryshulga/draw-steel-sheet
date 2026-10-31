import type {
  FeatureAmount,
  FeatureCondition,
  FeatureEffect,
  FeatureMechanics,
  FeatureTrigger,
  HeroicResourceSpec,
} from "../types";

/**
 * Неистовый: механики всех 89 записей скелета (`class-features.generated.json`).
 *
 * Источник — текст книги, сверенный с инвентаризацией
 * `docs/superpowers/specs/class-inventory/group1.json` (77 записей: аспекты,
 * триггеры аспектов, строки Растущей свирепости и группы способностей в
 * инвентаризации развёрнуты в отдельные записи скелета, отсюда 89).
 *
 * Где механика не выражается моделью (преимущества на кубиках, комплекты,
 * выбор типа урона, «три кубика — выбрать два»), запись остаётся механикой
 * с осмысленным `kinds` и причиной в `notes`: лист показывает правило,
 * но чисел не считает. Полностью прозаические записи (заголовки таблиц выдачи)
 * перечислены в `TEXT_ONLY` (`mechanics/exceptions.ts`).
 */

/** Название ресурса класса: по нему ищутся пороги в условиях эффектов. */
const FEROCITY = "Свирепость";

/** Показатели аспектов: Берсерк работает Мощью, Разоритель — Ловкостью. */
const MIGHT: FeatureAmount = { characteristic: "might" };
const AGILITY: FeatureAmount = { characteristic: "agility" };

/**
 * Бонус к расстоянию принудительного движения: он действует только по
 * достижении порога свирепости, а порог свой у каждого аспекта.
 */
function thresholdGate(aspect: string, threshold: number): FeatureCondition {
  return {
    keyValue: [aspect],
    resourceAtLeast: { name: FEROCITY, value: threshold },
  };
}

function forcedMovementBonus(
  aspect: string,
  amount: FeatureAmount,
  threshold: number,
): FeatureEffect {
  return {
    kind: "field",
    field: "push",
    value: amount,
    when: thresholdGate(aspect, threshold),
  };
}

/** Названия манёвров: подпись в именительном роде, подробность — в винительном. */
const MANEUVERS = {
  push: { title: "Первый толчок", action: "толчок" },
  throw: { title: "Первое швыряние", action: "швыряние" },
} as const;

/**
 * Порог Растущей свирепости: первый толчок (Берсерк) или первое швыряние
 * (Разоритель) существа в свой ход даёт всплески. Строки таблиц активируются
 * уровнем, а не выбором аспекта (у них нет `keyedBy`), поэтому аспект стоит
 * в `when`, а порог свирепости — в подписи и подробности.
 */
function firstForcedMovementTrigger(
  aspect: string,
  maneuver: { title: string; action: string },
  surges: string,
  threshold: number,
  replaces: boolean,
): FeatureTrigger {
  return {
    event: "forced-movement",
    frequency: "turn",
    label: `${maneuver.title} в свой ход при ${threshold}+ свирепости`,
    detail:
      `Первый раз за свой ход, когда вы совершаете ${maneuver.action} существа, ` +
      `вы получаете ${surges} (нужно ${threshold}+ свирепости).` +
      (replaces ? " Заменяет преимущество предыдущего порога." : ""),
    // Гейт только по аспекту: порог свирепости — состояние листа, и в условии
    // триггера он прятал бы строку при низком ресурсе. Порог виден в подписи.
    when: { keyValue: [aspect] },
  };
}

/**
 * Спецификация свирепости — героического ресурса Неистового.
 * Порядок прибавок — как в книге: начало боя, начало хода, урон,
 * утомление или смерть. Прочие прибавки приходят механиками фич 4/7/10
 * уровней с `replaces` по тегам.
 */
export const FURY_RESOURCE: HeroicResourceSpec = {
  name: "Свирепость",
  gains: [
    {
      tag: "combat-start",
      event: "combat-start",
      amount: "= Победы",
      frequency: "encounter",
    },
    {
      tag: "start-of-turn",
      event: "start-of-turn",
      amount: "1d3",
      frequency: "turn",
    },
    {
      tag: "take-damage",
      event: "take-damage",
      amount: "1",
      frequency: "round",
    },
    {
      // Книга даёт 1d3 и за утомление, и за состояние при смерти:
      // это одна прибавка «первый раз за бой».
      tag: "winded-or-dying",
      event: "winded",
      amount: "1d3",
      frequency: "encounter",
    },
  ],
  // Эпический пул 10-го уровня: до него лист его не показывает
  // (`resolvedEpicResourceGains` проверяет `epic.level`).
  epic: {
    name: "Первозданная сила",
    level: 10,
    gains: [
      {
        tag: "epic-respite",
        event: "respite",
        amount: "= Опыт",
        frequency: "respite",
      },
    ],
  },
};

export const FURY_MECHANICS: Record<string, FeatureMechanics> = {
  // ---------------------------------------------------------------- 1-й уровень
  "feature.fury.level-1.primordial-aspect": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.aspect",
      options: [
        { id: "fury.aspect.berserker", label: "Берсерк" },
        { id: "fury.aspect.raider", label: "Разоритель" },
        { id: "fury.aspect.stormbringer", label: "Буревестник" },
      ],
    },
    notes:
      "Подкласс. Приложение хранит выбранный аспект в поле подкласса, по нему " +
      "активируются вложенные записи аспекта. Навык аспекта (Берсерк — Лифтинг, " +
      "Разоритель — Скрытность, Буревестник — Выслеживание) выдаётся при " +
      "создании героя.",
  },
  "feature.fury.level-1.ferocity": {
    kinds: ["resource"],
    notes:
      "Контейнер ресурса: прибавки живут в CLASS_RESOURCES (FURY_RESOURCE) " +
      "и собираются движком src/lib/resources.ts. Своих gains у записи нет, " +
      "иначе свирепость начислялась бы дважды.",
  },
  "feature.fury.level-1.ferocity-in-combat": {
    kinds: ["resource"],
    notes:
      "Набор свирепости: в начале боевой встречи — равная Победам; в начале " +
      "каждого своего хода — 1d3; первый раз за раунд, когда получаешь урон — 1; " +
      "первый раз за бой, когда входишь в утомление или при смерти — 1d3. " +
      "Остаток свирепости сгорает в конце боевой встречи.",
  },
  "feature.fury.level-1.ferocity-outside-of-combat": {
    kinds: ["resource"],
    notes:
      "Вне боя свирепость не набирается: способность или эффект со свирепостью " +
      "применяются бесплатно, повтор — только после 1+ Победы или отдыха. " +
      "Способность с тратой «неограниченно» вне боя работает как трата, равная " +
      "Победам. Траты не списывают ресурс — это правило чтения, а не расчёт.",
  },
  "feature.fury.level-1.growing-ferocity": {
    kinds: ["resource", "situational"],
    notes:
      "Пороговые преимущества по количеству свирепости (2/4/6/8/10/12) из таблиц " +
      "аспектов; держатся до конца своего хода, даже если ресурс потрачен. " +
      "Строки порогов перенесены отдельными записями, таблица Буревестника " +
      "лежит в комплектах буревестника и в данных отсутствует.",
  },
  "feature.fury.level-1.growing-ferocity-berserker-2": {
    kinds: ["bonus"],
    when: thresholdGate("Берсерк", 2),
    effects: [forcedMovementBonus("Берсерк", MIGHT, 2)],
    notes:
      "Порог 2 свирепости у Берсерка: расстояние маневра Отталкивания получает " +
      "бонус, равный Мощи. Тип маневра движок не различает, поэтому бонус висит " +
      "на поле «толчок».",
  },
  "feature.fury.level-1.growing-ferocity-berserker-4": {
    kinds: ["trigger"],
    when: thresholdGate("Берсерк", 4),
    trigger: firstForcedMovementTrigger("Берсерк", MANEUVERS.push, "1 всплеск", 4, false),
    notes: "Всплески лист считает вручную: поля «всплески» в модели нет.",
  },
  "feature.fury.level-1.growing-ferocity-berserker-6": {
    kinds: ["situational"],
    when: thresholdGate("Берсерк", 6),
    notes:
      "Порог 6 свирепости у Берсерка: преимущество на тесты Мощи и маневр " +
      "Отталкивания. Преимущество на кубиках не выражается числовым полем — " +
      "правило показывается текстом.",
  },
  "feature.fury.level-4.growing-ferocity-berserker-8": {
    kinds: ["trigger"],
    when: thresholdGate("Берсерк", 8),
    trigger: firstForcedMovementTrigger("Берсерк", MANEUVERS.push, "2 всплеска", 8, true),
    notes:
      "Порог 8 свирепости (с 4-го уровня): те же всплески, но 2 вместо 1. " +
      "Требование уровня закрыто уровнем самой записи.",
  },
  "feature.fury.level-7.growing-ferocity-berserker-10": {
    kinds: ["situational"],
    when: thresholdGate("Берсерк", 10),
    notes:
      "Порог 10 свирепости (с 7-го уровня): двойное преимущество на тесты Мощи " +
      "и маневр Отталкивания — заменяет преимущество порога 6.",
  },
  "feature.fury.level-10.growing-ferocity-berserker-12": {
    kinds: ["trigger", "bonus"],
    when: thresholdGate("Берсерк", 12),
    effects: [forcedMovementBonus("Берсерк", MIGHT, 12)],
    trigger: {
      event: "use-ability",
      frequency: "always",
      label: "Героическая способность при 12+ свирепости",
      detail:
        "Всякий раз, когда вы используете героическую способность, вы получаете " +
        "10 очков временной выносливости (нужно 12+ свирепости).",
      when: { keyValue: ["Берсерк"] },
    },
    notes:
      "Порог 12 свирепости (с 10-го уровня). Бонус к расстоянию принудительного " +
      "движения относится к любому броску силы, а не только к маневру " +
      "Отталкивания, поэтому складывается с бонусом порога 2.",
  },
  "feature.fury.level-1.growing-ferocity-reaver-2": {
    kinds: ["bonus"],
    when: thresholdGate("Разоритель", 2),
    effects: [forcedMovementBonus("Разоритель", AGILITY, 2)],
    notes:
      "Порог 2 свирепости у Разорителя: расстояние маневра Отталкивания получает " +
      "бонус, равный Ловкости.",
  },
  "feature.fury.level-1.growing-ferocity-reaver-4": {
    kinds: ["trigger"],
    when: thresholdGate("Разоритель", 4),
    trigger: firstForcedMovementTrigger("Разоритель", MANEUVERS.throw, "1 всплеск", 4, false),
    notes: "Всплески лист считает вручную: поля «всплески» в модели нет.",
  },
  "feature.fury.level-1.growing-ferocity-reaver-6": {
    kinds: ["situational"],
    when: thresholdGate("Разоритель", 6),
    notes:
      "Порог 6 свирепости у Разорителя: преимущество на тесты Ловкости и маневр " +
      "Отталкивания; преимущество на кубиках показывается текстом.",
  },
  "feature.fury.level-4.growing-ferocity-reaver-8": {
    kinds: ["trigger"],
    when: thresholdGate("Разоритель", 8),
    trigger: firstForcedMovementTrigger("Разоритель", MANEUVERS.throw, "2 всплеска", 8, true),
    notes: "Порог 8 свирепости (с 4-го уровня): 2 всплеска вместо 1.",
  },
  "feature.fury.level-7.growing-ferocity-reaver-10": {
    kinds: ["situational"],
    when: thresholdGate("Разоритель", 10),
    notes:
      "Порог 10 свирепости (с 7-го уровня): двойное преимущество на тесты " +
      "Ловкости и маневр Отталкивания — заменяет преимущество порога 6.",
  },
  "feature.fury.level-10.growing-ferocity-reaver-12": {
    kinds: ["trigger", "bonus"],
    when: thresholdGate("Разоритель", 12),
    effects: [forcedMovementBonus("Разоритель", AGILITY, 12)],
    trigger: {
      event: "use-ability",
      frequency: "always",
      label: "Героическая способность при 12+ свирепости",
      detail:
        "Всякий раз, когда вы используете героическую способность, вы получаете " +
        "10 очков временной выносливости (нужно 12+ свирепости).",
      when: { keyValue: ["Разоритель"] },
    },
    notes:
      "Порог 12 свирепости (с 10-го уровня): бонус к расстоянию принудительного " +
      "движения при любом броске силы складывается с бонусом порога 2.",
  },
  "feature.fury.level-1.beast-shape": {
    kinds: ["grant", "situational"],
    notes:
      "Буревестник: можно использовать комплекты буревестника (статья 0924, " +
      "в данных отсутствует) и получать их преимущества, включая строки " +
      "Растущей свирепости Буревестника. Эффектов нет: преимущества живут " +
      "в комплекте, а не в этой записи.",
  },
  "feature.fury.level-1.kit": {
    kinds: ["grant"],
    notes:
      "Берсерк и Разоритель: можно использовать комплект и получать его " +
      "преимущества. Бонусы комплекта уже считает лист по данным комплектов " +
      "(kitBonus), дублировать их в записи не нужно.",
  },
  "feature.fury.level-1.primordial-cunning": {
    kinds: ["situational"],
    notes:
      "Разоритель: вас нельзя застигнуть врасплох; всякий раз, когда вы должны " +
      "совершить толчок цели принудительным движением, можете вместо этого " +
      "совершить швыряние. Подмены типа принудительного движения в модели нет.",
  },
  "feature.fury.level-1.primordial-strength": {
    kinds: ["trigger", "situational"],
    trigger: {
      event: "forced-movement",
      frequency: "always",
      label: "Толчок существа в объект",
      detail:
        "Когда вы толкаете другое существо в объект, существо получает " +
        "дополнительный урон, равный показателю вашей Мощи.",
    },
    notes:
      "Берсерк: удар оружием по объекту наносит дополнительный урон, равный Мощи. " +
      "«Цель — объект» в движке не выражается (ни в фильтре способности, ни в " +
      "условии эффекта), поэтому бонус урона по объектам остаётся за игроком: " +
      "бонус на все удары оружием был бы неверен.",
  },
  "feature.fury.level-1.relentless-hunter": {
    kinds: ["situational"],
    notes:
      "Буревестник: преимущество на тесты навыка Выслеживание. Преимущество на " +
      "кубиках не выражается числом.",
  },
  "feature.ability.fury.level-1.lines-of-force": {
    kinds: ["trigger"],
    trigger: {
      event: "forced-movement",
      frequency: "always",
      label: "Линии силы",
      detail:
        "Триггер, Ближний 1 (Магия): цель должна подвергнуться принудительному " +
        "движению. Вы можете выбрать новую цель того же размера или меньше в " +
        "пределах расстояния, стать источником движения, определить место " +
        "назначения и заменить движение толчком; расстояние получает бонус, " +
        "равный Мощи. За 1 свирепости — бонус, равный удвоенной Мощи.",
    },
    notes:
      "Берсерк. Эффект-бонус к толчку сюда не добавлен: он действовал бы на любое " +
      "принудительное движение героя и складывался бы с бонусом порога свирепости, " +
      "чего книга не говорит.",
  },
  "feature.ability.fury.level-1.unearthly-reflexes": {
    kinds: ["trigger"],
    trigger: {
      event: "take-damage",
      frequency: "always",
      label: "Неземные рефлексы",
      detail:
        "Триггер: вы получаете урон. Вы получаете половину урона от " +
        "срабатывающего эффекта и можете сместиться на число клеток вплоть до " +
        "показателя вашей Ловкости. За 1 свирепости: потенциал эффекта урона " +
        "уменьшается на 1 для вас.",
    },
    notes: "Разоритель. Половина урона считается игроком на лету.",
  },
  "feature.ability.fury.level-1.furious-change": {
    kinds: ["trigger"],
    trigger: {
      event: "lose-stamina",
      frequency: "always",
      label: "Яростное изменение",
      detail:
        "Триггер: вы теряете выносливость и не находитесь при смерти. Вы " +
        "получаете очки временной выносливости, равные показателю вашей Мощи, " +
        "и можете войти в форму животного или форму гибрида. За 1 свирепости: " +
        "если вы не при смерти, можете потратить Восстановление.",
    },
    notes: "Буревестник. Временная выносливость и формы — состояние листа, не эффект.",
  },
  "feature.fury.level-1.mighty-leaps": {
    kinds: ["situational"],
    notes:
      "Результат теста Мощи на прыжок не ниже второго тира. Подмены минимума " +
      "тира в модели нет — правило показывается текстом.",
  },
  "feature.fury.level-1.signature-ability": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.signature",
      options: [
        { id: "feature.ability.fury.level-1.brutal-slam", label: "Брутальный Удар" },
        { id: "feature.ability.fury.level-1.hit-and-run", label: "Бей и Беги" },
        { id: "feature.ability.fury.level-1.impaled", label: "Насквозь!" },
        { id: "feature.ability.fury.level-1.to-the-death", label: "До Смерти!" },
      ],
    },
    notes:
      "Выбор одной знаковой способности из четырёх; сами способности — записи " +
      "справочника способностей (abilities.generated), здесь только выбор.",
  },
  "feature.fury.level-1.3-ferocity-ability": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.3",
      options: [
        { id: "feature.ability.fury.level-1.back", label: "Назад!" },
        { id: "feature.ability.fury.level-1.out-of-the-way", label: "С Дороги!" },
        { id: "feature.ability.fury.level-1.tide-of-death", label: "Волна Смерти" },
        {
          id: "feature.ability.fury.level-1.your-entrails-are-your-extrails",
          label: "Твои внутренности Теперь Твои Наружности!",
        },
      ],
    },
    notes: "Выбор одной героической способности за 3 свирепости.",
  },
  "feature.fury.level-1.5-ferocity-ability": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.5",
      options: [
        { id: "feature.ability.fury.level-1.blood-for-blood", label: "Кровь за Кровь!" },
        {
          id: "feature.ability.fury.level-1.make-peace-with-your-god",
          label: "Простись Со Своим Богом!",
        },
        { id: "feature.ability.fury.level-1.thunder-roar", label: "Громовой Рев" },
        { id: "feature.ability.fury.level-1.to-the-uttermost-end", label: "До Самого Конца" },
      ],
    },
    notes: "Выбор одной героической способности за 5 свирепости.",
  },

  // ---------------------------------------------------------------- 2-й уровень
  "feature.fury.level-2.perk": {
    kinds: ["grant"],
    notes:
      "Один перк ремесла, исследования или интриги по выбору. Перки ведутся " +
      "своим списком на листе, поля эффектов у перка нет.",
  },
  "feature.fury.level-2.inescapable-wrath": {
    kinds: ["bonus", "situational"],
    effects: [{ kind: "field", field: "speed", value: AGILITY }],
    notes:
      "Разоритель: бонус к скорости, равный Ловкости, и игнорирование " +
      "труднопроходимой местности. Игнорирование местности — правило чтения, " +
      "числового поля у него нет.",
  },
  "feature.fury.level-2.tooth-and-claw": {
    kinds: ["trigger"],
    trigger: {
      event: "end-of-turn",
      frequency: "turn",
      label: "Зуб и коготь",
      detail:
        "В конце каждого вашего хода каждый враг, смежный с вами, получает урон, " +
        "равный показателю вашей Мощи.",
    },
    notes: "Буревестник. Урон получают все смежные враги — лист считает вручную.",
  },
  "feature.fury.level-2.unstoppable-force": {
    kinds: ["situational"],
    notes:
      "Берсерк: в действии атаки с рывком вместо свободного удара можно применить " +
      "знаковую или героическую способность удара; прыжок можно совершить как " +
      "часть рывка. Это правило выбора действия, чисел не даёт.",
  },
  "feature.fury.level-2.berserker-ability": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Берсерк"] },
    choice: {
      group: "fury.berserker.ability.2",
      options: [
        { id: "feature.ability.fury.level-2.special-delivery", label: "Особая Доставка" },
        { id: "feature.ability.fury.level-2.wrecking-ball", label: "Таранный Шар" },
      ],
    },
    notes: "Берсерк: одна из двух способностей 2-го уровня за 5 свирепости.",
  },
  "feature.fury.level-2.reaver-ability": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Разоритель"] },
    choice: {
      group: "fury.raider.ability.2",
      options: [
        { id: "feature.ability.fury.level-2.death-death", label: "Смерть... Смерть!" },
        { id: "feature.ability.fury.level-2.phalanx-breaker", label: "Разрушитель Фаланг" },
      ],
    },
    notes: "Разоритель: одна из двух способностей 2-го уровня за 5 свирепости.",
  },
  "feature.fury.level-2.stormwight-ability": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Буревестник"] },
    choice: {
      group: "fury.stormbringer.ability.2",
      options: [
        { id: "feature.ability.fury.level-2.apex-predator", label: "Высший Хищник" },
        { id: "feature.ability.fury.level-2.visceral-roar", label: "Внутренний Рев" },
      ],
    },
    notes: "Буревестник: одна из двух способностей 2-го уровня за 5 свирепости.",
  },

  // ---------------------------------------------------------------- 3-й уровень
  "feature.fury.level-3.immovable-object": {
    kinds: ["bonus"],
    effects: [{ kind: "field", field: "stability", value: MIGHT }],
    notes:
      "Берсерк: бонус к устойчивости, равный Мощи. Эффективный размер (уровень " +
      "прибавляется к размеру для взаимодействий) не моделируется: поля размера " +
      "в движке нет; на захват это не влияет, как и говорит книга.",
  },
  "feature.fury.level-3.natures-knight": {
    kinds: ["situational"],
    notes:
      "Буревестник: разговор с животными и элементалями, ощущение их присутствия " +
      "в 10 клетках, Слава +1 в переговорах с ними (суммируется с прибавкой " +
      "Мародёра). Слава и чувства — не числовые поля листа.",
  },
  "feature.fury.level-3.see-through-their-tricks": {
    kinds: ["situational"],
    notes:
      "Разоритель: двойное преимущество на поиск скрытых существ и мотивов, " +
      "обнаружение лжи и азартные игры. Преимущество на кубиках не выражается.",
  },
  "feature.fury.level-3.7-ferocity-ability": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.7",
      options: [
        { id: "feature.ability.fury.level-3.demon-unleashed", label: "Демон на Воле" },
        { id: "feature.ability.fury.level-3.face-the-storm", label: "Встреть Бурю!" },
        { id: "feature.ability.fury.level-3.steelbreaker", label: "Разрушитель Стали" },
        { id: "feature.ability.fury.level-3.you-are-already-dead", label: "Вы Уже Мертвы" },
      ],
    },
    notes: "Выбор одной героической способности за 7 свирепости.",
  },

  // ---------------------------------------------------------------- 4-й уровень
  "feature.fury.level-4.characteristic-increase": {
    kinds: ["characteristic"],
    notes:
      "Мощь и Ловкость поднимаются до 3. Значение применяет повышение уровня " +
      "(level-up: characteristics.set {might:3, agility:3}); аддитивный эффект " +
      "здесь удвоил бы прибавку, поэтому его нет.",
  },
  "feature.fury.level-4.damaging-ferocity": {
    kinds: ["resourceGain"],
    resource: {
      name: "Свирепость",
      gains: [
        {
          tag: "take-damage",
          event: "take-damage",
          amount: "2",
          frequency: "round",
          replaces: ["take-damage"],
        },
      ],
    },
    notes: "Первый раз за раунд, когда получаешь урон, — 2 свирепости вместо 1.",
  },
  "feature.fury.level-4.growing-ferocity-improvement": {
    kinds: ["resource", "situational"],
    notes:
      "Открывает строки Растущей свирепости с порогом 8 свирепости: строки " +
      "лежат отдельными записями 4-го уровня, а эта запись объясняет, почему " +
      "они появляются.",
  },
  "feature.fury.level-4.perk": {
    kinds: ["grant"],
    notes: "Один перк на выбор.",
  },
  "feature.fury.level-4.primordial-attunement": {
    kinds: ["situational"],
    notes:
      "Автоматическое ощущение иммунитетов и уязвимостей к кислоте, холоду, " +
      "порче, огню, молнии, яду и звуку в 10 клетках и источников этих типов. " +
      "Чувства — правило чтения, числового поля нет.",
  },
  "feature.fury.level-4.primordial-strike": {
    kinds: ["resource"],
    notes:
      "Как часть любого удара можно потратить 1 свирепости и получить 1 всплеск " +
      "на этот удар; тип дополнительного урона — кислота, холод, порча, огонь, " +
      "молния, яд или звук — выбирает игрок. С 10-го уровня (Воплощение Хаоса) " +
      "можно потратить до 3 свирепости. Трата ресурса и выбор типа — действие " +
      "игрока, не автоматический эффект.",
  },
  "feature.fury.level-4.skill": {
    kinds: ["grant"],
    notes: "Один навык на выбор; навыки ведутся своим списком на листе.",
  },

  // ---------------------------------------------------------------- 5-й уровень
  "feature.fury.level-5.bounder": {
    kinds: ["situational"],
    notes:
      "Берсерк: дистанция и высота прыжка удваиваются — это множитель, а не " +
      "слагаемое, и поля «дальность прыжка» в движке нет. Падение уменьшается на " +
      "дистанцию прыжка, лежачим после падения на существо вы не становитесь.",
  },
  "feature.fury.level-5.stormborn": {
    kinds: ["situational", "grant"],
    notes:
      "Буревестник: вы и союзники в 5 клетках игнорируете негативные эффекты " +
      "ненастной погоды; доступна особенность «Благословение удачной погоды» как " +
      "у проводника 1-го уровня. Кросс-классовая выдача чужой особенности " +
      "моделью не выражается.",
  },
  "feature.fury.level-5.unfettered": {
    kinds: ["trigger", "situational"],
    trigger: {
      event: "start-of-turn",
      frequency: "turn",
      label: "Раскованный",
      detail:
        "В начале вашего хода вы можете завершить любое состояние опутанности на себе.",
    },
    notes:
      "Разоритель: двойное преимущество на тесты побега из заключения — " +
      "преимущество на кубиках показывается текстом.",
  },
  "feature.fury.level-5.9-ferocity-ability": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.9",
      options: [
        { id: "feature.ability.fury.level-5.debilitating-strike", label: "Ослабляющий Удар" },
        { id: "feature.ability.fury.level-5.my-turn", label: "Моя Очередь!" },
        {
          id: "feature.ability.fury.level-5.rebounding-storm",
          label: "Разбрасывающий Шторм",
        },
        { id: "feature.ability.fury.level-5.to-stone", label: "Плоть в Камень!" },
      ],
    },
    notes: "Выбор одной героической способности за 9 свирепости.",
  },

  // ---------------------------------------------------------------- 6-й уровень
  "feature.fury.level-6.marauder-of-the-primordial-chaos": {
    kinds: ["situational", "trigger"],
    trigger: {
      event: "combat-start",
      frequency: "encounter",
      label: "Мародер Первозданного Хаоса",
      detail:
        "Когда элементаль впервые понимает, что находится с вами в бою, если его " +
        "Присутствие ниже СРЕДНЕГО, он напуган вами до прохождения.",
    },
    notes:
      "Ощущение элементалей и источников элементальной силы в 1 миле, разговор " +
      "с элементалями, Слава +1 в переговорах с ними (суммируется с Рыцарем " +
      "природы). Событие «впервые понял, что в бою» отслеживается за существо; " +
      "в листе это одно срабатывание за встречу.",
  },
  "feature.fury.level-6.primordial-portal": {
    kinds: ["situational"],
    notes:
      "Основным действием коснуться источника элементальной силы и создать портал " +
      "в Квинтэссенцию; поддерживается число порталов, равное Мощи. Портал и " +
      "перемещения — действия игрока, чисел для листа нет.",
  },
  "feature.fury.level-6.perk": {
    kinds: ["grant"],
    notes: "Один перк ремесла, исследования или интриги на выбор.",
  },
  "feature.fury.level-6.berserker-abilities": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Берсерк"] },
    choice: {
      group: "fury.berserker.ability.6",
      options: [
        { id: "feature.ability.fury.level-6.avalanche-impact", label: "Лавинный Удар" },
        { id: "feature.ability.fury.level-6.force-of-storms", label: "Сила Штормов" },
      ],
    },
    notes: "Берсерк: одна из двух способностей 6-го уровня за 9 свирепости.",
  },
  "feature.fury.level-6.reaver-abilities": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Разоритель"] },
    choice: {
      group: "fury.raider.ability.6",
      options: [
        { id: "feature.ability.fury.level-6.death-strike", label: "Смертельный Удар" },
        { id: "feature.ability.fury.level-6.seek-and-destroy", label: "Найти и Уничтожить" },
      ],
    },
    notes: "Разоритель: одна из двух способностей 6-го уровня за 9 свирепости.",
  },
  "feature.fury.level-6.stormwight-abilities": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Буревестник"] },
    choice: {
      group: "fury.stormbringer.ability.6",
      options: [
        { id: "feature.ability.fury.level-6.pounce", label: "Звериный Наскок" },
        { id: "feature.ability.fury.level-6.riders-on-the-storm", label: "Оседлавшие Бурю" },
      ],
    },
    notes: "Буревестник: одна из двух способностей 6-го уровня за 9 свирепости.",
  },

  // ---------------------------------------------------------------- 7-й уровень
  "feature.fury.level-7.characteristic-increase": {
    kinds: ["characteristic"],
    notes:
      "Каждая характеристика +1 до максимума 4. Значение применяет повышение " +
      "уровня (level-up: increaseAll {amount:1, cap:4}); аддитивный эффект здесь " +
      "удвоил бы прибавку.",
  },
  "feature.fury.level-7.elemental-form": {
    kinds: ["immunity"],
    effects: [
      {
        kind: "damageImmunity",
        types: ["кислота", "холод", "порча", "огонь", "молния", "яд", "звук"],
        value: MIGHT,
        when: { keyValue: ["Берсерк", "Разоритель"] },
      },
    ],
    notes:
      "Берсерк и Разоритель: иммунитет к семи типам урона, равный Мощи. " +
      "Буревестник получает иммунитет к типу урона Первозданного шторма, " +
      "равный удвоенной Мощи; конкретный тип урона в книге берётся из комплектов " +
      "буревестника (статья 0924, в данных отсутствует) — поэтому множитель ×2 " +
      "у Буревестника появляется только на 10-м уровне вместе с Воплощением Хаоса, " +
      "где тип назван обобщённо.",
  },
  "feature.fury.level-7.greater-ferocity": {
    kinds: ["resourceGain"],
    resource: {
      name: "Свирепость",
      gains: [
        {
          tag: "start-of-turn",
          event: "start-of-turn",
          amount: "1d3 + 1",
          frequency: "turn",
          replaces: ["start-of-turn"],
        },
      ],
    },
    notes: "Свирепость в начале каждого своего хода — 1d3 + 1 вместо 1d3.",
  },
  "feature.fury.level-7.growing-ferocity-improvement": {
    kinds: ["resource", "situational"],
    notes:
      "Открывает строки Растущей свирепости с порогом 10 свирепости; строки " +
      "лежат отдельными записями 7-го уровня.",
  },
  "feature.fury.level-7.skill": {
    kinds: ["grant"],
    notes: "Один навык на выбор.",
  },

  // ---------------------------------------------------------------- 8-й уровень
  "feature.fury.level-8.perk": {
    kinds: ["grant"],
    notes: "Один перк на выбор.",
  },
  "feature.fury.level-8.menagerie": {
    kinds: ["grant", "situational"],
    notes:
      "Буревестник: доступны все комплекты буревестника, на отдыхе комплект " +
      "меняется с дополнительной деятельностью отдыха, Рыцарь природы ощущает " +
      "животных в 1 миле, на выслеживании бросаются три кубика с выбором двух. " +
      "Комплекты буревестника в данных отсутствуют, «три кубика» числом не " +
      "выражаются.",
  },
  "feature.fury.level-8.a-step-ahead": {
    kinds: ["situational", "bonus"],
    effects: [{ kind: "field", field: "disengage", value: AGILITY }],
    notes:
      "Разоритель: расстояние Действия отхода получает бонус, равный Ловкости; " +
      "на тестах Ловкости бросаются три кубика с выбором двух (числом не " +
      "выражается).",
  },
  "feature.fury.level-8.strongest-there-is": {
    kinds: ["situational", "bonus"],
    effects: [{ kind: "field", field: "push", value: MIGHT }],
    notes:
      "Берсерк: расстояние маневра Отталкивания получает бонус, равный Мощи; " +
      "на тестах Мощи бросаются три кубика с выбором двух (числом не выражается).",
  },
  "feature.fury.level-8.11-ferocity-ability": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.11",
      options: [
        {
          id: "feature.ability.fury.level-8.elemental-ferocity",
          label: "Элементальная Свирепость",
        },
        { id: "feature.ability.fury.level-8.overkill", label: "Избыточный Урон" },
        { id: "feature.ability.fury.level-8.primordial-rage", label: "Первозданная Ярость" },
        { id: "feature.ability.fury.level-8.relentless-death", label: "Неумолимая Смерть" },
      ],
    },
    notes: "Выбор одной героической способности за 11 свирепости.",
  },

  // ---------------------------------------------------------------- 9-й уровень
  "feature.fury.level-9.harbinger-of-the-primordial-chaos": {
    kinds: ["situational"],
    notes:
      "Деятельность отдыха: создать временный источник элементальной силы на 24 " +
      "часа, пригодный для Первозданного портала; пока портал поддерживается, " +
      "источник сохраняется. Это деятельность отдыха, чисел для листа нет.",
  },
  "feature.fury.level-9.berserker-abilities": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Берсерк"] },
    choice: {
      group: "fury.berserker.ability.9",
      options: [
        {
          id: "feature.ability.fury.level-9.death-comes-for-you-all",
          label: "Смерть Приходит За Всеми!",
        },
        { id: "feature.ability.fury.level-9.primordial-vortex", label: "Первозданный Вихрь" },
      ],
    },
    notes: "Берсерк: одна из двух способностей 9-го уровня за 11 свирепости.",
  },
  "feature.fury.level-9.reaver-abilities": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Разоритель"] },
    choice: {
      group: "fury.raider.ability.9",
      options: [
        {
          id: "feature.ability.fury.level-9.primordial-bane",
          label: "Первозданная кара",
        },
        { id: "feature.ability.fury.level-9.shower-of-blood", label: "Кровавый Дождь" },
      ],
    },
    notes: "Разоритель: одна из двух способностей 9-го уровня за 11 свирепости.",
  },
  "feature.fury.level-9.stormwight-abilities": {
    kinds: ["choice", "grant"],
    when: { keyValue: ["Буревестник"] },
    choice: {
      group: "fury.stormbringer.ability.9",
      options: [
        { id: "feature.ability.fury.level-9.death-rattle", label: "Рев Смерти" },
        { id: "feature.ability.fury.level-9.deluge", label: "Бедствие" },
      ],
    },
    notes: "Буревестник: одна из двух способностей 9-го уровня за 11 свирепости.",
  },

  // --------------------------------------------------------------- 10-й уровень
  "feature.fury.level-10.chaos-incarnate": {
    kinds: ["immunity", "trigger", "resource"],
    // Двойная Мощь у Берсерка и Разорителя — семь типов урона, тройная
    // у Буревестника — тип Первозданного шторма (см. notes).
    effects: [
      {
        kind: "damageImmunity",
        types: ["кислота", "холод", "порча", "огонь", "молния", "яд", "звук"],
        value: MIGHT,
        multiplier: 2,
        when: { keyValue: ["Берсерк", "Разоритель"] },
      },
      {
        kind: "damageImmunity",
        types: ["Первозданный шторм"],
        value: MIGHT,
        multiplier: 3,
        when: { keyValue: ["Буревестник"] },
      },
    ],
    trigger: {
      event: "combat-start",
      frequency: "encounter",
      label: "Воплощение Хаоса",
      detail:
        "Когда элементаль или существо, чьи способности наносят урон кислотой, " +
        "холодом, порчей, огнем, молнией, ядом или звуком, впервые понимает, что " +
        "находится с вами в бою, если его Присутствие ниже СИЛЬНОГО, оно " +
        "напугано вами до прохождения.",
    },
    notes:
      "Иммунитеты: Берсерк и Разоритель — к семи типам урона, равный удвоенной " +
      "Мощи; Буревестник — к типу Первозданного шторма, равный утроенной Мощи. " +
      "Иммунитет заменяет базовый из Элементальной формы, а не складывается с ним. " +
      "Конкретный тип Первозданного шторма в данных отсутствует (комплекты " +
      "буревестника, статья 0924), поэтому тип назван обобщённо и выбирается на " +
      "листе. Первозданный удар здесь усиливается до 3 свирепости за удар " +
      "(см. запись 4-го уровня) — это расход ресурса, а не число листа.",
  },
  "feature.fury.level-10.characteristic-increase": {
    kinds: ["characteristic"],
    notes:
      "Мощь и Ловкость поднимаются до 5. Значение применяет повышение уровня " +
      "(level-up: characteristics.set {might:5, agility:5}); аддитивный эффект " +
      "здесь удвоил бы прибавку.",
  },
  "feature.fury.level-10.growing-ferocity-improvement": {
    kinds: ["resource", "situational"],
    notes:
      "Открывает строки Растущей свирепости с порогом 12 свирепости; строки " +
      "лежат отдельными записями 10-го уровня.",
  },
  "feature.fury.level-10.perk": {
    kinds: ["grant"],
    notes: "Один перк ремесла, исследования или интриги на выбор.",
  },
  "feature.fury.level-10.primordial-ferocity": {
    kinds: ["resourceGain"],
    resource: {
      name: "Свирепость",
      gains: [
        {
          tag: "take-damage",
          event: "take-damage",
          amount: "3",
          frequency: "round",
          replaces: ["take-damage"],
        },
      ],
    },
    notes: "Первый раз за раунд, когда получаешь урон, — 3 свирепости вместо 2.",
  },
  "feature.fury.level-10.primordial-power": {
    kinds: ["resource"],
    notes:
      "Эпический ресурс: на каждом отдыхе первозданная сила прибывает на " +
      "полученный Опыт, тратится как свирепость и не сгорает. Прибавка живёт в " +
      "эпическом пуле CLASS_RESOURCES (FURY_RESOURCE.epic), чтобы не смешаться " +
      "с основным. За свободный маневр можно потратить любое количество, чтобы " +
      "завершить столько же эффектов на себе; 3 единицы создают портал без " +
      "источника элементальной силы.",
  },
  "feature.fury.level-10.skill": {
    kinds: ["grant"],
    notes: "Один навык на выбор.",
  },
};
