import type { Ability, AbilityTier, ActionType } from "../../../types";
import type { AncestryFeatureMechanics } from "../types";

/**
 * Способности происхождений. Карточки собраны руками по книге, потому что
 * часть черт описывает триггеры или маневры прозой, а не таблицей броска силы;
 * канонические данные происхождений приходят из
 * `generated/consumers/builder.json` и `features.json`, но способности
 * остаются рукописной механикой.
 *
 * `id` способности стабилен и не зависит от порядка данных: по нему лист
 * находит карточку, а `ancestryAbilitySources` строит подпись «Происхождение».
 * Это не способности каталога: они не сохраняются в `character.abilities`,
 * а выдаются выбранной чертой или знаковой чертой происхождения.
 */

interface AbilitySeed {
  id: string;
  name: string;
  actionType: ActionType;
  keywords: string[];
  distance: string;
  target: string;
  flavor?: string;
  /** `signature` — только там, где книга прямо называет способность знаковой. */
  kind?: Ability["kind"];
  rollCharacteristics?: Ability["rollCharacteristics"];
  preferredCharacteristic?: Ability["preferredCharacteristic"];
  trigger?: string;
  tiers?: [AbilityTier, AbilityTier, AbilityTier];
  effect?: string;
  notes?: string;
}

function emptyTiers(): [AbilityTier, AbilityTier, AbilityTier] {
  return [
    { damage: "", effect: "" },
    { damage: "", effect: "" },
    { damage: "", effect: "" },
  ];
}

function ability(source: string, seed: AbilitySeed): Ability {
  const rollCharacteristics = seed.rollCharacteristics ?? [];
  return {
    id: seed.id,
    name: seed.name,
    flavor: seed.flavor ?? "",
    actionType: seed.actionType,
    kind: seed.kind ?? "other",
    keywords: seed.keywords,
    distance: seed.distance,
    target: seed.target,
    rollCharacteristics,
    preferredCharacteristic:
      seed.preferredCharacteristic ?? rollCharacteristics[0] ?? "",
    rollBonus: 0,
    resourceCost: 0,
    trigger: seed.trigger ?? "",
    tiers: seed.tiers ?? emptyTiers(),
    effect: seed.effect ?? "",
    source,
    notes: seed.notes ?? "",
  };
}

const DEVIL = "Происхождение · Дьявол";
const DRAGON_KNIGHT = "Происхождение · Драконий Рыцарь";
const WODE_ELF = "Происхождение · Лесной Эльф";
const HIGH_ELF = "Происхождение · Высший Эльф";
const HUMAN = "Происхождение · Человек";
const MEMANEK = "Происхождение · Меманек";
const POLDER = "Происхождение · Полдер";
const REVENANT = "Происхождение · Ревенант";
const TIME_RAIDER = "Происхождение · Рейдер Времени";
const TAURUS = "Происхождение · Таурус";
const LIZARD = "Происхождение · Ящер";

const PSIONIC_GIFT_GROUP = "ancestry.time-raider.psionic-gift";

const concussiveSlam = ability(TIME_RAIDER, {
  id: "ancestry.time-raider.psionic-gift.concussive-slam",
  name: "Сотрясающий Удар",
  kind: "signature",
  flavor: "Вы сотрясаете врага невидимой силой.",
  actionType: "main",
  keywords: ["Псионика", "Дальний", "Удар"],
  distance: "Дальний 10",
  target: "Одно существо или объект",
  rollCharacteristics: ["reason", "intuition", "presence"],
  tiers: [
    { damage: "2 + R, I или P", effect: "" },
    { damage: "5 + R, I или P", effect: "толчок 1" },
    {
      damage: "7 + R, I или P",
      effect: "толчок 2; М < СЛАБЫЙ, лежачий",
    },
  ],
});

