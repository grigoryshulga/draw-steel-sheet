import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import type {
  FeatureEffect,
  FeatureMechanics,
  GeneratedClassFeature,
} from "../src/data/class-features/types";
import { createCharacter } from "../src/lib/defaults";
import { featureConditionMet } from "../src/lib/feature-conditions";
import {
  buildCharacter,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";
import {
  activeClassFeatureEffects,
  activeClassFeatures,
  classFeatureTriggers,
  invalidateClassFeatureRegistry,
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
  invalidateClassFeatureRegistry();
  try {
    return run();
  } finally {
    const index = GENERATED_CLASS_FEATURES.findIndex(
      (feature) => feature.id === id,
    );
    if (index >= 0) GENERATED_CLASS_FEATURES.splice(index, 1);
    delete FEATURE_MECHANICS[id];
    invalidateClassFeatureRegistry();
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
    invalidateClassFeatureRegistry();
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
      invalidateClassFeatureRegistry();
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
    // Временная запись без механики: статичные условия фичи (`mechanics.when`)
    // проверяет отдельный тест, а здесь важно только правило активации.
    withFeature({ keyValue: "2" }, { kinds: ["situational"] }, () => {
      const ids = activeClassFeatures(furyWithAspect("Разоритель")).map(
        (feature) => feature.id,
      );
      expect(ids).toContain(TEST_ID);
    });
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

  it("Неистовый сохраняет фолбэк подкласса и приоритет явного выбора", () => {
    withFeature(
      { keyedBy: "aspect", keyValue: "Берсерк" },
      { kinds: ["bonus"] },
      () => {
        const hero = createCharacter({ className: "Неистовый", level: 2 });
        hero.subclass = "Берсерк";
        expect(activeClassFeatures(hero).map((f) => f.id)).toContain(TEST_ID);
        const explicitHero = furyWithAspect("Разоритель");
        explicitHero.subclass = "Берсерк";
        expect(activeClassFeatures(explicitHero).map((f) => f.id)).not.toContain(TEST_ID);
        expect(
          featureConditionMet(explicitHero, { keyValue: ["Берсерк"] }),
        ).toBe(false);
      },
    );
  });

  it("класс без зарегистрированной группы не фильтрует keyedBy", () => {
    withFeature(
      { className: "Тактик", keyedBy: "aspect", keyValue: "Берсерк" },
      { kinds: ["bonus"] },
      () => {
        expect(activeClassFeatures(createCharacter({ className: "Тактик", level: 1 })).map((f) => f.id)).toContain(TEST_ID);
      },
    );
  });

  it("Проводник не угадывает выборы уровней 1/4/7 из старой пары доменов", () => {
    const hero = buildCharacter({
      ...emptyBuilderDraft(),
      className: "Проводник",
      subclass: "Жизнь, Защита",
      characteristics: startingCharacteristics("Проводник"),
    });
    expect(hero.automation?.classFeatureSelections?.["conduit.domain"]).toBe(
      "Жизнь, Защита",
    );
    const ids = new Set(
      activeClassFeatures({ ...hero, level: 9 }).map((feature) => feature.id),
    );
    expect(ids).not.toContain("feature.conduit.level-1.revitalizing-ritual");
    expect(ids).not.toContain("feature.conduit.level-1.protective-circle");
    expect(ids).not.toContain("feature.conduit.level-4.4th-level-domain-feature.protection");
    expect(ids).not.toContain("feature.conduit.level-7.blessing-of-iron");
    expect(ids).not.toContain("feature.conduit.level-1.sanctified-weapon");
  });

  it("legacy ID молитвы активирует только соответствующую запись скелета после buildCharacter", () => {
    const prayers = [
      ["conduit.prayer.destruction", "Молитва о разрушении", "feature.conduit.level-1.prayer-of-destruction"],
      ["conduit.prayer.distance", "Молитва о дистанции", "feature.conduit.level-1.prayer-of-distance"],
      ["conduit.prayer.soldier", "Молитва о мастерстве солдата", "feature.conduit.level-1.prayer-of-soldiers-skill"],
      ["conduit.prayer.speed", "Молитва о скорости", "feature.conduit.level-1.prayer-of-speed"],
      ["conduit.prayer.steel", "Молитва о стали", "feature.conduit.level-1.prayer-of-steel"],
    ] as const;
    for (const [optionId, name, featureId] of prayers) {
      const hero = buildCharacter({
        ...emptyBuilderDraft(),
        className: "Проводник",
        level: 1,
        featureChoices: { Молитва: name },
        characteristics: startingCharacteristics("Проводник"),
      });
      hero.level = 1;
      expect(hero.automation?.classFeatureSelections?.["conduit.prayer"]).toBe(optionId);
      const active = activeClassFeatures(hero).filter((feature) => feature.id.startsWith("feature.conduit.level-1.prayer-of-"));
      expect(active.map((feature) => feature.id)).toEqual([featureId]);
      hero.automation = { ...hero.automation!, enabled: false };
      expect(activeClassFeatures(hero).filter((feature) => feature.id.startsWith("feature.conduit.level-1.prayer-of-")).map((feature) => feature.id)).toEqual([featureId]);
    }
  });

  it("пустой, неизвестный выбор и выбор на другом классе не активируют молитвы", () => {
    const hero = createCharacter({ className: "Проводник", level: 1 });
    const ids = (selection?: string, className = "Проводник") => activeClassFeatures({
      ...hero,
      className,
      automation: { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: selection === undefined ? {} : { "conduit.prayer": selection } },
    }).filter((feature) => Object.values({
      destruction: "feature.conduit.level-1.prayer-of-destruction",
      distance: "feature.conduit.level-1.prayer-of-distance",
      soldier: "feature.conduit.level-1.prayer-of-soldiers-skill",
      speed: "feature.conduit.level-1.prayer-of-speed",
      steel: "feature.conduit.level-1.prayer-of-steel",
    }).includes(feature.id)).map((feature) => feature.id);
    expect(ids()).toEqual([]);
    expect(ids("conduit.prayer.unknown")).toEqual([]);
    expect(ids("conduit.prayer.distance", "Тактик")).toEqual([]);
  });

  it("старое сохранение не активирует особенности без выбора их уровня", () => {
    const hero = createCharacter({ className: "Проводник", level: 9 });
    hero.subclass = "Жизнь, Защита";
    hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [] };
    const ids = new Set(activeClassFeatures(hero).map((feature) => feature.id));
    expect(ids).not.toContain("feature.conduit.level-1.revitalizing-ritual");
    expect(ids).not.toContain("feature.conduit.level-1.protective-circle");
    expect(ids).not.toContain("feature.conduit.level-1.sanctified-weapon");
  });

  it("явный выбор уровня 1 имеет приоритет над старой парой subclass", () => {
    const hero = createCharacter({ className: "Проводник", level: 1 });
    hero.subclass = "Жизнь";
    hero.automation = {
      enabled: true,
      adjustments: {},
      ancestryTraits: [],
      classFeatureSelections: { "conduit.domain.1": "Защита", "conduit.domain": "Жизнь, Защита" },
    };
    const ids = new Set(activeClassFeatures(hero).map((feature) => feature.id));
    expect(ids).not.toContain("feature.conduit.level-1.revitalizing-ritual");
    expect(ids).toContain("feature.conduit.level-1.protective-circle");
    expect(activeClassFeatures({ ...hero, level: 2 }).some(
      (feature) => feature.id === "feature.conduit.level-1.revitalizing-ritual" && feature.level === 2,
    )).toBe(true);
  });

  it("доменные способности требуют отдельного выбора 2/6/9 уровня", () => {
    for (const [level, name] of [[2, "feature.ability.conduit.level-2.wellspring-of-grace"], [6, "feature.ability.conduit.level-6.revitalizing-grace"], [9, "feature.ability.conduit.level-9.radiance-of-grace"]] as const) {
      const hero = createCharacter({ className: "Проводник", level });
      hero.subclass = "Жизнь, Защита";
      expect(activeClassFeatures(hero).some((feature) => feature.id === name)).toBe(false);
      const selected = { ...hero, automation: { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { [`conduit.ability.domain.${level}`]: "Жизнь" } } };
      expect(activeClassFeatures(selected).some((feature) => feature.id === name)).toBe(true);
    }
  });

  it("доменные выборы и автоматические комплементы работают на уровнях 1–10", () => {
    const hero = createCharacter({ className: "Проводник", level: 10 });
    hero.automation = {
      enabled: false,
      adjustments: {},
      ancestryTraits: [],
      classFeatureSelections: {
        "conduit.domain": "Жизнь, Защита",
        "conduit.domain.1": "Жизнь",
        "conduit.domain.4": "Защита",
        "conduit.domain.7": "Жизнь",
        "conduit.ability.domain.2": "Защита",
        "conduit.ability.domain.6": "Жизнь",
        "conduit.ability.domain.9": "Защита",
      },
    };
    const expected = new Map([
      [1, ["Жизнь"]], [2, ["Защита"]], [3, []], [4, ["Защита"]],
      [5, ["Жизнь"]], [6, []], [7, ["Жизнь"]], [8, ["Защита"]], [9, []], [10, []],
    ]);
    for (let level = 1; level <= 10; level += 1) {
      const atLevel = activeClassFeatures({ ...hero, level });
      const domainFeatures = atLevel.filter((feature) => feature.keyedBy === "domain" && !feature.id.startsWith("feature.ability.") && feature.level === level);
      expect(domainFeatures.map((feature) => feature.level), `level ${level}`).toEqual(
        (expected.get(level) ?? []).map(() => level),
      );
      expect(domainFeatures.map((feature) => feature.keyValue), `level ${level}`).toEqual(expected.get(level));
      const abilityIds = atLevel.filter((feature) => feature.keyedBy === "domain" && feature.id.startsWith(`feature.ability.conduit.level-${level}.`));
      if ([2, 6, 9].includes(level)) expect(abilityIds.length, `ability level ${level}`).toBe(1);
    }
  });

  it("не активирует домены и способности без выбора, вне пары или с некорректной парой", () => {
    const hero = createCharacter({ className: "Проводник", level: 9 });
    const ids = (selections: Record<string, string>, subclass = "Жизнь, Защита") => {
      const character = { ...hero, subclass, automation: { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: selections } };
      return activeClassFeatures(character).map((feature) => feature.id).filter((id) => /^conduit\.domain\./.test(id));
    };
    expect(ids({})).toEqual([]);
    expect(ids({ "conduit.domain": "Жизнь, Жизнь", "conduit.domain.1": "Жизнь" })).toEqual([]);
    expect(ids({ "conduit.domain.1": "Смерть", "conduit.ability.domain.2": "Смерть" })).toEqual([]);
    expect(ids({ "conduit.domain": "Жизнь, Защита", "conduit.domain.1": "Жизнь, Защита" })).toEqual([]);
  });

  it("условия распознают оба домена из старого листа и явного выбора", () => {
    const condition = { keyValue: ["Жизнь", "Защита"] };
    const oldSheet = createCharacter({ className: "Проводник" });
    oldSheet.subclass = "Жизнь, Защита";
    expect(featureConditionMet(oldSheet, condition)).toBe(true);

    const explicit = createCharacter({ className: "Проводник" });
    explicit.automation = {
      enabled: true,
      adjustments: {},
      ancestryTraits: [],
      classFeatureSelections: { "conduit.domain": "Жизнь, Защита" },
    };
    expect(featureConditionMet(explicit, condition)).toBe(true);
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
    expect(idsFor("Разоритель")).toContain("feature.fury.level-1.kit");
    expect(idsFor("Берсерк")).toContain("feature.fury.level-1.kit");
    expect(idsFor("Буревестник")).not.toContain("feature.fury.level-1.kit");
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
        feature.id === "feature.fury.level-1.1st-level-aspect-features",
    );
    expect(plain).toBeDefined();
    expect(plain?.mechanics).toBeUndefined();
    expect(
      activeClassFeatureEffects(hero).some(
        (source) =>
          source.sourceId ===
          "feature.fury.level-1.1st-level-aspect-features",
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
