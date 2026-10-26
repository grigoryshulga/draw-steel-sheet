import type {
  FeatureAmount,
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
function forcedMovementBonus(
  aspect: string,
  amount: FeatureAmount,
  threshold: number,
): FeatureEffect {
  return {
    kind: "field",
    field: "push",
    value: amount,
    when: {
      keyValue: [aspect],
      resourceAtLeast: { name: FEROCITY, value: threshold },
    },
  };
}

/**
 * Порог Растущей свирепости: первый толчок (Берсерк) или первое швыряние
 * (Разоритель) существа в свой ход даёт всплески. Строки таблиц активируются
 * уровнем, а не выбором аспекта (у них нет `keyedBy`), поэтому аспект стоит
 * в `when`, а порог свирепости — в подписи и подробности.
 */
function firstForcedMovementTrigger(
  aspect: string,
  maneuver: string,
  surges: string,
  threshold: number,
  replaces: boolean,
): FeatureTrigger {
  return {
    event: "forced-movement",
    frequency: "turn",
    label: `Первый ${maneuver} в свой ход при ${threshold}+ свирепости`,
    detail:
      `Первый раз за свой ход, когда вы совершаете ${maneuver} существа, ` +
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
  // Эпический пул 10-го уровня. Лист показывает его отдельно; гейта по уровню
  // в модели ресурса нет, поэтому конкретный уровень проверяет вызывающий.
  epic: {
    name: "Первозданная сила",
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
  "fury.feature.1.pervozdannyy-aspekt": {
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
      "Подкласс. Приложение пишет выбранный аспект названием в " +
      "automation.classFeatureSelections[\"fury.aspect\"], по нему активируются " +
      "вложенные записи с keyedBy: \"aspect\". Навык аспекта (Берсерк — Лифтинг, " +
      "Разоритель — Скрытность, Буревестник — Выслеживание) — выдача игроку: " +
      "поля навыков в эффектах нет.",
  },
  "fury.feature.1.svirepost": {
    kinds: ["resource"],
    notes:
      "Контейнер ресурса: прибавки живут в CLASS_RESOURCES (FURY_RESOURCE) " +
      "и собираются движком src/lib/resources.ts. Своих gains у записи нет, " +
      "иначе свирепость начислялась бы дважды.",
  },
  "fury.feature.1.svirepost-v-boyu": {
    kinds: ["resource"],
    notes:
      "Набор свирепости: в начале боевой встречи — равная Победам; в начале " +
      "каждого своего хода — 1d3; первый раз за раунд, когда получаешь урон — 1; " +
      "первый раз за бой, когда входишь в утомление или при смерти — 1d3. " +
      "Остаток свирепости сгорает в конце боевой встречи.",
  },
  "fury.feature.1.svirepost-vne-boya": {
    kinds: ["resource"],
    notes:
      "Вне боя свирепость не набирается: способность или эффект со свирепостью " +
      "применяются бесплатно, повтор — только после 1+ Победы или отдыха. " +
      "Способность с тратой «неограниченно» вне боя работает как трата, равная " +
      "Победам. Траты не списывают ресурс — это правило чтения, а не расчёт.",
  },
  "fury.feature.1.rastushchaya-svirepost": {
    kinds: ["resource", "situational"],
    notes:
      "Пороговые преимущества по количеству свирепости (2/4/6/8/10/12) из таблиц " +
      "аспектов; держатся до конца своего хода, даже если ресурс потрачен. " +
      "Строки порогов перенесены отдельными записями, таблица Буревестника " +
      "лежит в комплектах буревестника и в данных отсутствует.",
  },
  "fury.feature.1.rastushchaya-svirepost-berserka-2": {
    kinds: ["bonus"],
    effects: [forcedMovementBonus("Берсерк", MIGHT, 2)],
    notes:
      "Порог 2 свирепости у Берсерка: расстояние маневра Отталкивания получает " +
      "бонус, равный Мощи. Тип маневра движок не различает, поэтому бонус висит " +
      "на поле «толчок».",
  },
  "fury.feature.1.rastushchaya-svirepost-berserka-4": {
    kinds: ["trigger"],
    trigger: firstForcedMovementTrigger("Берсерк", "толчок", "1 всплеск", 4, false),
    notes: "Всплески лист считает вручную: поля «всплески» в модели нет.",
  },
  "fury.feature.1.rastushchaya-svirepost-berserka-6": {
    kinds: ["situational"],
    notes:
      "Порог 6 свирепости у Берсерка: преимущество на тесты Мощи и маневр " +
      "Отталкивания. Преимущество на кубиках не выражается числовым полем — " +
      "правило показывается текстом.",
  },
  "fury.feature.4.rastushchaya-svirepost-berserka-8-4-y-uroven": {
    kinds: ["trigger"],
    trigger: firstForcedMovementTrigger("Берсерк", "толчок", "2 всплеска", 8, true),
    notes:
      "Порог 8 свирепости (с 4-го уровня): те же всплески, но 2 вместо 1. " +
      "Требование уровня закрыто уровнем самой записи.",
  },
  "fury.feature.7.rastushchaya-svirepost-berserka-10-7-y-uroven": {
    kinds: ["situational"],
    notes:
      "Порог 10 свирепости (с 7-го уровня): двойное преимущество на тесты Мощи " +
      "и маневр Отталкивания — заменяет преимущество порога 6.",
  },
  "fury.feature.10.rastushchaya-svirepost-berserka-12-10-y-uroven": {
    kinds: ["trigger", "bonus"],
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
  "fury.feature.1.rastushchaya-svirepost-razoritelya-2": {
    kinds: ["bonus"],
    effects: [forcedMovementBonus("Разоритель", AGILITY, 2)],
    notes:
      "Порог 2 свирепости у Разорителя: расстояние маневра Отталкивания получает " +
      "бонус, равный Ловкости.",
  },
  "fury.feature.1.rastushchaya-svirepost-razoritelya-4": {
    kinds: ["trigger"],
    trigger: firstForcedMovementTrigger("Разоритель", "швыряние", "1 всплеск", 4, false),
    notes: "Всплески лист считает вручную: поля «всплески» в модели нет.",
  },
  "fury.feature.1.rastushchaya-svirepost-razoritelya-6": {
    kinds: ["situational"],
    notes:
      "Порог 6 свирепости у Разорителя: преимущество на тесты Ловкости и маневр " +
      "Отталкивания; преимущество на кубиках показывается текстом.",
  },
  "fury.feature.4.rastushchaya-svirepost-razoritelya-8-4-y-uroven": {
    kinds: ["trigger"],
    trigger: firstForcedMovementTrigger("Разоритель", "швыряние", "2 всплеска", 8, true),
    notes: "Порог 8 свирепости (с 4-го уровня): 2 всплеска вместо 1.",
  },
  "fury.feature.7.rastushchaya-svirepost-razoritelya-10-7-y-uroven": {
    kinds: ["situational"],
    notes:
      "Порог 10 свирепости (с 7-го уровня): двойное преимущество на тесты " +
      "Ловкости и маневр Отталкивания — заменяет преимущество порога 6.",
  },
  "fury.feature.10.rastushchaya-svirepost-razoritelya-12-10-y-uroven": {
    kinds: ["trigger", "bonus"],
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
  "fury.aspect.1.forma-zverya": {
    kinds: ["grant", "situational"],
    notes:
      "Буревестник: можно использовать комплекты буревестника (статья 0924, " +
      "в данных отсутствует) и получать их преимущества, включая строки " +
      "Растущей свирепости Буревестника. Эффектов нет: преимущества живут " +
      "в комплекте, а не в этой записи.",
  },
  "fury.aspect.1.komplekt": {
    kinds: ["grant"],
    notes:
      "Берсерк и Разоритель: можно использовать комплект и получать его " +
      "преимущества. Бонусы комплекта уже считает лист по данным комплектов " +
      "(kitBonus), дублировать их в записи не нужно.",
  },
  "fury.aspect.1.pervozdannaya-khitrost": {
    kinds: ["situational"],
    notes:
      "Разоритель: вас нельзя застигнуть врасплох; всякий раз, когда вы должны " +
      "совершить толчок цели принудительным движением, можете вместо этого " +
      "совершить швыряние. Подмены типа принудительного движения в модели нет.",
  },
  "fury.aspect.1.pervozdannaya-sila": {
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
  "fury.aspect.1.bezzhalostnyy-okhotnik": {
    kinds: ["situational"],
    notes:
      "Буревестник: преимущество на тесты навыка Выслеживание. Преимущество на " +
      "кубиках не выражается числом.",
  },
  "fury.aspect.1.linii-sily": {
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
  "fury.aspect.1.nezemnye-refleksy": {
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
  "fury.aspect.1.yarostnoe-izmenenie": {
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
  "fury.feature.1.moguchie-pryzhki": {
    kinds: ["situational"],
    notes:
      "Результат теста Мощи на прыжок не ниже второго тира. Подмены минимума " +
      "тира в модели нет — правило показывается текстом.",
  },
  "fury.feature.1.znakovaya-sposobnost": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.signature",
      options: [
        { id: "neistovyy-brutalnyy-udar-c9b6b0c82f", label: "Брутальный Удар" },
        { id: "neistovyy-bey-i-begi-d49f37111e", label: "Бей и Беги" },
        { id: "neistovyy-naskvoz-7040e8d41c", label: "Насквозь!" },
        { id: "neistovyy-do-smerti-cc34e7fea6", label: "До Смерти!" },
      ],
    },
    notes:
      "Выбор одной знаковой способности из четырёх; сами способности — записи " +
      "справочника способностей (abilities.generated), здесь только выбор.",
  },
  "fury.feature.1.sposobnost-za-3-svireposti": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.3",
      options: [
        { id: "neistovyy-nazad-dd23a538d2", label: "Назад!" },
        { id: "neistovyy-s-dorogi-5131581e24", label: "С Дороги!" },
        { id: "neistovyy-volna-smerti-ae560a2604", label: "Волна Смерти" },
        {
          id: "neistovyy-tvoi-vnutrennosti-teper-tvoi-naruzhnosti-23236dd6fc",
          label: "Твои внутренности Теперь Твои Наружности!",
        },
      ],
    },
    notes: "Выбор одной героической способности за 3 свирепости.",
  },
  "fury.feature.1.sposobnost-za-5-svireposti": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.5",
      options: [
        { id: "neistovyy-krov-za-krov-dd0a9a2493", label: "Кровь за Кровь!" },
        {
          id: "neistovyy-prostis-so-svoim-bogom-098a9d8f41",
          label: "Простись Со Своим Богом!",
        },
        { id: "neistovyy-gromovoy-rev-b222cca75a", label: "Громовой Рев" },
        { id: "neistovyy-do-samogo-konca-ed7c9f1a9d", label: "До Самого Конца" },
      ],
    },
    notes: "Выбор одной героической способности за 5 свирепости.",
  },

  // ---------------------------------------------------------------- 2-й уровень
  "fury.feature.2.perk": {
    kinds: ["grant"],
    notes:
      "Один перк ремесла, исследования или интриги по выбору. Перки ведутся " +
      "своим списком на листе, поля эффектов у перка нет.",
  },
  "fury.aspect.2.neizbezhnyy-gnev": {
    kinds: ["bonus", "situational"],
    effects: [{ kind: "field", field: "speed", value: AGILITY }],
    notes:
      "Разоритель: бонус к скорости, равный Ловкости, и игнорирование " +
      "труднопроходимой местности. Игнорирование местности — правило чтения, " +
      "числового поля у него нет.",
  },
  "fury.aspect.2.zub-i-kogot": {
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
  "fury.aspect.2.nepreodolimaya-sila": {
    kinds: ["situational"],
    notes:
      "Берсерк: в действии атаки с рывком вместо свободного удара можно применить " +
      "знаковую или героическую способность удара; прыжок можно совершить как " +
      "часть рывка. Это правило выбора действия, чисел не даёт.",
  },
  "fury.feature.2.sposobnost-berserka-2-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.berserker.ability.2",
      options: [
        { id: "neistovyy-osobaya-dostavka-f71cbdccc0", label: "Особая Доставка" },
        { id: "neistovyy-tarannyy-shar-5aecde78f8", label: "Таранный Шар" },
      ],
    },
    notes: "Берсерк: одна из двух способностей 2-го уровня за 5 свирепости.",
  },
  "fury.feature.2.sposobnost-razoritelya-2-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.raider.ability.2",
      options: [
        { id: "neistovyy-smert-smert-61a8e0d162", label: "Смерть... Смерть!" },
        { id: "neistovyy-razrushitel-falang-5c4d3b0d58", label: "Разрушитель Фаланг" },
      ],
    },
    notes: "Разоритель: одна из двух способностей 2-го уровня за 5 свирепости.",
  },
  "fury.feature.2.sposobnost-burevestnika-2-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.stormbringer.ability.2",
      options: [
        { id: "neistovyy-vysshiy-hischnik-373d249741", label: "Высший Хищник" },
        { id: "neistovyy-vnutrenniy-rev-04d333351c", label: "Внутренний Рев" },
      ],
    },
    notes: "Буревестник: одна из двух способностей 2-го уровня за 5 свирепости.",
  },

  // ---------------------------------------------------------------- 3-й уровень
  "fury.aspect.3.nedvizhimyy-obekt": {
    kinds: ["bonus"],
    effects: [{ kind: "field", field: "stability", value: MIGHT }],
    notes:
      "Берсерк: бонус к устойчивости, равный Мощи. Эффективный размер (уровень " +
      "прибавляется к размеру для взаимодействий) не моделируется: поля размера " +
      "в движке нет; на захват это не влияет, как и говорит книга.",
  },
  "fury.aspect.3.rytsar-prirody": {
    kinds: ["situational"],
    notes:
      "Буревестник: разговор с животными и элементалями, ощущение их присутствия " +
      "в 10 клетках, Слава +1 в переговорах с ними (суммируется с прибавкой " +
      "Мародёра). Слава и чувства — не числовые поля листа.",
  },
  "fury.aspect.3.videt-skvoz-ikh-ulovki": {
    kinds: ["situational"],
    notes:
      "Разоритель: двойное преимущество на поиск скрытых существ и мотивов, " +
      "обнаружение лжи и азартные игры. Преимущество на кубиках не выражается.",
  },
  "fury.feature.3.sposobnost-za-7-svireposti": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.7",
      options: [
        { id: "neistovyy-demon-na-vole-645401a1d0", label: "Демон на Воле" },
        { id: "neistovyy-vstret-buryu-971551c413", label: "Встреть Бурю!" },
        { id: "neistovyy-razrushitel-stali-90211fa030", label: "Разрушитель Стали" },
        { id: "neistovyy-vy-uzhe-mertvy-c10cbde43c", label: "Вы Уже Мертвы" },
      ],
    },
    notes: "Выбор одной героической способности за 7 свирепости.",
  },

  // ---------------------------------------------------------------- 4-й уровень
  "fury.feature.4.uvelichenie-kharakteristik": {
    kinds: ["characteristic"],
    notes:
      "Мощь и Ловкость поднимаются до 3. Значение применяет повышение уровня " +
      "(level-up: characteristics.set {might:3, agility:3}); аддитивный эффект " +
      "здесь удвоил бы прибавку, поэтому его нет.",
  },
  "fury.feature.4.uron-ot-svireposti": {
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
  "fury.feature.4.uluchshenie-rastushchey-svireposti": {
    kinds: ["resource", "situational"],
    notes:
      "Открывает строки Растущей свирепости с порогом 8 свирепости: строки " +
      "лежат отдельными записями 4-го уровня, а эта запись объясняет, почему " +
      "они появляются.",
  },
  "fury.feature.4.perk": {
    kinds: ["grant"],
    notes: "Один перк на выбор.",
  },
  "fury.feature.4.pervozdannaya-nastroyka": {
    kinds: ["situational"],
    notes:
      "Автоматическое ощущение иммунитетов и уязвимостей к кислоте, холоду, " +
      "порче, огню, молнии, яду и звуку в 10 клетках и источников этих типов. " +
      "Чувства — правило чтения, числового поля нет.",
  },
  "fury.feature.4.pervozdannyy-udar": {
    kinds: ["resource"],
    notes:
      "Как часть любого удара можно потратить 1 свирепости и получить 1 всплеск " +
      "на этот удар; тип дополнительного урона — кислота, холод, порча, огонь, " +
      "молния, яд или звук — выбирает игрок. С 10-го уровня (Воплощение Хаоса) " +
      "можно потратить до 3 свирепости. Трата ресурса и выбор типа — действие " +
      "игрока, не автоматический эффект.",
  },
  "fury.feature.4.navyk": {
    kinds: ["grant"],
    notes: "Один навык на выбор; навыки ведутся своим списком на листе.",
  },

  // ---------------------------------------------------------------- 5-й уровень
  "fury.aspect.5.prygun": {
    kinds: ["situational"],
    notes:
      "Берсерк: дистанция и высота прыжка удваиваются — это множитель, а не " +
      "слагаемое, и поля «дальность прыжка» в движке нет. Падение уменьшается на " +
      "дистанцию прыжка, лежачим после падения на существо вы не становитесь.",
  },
  "fury.aspect.5.rozhdennyy-shtormom": {
    kinds: ["situational", "grant"],
    notes:
      "Буревестник: вы и союзники в 5 клетках игнорируете негативные эффекты " +
      "ненастной погоды; доступна особенность «Благословение удачной погоды» как " +
      "у проводника 1-го уровня. Кросс-классовая выдача чужой особенности " +
      "моделью не выражается.",
  },
  "fury.aspect.5.raskovannyy": {
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
  "fury.feature.5.sposobnost-za-9-svireposti": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.9",
      options: [
        { id: "neistovyy-oslablyayuschiy-udar-33a1fa07fa", label: "Ослабляющий Удар" },
        { id: "neistovyy-moya-ochered-a1891828ca", label: "Моя Очередь!" },
        {
          id: "neistovyy-razbrasyvayuschiy-shtorm-653f063a97",
          label: "Разбрасывающий Шторм",
        },
        { id: "neistovyy-plot-v-kamen-feb37231c4", label: "Плоть в Камень!" },
      ],
    },
    notes: "Выбор одной героической способности за 9 свирепости.",
  },

  // ---------------------------------------------------------------- 6-й уровень
  "fury.feature.6.maroder-pervozdannogo-khaosa": {
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
  "fury.feature.6.pervozdannyy-portal": {
    kinds: ["situational"],
    notes:
      "Основным действием коснуться источника элементальной силы и создать портал " +
      "в Квинтэссенцию; поддерживается число порталов, равное Мощи. Портал и " +
      "перемещения — действия игрока, чисел для листа нет.",
  },
  "fury.feature.6.perk": {
    kinds: ["grant"],
    notes: "Один перк ремесла, исследования или интриги на выбор.",
  },
  "fury.feature.6.sposobnosti-berserka-6-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.berserker.ability.6",
      options: [
        { id: "neistovyy-lavinnyy-udar-de8e2a81ef", label: "Лавинный Удар" },
        { id: "neistovyy-sila-shtormov-45ac646e33", label: "Сила Штормов" },
      ],
    },
    notes: "Берсерк: одна из двух способностей 6-го уровня за 9 свирепости.",
  },
  "fury.feature.6.sposobnosti-razoritelya-6-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.raider.ability.6",
      options: [
        { id: "neistovyy-smertelnyy-udar-dec35603e1", label: "Смертельный Удар" },
        { id: "neistovyy-nayti-i-unichtozhit-2f81ea4bd4", label: "Найти и Уничтожить" },
      ],
    },
    notes: "Разоритель: одна из двух способностей 6-го уровня за 9 свирепости.",
  },
  "fury.feature.6.sposobnosti-burevestnika-6-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.stormbringer.ability.6",
      options: [
        { id: "neistovyy-zverinyy-naskok-575ec5a122", label: "Звериный Наскок" },
        { id: "neistovyy-osedlavshie-buryu-56b467d86d", label: "Оседлавшие Бурю" },
      ],
    },
    notes: "Буревестник: одна из двух способностей 6-го уровня за 9 свирепости.",
  },

  // ---------------------------------------------------------------- 7-й уровень
  "fury.feature.7.uvelichenie-kharakteristik": {
    kinds: ["characteristic"],
    notes:
      "Каждая характеристика +1 до максимума 4. Значение применяет повышение " +
      "уровня (level-up: increaseAll {amount:1, cap:4}); аддитивный эффект здесь " +
      "удвоил бы прибавку.",
  },
  "fury.feature.7.elementalnaya-forma": {
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
      "равный удвоенной Мощи, но тип урона в книге берётся из комплектов " +
      "буревестника (статья 0924, в данных отсутствует), а множитель ×2 модель " +
      "значений не выражает — эта часть остаётся за игроком.",
  },
  "fury.feature.7.velikaya-svirepost": {
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
  "fury.feature.7.uluchshenie-rastushchey-svireposti": {
    kinds: ["resource", "situational"],
    notes:
      "Открывает строки Растущей свирепости с порогом 10 свирепости; строки " +
      "лежат отдельными записями 7-го уровня.",
  },
  "fury.feature.7.navyk": {
    kinds: ["grant"],
    notes: "Один навык на выбор.",
  },

  // ---------------------------------------------------------------- 8-й уровень
  "fury.feature.8.perk": {
    kinds: ["grant"],
    notes: "Один перк на выбор.",
  },
  "fury.aspect.8.zverinets": {
    kinds: ["grant", "situational"],
    notes:
      "Буревестник: доступны все комплекты буревестника, на отдыхе комплект " +
      "меняется с дополнительной деятельностью отдыха, Рыцарь природы ощущает " +
      "животных в 1 миле, на выслеживании бросаются три кубика с выбором двух. " +
      "Комплекты буревестника в данных отсутствуют, «три кубика» числом не " +
      "выражаются.",
  },
  "fury.aspect.8.na-shag-vperedi": {
    kinds: ["situational", "bonus"],
    effects: [{ kind: "field", field: "disengage", value: AGILITY }],
    notes:
      "Разоритель: расстояние Действия отхода получает бонус, равный Ловкости; " +
      "на тестах Ловкости бросаются три кубика с выбором двух (числом не " +
      "выражается).",
  },
  "fury.aspect.8.silneyshiy": {
    kinds: ["situational", "bonus"],
    effects: [{ kind: "field", field: "push", value: MIGHT }],
    notes:
      "Берсерк: расстояние маневра Отталкивания получает бонус, равный Мощи; " +
      "на тестах Мощи бросаются три кубика с выбором двух (числом не выражается).",
  },
  "fury.feature.8.sposobnost-za-11-svireposti": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.heroic.11",
      options: [
        {
          id: "neistovyy-elementalnaya-svirepost-e0e6be2a3b",
          label: "Элементальная Свирепость",
        },
        { id: "neistovyy-izbytochnyy-uron-48e9173636", label: "Избыточный Урон" },
        { id: "neistovyy-pervozdannaya-yarost-682dd13031", label: "Первозданная Ярость" },
        { id: "neistovyy-neumolimaya-smert-73c9ebb5f8", label: "Неумолимая Смерть" },
      ],
    },
    notes: "Выбор одной героической способности за 11 свирепости.",
  },

  // ---------------------------------------------------------------- 9-й уровень
  "fury.feature.9.predvestnik-pervozdannogo-khaosa": {
    kinds: ["situational"],
    notes:
      "Деятельность отдыха: создать временный источник элементальной силы на 24 " +
      "часа, пригодный для Первозданного портала; пока портал поддерживается, " +
      "источник сохраняется. Это деятельность отдыха, чисел для листа нет.",
  },
  "fury.feature.9.sposobnosti-berserka-9-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.berserker.ability.9",
      options: [
        {
          id: "neistovyy-smert-prihodit-za-vsemi-14cbc215f6",
          label: "Смерть Приходит За Всеми!",
        },
        { id: "neistovyy-pervozdannyy-vihr-f4a556044d", label: "Первозданный Вихрь" },
      ],
    },
    notes: "Берсерк: одна из двух способностей 9-го уровня за 11 свирепости.",
  },
  "fury.feature.9.sposobnosti-razoritelya-9-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.raider.ability.9",
      options: [
        {
          id: "neistovyy-pervozdannaya-kara-primordial-bane-201a549d9a",
          label: "Первозданная кара",
        },
        { id: "neistovyy-krovavyy-dozhd-f2ebe05910", label: "Кровавый Дождь" },
      ],
    },
    notes: "Разоритель: одна из двух способностей 9-го уровня за 11 свирепости.",
  },
  "fury.feature.9.sposobnosti-burevestnika-9-go-urovnya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "fury.stormbringer.ability.9",
      options: [
        { id: "neistovyy-rev-smerti-c0987130c4", label: "Рев Смерти" },
        { id: "neistovyy-bedstvie-62e981aae4", label: "Бедствие" },
      ],
    },
    notes: "Буревестник: одна из двух способностей 9-го уровня за 11 свирепости.",
  },

  // --------------------------------------------------------------- 10-й уровень
  "fury.feature.10.voploshchenie-khaosa": {
    kinds: ["immunity", "trigger", "resource"],
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
      "Множители ×2 и ×3 модель значений не выражает, поэтому эффекта нет, " +
      "а Элементальная форма остаётся с базовым иммунитетом. Первозданный удар " +
      "здесь усиливается до 3 свирепости за удар (см. запись 4-го уровня).",
  },
  "fury.feature.10.uvelichenie-kharakteristik": {
    kinds: ["characteristic"],
    notes:
      "Мощь и Ловкость поднимаются до 5. Значение применяет повышение уровня " +
      "(level-up: characteristics.set {might:5, agility:5}); аддитивный эффект " +
      "здесь удвоил бы прибавку.",
  },
  "fury.feature.10.uluchshenie-rastushchey-svireposti": {
    kinds: ["resource", "situational"],
    notes:
      "Открывает строки Растущей свирепости с порогом 12 свирепости; строки " +
      "лежат отдельными записями 10-го уровня.",
  },
  "fury.feature.10.perk": {
    kinds: ["grant"],
    notes: "Один перк ремесла, исследования или интриги на выбор.",
  },
  "fury.feature.10.pervozdannaya-svirepost": {
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
  "fury.feature.10.pervozdannaya-sila": {
    kinds: ["resource"],
    notes:
      "Эпический ресурс: на каждом отдыхе первозданная сила прибывает на " +
      "полученный Опыт, тратится как свирепость и не сгорает. Прибавка живёт в " +
      "эпическом пуле CLASS_RESOURCES (FURY_RESOURCE.epic), чтобы не смешаться " +
      "с основным. За свободный маневр можно потратить любое количество, чтобы " +
      "завершить столько же эффектов на себе; 3 единицы создают портал без " +
      "источника элементальной силы.",
  },
  "fury.feature.10.navyk": {
    kinds: ["grant"],
    notes: "Один навык на выбор.",
  },
};
