import type { HeroicResourceSpec } from "../types";

/**
 * Героический ресурс Цензора — «Гнев».
 *
 * Прибавки взяты из записей скелета «Гнев в бою» (уровень 1), «Гнев за
 * пределами гнева» (4), «Сосредоточенный гнев» (7) и «Гнев богов» (10).
 * Замены прибавок живут в механиках этих фич: они приходят с `replaces` по
 * тегу, поэтому базовые строки ниже не переписываются при росте уровня.
 *
 * Гнев не набирается вне боя, поэтому отрицательных значений у пула нет.
 */
export const CENSOR_RESOURCE: HeroicResourceSpec = {
  name: "Гнев",
  gains: [
    {
      tag: "combat-start",
      event: "combat-start",
      amount: "= Победы",
      frequency: "encounter",
      label: "Начало боевой встречи",
    },
    {
      tag: "start-of-turn",
      event: "start-of-turn",
      amount: "2",
      frequency: "turn",
      label: "Начало твоего хода в бою",
    },
    {
      tag: "damage-judged",
      event: "deal-damage",
      amount: "1",
      frequency: "round",
      label: "Первый раз за раунд: наносишь урон осуждённому",
    },
    {
      tag: "judged-damages-you",
      event: "take-damage",
      amount: "1",
      frequency: "round",
      label: "Первый раз за раунд: осуждённый наносит тебе урон",
    },
  ],
  // Эпический пул 10-го уровня: до него лист его не показывает
  // (`resolvedEpicResourceGains` проверяет `epic.level`).
  epic: {
    name: "Добродетель",
    level: 10,
    gains: [
      {
        tag: "epic-respite",
        event: "respite",
        amount: "= Опыт",
        frequency: "respite",
        label: "Завершаешь отдых",
      },
    ],
  },
};
