import { describe, expect, it } from "vitest";
import {
  CLASS_RESOURCES,
  resourceSpecFor,
} from "../src/data/class-features/class-resources";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { invalidateClassFeatureRegistry } from "../src/lib/class-features";
import type {
  GeneratedClassFeature,
  HeroicResourceSpec,
  ResourceGain,
  TriggerEvent,
} from "../src/data/class-features/types";
import { createCharacter } from "../src/lib/defaults";
import {
  resolvedEpicResourceGains,
  resolvedResourceGains,
  resourceGainLabel,
  resourceGainLabels,
} from "../src/lib/resources";
import { normalizeFeatureText } from "../src/lib/utils";
import type { Character } from "../src/types";

/**
 * Синтетический класс: значения настоящего ресурса Неистового появляются
 * отдельным заходом, и тесты этого файла не должны от них зависеть.
 */
const TEST_CLASS = "Проверочный класс";
const TEST_RESOURCE_NAME = "Проверочный ресурс";
const EPIC_RESOURCE_NAME = "Эпический проверочный ресурс";
const BASE_TAGS = ["start", "take-damage", "respite"];

const TEST_RESOURCE: HeroicResourceSpec = {
  name: TEST_RESOURCE_NAME,
  gains: [
    { tag: "start", event: "start-of-turn", amount: "1d3", frequency: "turn" },
    { tag: "take-damage", event: "take-damage", amount: "1", frequency: "turn" },
    { tag: "respite", event: "respite", amount: "= Мощь", frequency: "respite" },
  ],
  epic: {
    name: EPIC_RESOURCE_NAME,
    // Синтетический пул открывается сразу: проверки уровневого гейта — отдельно.
    level: 1,
    gains: [
      { tag: "epic-start", event: "start-of-turn", amount: "2", frequency: "turn" },
    ],
  },
};

/** Прибавка, которую добавляет фича какого-то уровня. */
interface Upgrade {
  id: string;
  level: number;
  name: string;
  gains: ResourceGain[];
}

const DAMAGE_UPGRADE: Upgrade = {
  id: "test.upgrade.damage",
  level: 4,
  name: "Злее бьёшь",
  gains: [
    {
      tag: "take-damage",
      event: "take-damage",
      amount: "2",
      frequency: "turn",
      replaces: ["take-damage"],
    },
  ],
};

const START_UPGRADE: Upgrade = {
  id: "test.upgrade.start",
  level: 7,
  name: "Злее начинаешь ход",
  gains: [
    {
      tag: "start",
      event: "start-of-turn",
      amount: "1d3 + 1",
      frequency: "turn",
      replaces: ["start"],
    },
  ],
};

const HARD_HIT_UPGRADE: Upgrade = {
  id: "test.upgrade.hard-hit",
  level: 10,
  name: "Злее получаешь урон",
  gains: [
    {
      tag: "take-damage",
      event: "take-damage",
      amount: "3",
      frequency: "turn",
      replaces: ["take-damage"],
    },
  ],
};

/** Герой синтетического класса: настоящие фичи Неистового ему не достаются. */
function testHero(level: number): Character {
  const hero = createCharacter({ className: "Неистовый", level });
  hero.className = TEST_CLASS;
  return hero;
}

/**
 * Временные данные на время одного теста: спецификация ресурса, фичи-апгрейды
 * и их механики. Всё снимается в `finally`, даже если тест упал.
 */
function withResource<T>(
  spec: HeroicResourceSpec | undefined,
  upgrades: Upgrade[],
  run: () => T,
): T {
  const key = normalizeFeatureText(TEST_CLASS);
  const previousSpec = CLASS_RESOURCES[key];
  if (spec) CLASS_RESOURCES[key] = spec;
  else delete CLASS_RESOURCES[key];

  const addedIds: string[] = [];
  for (const upgrade of upgrades) {
    const record: GeneratedClassFeature = {
      id: upgrade.id,
      className: TEST_CLASS,
      level: upgrade.level,
      name: upgrade.name,
      articleId: "test",
      description: "",
    };
    GENERATED_CLASS_FEATURES.push(record);
    addedIds.push(upgrade.id);
    // Механика апгрейда описывает только прибавки, сам ресурс берётся у класса.
    FEATURE_MECHANICS[upgrade.id] = {
      kinds: ["resourceGain"],
      resource: { name: spec?.name ?? "", gains: upgrade.gains },
    };
  }

  invalidateClassFeatureRegistry();
  try {
    return run();
  } finally {
    for (const id of addedIds) {
      for (let index = GENERATED_CLASS_FEATURES.length - 1; index >= 0; index -= 1) {
        if (GENERATED_CLASS_FEATURES[index].id === id) {
          GENERATED_CLASS_FEATURES.splice(index, 1);
        }
      }
      delete FEATURE_MECHANICS[id];
    }
    if (previousSpec) CLASS_RESOURCES[key] = previousSpec;
    else delete CLASS_RESOURCES[key];
    invalidateClassFeatureRegistry();
  }
}

