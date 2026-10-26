import { describe, expect, it } from "vitest";
import {
  CLASS_RESOURCES,
  resourceSpecFor,
} from "../src/data/class-features/class-resources";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
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

describe("resourceGainLabel", () => {
  it("подписывает известные события по-русски, неизвестные — как есть", () => {
    withResource(TEST_RESOURCE, [], () => {
      const gains = resolvedResourceGains(testHero(1));
      expect(
        gains.find((gain) => gain.event === "start-of-turn")!.label,
      ).toBe("Начало твоего хода");
      expect(gains.find((gain) => gain.event === "take-damage")!.label).toBe(
        "Получаешь урон",
      );
      expect(gains.find((gain) => gain.event === "respite")!.label).toBe(
        "Завершаешь отдых",
      );
    });
    expect(resourceGainLabel("winded")).toBe("Становишься при смерти");
    expect(resourceGainLabel("unknown-event" as TriggerEvent)).toBe(
      "unknown-event",
    );
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

  it("без эпической части пул пуст", () => {
    const withoutEpic: HeroicResourceSpec = {
      name: TEST_RESOURCE.name,
      gains: TEST_RESOURCE.gains,
    };
    withResource(withoutEpic, [], () => {
      expect(resolvedEpicResourceGains(testHero(1))).toEqual([]);
    });
  });
});
