import type { FeatureMechanics } from "../types";

/**
 * Пять элементальных зачарований. В скелете у записей нет `keyedBy`, поэтому
 * выбор включается условием `when.keyValue` с русским именем старой опции:
 * билдер и панель листа пишут прежние ID (`elementalist.enchantment.distance`
 * и т. д.), а таблица названий разворачивает их в имя. Числа перенесены из
 * старого реестра один в один — эффекты опций удалены, чтобы не было двойного
 * вклада.
 */
export const ELEMENTALIST_ENCHANTMENT_MECHANICS: Record<
  string,
  FeatureMechanics
> = {
  "elementalist.feature.1.zacharovanie-bitvy": {
    kinds: ["bonus", "proficiency"],
    when: { keyValue: ["Зачарование битвы"] },
    effects: [
      {
        kind: "field",
        field: "stamina",
        value: 0,
        perEchelon: 3,
        when: { equipment: { lightArmor: true }, noKit: true },
      },
      {
        kind: "field",
        field: "rolledDamage",
        value: 1,
        filter: { keywords: ["Оружие"] },
        rolledOnly: false,
        when: { equipment: { lightWeapon: true }, noKit: true },
      },
      {
        kind: "proficiency",
        armor: ["light"],
        weapons: ["light"],
        treasures: true,
      },
    ],
    notes:
      "Герой может эффективно носить лёгкую броню и владеть лёгким оружием без " +
      "комплекта и использовать их сокровища. Пока вы носите лёгкую броню, вы " +
      "получаете +3 Выносливости за эшелон. Пока вы владеете лёгким оружием, " +
      "вы получаете +1 к выброшенному урону оружейных способностей, включая " +
      "свободные удары. Условия независимы: броня даёт выносливость, оружие — " +
      "урон. С любым комплектом это зачарование взять нельзя.",
  },
  "elementalist.feature.1.zacharovanie-bystroty": {
    kinds: ["bonus"],
    when: { keyValue: ["Зачарование быстроты"] },
    effects: [
      { kind: "field", field: "speed", value: 1 },
      { kind: "field", field: "disengage", value: 1 },
    ],
    notes:
      "Скорость +1 и +1 к расстоянию отхода. Оба числа не растут по эшелонам.",
  },
  "elementalist.feature.1.zacharovanie-razrusheniya": {
    kinds: ["bonus"],
    when: { keyValue: ["Зачарование разрушения"] },
    effects: [
      {
        kind: "field",
        field: "rolledDamage",
        value: 1,
        filter: { keywords: ["Магия"] },
      },
    ],
    notes:
      "Наносящие урон магические способности получают +1 к выброшенному урону. " +
      "Бонус не применяется к способности без броска силы с числовым уроном: " +
      "так же считает и остальной лист.",
  },
  "elementalist.feature.1.zacharovanie-distantsii": {
    kinds: ["bonus"],
    when: { keyValue: ["Зачарование дистанции"] },
    effects: [
      {
        kind: "field",
        field: "distance",
        value: 2,
        filter: { keywords: ["Дальний", "Магия"] },
      },
    ],
    notes:
      "Дальнобойные магические способности получают +2 к расстоянию. Фильтр " +
      "требует оба ключевых слова, как в книге.",
  },
  "elementalist.feature.1.zacharovanie-postoyanstva": {
    kinds: ["bonus"],
    when: { keyValue: ["Зачарование постоянства"] },
    effects: [
      { kind: "field", field: "stamina", value: 0, perEchelon: 6 },
      { kind: "field", field: "stability", value: 1 },
    ],
    notes:
      "Выносливость +6 и ещё +6 на 4/7/10 уровнях; устойчивость +1. Числа " +
      "перенесены из старой опции без изменений.",
  },
};

/** Среди пяти зачарований прозаических записей нет. */
export const ELEMENTALIST_ENCHANTMENT_TEXT_ONLY: Record<string, string> = {};