const psionicBolt = ability(TIME_RAIDER, {
  id: "ancestry.time-raider.psionic-gift.psionic-bolt",
  name: "Псионический Заряд",
  kind: "signature",
  flavor: "Вы пускаете луч сконцентрированной пси-энергии.",
  actionType: "main",
  keywords: ["Псионика", "Дальний", "Удар"],
  distance: "Дальний 10",
  target: "Одно существо или объект",
  rollCharacteristics: ["reason", "intuition", "presence"],
  tiers: [
    { damage: "2 + R, I или P", effect: "швыряние 1; псионический урон" },
    { damage: "5 + R, I или P", effect: "швыряние 2; псионический урон" },
    { damage: "7 + R, I или P", effect: "швыряние 3; псионический урон" },
  ],
});

const minorAcceleration = ability(TIME_RAIDER, {
  id: "ancestry.time-raider.psionic-gift.minor-acceleration",
  name: "Малая Акселерация",
  kind: "signature",
  flavor: "Вы заряжаете себя или союзника всплеском скорости.",
  actionType: "maneuver",
  keywords: ["Псионика", "Ближний"],
  distance: "Ближний 1",
  target: "На себя или одного союзника",
  effect:
    "Цель получает бонус к скорости, равный вашему показателю Разума, " +
    "Интуиции или Присутствия (ваш выбор), до начала вашего следующего хода.",
});

export const ANCESTRY_ABILITY_MECHANICS: Record<
  string,
  AncestryFeatureMechanics
