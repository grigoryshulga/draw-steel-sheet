import type { FeatureMechanics } from "../types";

/**
 * Три псионические аугментации Нуля. В скелете у записей нет разметки по
 * группе выбора, поэтому выбор активируется условием с русским именем старой
 * опции: билдер пишет прежние ID (`null.augmentation.density` и т. д.), а
 * движок разворачивает их в имя. Числа совпадают со старым реестром один в
 * один — эффекты из `class-feature-rules.ts` удалены, чтобы не было двойного
 * вклада.
 *
 * Контейнер остаётся точкой выбора старого листа: ID и русские подписи
 * прежние, числа живут во вложенных записях. Сменить аугментацию можно
 * псионической медитацией как деятельностью отдыха.
 */
export const NULL_AUGMENTATION_MECHANICS: Record<string, FeatureMechanics> = {
  "null.feature.1.psionicheskaya-augmentatsiya": {
    kinds: ["choice", "grant"],
    choice: {
      group: "null.augmentation",
      label: "Псионическая аугментация",
      options: [
        {
          id: "null.augmentation.density",
          label: "Аугментация плотности (Density Augmentation)",
        },
        {
          id: "null.augmentation.force",
          label: "Аугментация силы (Force Augmentation)",
        },
        {
          id: "null.augmentation.speed",
          label: "Аугментация скорости (Speed Augmentation)",
        },
      ],
    },
    notes:
      "Выбирается ровно одна аугментация; сменить её можно псионической " +
      "медитацией как деятельностью отдыха. Числа уже учитываются в расчётах " +
      "вложенных особенностей, а сохранённые выборы прежних листов " +
      "продолжают работать. Быстрый билд: Аугментация скорости.",
  },
  "null.feature.1.augmentatsiya-plotnosti-density-augmentation": {
    kinds: ["bonus"],
    when: { keyValue: ["Аугментация плотности (Density Augmentation)"] },
    effects: [
      { kind: "field", field: "stamina", value: 0, perEchelon: 6 },
      { kind: "field", field: "stability", value: 1 },
    ],
    notes:
      "Выносливость +6 и ещё +6 на 4/7/10 уровнях; устойчивость +1. Книга " +
      "описывает рост как «+6, увеличивается на 6 на 4/7/10 уровнях»; число " +
      "считается по эшелону так же, как у родственных аугментаций. Числа " +
      "перенесены из старой опции без изменений.",
  },
  "null.feature.1.augmentatsiya-sily-force-augmentation": {
    kinds: ["bonus"],
    when: { keyValue: ["Аугментация силы (Force Augmentation)"] },
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
  "null.feature.1.augmentatsiya-skorosti-speed-augmentation": {
    kinds: ["bonus"],
    when: { keyValue: ["Аугментация скорости (Speed Augmentation)"] },
    effects: [
      { kind: "field", field: "speed", value: 1 },
      { kind: "field", field: "disengage", value: 1 },
    ],
    notes:
      "Скорость +1 и +1 к расстоянию отхода. Оба числа не растут по эшелонам.",
  },
};

/** Среди трёх аугментаций прозаических записей нет. */
export const NULL_AUGMENTATION_TEXT_ONLY: Record<string, string> = {};
