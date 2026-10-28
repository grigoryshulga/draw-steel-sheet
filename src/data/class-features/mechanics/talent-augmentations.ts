import type { FeatureMechanics } from "../types";

/**
 * Пять псионических аугментаций Таланта. В скелете у записей нет `keyedBy`,
 * поэтому выбор активируется условием `when.keyValue` с русским именем
 * старой опции: `classFeatureSelectionsFromDraft` пишет прежние ID
 * (`talent.augmentation.density` и т. д.), а `selectedKeyValues` разворачивает
 * их в имя. Числа совпадают со старым реестром один в один — эффекты из
 * `class-feature-rules.ts` удалены, чтобы не было двойного вклада.
 */
export const TALENT_AUGMENTATION_MECHANICS: Record<string, FeatureMechanics> = {
  "talent.feature.1.boevaya-augmentatsiya": {
    kinds: ["bonus", "proficiency"],
    when: { keyValue: ["Боевая аугментация"] },
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
      { kind: "proficiency", armor: ["light"], weapons: ["light"], treasures: true },
    ],
    notes:
      "Герой может эффективно носить лёгкую броню и владеть лёгким оружием без " +
      "комплекта и использовать их сокровища. Пока вы носите лёгкую броню, вы " +
      "получаете +3 Выносливости за эшелон. Пока вы владеете лёгким оружием, " +
      "вы получаете +1 к выброшенному урону оружейных способностей, включая " +
      "свободные удары. Условия независимы: броня даёт выносливость, оружие — " +
      "урон. С любым комплектом эту аугментацию взять нельзя.",
  },
  "talent.feature.1.augmentatsiya-plotnosti": {
    kinds: ["bonus"],
    when: { keyValue: ["Аугментация плотности"] },
    effects: [
      { kind: "field", field: "stamina", value: 0, perEchelon: 6 },
      { kind: "field", field: "stability", value: 1 },
    ],
    notes:
      "Выносливость +6 и ещё +6 на 4/7/10 уровнях; устойчивость +1. Числа " +
      "перенесены из старой опции без изменений.",
  },
  "talent.feature.1.augmentatsiya-distantsii": {
    kinds: ["bonus"],
    when: { keyValue: ["Аугментация дистанции"] },
    effects: [
      {
        kind: "field",
        field: "distance",
        value: 2,
        filter: { keywords: ["Дальний", "Псионика"] },
      },
    ],
    notes:
      "Дальнобойные псионические способности получают +2 к расстоянию. " +
      "Фильтр требует оба ключевых слова, как в книге.",
  },
  "talent.feature.1.augmentatsiya-sily": {
    kinds: ["bonus"],
    when: { keyValue: ["Аугментация силы"] },
    effects: [
      {
        kind: "field",
        field: "rolledDamage",
        value: 1,
        filter: { keywords: ["Псионика"] },
      },
    ],
    notes:
      "Наносящие урон псионические способности получают +1 к выброшенному " +
      "урону. Бонус не применяется к способности без броска силы с числовым " +
      "уроном: так же считает и остальной лист.",
  },
  "talent.feature.1.augmentatsiya-skorosti": {
    kinds: ["bonus"],
    when: { keyValue: ["Аугментация скорости"] },
    effects: [
      { kind: "field", field: "speed", value: 1 },
      { kind: "field", field: "disengage", value: 1 },
    ],
    notes:
      "Скорость +1 и +1 к расстоянию отхода. Оба числа не растут по эшелонам.",
  },
};

/** Среди пяти аугментаций прозаических записей нет. */
export const TALENT_AUGMENTATION_TEXT_ONLY: Record<string, string> = {};
