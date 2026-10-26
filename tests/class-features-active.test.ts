import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import type {
  FeatureEffect,
  FeatureMechanics,
  GeneratedClassFeature,
} from "../src/data/class-features/types";
import { createCharacter } from "../src/lib/defaults";
import {
  activeClassFeatureEffects,
  activeClassFeatures,
  classFeatureTriggers,
} from "../src/lib/class-features";
import {
  effectiveCharacteristics,
  featureFieldBonus,
} from "../src/lib/feature-modifiers";
import type { Character } from "../src/types";

/** Герой Неистового нужного уровня без выбранного аспекта. */
function fury(level = 2): Character {
  return createCharacter({ className: "Неистовый", level });
}

/** Герой Неистового с выбранным аспектом в `automation.classFeatureSelections`. */
function furyWithAspect(aspect: string, level = 2): Character {
  const hero = fury(level);
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: { "fury.aspect": aspect },
  };
  return hero;
}

const TEST_ID = "fury.feature.1.test-feature";

/** Временная запись реестра: снимается в `finally`, даже если тест упал. */
function withFeature<T>(
  record: Partial<GeneratedClassFeature>,
  mechanics: FeatureMechanics,
  run: () => T,
): T {
  const id = record.id ?? TEST_ID;
  GENERATED_CLASS_FEATURES.push({
    id,
    className: "Неистовый",
    level: 1,
    name: "Тестовая фича",
    articleId: "test",
    description: "",
    ...record,
  });
  FEATURE_MECHANICS[id] = mechanics;
  try {
    return run();
  } finally {
    const index = GENERATED_CLASS_FEATURES.findIndex(
      (feature) => feature.id === id,
    );
    if (index >= 0) GENERATED_CLASS_FEATURES.splice(index, 1);
    delete FEATURE_MECHANICS[id];
  }
}

function namesOf(hero: Character): string[] {
  return activeClassFeatures(hero).map((feature) => feature.name);
}