describe("resourceSpecFor", () => {
  it("находит спецификацию по имени класса без учёта регистра и ё", () => {
    withResource(TEST_RESOURCE, [], () => {
      expect(resourceSpecFor("  проверочный КЛАСС ")).toBe(TEST_RESOURCE);
      expect(resourceSpecFor("")).toBeUndefined();
      expect(resourceSpecFor("Неизвестный класс")).toBeUndefined();
    });
  });

  it("у класса без спецификации ресурса прибавок нет", () => {
    const hero = createCharacter({ className: "Тактик" });
    expect(resourceSpecFor(hero.className)).toBeUndefined();
    expect(resolvedResourceGains(hero)).toEqual([]);
  });
});

describe("resolvedResourceGains", () => {
  it("базовые прибавки сохраняют порядок из спецификации", () => {
    withResource(TEST_RESOURCE, [], () => {
      const gains = resolvedResourceGains(testHero(1));
      expect(gains.map((gain) => gain.tag)).toEqual(BASE_TAGS);
      expect(gains.map((gain) => gain.amount)).toEqual(["1d3", "1", "= Мощь"]);
      expect(gains.every((gain) => gain.sourceName === TEST_RESOURCE_NAME)).toBe(
        true,
      );
      expect(gains.every((gain) => gain.sourceId === `class:${normalizeFeatureText(TEST_CLASS)}`)).toBe(
        true,
      );
    });
  });

  it("прибавка 4-го уровня заменяет прибавку за урон, но не начало хода", () => {
    withResource(TEST_RESOURCE, [DAMAGE_UPGRADE], () => {
      const gains = resolvedResourceGains(testHero(4));
      const tags = gains.map((gain) => gain.tag);
      const damage = gains.filter((gain) => gain.tag === "take-damage");
      expect(tags).toContain("start");
      expect(tags).toContain("respite");
      expect(damage).toHaveLength(1);
      expect(damage[0].amount).toBe("2");
      expect(damage[0].sourceId).toBe(DAMAGE_UPGRADE.id);
      expect(damage[0].sourceName).toBe(DAMAGE_UPGRADE.name);
      expect(gains.find((gain) => gain.tag === "start")!.amount).toBe("1d3");
    });
  });

  it("апгрейд выше уровня героя не применяется", () => {
    withResource(TEST_RESOURCE, [DAMAGE_UPGRADE], () => {
      const gains = resolvedResourceGains(testHero(3));
      expect(gains.find((gain) => gain.tag === "take-damage")!.amount).toBe("1");
    });
  });

  it("на 7-м уровне начало хода даёт 1d3 + 1, на 10-м урон — 3", () => {
    withResource(
      TEST_RESOURCE,
      [DAMAGE_UPGRADE, START_UPGRADE, HARD_HIT_UPGRADE],
      () => {
        const level7 = resolvedResourceGains(testHero(7));
        expect(
          level7.find((gain) => gain.event === "start-of-turn")!.amount,
        ).toBe("1d3 + 1");
        expect(level7.find((gain) => gain.tag === "take-damage")!.amount).toBe("2");

        const level10 = resolvedResourceGains(testHero(10));
        expect(level10.find((gain) => gain.tag === "take-damage")!.amount).toBe(
          "3",
        );
        expect(
          level10.find((gain) => gain.event === "start-of-turn")!.amount,
        ).toBe("1d3 + 1");
      },
    );
  });

  it("две замены одного тега не оставляют дублей", () => {
    withResource(TEST_RESOURCE, [DAMAGE_UPGRADE, HARD_HIT_UPGRADE], () => {
      const gains = resolvedResourceGains(testHero(10));
      const damage = gains.filter((gain) => gain.tag === "take-damage");
      expect(damage).toHaveLength(1);
      expect(damage[0].amount).toBe("3");
      expect(damage[0].sourceId).toBe(HARD_HIT_UPGRADE.id);
    });
  });

  it("прибавки одного уровня упорядочены по id фичи", () => {
    const first: Upgrade = {
      id: "test.upgrade.a",
      level: 4,
      name: "Первая",
      gains: [
        { tag: "first", event: "deal-damage", amount: "1", frequency: "turn" },
      ],
    };
    const second: Upgrade = {
      id: "test.upgrade.b",
      level: 4,
      name: "Вторая",
      gains: [{ tag: "second", event: "hit", amount: "1", frequency: "turn" }],
    };
    // Реестр скелета передан в обратном порядке: побеждает id, а не порядок вставки.
    withResource(TEST_RESOURCE, [second, first], () => {
      const tags = resolvedResourceGains(testHero(4)).map((gain) => gain.tag);
      expect(tags.slice(-2)).toEqual(["first", "second"]);
    });
  });

  it("без авторасчёта прибавки всё равно видны", () => {
    withResource(TEST_RESOURCE, [DAMAGE_UPGRADE], () => {
      const hero = testHero(4);
      hero.automation = {
        enabled: false,
        adjustments: {},
        ancestryTraits: [],
      };
      const gains = resolvedResourceGains(hero);
      expect(gains.length).toBeGreaterThan(0);
      expect(gains.find((gain) => gain.tag === "take-damage")!.amount).toBe("2");
    });
  });
});

