export type FeatureStat =
  | "stamina"
  | "recoveries"
  | "speed"
  | "stability"
  | "disengage"
  | "save";

export type FeatureEffect =
  | { kind: "stat"; stat: FeatureStat; value: number; perEchelon?: number }
  | { kind: "damage" | "distance"; value: number; keywords: string[] };

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

const manualArmor = "Бонусы зависят от ношения легкой брони и владения легким оружием; это условие пока не отслеживается автоматически.";
const manualReaction = "Это реактивный эффект, требующий выбора действия или отслеживания состояния; он пока применяется вручную.";
const manualImmunity = "Иммунитет к нескольким видам урона зависит от характеристики и не поддерживается автоматическими модификаторами.";
const manualSteelWard = "Срабатывает после получения урона и даёт иммунитет к урону, равный показателю Разума, до конца вашего следующего хода; величину и срок нужно отслеживать вручную.";

export const CLASS_FEATURE_GROUPS: ClassFeatureGroup[] = [
  {
    id: "null.augmentation",
    name: "Псионическая аугментация",
    className: "Нуль",
    options: [
      { id: "null.augmentation.density", name: "Аугментация плотности (Density Augmentation)", description: "Вы получаете бонус +6 к выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях. Дополнительно, вы получаете бонус +1 к устойчивости.", effects: [{ kind: "stat", stat: "stamina", value: 0, perEchelon: 6 }, { kind: "stat", stat: "stability", value: 1 }] },
      { id: "null.augmentation.force", name: "Аугментация силы (Force Augmentation)", description: "Ваши наносящие урон псионические способности получают бонус +1 к выброшенному урону.", effects: [{ kind: "damage", value: 1, keywords: ["Псионика"] }] },
      { id: "null.augmentation.speed", name: "Аугментация скорости (Speed Augmentation)", description: "Вы получаете бонус +1 к скорости и к расстоянию, на которое вы можете сместиться, когда вы используете Действие отхода.\n\n---", effects: [{ kind: "stat", stat: "speed", value: 1 }, { kind: "stat", stat: "disengage", value: 1 }] },
    ],
  },
  {
    id: "conduit.prayer",
    name: "Молитва",
    className: "Проводник",
    options: [
      { id: "conduit.prayer.destruction", name: "Молитва о разрушении", description: "Ваш бог вселяет гнев в вашу сущность. Вы получаете бонус +1 к выброшенному урону магическими способностями.", effects: [{ kind: "damage", value: 1, keywords: ["Магия"] }] },
      { id: "conduit.prayer.distance", name: "Молитва о дистанции", description: "Ваш бог благословляет вас способностью растягивать свою божественную магию дальше. Вы получаете бонус +2 к расстоянию ваших дальнобойных магических способностей.", effects: [{ kind: "distance", value: 2, keywords: ["Дальний", "Магия"] }] },
      { id: "conduit.prayer.soldier", name: "Молитва о мастерстве солдата", description: "Ваш бог дает вашему разуму выучку солдата. Вы можете эффективно носить легкую броню и владеть легким оружием, даже если у вас нет комплекта. Пока вы носите легкую броню, вы получаете бонус +3 к Выносливости, и этот бонус увеличивается на 3 на 4-м, 7-м и 10-м уровнях. Пока вы владеете легким оружием, вы получаете бонус +1 к урону со способностями оружия, включая свободные удары. Вы можете использовать сокровища легкой брони и сокровища легкого оружия.\n\nЕсли у вас есть комплект, вы не можете принять это благословение.", effects: [], manualReason: manualArmor },
      { id: "conduit.prayer.speed", name: "Молитва о скорости", description: "Ваш бог благословляет вашу плоть и наполняет ее божественной быстротой. Вы получаете бонус +1 к вашей скорости и к расстоянию, на которое вы можете сместиться, когда вы используете Действие отхода.", effects: [{ kind: "stat", stat: "speed", value: 1 }, { kind: "stat", stat: "disengage", value: 1 }] },
      { id: "conduit.prayer.steel", name: "Молитва о стали", description: "Ваш бог наполняет ваше тело светом созидания, делая вас более стойким к урону и перемещению. Вы получаете бонус +6 к Выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях. Дополнительно, вы получаете бонус +1 к устойчивости.\n\n---", effects: [{ kind: "stat", stat: "stamina", value: 0, perEchelon: 6 }, { kind: "stat", stat: "stability", value: 1 }] },
    ],
  },
  {
    id: "conduit.sanctuary",
    name: "Оберег проводника",
    className: "Проводник",
    options: [
      { id: "conduit.sanctuary.bastion", name: "Оберег бастиона", description: "Ваш бог дарует вам святой лик, который защищает вас во все времена. Вы получаете бонус +1 к спасброскам.", effects: [{ kind: "stat", stat: "save", value: 1 }] },
      { id: "conduit.sanctuary.reaction", name: "Оберег реакции", description: "Боги дарят вам божественную реакцию. Всякий раз, когда смежное существо наносит вам урон, вы можете сместиться вплоть до числа клеток, равного показателю вашей Интуиции, после того, как урон был нанесен.", effects: [], manualReason: manualReaction },
      { id: "conduit.sanctuary.refuge", name: "Оберег святилища", description: "В ответ на агрессию врага ваш бог защищает вас. Всякий раз, когда другое существо наносит вам урон, оно не может нацелиться на вас ударом, пока вы не нанесете вред ему или одному из его союзников, или до конца его следующего хода.", effects: [], manualReason: manualReaction },
      { id: "conduit.sanctuary.spirits", name: "Оберег духов", description: "Невидимые духи окружают вас, если вам причиняют вред. Всякий раз, когда смежное существо наносит вам урон, оно получает урон порчей, равный показателю вашей Интуиции.\n\n---", effects: [], manualReason: manualReaction },
    ],
  },
  {
    id: "talent.augmentation",
    name: "Псионическая аугментация",
    className: "Талант",
    options: [
      { id: "talent.augmentation.battle", name: "Боевая аугментация", description: "Вы можете эффективно носить легкую броню и владеть легким оружием, даже если у вас нет комплекта. Пока вы носите легкую броню, вы получаете бонус +3 к выносливости, и этот бонус увеличивается на 3 на 4-м, 7-м и 10-м уровнях. Пока вы владеете легким оружием, вы получаете бонус +1 к урону со способностями оружия, включая свободные удары. Вы можете использовать сокровища легкой брони и сокровища легкого оружия.\n\nЕсли у вас есть комплект, вы не можете взять эту аугментацию.", effects: [], manualReason: manualArmor },
      { id: "talent.augmentation.density", name: "Аугментация плотности", description: "Вы получаете бонус +6 к выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях. Дополнительно, вы получаете бонус +1 к устойчивости.", effects: [{ kind: "stat", stat: "stamina", value: 0, perEchelon: 6 }, { kind: "stat", stat: "stability", value: 1 }] },
      { id: "talent.augmentation.distance", name: "Аугментация дистанции", description: "Ваши дальнобойные псионические способности получают бонус +2 к расстоянию.", effects: [{ kind: "distance", value: 2, keywords: ["Дальний", "Псионика"] }] },
      { id: "talent.augmentation.force", name: "Аугментация силы", description: "Ваши наносящие урон псионические способности получают бонус +1 к выброшенному урону.", effects: [{ kind: "damage", value: 1, keywords: ["Псионика"] }] },
      { id: "talent.augmentation.speed", name: "Аугментация скорости", description: "Вы получаете бонус +1 к вашей скорости и к расстоянию, на которое вы можете сместиться, когда вы используете Действие отхода.\n\n---", effects: [{ kind: "stat", stat: "speed", value: 1 }, { kind: "stat", stat: "disengage", value: 1 }] },
    ],
  },
  {
    id: "talent.sanctuary",
    name: "Оберег таланта",
    className: "Талант",
    options: [
      { id: "talent.sanctuary.entropy", name: "Оберег энтропии", description: "Ваш оберег замедляет время для ваших врагов. Всякий раз, когда существо наносит вам урон, его скорость уменьшается на величину, равную показателю вашего Разума, и оно не может использовать триггеры до конца своего следующего хода.", effects: [], manualReason: manualReaction },
      { id: "talent.sanctuary.repelling", name: "Отталкивающий оберег", description: "Вы окружаете себя невидимым оберегом телекинетической энергии. Всякий раз, когда смежное существо наносит вам урон, вы можете использовать свободный триггер, чтобы совершить его толчок вплоть до числа клеток, равного показателю вашего Разума.", effects: [], manualReason: manualReaction },
      { id: "talent.sanctuary.steel", name: "Стальной оберег", description: "Ваш оберег реагирует на опасность, защищая вас от будущего вреда. Всякий раз, когда вы получаете урон, после разрешения урона вы получаете иммунитет к урону, равный показателю вашего Разума, до конца вашего следующего хода.", effects: [], manualReason: manualSteelWard },
      { id: "talent.sanctuary.vanishing", name: "Исчезающий оберег", description: "Ваш оберег позволяет вам ускользать от угроз. Всякий раз, когда вы получаете урон, вы становитесь невидимым до конца вашего следующего хода.\n\n---", effects: [], manualReason: manualReaction },
    ],
  },
  {
    id: "elementalist.enchantment",
    name: "Зачарование",
    className: "Элементалист",
    options: [
      { id: "elementalist.enchantment.battle", name: "Зачарование битвы", description: "Вы можете эффективно носить легкую броню и владеть легким оружием, даже если у вас нет комплекта. Пока вы носите легкую броню, вы получаете бонус +3 к Выносливости, и этот бонус увеличивается на 3 на 4-м, 7-м и 10-м уровнях. Пока вы владеете легким оружием, вы получаете бонус +1 к урону со способностями оружия, включая свободные удары. Вы можете использовать сокровища легкой брони и сокровища легкого оружия.\n\nЕсли у вас есть комплект, вы не можете взять это зачарование.", effects: [], manualReason: manualArmor },
      { id: "elementalist.enchantment.speed", name: "Зачарование быстроты", description: "Вы получаете бонус +1 к вашей скорости и к расстоянию, на которое вы можете сместиться, когда вы используете Действие отхода.", effects: [{ kind: "stat", stat: "speed", value: 1 }, { kind: "stat", stat: "disengage", value: 1 }] },
      { id: "elementalist.enchantment.destruction", name: "Зачарование разрушения", description: "Вы получаете бонус +1 к выброшенному урону магическими способностями.", effects: [{ kind: "damage", value: 1, keywords: ["Магия"] }] },
      { id: "elementalist.enchantment.distance", name: "Зачарование дистанции", description: "У вас есть бонус +2 к расстоянию ваших дальнобойных магических способностей.", effects: [{ kind: "distance", value: 2, keywords: ["Дальний", "Магия"] }] },
      { id: "elementalist.enchantment.constancy", name: "Зачарование постоянства", description: "Вы получаете бонус +6 к Выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях. Дополнительно, вы получаете бонус +1 к устойчивости.\n\n---", effects: [{ kind: "stat", stat: "stamina", value: 0, perEchelon: 6 }, { kind: "stat", stat: "stability", value: 1 }] },
    ],
  },
  {
    id: "elementalist.sanctuary",
    name: "Оберег элементалиста",
    className: "Элементалист",
    options: [
      { id: "elementalist.sanctuary.delightful", name: "Оберег восхитительных последствий", description: "Защитное поле магии пустоты поглощает насилие, направленное на вас, а затем позволяет вам метнуть его обратно во врагов. В первый раз за раунд, когда вы получаете урон, вы получаете 1 всплеск.", effects: [], manualReason: manualReaction },
      { id: "elementalist.sanctuary.superior", name: "Оберег превосходной защиты", description: "Вы сплетаете щит из всех элементов вокруг себя, направляя их полную защитную силу. У вас есть иммунитет к урону кислотой, холодом, порчей, огнем, молнией, ядом или звуком, равный показателю вашего Разума.", effects: [], manualReason: manualImmunity },
      { id: "elementalist.sanctuary.nature", name: "Оберег привязанности природы", description: "Энергия зелени, извивающаяся внутри вашего тела, позволяет вам создавать мощные лозы, когда вы в опасности. Всякий раз, когда существо в пределах количества клеток, равного показателю вашего Разума, наносит вам урон, вы можете использовать свободный триггер, чтобы совершить швыряние этого существа на количество клеток вплоть до показателя вашего Разума.", effects: [], manualReason: manualReaction },
      { id: "elementalist.sanctuary.reactivity", name: "Оберег удивительной реактивности", description: "Вы используете магию огня для создания оберега взрывной энергии. Всякий раз, когда смежное существо наносит вам урон, вы можете использовать свободный триггер, чтобы совершить толчок этого существа на количество клеток вплоть до двойного показателя вашего Разума.\n\n---", effects: [], manualReason: manualReaction },
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
  return selected;
}
