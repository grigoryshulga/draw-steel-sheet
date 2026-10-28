import type { FeatureEffect } from "./feature-effects";

export type { FeatureCondition, FeatureEffect, FeatureStat } from "./feature-effects";

export interface ClassFeatureOption {
  id: string;
  name: string;
  description: string;
  effects: FeatureEffect[];
  manualReason?: string;
}

export interface ClassFeatureGroup {
  id: string;
  name: string;
  className: string;
  options: ClassFeatureOption[];
}

/** Старые опции Таланта остаются метаданными выбора: числа живут в механике. */
const talentMoved = (
  name: string,
  lead = "Числовой эффект перенесён",
) =>
  `${lead} в механику особенности «${name}»; запись оставлена для сохранённых выборов билдера и панели листа.`;

/** Старые опции Нуля тоже остаются метаданными выбора: числа живут в механике. */
const nullMoved = (name: string) => talentMoved(name);

/**
 * Зачарования и обереги Элементалиста — последняя группа старого реестра:
 * выбор остаётся метаданными, а числа и триггеры живут в механике.
 */
const elementalistMoved = (name: string) =>
  talentMoved(name, "Правило перенесено");

export const CLASS_FEATURE_GROUPS: ClassFeatureGroup[] = [
  {
    id: "null.augmentation",
    name: "Псионическая аугментация",
    className: "Нуль",
    options: [
      {
        id: "null.augmentation.density",
        name: "Аугментация плотности (Density Augmentation)",
        description:
          "Вы получаете бонус +6 к выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях. Дополнительно, вы получаете бонус +1 к устойчивости.",
        effects: [],
        manualReason: nullMoved("Аугментация плотности"),
      },
      {
        id: "null.augmentation.force",
        name: "Аугментация силы (Force Augmentation)",
        description:
          "Ваши наносящие урон псионические способности получают бонус +1 к выброшенному урону.",
        effects: [],
        manualReason: nullMoved("Аугментация силы"),
      },
      {
        id: "null.augmentation.speed",
        name: "Аугментация скорости (Speed Augmentation)",
        description:
          "Вы получаете бонус +1 к скорости и к расстоянию, на которое вы можете сместиться, когда вы используете Действие отхода.\n\n---",
        effects: [],
        manualReason: nullMoved("Аугментация скорости"),
      },
    ],
  },
  {
    id: "talent.augmentation",
    name: "Псионическая аугментация",
    className: "Талант",
    options: [
      {
        id: "talent.augmentation.battle",
        name: "Боевая аугментация",
        description:
          "Вы можете эффективно носить легкую броню и владеть легким оружием, даже если у вас нет комплекта. Пока вы носите легкую броню, вы получаете бонус +3 к выносливости, и этот бонус увеличивается на 3 на 4-м, 7-м и 10-м уровнях. Пока вы владеете легким оружием, вы получаете бонус +1 к урону со способностями оружия, включая свободные удары. Вы можете использовать сокровища легкой брони и сокровища легкого оружия.\n\nЕсли у вас есть комплект, вы не можете взять эту аугментацию.",
        effects: [],
        manualReason: talentMoved(
          "Боевая аугментация"
        ),
      },
      {
        id: "talent.augmentation.density",
        name: "Аугментация плотности",
        description:
          "Вы получаете бонус +6 к выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях. Дополнительно, вы получаете бонус +1 к устойчивости.",
        effects: [],
        manualReason: talentMoved(
          "Аугментация плотности"
        ),
      },
      {
        id: "talent.augmentation.distance",
        name: "Аугментация дистанции",
        description:
          "Ваши дальнобойные псионические способности получают бонус +2 к расстоянию.",
        effects: [],
        manualReason: talentMoved(
          "Аугментация дистанции"
        ),
      },
      {
        id: "talent.augmentation.force",
        name: "Аугментация силы",
        description:
          "Ваши наносящие урон псионические способности получают бонус +1 к выброшенному урону.",
        effects: [],
        manualReason: talentMoved(
          "Аугментация силы"
        ),
      },
      {
        id: "talent.augmentation.speed",
        name: "Аугментация скорости",
        description:
          "Вы получаете бонус +1 к вашей скорости и к расстоянию, на которое вы можете сместиться, когда вы используете Действие отхода.\n\n---",
        effects: [],
        manualReason: talentMoved(
          "Аугментация скорости"
        ),
      },
    ],
  },
  {
    id: "talent.sanctuary",
    name: "Оберег таланта",
    className: "Талант",
    options: [
      {
        id: "talent.sanctuary.entropy",
        name: "Оберег энтропии",
        description:
          "Ваш оберег замедляет время для ваших врагов. Всякий раз, когда существо наносит вам урон, его скорость уменьшается на величину, равную показателю вашего Разума, и оно не может использовать триггеры до конца своего следующего хода.",
        effects: [],
        manualReason: talentMoved(
          "Оберег энтропии",
          "Правило перенесено",
        ),
      },
      {
        id: "talent.sanctuary.repelling",
        name: "Отталкивающий оберег",
        description:
          "Вы окружаете себя невидимым оберегом телекинетической энергии. Всякий раз, когда смежное существо наносит вам урон, вы можете использовать свободный триггер, чтобы совершить его толчок вплоть до числа клеток, равного показателю вашего Разума.",
        effects: [],
        manualReason: talentMoved(
          "Отталкивающий оберег",
          "Правило перенесено",
        ),
      },
      {
        id: "talent.sanctuary.steel",
        name: "Стальной оберег",
        description:
          "Ваш оберег реагирует на опасность, защищая вас от будущего вреда. Всякий раз, когда вы получаете урон, после разрешения урона вы получаете иммунитет к урону, равный показателю вашего Разума, до конца вашего следующего хода.",
        effects: [],
        manualReason: talentMoved(
          "Стальной оберег",
          "Правило перенесено",
        ),
      },
      {
        id: "talent.sanctuary.vanishing",
        name: "Исчезающий оберег",
        description:
          "Ваш оберег позволяет вам ускользать от угроз. Всякий раз, когда вы получаете урон, вы становитесь невидимым до конца вашего следующего хода.\n\n---",
        effects: [],
        manualReason: talentMoved(
          "Исчезающий оберег",
          "Правило перенесено",
        ),
      },
    ],
  },
  {
    id: "elementalist.enchantment",
    name: "Зачарование",
    className: "Элементалист",
    options: [
      {
        id: "elementalist.enchantment.battle",
        name: "Зачарование битвы",
        description:
          "Вы можете эффективно носить легкую броню и владеть легким оружием, даже если у вас нет комплекта. Пока вы носите легкую броню, вы получаете бонус +3 к Выносливости, и этот бонус увеличивается на 3 на 4-м, 7-м и 10-м уровнях. Пока вы владеете легким оружием, вы получаете бонус +1 к урону со способностями оружия, включая свободные удары. Вы можете использовать сокровища легкой брони и сокровища легкого оружия.\n\nЕсли у вас есть комплект, вы не можете взять это зачарование.",
        effects: [],
        manualReason: elementalistMoved("Зачарование битвы"),
      },
      {
        id: "elementalist.enchantment.speed",
        name: "Зачарование быстроты",
        description:
          "Вы получаете бонус +1 к вашей скорости и к расстоянию, на которое вы можете сместиться, когда вы используете Действие отхода.",
        effects: [],
        manualReason: elementalistMoved("Зачарование быстроты"),
      },
      {
        id: "elementalist.enchantment.destruction",
        name: "Зачарование разрушения",
        description:
          "Вы получаете бонус +1 к выброшенному урону магическими способностями.",
        effects: [],
        manualReason: elementalistMoved("Зачарование разрушения"),
      },
      {
        id: "elementalist.enchantment.distance",
        name: "Зачарование дистанции",
        description:
          "У вас есть бонус +2 к расстоянию ваших дальнобойных магических способностей.",
        effects: [],
        manualReason: elementalistMoved("Зачарование дистанции"),
      },
      {
        id: "elementalist.enchantment.constancy",
        name: "Зачарование постоянства",
        description:
          "Вы получаете бонус +6 к Выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях. Дополнительно, вы получаете бонус +1 к устойчивости.\n\n---",
        effects: [],
        manualReason: elementalistMoved("Зачарование постоянства"),
      },
    ],
  },
  {
    id: "elementalist.sanctuary",
    name: "Оберег элементалиста",
    className: "Элементалист",
    options: [
      {
        id: "elementalist.sanctuary.delightful",
        name: "Оберег восхитительных последствий",
        description:
          "Защитное поле магии пустоты поглощает насилие, направленное на вас, а затем позволяет вам метнуть его обратно во врагов. В первый раз за раунд, когда вы получаете урон, вы получаете 1 всплеск.",
        effects: [],
        manualReason: elementalistMoved("Оберег восхитительных последствий"),
      },
      {
        id: "elementalist.sanctuary.superior",
        name: "Оберег превосходной защиты",
        description:
          "Вы сплетаете щит из всех элементов вокруг себя, направляя их полную защитную силу. У вас есть иммунитет к урону кислотой, холодом, порчей, огнем, молнией, ядом или звуком, равный показателю вашего Разума.",
        effects: [],
        manualReason: elementalistMoved("Оберег превосходной защиты"),
      },
      {
        id: "elementalist.sanctuary.nature",
        name: "Оберег привязанности природы",
        description:
          "Энергия зелени, извивающаяся внутри вашего тела, позволяет вам создавать мощные лозы, когда вы в опасности. Всякий раз, когда существо в пределах количества клеток, равного показателю вашего Разума, наносит вам урон, вы можете использовать свободный триггер, чтобы совершить швыряние этого существа на количество клеток вплоть до показателя вашего Разума.",
        effects: [],
        manualReason: elementalistMoved("Оберег привязанности природы"),
      },
      {
        id: "elementalist.sanctuary.reactivity",
        name: "Оберег удивительной реактивности",
        description:
          "Вы используете магию огня для создания оберега взрывной энергии. Всякий раз, когда смежное существо наносит вам урон, вы можете использовать свободный триггер, чтобы совершить толчок этого существа на количество клеток вплоть до двойного показателя вашего Разума.\n\n---",
        effects: [],
        manualReason: elementalistMoved("Оберег удивительной реактивности"),
      },
    ],
  },
];