/**
 * Ожидаемые подписи событий. Термины состояний — как в правилах проекта
 * (`vitalStatus`): «утомлён» — на половине выносливости, «при смерти» —
 * отдельное состояние на нуле. Таблица — контракт для UI: правка формулировки
 * правится здесь же, по одной строке.
 */
const LABELS: [TriggerEvent, string][] = [
  ["start-of-turn", "Начало твоего хода"],
  ["end-of-turn", "Конец твоего хода"],
  ["take-damage", "Получаешь урон"],
  ["deal-damage", "Наносишь урон"],
  ["hit", "Попадаешь по цели"],
  ["crit", "Критический удар"],
  ["miss", "Промахиваешься"],
  ["ally-damaged", "Союзник получает урон"],
  ["adjacent-enemy-damages-you", "Смежный враг наносит тебе урон"],
  ["first-per-round", "Первый раз за раунд"],
  ["winded", "Становишься утомлённым"],
  ["dying", "Становишься при смерти"],
  ["spend-recovery", "Тратишь восстановление"],
  ["enemy-enters", "Враг входит в зону"],
  ["save-failed", "Проваливаешь спасбросок"],
  ["save-succeeded", "Проходишь спасбросок"],
  ["respite", "Завершаешь отдых"],
  ["victory", "Одерживаешь победу"],
  ["use-ability", "Используешь способность"],
  ["form-changed", "Меняешь форму"],
  ["passive", "Постоянно"],
];

describe("resourceGainLabel", () => {
  it.each(LABELS)("%s → «%s»", (event, label) => {
    expect(resourceGainLabel(event)).toBe(label);
  });

  it("неизвестное событие показывается своим кодом", () => {
    expect(resourceGainLabel("unknown-event" as TriggerEvent)).toBe(
      "unknown-event",
    );
  });

  it("прибавки несут те же подписи, что и таблица событий", () => {
    withResource(TEST_RESOURCE, [], () => {
      const expected = new Map(LABELS);
      const gains = resolvedResourceGains(testHero(1));
      expect(gains.length).toBeGreaterThan(0);
      for (const gain of gains) {
        expect(gain.label).toBe(expected.get(gain.event));
      }
    });
  });
});