describe("activeClassFeatures", () => {
  it("фича аспекта видна только выбранному аспекту", () => {
    const berserker = furyWithAspect("Берсерк");
    expect(activeClassFeatures(berserker).map((f) => f.name)).toContain(
      "Непреодолимая сила",
    );
    expect(activeClassFeatures(berserker).map((f) => f.name)).not.toContain(
      "Зуб и коготь",
    );
  });

  it("фича уровня выше героя не активна", () => {
    const hero = { ...furyWithAspect("Берсерк"), level: 1 };
    expect(activeClassFeatures(hero).some((f) => f.level === 2)).toBe(false);
  });

  it("одноимённая фича на двух уровнях учитывается один раз", () => {
    const id = "fury.feature.1.duplicate";
    const duplicate: GeneratedClassFeature = {
      id,
      className: "Неистовый",
      level: 2,
      name: "Тестовая фича",
      articleId: "test",
      description: "",
    };
    GENERATED_CLASS_FEATURES.push({ ...duplicate, level: 1 }, duplicate);
    try {
      const same = activeClassFeatures(fury(2)).filter((f) => f.id === id);
      expect(same).toHaveLength(1);
      // Побеждает первая запись реестра.
      expect(same[0].level).toBe(1);
    } finally {
      for (let index = GENERATED_CLASS_FEATURES.length - 1; index >= 0; index -= 1) {
        if (GENERATED_CLASS_FEATURES[index].id === id) {
          GENERATED_CLASS_FEATURES.splice(index, 1);
        }
      }
    }
  });

  it("фича другого класса не активна", () => {
    const hero = furyWithAspect("Берсерк", 3);
    hero.className = "Талант";
    expect(
      activeClassFeatures(hero).every((f) => f.className === "Талант"),
    ).toBe(true);
    expect(namesOf(hero)).not.toContain("Непреодолимая сила");
  });

  it("без выбранного аспекта вложенные фичи аспекта не активны", () => {
    expect(namesOf(fury(2))).not.toContain("Непреодолимая сила");
  });

  it("фича без keyedBy и с числовым keyValue активна по уровню", () => {
    // Пороговые строки таблиц разбираются без группы выбора: keyValue — число.
    const ids = activeClassFeatures(furyWithAspect("Разоритель")).map((f) => f.id);
    expect(ids).toContain("fury.feature.1.rastushchaya-svirepost-berserka-2");
  });

  it("фича с keyedBy без совпадения по выбору не активна, с совпадением — активна", () => {
    withFeature(
      { keyedBy: "aspect", keyValue: "Берсерк" },
      { kinds: ["bonus"] },
      () => {
        expect(activeClassFeatures(furyWithAspect("Разоритель")).map((f) => f.id)).not.toContain(
          TEST_ID,
        );
        expect(activeClassFeatures(furyWithAspect("Берсерк")).map((f) => f.id)).toContain(
          TEST_ID,
        );
      },
    );
    expect(activeClassFeatures(furyWithAspect("Берсерк")).map((f) => f.id)).not.toContain(
      TEST_ID,
    );
  });

  it("выбор по названию аспекта сравнивается без учёта регистра, пробелов и ё/е", () => {
    withFeature(
      { keyedBy: "aspect", keyValue: "Берсерк" },
      { kinds: ["bonus"] },
      () => {
        expect(
          activeClassFeatures(furyWithAspect("  БЕРСЕРК ")).map((f) => f.id),
        ).toContain(TEST_ID);
      },
    );
  });

  it("выбор под ключом, которого нет в таблице групп, фичу не активирует", () => {
    withFeature(
      { keyedBy: "aspect", keyValue: "Берсерк" },
      { kinds: ["bonus"] },
      () => {
        const hero = fury(2);
        // Ключ группы не угадывается по слагу: приложение пишет `fury.aspect`.
        hero.automation = {
          enabled: true,
          adjustments: {},
          ancestryTraits: [],
          classFeatureSelections: { aspect: "Берсерк" },
        };
        expect(activeClassFeatures(hero).map((f) => f.id)).not.toContain(TEST_ID);
      },
    );
  });

  it("для класса без соответствия групп фича активна только по уровню", () => {
    withFeature(
      {
        id: "conduit.feature.3.test-domain",
        className: "Проводник",
        level: 3,
        keyedBy: "domain",
        keyValue: "Молитва о разрушении",
      },
      { kinds: ["bonus"] },
      () => {
        const hero = createCharacter({ className: "Проводник", level: 3 });
        // Старый реестр кладёт сюда `conduit.prayer`, а соответствия для
        // Проводника в таблице нет — выборы не читаются вовсе.
        hero.automation = {
          enabled: true,
          adjustments: {},
          ancestryTraits: [],
          classFeatureSelections: { "conduit.prayer": "conduit.prayer.destruction" },
        };
        expect(activeClassFeatures(hero).map((f) => f.id)).toContain(
          "conduit.feature.3.test-domain",
        );

        const withoutAutomation = createCharacter({
          className: "Проводник",
          level: 3,
        });
        expect(activeClassFeatures(withoutAutomation).map((f) => f.id)).toContain(
          "conduit.feature.3.test-domain",
        );
      },
    );
  });

  it("вложенная запись активна без родителя в реестре", () => {
    withFeature(
      { parentId: "fury.feature.1.missing-parent", name: "Вложенная фича" },
      { kinds: ["text"] },
      () => {
        expect(activeClassFeatures(fury()).map((f) => f.id)).toContain(TEST_ID);
      },
    );
  });

  it("keyValue со списком вариантов подходит любому из выбранных", () => {
    const idsFor = (aspect: string) =>
      activeClassFeatures(furyWithAspect(aspect)).map((f) => f.id);
    // В книге «Комплект» записан как «Берсерк, Разоритель».
    expect(idsFor("Разоритель")).toContain("fury.aspect.1.komplekt");
    expect(idsFor("Берсерк")).toContain("fury.aspect.1.komplekt");
    expect(idsFor("Буревестник")).not.toContain("fury.aspect.1.komplekt");
  });

  it("список активных фич не зависит от automation.enabled", () => {
    const disabled = furyWithAspect("Берсерк");
    disabled.automation = { ...disabled.automation!, enabled: false };
    expect(namesOf(disabled)).toContain("Непреодолимая сила");
  });

  it("фича без механики попадает в список и не даёт эффектов", () => {
    const hero = furyWithAspect("Берсерк", 3);
    // У Неистового все записи разобраны: полностью прозаические (заголовки таблиц
    // выдачи) лежат в TEXT_ONLY и механики не имеют.
    const plain = activeClassFeatures(hero).find(
      (feature) =>
        feature.id === "fury.feature.1.osobennosti-aspekta-1-go-urovnya",
    );
    expect(plain).toBeDefined();
    expect(plain?.mechanics).toBeUndefined();
    expect(
      activeClassFeatureEffects(hero).some(
        (source) =>
          source.sourceId ===
          "fury.feature.1.osobennosti-aspekta-1-go-urovnya",
      ),
    ).toBe(false);
  });

  it("сортирует по уровню, затем по id", () => {
    const features = activeClassFeatures(furyWithAspect("Берсерк", 6));
    const levels = features.map((feature) => feature.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    for (let index = 1; index < features.length; index += 1) {
      const previous = features[index - 1];
      const current = features[index];
      if (previous.level !== current.level) continue;
      expect(previous.id < current.id).toBe(true);
    }
  });
});

describe("classFeatureTriggers", () => {
  it("отдаёт триггер механики активной фичи с событием, частотой и подписями", () => {
    withFeature(
      {},
      {
        kinds: ["trigger"],
        trigger: {
          event: "take-damage",
          frequency: "round",
          label: "Разворот гнева",
          detail: "Получив урон, получите 1 свирепость.",
        },
      },
      () => {
        const triggers = classFeatureTriggers(fury());
        expect(triggers).toHaveLength(1);
        expect(triggers[0]).toEqual({
          featureId: TEST_ID,
          name: "Тестовая фича",
          level: 1,
          event: "take-damage",
          frequency: "round",
          label: "Разворот гнева",
          detail: "Получив урон, получите 1 свирепость.",
        });
      },
    );
    expect(classFeatureTriggers(fury())).toEqual([]);
  });

  it("при выключенном авторасчёте триггеры не теряются", () => {
    withFeature(
      {},
      {
        kinds: ["trigger"],
        trigger: {
          event: "take-damage",
          frequency: "round",
          label: "Разворот гнева",
          detail: "Получив урон, получите 1 свирепость.",
        },
      },
      () => {
        const hero = fury();
        hero.automation = { enabled: false, adjustments: {}, ancestryTraits: [] };
        expect(classFeatureTriggers(hero)).toHaveLength(1);
      },
    );
  });

  it("не выводит триггеры фич выше уровня героя", () => {
    withFeature(
      { level: 5 },
      {
        kinds: ["trigger"],
        trigger: {
          event: "start-of-turn",
          frequency: "turn",
          label: "Ярость",
          detail: "В начале хода.",
        },
      },
      () => {
        expect(classFeatureTriggers(fury(4))).toEqual([]);
        expect(classFeatureTriggers(fury(5))).toHaveLength(1);
      },
    );
  });
});

describe("эффекты классовых фич в движке", () => {
  const EFFECTS: FeatureEffect[] = [
    { kind: "field", field: "stamina", value: 2 },
  ];

  it("временная запись реестра даёт бонус через activeClassFeatures → featureFieldBonus", () => {
    withFeature({}, { kinds: ["bonus"], effects: EFFECTS }, () => {
      const hero = fury();
      hero.automation = {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
      };
      expect(
        activeClassFeatureEffects(hero).find((source) => source.sourceId === TEST_ID),
      ).toEqual({ sourceId: TEST_ID, sourceName: "Тестовая фича", effects: EFFECTS });
      expect(featureFieldBonus(hero, "stamina")).toBe(2);

      const disabled = { ...hero, automation: { ...hero.automation!, enabled: false } };
      expect(featureFieldBonus(disabled, "stamina")).toBe(0);
    });
    expect(featureFieldBonus(fury(), "stamina")).toBe(0);
  });

  it("бонус характеристики из реестра меняет эффективные характеристики и снимается без авторасчёта", () => {
    withFeature(
      {},
      {
        kinds: ["characteristic"],
        effects: [{ kind: "characteristic", key: "presence", value: 2 }],
      },
      () => {
        const hero = createCharacter({ className: "Неистовый" });
        hero.characteristics.presence = 1;
        hero.automation = {
          enabled: true,
          adjustments: {},
          ancestryTraits: [],
        };
        expect(effectiveCharacteristics(hero).presence).toBe(3);
        hero.automation = { ...hero.automation, enabled: false };
        expect(effectiveCharacteristics(hero).presence).toBe(1);
      },
    );
  });
});