export function classFeatureGroups(className: string): ClassFeatureGroup[] {
  return CLASS_FEATURE_GROUPS.filter((group) => group.className === className);
}

/** Convert the builder's translated labels to IDs, ignoring unknown or cross-class labels. */
export function classFeatureSelectionsFromDraft(
  className: string,
  choices: Record<string, string>,
): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const group of classFeatureGroups(className)) {
    const option = group.options.find((candidate) => candidate.name === choices[group.name]);
    if (option) selected[group.id] = option.id;
  }
  // Старые поля конструктора остаются входным контрактом, но их выборы
  // сохраняются как явные ID, читаемые механикой Проводника.
  if (className === "Проводник") {
    const prayer = CONDUIT_LEGACY_OPTIONS.prayer.find((option) => option.name === choices.Молитва);
    const sanctuary = CONDUIT_LEGACY_OPTIONS.sanctuary.find((option) => option.name === choices["Оберег проводника"]);
    if (prayer) selected["conduit.prayer"] = prayer.id;
    if (sanctuary) selected["conduit.sanctuary"] = sanctuary.id;
  }
  return selected;
}

/** Explicit legacy choice IDs retained for old sheets and builder drafts. */
export const CONDUIT_LEGACY_OPTIONS = {
  prayer: [
    { id: "conduit.prayer.destruction", name: "Молитва о разрушении" },
    { id: "conduit.prayer.distance", name: "Молитва о дистанции" },
    { id: "conduit.prayer.soldier", name: "Молитва о мастерстве солдата" },
    { id: "conduit.prayer.speed", name: "Молитва о скорости" },
    { id: "conduit.prayer.steel", name: "Молитва о стали" },
  ],
  sanctuary: [
    { id: "conduit.sanctuary.bastion", name: "Оберег бастиона" },
    { id: "conduit.sanctuary.reaction", name: "Оберег реакции" },
    { id: "conduit.sanctuary.refuge", name: "Оберег святилища" },
    { id: "conduit.sanctuary.spirits", name: "Оберег духов" },
  ],
} as const;