describe("resolvedEpicResourceGains", () => {
  it("эпический ресурс возвращается отдельным пулом", () => {
    withResource(TEST_RESOURCE, [DAMAGE_UPGRADE], () => {
      const hero = testHero(4);
      expect(resolvedResourceGains(hero).map((gain) => gain.tag)).not.toContain(
        "epic-start",
      );
      const epic = resolvedEpicResourceGains(hero);
      expect(epic.map((gain) => gain.tag)).toEqual(["epic-start"]);
      expect(epic[0].sourceName).toBe(EPIC_RESOURCE_NAME);
    });
  });

  it("эпический пул не смешивается с основным и не применяет его замены", () => {
    // Тег урона есть в обоих пулах: замена 4-го уровня трогает только основной.
    const withCollision: HeroicResourceSpec = {
      ...TEST_RESOURCE,
      epic: {
        name: EPIC_RESOURCE_NAME,
        level: 1,
        gains: [
          {
            tag: "epic-start",
            event: "start-of-turn",
            amount: "2",
            frequency: "turn",
          },
          {
            tag: "take-damage",
            event: "take-damage",
            amount: "5",
            frequency: "turn",
          },
        ],
      },
    };
    withResource(withCollision, [DAMAGE_UPGRADE], () => {
      const hero = testHero(4);
      const main = resolvedResourceGains(hero);
      expect(main.map((gain) => gain.tag)).not.toContain("epic-start");
      expect(main.find((gain) => gain.tag === "take-damage")!.amount).toBe("2");

      const epic = resolvedEpicResourceGains(hero);
      expect(epic.map((gain) => gain.tag)).toEqual(["epic-start", "take-damage"]);
      expect(epic.find((gain) => gain.tag === "take-damage")!.amount).toBe("5");
      expect(epic.every((gain) => gain.sourceId === `class:${normalizeFeatureText(TEST_CLASS)}`)).toBe(true);
    });
  });

  it("эпический пул открывается на 10-м уровне, если уровень не задан", () => {
    const defaultLevel: HeroicResourceSpec = {
      name: TEST_RESOURCE.name,
      gains: TEST_RESOURCE.gains,
      epic: {
        name: EPIC_RESOURCE_NAME,
        gains: [
          { tag: "epic-start", event: "start-of-turn", amount: "2", frequency: "turn" },
        ],
      },
    };
    withResource(defaultLevel, [], () => {
      expect(resolvedEpicResourceGains(testHero(9))).toEqual([]);
      expect(resolvedEpicResourceGains(testHero(10)).map((gain) => gain.tag)).toEqual([
        "epic-start",
      ]);
    });
  });

  it("epic.level задаёт свой уровень открытия пула", () => {
    const early: HeroicResourceSpec = {
      ...TEST_RESOURCE,
      epic: {
        name: EPIC_RESOURCE_NAME,
        level: 4,
        gains: [
          { tag: "epic-start", event: "start-of-turn", amount: "2", frequency: "turn" },
        ],
      },
    };
    withResource(early, [], () => {
      expect(resolvedEpicResourceGains(testHero(3))).toEqual([]);
      expect(resolvedEpicResourceGains(testHero(4)).map((gain) => gain.tag)).toEqual([
        "epic-start",
      ]);
    });
  });

  it("без эпической части пул пуст", () => {
    const withoutEpic: HeroicResourceSpec = {
      name: TEST_RESOURCE.name,
      gains: TEST_RESOURCE.gains,
    };
    withResource(withoutEpic, [], () => {
      expect(resolvedEpicResourceGains(testHero(1))).toEqual([]);
    });
  });

  it("подпись из данных главнее специальной ветки домена Проводника", () => {
    // Запись домена Проводника исторически получает подпись из специальной
    // ветки движка. Если автор задал подпись в данных, выигрывать должна она.
    const id = "conduit.feature.1.blagochestie-i-effekt-domena-solntsa";
    const previousMechanic = FEATURE_MECHANICS[id];
    const previousSpec = CLASS_RESOURCES["проводник"];
    FEATURE_MECHANICS[id] = {
      kinds: ["resource"],
      when: { keyValue: ["Солнце"] },
      resource: {
        name: "Благочестие",
        gains: [
          {
            tag: "labelled",
            event: "use-ability",
            amount: "2",
            frequency: "encounter",
            label: "Данные важнее ветки",
          },
        ],
      },
    };
    CLASS_RESOURCES["проводник"] = { name: "Благочестие", gains: [] };
    invalidateClassFeatureRegistry();
    try {
      const hero = createCharacter({ className: "Проводник", level: 1 });
      hero.automation = {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        classFeatureSelections: { "conduit.domain": "Жизнь, Солнце" },
      };
      expect(
        resourceGainLabels(hero).find((gain) => gain.tag === "labelled")?.label,
      ).toBe("Данные важнее ветки");
    } finally {
      if (previousMechanic) FEATURE_MECHANICS[id] = previousMechanic;
      else delete FEATURE_MECHANICS[id];
      if (previousSpec) CLASS_RESOURCES["проводник"] = previousSpec;
      else delete CLASS_RESOURCES["проводник"];
      invalidateClassFeatureRegistry();
    }
  });
});