> = {
  // ---------------------------------------------------------------- Дьявол
  "ancestry.devil.glowing-eyes": {
    abilities: [
      ability(DEVIL, {
        id: "ancestry.devil.glowing-eyes",
        name: "Светящиеся Глаза",
        flavor:
          "Ваши глаза сплошного, яркого цвета, который вспыхивает, показывая ваше возбуждение или ярость.",
        actionType: "trigger",
        keywords: [],
        distance: "Особая",
        target: "Существо, нанёсшее вам урон",
        trigger:
          "Вы получаете урон от существа; можно проклясть это существо.",
        effect:
          "Существо получает 1d10 + ваш уровень психического урона.",
      }),
    ],
    notes:
      "Сколько раз за раунд срабатывает проклятие, источник не уточняет: " +
      "лист не ограничивает триггер автоматически.",
  },

  // ------------------------------------------------------ Драконий Рыцарь
  "ancestry.dragon-knight.draconian-guard": {
    abilities: [
      ability(DRAGON_KNIGHT, {
        id: "ancestry.dragon-knight.draconian-guard",
        name: "Драконий Страж",
        flavor:
          "Ваша драконья чешуя позволяет вам защитить себя или союзника от удара.",
        actionType: "trigger",
        keywords: [],
        distance: "На себя или смежное существо",
        target: "Вы или смежное существо",
        trigger:
          "Вы или смежное существо получаете урон от удара.",
        effect:
          "Вы уменьшаете любой урон от удара на количество, равное вашему уровню.",
      }),
    ],
  },
  "ancestry.dragon-knight.draconic-pride": {
    abilities: [
      ability(DRAGON_KNIGHT, {
        id: "ancestry.dragon-knight.draconic-pride",
        name: "Драконья Гордость",
        kind: "signature",
        flavor: "Вы издаете могучий рев, что колеблет ваших противников.",
        actionType: "main",
        keywords: ["Область", "Магия"],
        distance: "Взрыв 1",
        target: "Каждый враг в области",
        rollCharacteristics: ["might", "presence"],
        tiers: [
          { damage: "2", effect: "" },
          { damage: "5", effect: "толчок 1" },
          { damage: "7", effect: "толчок 2" },
        ],
      }),
    ],
  },
  "ancestry.dragon-knight.remember-your-oath": {
    abilities: [
      ability(DRAGON_KNIGHT, {
        id: "ancestry.dragon-knight.remember-your-oath",
        name: "Помни Свою Клятву",
        flavor:
          "Вы произносите клятву, которая укрепляет вашу волю против врагов.",
        actionType: "maneuver",
        keywords: [],
        distance: "На себя",
        target: "На себя",
        effect:
          "До начала вашего следующего хода всякий раз, когда вы проходите " +
          "Спасбросок, вы преуспеваете при результате 4 или выше.",
      }),
    ],
  },
  "ancestry.dragon-knight.dragon-breath": {
    abilities: [
      ability(DRAGON_KNIGHT, {
        id: "ancestry.dragon-knight.dragon-breath",
        name: "Драконье Дыхание",
        kind: "signature",
        flavor: "Яростный выдох энергии омывает ваших противников.",
        actionType: "main",
        keywords: ["Область", "Магия"],
        distance: "Куб 3 в пределах 1",
        target: "Каждый враг в области",
        rollCharacteristics: ["might", "presence"],
        tiers: [
          { damage: "2", effect: "" },
          { damage: "4", effect: "" },
          { damage: "6", effect: "" },
        ],
        effect:
          "Вы выбираете тип урона способности из кислоты, холода, порчи, " +
          "огня, молнии или яда.",
      }),
    ],
  },

  // ------------------------------------------------------------- Лесной Эльф
  "ancestry.forest-elf.the-wode-defends": {
    abilities: [
      ability(WODE_ELF, {
        id: "ancestry.forest-elf.the-wode-defends",
        name: "Леса Защищают",
        kind: "signature",
        flavor: "Колючие лозы прорастают из земли и связывают врага.",
        actionType: "main",
        keywords: ["Дальний", "Магия", "Удар"],
        distance: "Дальний 10",
        target: "Одно существо",
        rollCharacteristics: ["might", "agility"],
        tiers: [
          {
            damage: "2 + M или A",
            effect: "Л < СЛАБЫЙ, замедлен (до прохождения)",
          },
          {
            damage: "3 + M или A",
            effect: "Л < СРЕДНИЙ, замедлен (до прохождения)",
          },
          {
            damage: "5 + M или A",
            effect: "Л < СИЛЬНЫЙ, замедлен (до прохождения)",
          },
        ],
      }),
    ],
  },

  // ------------------------------------------------------------ Высший Эльф
  "ancestry.high-elf.glamor-of-terror": {
    abilities: [
      ability(HIGH_ELF, {
        id: "ancestry.high-elf.glamor-of-terror",
        name: "Очарование Ужаса",
        flavor:
          "Вы обращаете магию своего очарования, чтобы вселить страх в сердце врага.",
        actionType: "trigger",
        keywords: ["Магия"],
        distance: "Особая",
        target: "Существо, нанёсшее вам урон",
        trigger: "Вы получаете урон от существа.",
        effect:
          "Существо становится напуганным вами до конца своего следующего хода.",
      }),
    ],
  },

  // ---------------------------------------------------------------- Человек
  "ancestry.human.signature.detect-the-supernatural": {
    abilities: [
      ability(HUMAN, {
        id: "ancestry.human.signature.detect-the-supernatural",
        name: "Видение Сверхъестественного",
        flavor:
          "Вы открываете своё сознание для обнаружения сверхъестественных существ и явлений.",
        actionType: "maneuver",
        keywords: [],
        distance: "На себя",
        target: "На себя",
        effect:
          "До конца вашего следующего хода вы знаете местоположение любого " +
          "сверхъестественного предмета, нежити, конструкта или существа из " +
          "другого мира в пределах 5 клеток, даже без линии воздействия. Вы " +
          "знаете, обнаруживаете ли вы предмет или существо, и знаете природу " +
          "любого обнаруженного существа.",
      }),
    ],
  },
  "ancestry.human.determination": {
    abilities: [
      ability(HUMAN, {
        id: "ancestry.human.determination",
        name: "Решимость",
        flavor:
          "Терпимость к боли и страданиям позволяет вам преодолевать трудные ситуации.",
        actionType: "maneuver",
        keywords: [],
        distance: "На себя",
        target: "На себя",
        effect:
          "Если вы напуганы, замедлены или ослаблены, вы немедленно " +
          "прекращаете одно из этих состояний.",
      }),
    ],
  },
  "ancestry.human.resist-the-unnatural": {
    abilities: [
      ability(HUMAN, {
        id: "ancestry.human.resist-the-unnatural",
        name: "Сопротивление Неестественному",
        flavor:
          "Ваша инстинктивная стойкость защищает вас от травм, выходящих за рамки обычного.",
        actionType: "trigger",
        keywords: [],
        distance: "На себя",
        target: "На себя",
        trigger:
          "Вы получаете урон, который не является нетиповым.",
        effect: "Вы получаете половину урона.",
      }),
    ],
  },

  // ---------------------------------------------------------------- Меманек
  "ancestry.memanek.keeper-of-order": {
    abilities: [
      ability(MEMANEK, {
        id: "ancestry.memanek.keeper-of-order",
        name: "Хранитель Порядка",
        flavor:
          "Ваша связь с Аксиомом, планом Абсолютного Закона, позволяет вам управлять хаосом вокруг вас.",
        actionType: "free-trigger",
        keywords: [],
        distance: "На себя или смежное существо",
        target: "Вы или смежное существо",
        trigger:
          "Вы или смежное существо делаете бросок силы; один раз за раунд.",
        effect:
          "Уберите преимущество или помеху на броске, превратите двойное " +
          "преимущество в преимущество или двойную помеху в помеху.",
      }),
    ],
  },

  // ----------------------------------------------------------------- Полдер
  "ancestry.polder.signature.shadowmeld": {
    abilities: [
      ability(POLDER, {
        id: "ancestry.polder.signature.shadowmeld",
        name: "Слияние С Тенью",
        flavor: "Вы становитесь настоящей тенью.",
        actionType: "maneuver",
        keywords: ["Магия"],
        distance: "На себя",
        target: "На себя",
        effect:
          "Вы распластываете себя по тени на поверхности, к которой " +
          "соприкасаетесь, и становитесь скрыты от любого существа, против " +
          "которого у вас есть укрытие или покров либо которое вас не ищет. " +
          "Пока вы в теневой форме, удары по вам и тесты для вашего поиска " +
          "получают помеху. Вы не можете двигаться, быть принудительно " +
          "передвинутым или использовать основные действия и маневры, кроме " +
          "выхода из формы и управления подконтрольными существами. Если " +
          "поверхность уничтожена, способность заканчивается и вы получаете " +
          "1d6 урона, который нельзя уменьшить.",
      }),
    ],
    notes: "Выход из формы — повторное использование маневра.",
  },
  "ancestry.polder.reactive-tumble": {
    abilities: [
      ability(POLDER, {
        id: "ancestry.polder.reactive-tumble",
        name: "Реактивное Перемещение",
        flavor: "Легкий шаг помогает вам быстро менять позицию.",
        actionType: "free-trigger",
        keywords: [],
        distance: "На себя",
        target: "На себя",
        trigger: "Вас принудительно передвинули.",
        effect:
          "После того как принудительное движение закончено, вы смещаетесь на 1 клетку.",
      }),
    ],
  },

  // --------------------------------------------------------------- Ревенант
  "ancestry.revenant.detonate-sigil": {
    abilities: [
      ability(REVENANT, {
        id: "ancestry.revenant.detonate-sigil",
        name: "Взрыв Печати",
        kind: "signature",
        flavor: "Помещенная магическая печать взрывается энергией.",
        actionType: "main",
        keywords: ["Дальний", "Магия", "Удар"],
        distance: "Дальний 10",
        target: "Одно существо или объект",
        rollCharacteristics: ["reason", "intuition", "presence"],
        tiers: [
          { damage: "3 + R, I или P", effect: "швыряние 1" },
          { damage: "5 + R, I или P", effect: "швыряние 2" },
          { damage: "7 + R, I или P", effect: "швыряние 3" },
        ],
        effect: "Печать исчезает с существа.",
      }),
    ],
    notes:
      "Печать ставится маневром «Метка мести»; одновременно можно иметь " +
      "столько печатей, сколько у вас уровней.",
  },

  // -------------------------------------------------------- Рейдер Времени
  "ancestry.time-raider.beyondsight": {
    abilities: [
      ability(TIME_RAIDER, {
        id: "ancestry.time-raider.beyondsight",
        name: "Потустороннее Зрение",
        flavor:
          "Вы настраиваете зрение так, чтобы видеть сквозь обыденные препятствия.",
        actionType: "maneuver",
        keywords: [],
        distance: "На себя",
        target: "На себя",
        effect:
          "Вы видите сквозь обыденные препятствия толщиной в 1 клетку или " +
          "меньше. Пока зрение настроено так, вы не видите область в пределах " +
          "1 клетки от вас и не имеете линии воздействия на существ и объекты " +
          "в ней. Повторное использование маневра возвращает обычное зрение.",
      }),
    ],
  },
  "ancestry.time-raider.foresight": {
    abilities: [
      ability(TIME_RAIDER, {
        id: "ancestry.time-raider.foresight",
        name: "Дальновидность",
        flavor:
          "Ваши чувства простираются сквозь обыденные препятствия и завесу будущего.",
        actionType: "trigger",
        keywords: [],
        distance: "На себя",
        target: "На себя",
        trigger: "Вы становитесь целью удара.",
        effect: "Вы налагаете помеху на бросок силы.",
      }),
    ],
    notes:
      "Пассивно: вы автоматически определяете местоположение любого существа " +
      "под покровом в пределах 20 клеток, если оно не скрыто от вас, и " +
      "игнорируете обычную помеху на удары по таким существам.",
  },
  "ancestry.time-raider.psionic-gift": {
    choice: {
      group: PSIONIC_GIFT_GROUP,
      label: "Псионический дар: знаковая способность",
      options: [
        {
          id: "ancestry.time-raider.psionic-gift.concussive-slam",
          label: "Сотрясающий Удар",
          ability: concussiveSlam,
        },
        {
          id: "ancestry.time-raider.psionic-gift.psionic-bolt",
          label: "Псионический Заряд",
          ability: psionicBolt,
        },
        {
          id: "ancestry.time-raider.psionic-gift.minor-acceleration",
          label: "Малая Акселерация",
          ability: minorAcceleration,
        },
      ],
    },
  },

  // ----------------------------------------------------------------- Таурус
  "ancestry.taurus.let-loose": {
    abilities: [
      ability(TAURUS, {
        id: "ancestry.taurus.let-loose",
        name: "Дать Волю",
        kind: "signature",
        flavor: "С яростным ревом вы выпускаете зверя.",
        actionType: "main",
        keywords: ["Область", "Ближний"],
        distance: "Взрыв 1",
        target: "Каждый враг в области",
        rollCharacteristics: ["might", "presence"],
        tiers: [
          { damage: "2", effect: "" },
          { damage: "5", effect: "толчок 1" },
          { damage: "7", effect: "толчок 2" },
        ],
      }),
    ],
  },

  // ------------------------------------------------------------------ Ящер
  "ancestry.lizard.dragon-heritage": {
    abilities: [
      ability(LIZARD, {
        id: "ancestry.lizard.dragon-heritage",
        name: "Наследие Драконов",
        kind: "signature",
        flavor: "Яростный выдох энергии омывает ваших противников.",
        actionType: "main",
        keywords: ["Область", "Магия"],
        distance: "Куб 3 в пределах 1",
        target: "Каждый враг в области",
        rollCharacteristics: ["might", "presence"],
        tiers: [
          { damage: "2", effect: "" },
          { damage: "4", effect: "" },
          { damage: "6", effect: "" },
        ],
        effect:
          "Вы выбираете тип урона способности из кислоты, холода, порчи, " +
          "огня, молнии или яда.",
      }),
    ],
  },
};
