import type { FeatureMechanics } from "../types";

/**
 * Четыре оберега Элементалиста. Как и зачарования, записи скелета не имеют
 * `keyedBy`, поэтому выбор включается `when.keyValue` с именем старой опции.
 * Три оберега — реактивные правила: лист напоминает о срабатывании, но
 * состояние цели (всплеск, швыряние, толчок) игрок ведёт вручную.
 */
export const ELEMENTALIST_SANCTUARY_MECHANICS: Record<
  string,
  FeatureMechanics
> = {
  "feature.elementalist.level-1.ward-of-delightful-consequences": {
    kinds: ["trigger"],
    when: { keyValue: ["Оберег восхитительных последствий"] },
    trigger: {
      event: "take-damage",
      frequency: "round",
      label: "Первый раз за раунд: ты получаешь урон",
      detail: "Вы получаете 1 всплеск.",
    },
    notes:
      "Всплеск начисляется вручную: лист не хранит счётчик всплесков. " +
      "Напоминание срабатывает только первый раз за раунд.",
  },
  "feature.elementalist.level-1.ward-of-excellent-protection": {
    kinds: ["bonus", "immunity"],
    when: { keyValue: ["Оберег превосходной защиты"] },
    effects: [
      {
        kind: "damageImmunity",
        types: ["кислота", "холод", "порча", "огонь", "молния", "яд", "звук"],
        value: { characteristic: "reason" },
      },
    ],
    notes:
      "Иммунитет к урону кислотой, холодом, порчей, огнём, молнией, ядом и " +
      "звуком равен показателю Разума. Лист показывает число, но урон не " +
      "уменьшает: применяется вручную.",
  },
  "feature.elementalist.level-1.ward-of-natures-affection": {
    kinds: ["trigger"],
    when: { keyValue: ["Оберег привязанности природы"] },
    trigger: {
      event: "take-damage",
      frequency: "always",
      label: "Существо в пределах Разума наносит тебе урон",
      detail:
        "Вы можете использовать свободный триггер, чтобы совершить швыряние " +
        "этого существа на число клеток вплоть до показателя Разума.",
    },
    notes:
      "Расстояние швыряния и выбор цели применяются вручную: лист не двигает " +
      "существ и не проверяет дистанцию до источника урона.",
  },
  "feature.elementalist.level-1.ward-of-surprising-reactivity": {
    kinds: ["trigger"],
    when: { keyValue: ["Оберег удивительной реактивности"] },
    trigger: {
      event: "adjacent-enemy-damages-you",
      frequency: "always",
      label: "Смежное существо наносит тебе урон",
      detail:
        "Вы можете использовать свободный триггер, чтобы совершить толчок " +
        "этого существа на число клеток вплоть до двойного показателя Разума.",
    },
    notes:
      "Расстояние толчка и выбор цели применяются вручную: лист не двигает " +
      "существ и не проверяет смежность.",
  },
};

/** Среди четырёх оберегов прозаических записей нет. */
export const ELEMENTALIST_SANCTUARY_TEXT_ONLY: Record<string, string> = {};
