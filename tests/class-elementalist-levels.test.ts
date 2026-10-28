import { describe, expect, it } from "vitest";
import {
  NOT_YET,
  TEXT_ONLY,
  mechanicsFor,
} from "../src/data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { activeClassFeatures } from "../src/lib/class-features";
import {
  classFeatureGiftsAtLevel,
  classFeatureGroupsForSheet,
} from "../src/lib/class-feature-view";
import { createCharacter } from "../src/lib/defaults";
import {
  featureAbilityDamageContributions,
  featureDamageImmunities,
  featureStatContributions,
} from "../src/lib/feature-modifiers";
import {
  getLevelUpPlan,
  previewLevelUp,
  type LevelUpPreview,
  type LevelUpRequest,
} from "../src/lib/level-up";
import {
  resolvedEpicResourceGains,
  resolvedResourceGains,
} from "../src/lib/resources";
import type { Ability, Character } from "../src/types";

/** Элементалист с выбранными опциями; значения — как их пишет билдер. */
function elementalist(
  level = 1,
  selections: Record<string, string> = {},
  overrides: Partial<Character> = {},
): Character {
  const hero = createCharacter({ className: "Элементалист", level });
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: selections,
  };
  return { ...hero, ...overrides };
}

function ability(
  keywords: string[],
  overrides: Partial<Ability> = {},
): Ability {
  return {
    id: `test-${keywords.join("-")}`,
    name: "Тестовая способность",
    flavor: "",
    actionType: "main",
    kind: "signature",
    keywords,
    distance: "Дальний 10",
    target: "Одно существо",
    rollCharacteristics: ["reason"],
    preferredCharacteristic: "reason",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "3 + Р", effect: "" },
      { damage: "5 + Р", effect: "" },
      { damage: "7 + Р", effect: "" },
    ],
    effect: "",
    source: "",
    notes: "",
    ...overrides,
  };
}

const fireAbility = () => ability(["Огонь", "Магия"]);
const magicAbility = () => ability(["Магия"]);
const weaponAbility = () => ability(["Оружие"]);

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

function sheetItems(hero: Character) {
  return classFeatureGroupsForSheet(hero).flatMap((group) => group.features);
}

const ELEMENTALIST_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Элементалист",
);
const STAGE_TWO = ELEMENTALIST_FEATURES.filter(
  (feature) => feature.level >= 5,
);

const ABILITY_CHOICES = [
  "elementalist.feature.5.sposobnost-za-9-essentsii",
  "elementalist.feature.6.novaya-sposobnost-za-9-essentsii",
  "elementalist.feature.8.sposobnost-za-11-essentsii",
  "elementalist.feature.9.novaya-sposobnost-za-11-essentsii",
];

const SPECIALIZATION_LATE = {
  5: {
    Земля: "elementalist.specialization.5.gora-ne-sdvinetsya",
    Огонь: "elementalist.specialization.5.tleyushchiy-shag",
    Зелень: "elementalist.specialization.5.shkura-desyatikratnykh-shchitov",
    Пустота: "elementalist.specialization.5.probit-zavesu-materii",
  },
  8: {
    Земля: "elementalist.specialization.8.prizyv-istochnika-zemli",
    Огонь: "elementalist.specialization.8.pervozdannoe-plamya",
    Зелень: "elementalist.specialization.8.khimericheskoe-proyavlenie",
    Пустота: "elementalist.specialization.8.zvezda-chernoy-dyry",
  },
  10: {
    Земля: "elementalist.specialization.10.master-zemli",
    Огонь: "elementalist.specialization.10.master-ognya",
    Зелень: "elementalist.specialization.10.master-zeleni",
    Пустота: "elementalist.specialization.10.master-pustoty",
  },
} as const;

const ALL_SPECIALIZATION_IDS = Object.values(SPECIALIZATION_LATE).flatMap(
  (bySubclass) => Object.values(bySubclass),
);

describe("Элементалист: production-покрытие уровней 5–10", () => {
  it("все 91 запись покрыты, NOT_YET без Элементалиста", () => {
    expect(ELEMENTALIST_FEATURES).toHaveLength(91);
    expect(STAGE_TWO).toHaveLength(32);
    expect(NOT_YET["Элементалист"]).toBeUndefined();

    const missing = ELEMENTALIST_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id) && !TEXT_ONLY[feature.id],
    );
    expect(
      missing.map((feature) => `${feature.name} (ур. ${feature.level})`),
    ).toEqual([]);

    expect(
      ELEMENTALIST_FEATURES.filter((feature) => mechanicsFor(feature.id)),
    ).toHaveLength(83);
  });

  it("прозаических записей ровно пять: перки 6/8/10 и навыки 7/10", () => {
    const textOnlyIds = STAGE_TWO.filter(
      (feature) => !mechanicsFor(feature.id),
    ).map((feature) => feature.id);
    expect(textOnlyIds.sort()).toEqual(
      [
        "elementalist.feature.10.navyk",
        "elementalist.feature.10.perk",
        "elementalist.feature.6.perk",
        "elementalist.feature.7.navyk",
        "elementalist.feature.8.perk",
      ].sort(),
    );
    expect(
      textOnlyIds.every((id) => (TEXT_ONLY[id] ?? "").trim().length > 10),
    ).toBe(true);
  });

  it("механика без чисел, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = STAGE_TWO.map((feature) => ({
      feature,
      mechanics: mechanicsFor(feature.id),
    })).filter(({ mechanics }) => {
      if (!mechanics) return false;
      if (
        mechanics.effects?.length ||
        mechanics.trigger ||
        mechanics.choice ||
        mechanics.resource
      ) {
        return false;
      }
      return !mechanics.notes?.trim();
    });
    expect(silent.map(({ feature }) => feature.name)).toEqual([]);
  });
});

describe("Элементалист: Эссенция на уровнях 5–10", () => {
  it("5/6 — 2 эссенции, 7/8/9 — 3, 10 — 4; по одной строке на тег", () => {
    for (const [level, amount, sourceId] of [
      [5, "2", undefined],
      [6, "2", undefined],
      [7, "3", "elementalist.feature.7.burlyashchaya-essentsiya"],
      [8, "3", "elementalist.feature.7.burlyashchaya-essentsiya"],
      [9, "3", "elementalist.feature.7.burlyashchaya-essentsiya"],
      [10, "4", "elementalist.feature.10.sushchnostnoe-bytie"],
    ] as const) {
      const gains = resolvedResourceGains(elementalist(level));
      expect(new Set(gains.map((gain) => gain.tag)).size, String(level)).toBe(
        gains.length,
      );
      const start = gains.filter((gain) => gain.tag === "start-of-turn");
      expect(start, String(level)).toHaveLength(1);
      expect(start[0].amount, String(level)).toBe(amount);
      if (sourceId) expect(start[0].sourceId, String(level)).toBe(sourceId);

      const nearby = gains.filter((gain) => gain.tag === "damage-nearby");
      expect(nearby, String(level)).toHaveLength(1);
      expect(nearby[0].amount, String(level)).toBe("2");
    }
  });

  it("эпическое «Веяние» начисляется только с 10-го уровня", () => {
    expect(resolvedEpicResourceGains(elementalist(9))).toEqual([]);
    expect(
      resolvedEpicResourceGains(elementalist(10)).map(
        (gain) => `${gain.tag}:${gain.event}:${gain.amount}:${gain.frequency}`,
      ),
    ).toEqual(["epic-respite:respite:= Опыт:respite"]);
    expect(mechanicsFor("elementalist.feature.10.veyanie")?.kinds).toEqual([
      "resource",
    ]);
  });
});

describe("Элементалист: специализации 5/8/10 уровней", () => {
  it("каждая специализация включает только свою запись уровня", () => {
    for (const level of [5, 8, 10] as const) {
      const bySubclass = SPECIALIZATION_LATE[level];
      const levelIds = Object.values(bySubclass);
      for (const [subclass, ownId] of Object.entries(bySubclass)) {
        const ids = activeIds(elementalist(level, {}, { subclass }));
        expect(
          ids.filter((id) => levelIds.includes(id)),
          `${subclass} (ур. ${level})`,
        ).toEqual([ownId]);
      }
    }
  });

  it("пустая, неизвестная и двойная специализация не включают записи", () => {
    for (const subclass of ["", "Воздух", "Гниль", "Вода", "Земля, Огонь"]) {
      const ids = activeIds(elementalist(10, {}, { subclass }));
      expect(
        ids.filter((id) => ALL_SPECIALIZATION_IDS.includes(id)),
        subclass || "пусто",
      ).toEqual([]);
    }
  });

  it("Гора не сдвинется даёт устойчивость, равную уровню героя", () => {
    for (const level of [5, 8, 10] as const) {
      const hero = elementalist(level, {}, { subclass: "Земля" });
      expect(featureStatContributions(hero, "stability"), String(level)).toEqual([
        {
          sourceId: "elementalist.specialization.5.gora-ne-sdvinetsya",
          sourceName: "Гора не сдвинется",
          value: level,
        },
      ]);
    }
  });

  it("Мастер Земли даёт иммунитет к урону 5", () => {
    const hero = elementalist(10, {}, { subclass: "Земля" });
    expect(featureDamageImmunities(hero)).toEqual([
      {
        sourceId: "elementalist.specialization.10.master-zemli",
        sourceName: "Мастер Земли",
        types: ["урон"],
        value: 5,
      },
    ]);
    const item = sheetItems(hero).find(
      (feature) => feature.name === "Мастер Земли",
    );
    expect(item?.summary).toContain("иммунитет к урону 5");
    expect(item?.summary).not.toContain("(урон)");
  });

  it("Мастер Огня заменяет +1 Аколита на +5, а не складывает", () => {
    const hero = elementalist(10, {}, { subclass: "Огонь" });
    expect(featureAbilityDamageContributions(fireAbility(), hero)).toEqual([
      {
        sourceId: "elementalist.specialization.10.master-ognya",
        sourceName: "Мастер Огня",
        value: 5,
      },
    ]);
    expect(featureAbilityDamageContributions(magicAbility(), hero)).toEqual([
      {
        sourceId: "elementalist.specialization.10.master-ognya",
        sourceName: "Мастер Огня",
        value: 5,
      },
    ]);
    expect(featureAbilityDamageContributions(weaponAbility(), hero)).toEqual([]);
  });

  it("Мастер Зелени добавляет 2 Восстановления", () => {
    const hero = elementalist(10, {}, { subclass: "Зелень" });
    expect(featureStatContributions(hero, "recoveries")).toEqual([
      {
        sourceId: "elementalist.specialization.10.master-zeleni",
        sourceName: "Мастер Зелени",
        value: 2,
      },
    ]);
  });

  it("Великий вирдинг — ручной выбор иммунитета, не постоянный эффект", () => {
    const hero = elementalist(9, {}, { subclass: "Пустота" });
    const mechanics = mechanicsFor("elementalist.feature.9.velikiy-virding");
    expect(mechanics?.effects ?? []).toEqual([]);
    expect(mechanics?.trigger).toBeUndefined();
    expect(mechanics?.notes).toContain("5 и более Побед");
    expect(mechanics?.notes).toContain("вручную");
    expect(featureDamageImmunities(hero)).toEqual([]);
  });

  it("Мастер Пустоты не добавляет постоянных чисел", () => {
    const hero = elementalist(10, {}, { subclass: "Пустота" });
    const mechanics = mechanicsFor(
      "elementalist.specialization.10.master-pustoty",
    );
    expect(mechanics?.effects ?? []).toEqual([]);
    expect(mechanics?.notes).toContain("телепортироваться");
    expect(featureDamageImmunities(hero)).toEqual([]);
  });
});

describe("Элементалист: контейнеры способностей 5/6/8/9 уровней", () => {
  it("выборы видны независимо от специализации и описаны вариантами", () => {
    for (const subclass of ["Земля", "Огонь", "Зелень", "Пустота"]) {
      const ids = activeIds(elementalist(9, {}, { subclass }));
      for (const id of ABILITY_CHOICES) expect(ids, id).toContain(id);
    }

    for (const id of ABILITY_CHOICES) {
      expect(mechanicsFor(id)?.kinds, id).toEqual(["choice", "grant"]);
      expect(mechanicsFor(id)?.notes?.trim(), id).toBeTruthy();
      expect(mechanicsFor(id)?.effects ?? [], id).toEqual([]);
      expect(mechanicsFor(id)?.resource, id).toBeUndefined();
    }

    expect(
      mechanicsFor("elementalist.feature.5.sposobnost-za-9-essentsii")?.notes,
    ).toContain("Отложенное Возгорание");
    expect(
      mechanicsFor("elementalist.feature.8.sposobnost-za-11-essentsii")?.notes,
    ).toContain("Сердце Леса");
    expect(
      mechanicsFor("elementalist.feature.9.novaya-sposobnost-za-11-essentsii")
        ?.notes,
    ).toContain("Призма");
  });

  it("подарки 5/8/10 уровней называют только свою специализацию", () => {
    const level5 = classFeatureGiftsAtLevel(
      elementalist(4, {}, { subclass: "Земля" }),
      5,
    ).map((feature) => feature.name);
    expect(level5).toContain("Гора не сдвинется");
    expect(level5).not.toContain("Тлеющий шаг");

    const level8 = classFeatureGiftsAtLevel(
      elementalist(7, {}, { subclass: "Земля" }),
      8,
    ).map((feature) => feature.name);
    expect(level8).toContain("Призыв Источника Земли");
    expect(level8).not.toContain("Способность за 11 эссенции");

    const level10 = classFeatureGiftsAtLevel(
      elementalist(9, {}, { subclass: "Пустота" }),
      10,
    ).map((feature) => feature.name);
    expect(level10).toContain("Мастер Пустоты");
    expect(level10).not.toContain("Мастер Земли");
  });
});

describe("Элементалист: проза 6–10 уровней", () => {
  it("Вирдинг, мантия и характеристики объяснены без чисел-эффектов", () => {
    const virding = mechanicsFor("elementalist.feature.6.virding");
    expect(virding?.kinds).toEqual(["situational"]);
    expect(virding?.notes).toContain("10 непрерывных минут");
    expect(virding?.effects ?? []).toEqual([]);

    const mantle = mechanicsFor("elementalist.feature.7.mantiya-kvintessentsii");
    expect(mantle?.notes).toContain("терпение");
    expect(mantle?.effects ?? []).toEqual([]);

    for (const id of [
      "elementalist.feature.7.uvelichenie-kharakteristik",
      "elementalist.feature.10.uvelichenie-kharakteristik",
    ]) {
      expect(mechanicsFor(id)?.kinds, id).toEqual(["characteristic"]);
      expect(mechanicsFor(id)?.effects ?? [], id).toEqual([]);
    }
  });

  it("записи уровней видны на листе", () => {
    const names = sheetItems(elementalist(10, {}, { subclass: "Зелень" })).map(
      (feature) => feature.name,
    );
    for (const name of [
      "Вирдинг",
      "Великий вирдинг",
      "Мантия квинтэссенции",
      "Бурлящая эссенция",
      "Сущностное бытие",
      "Веяние",
      "Увеличение характеристик",
      "Мастер Зелени",
    ]) {
      expect(names, name).toContain(name);
    }
  });
});

describe("Элементалист: повышение уровня 4→5, 7→8 и 9→10", () => {
  const ENOUGH_XP = 1000;

  function request(
    hero: Character,
    choices: Record<string, string[]> = {},
  ): LevelUpRequest {
    return {
      characterId: hero.id,
      fromLevel: hero.level,
      className: hero.className,
      subclass: hero.subclass,
      mode: "milestone",
      choices,
      reviewedRules: true,
    };
  }

  function firstChoices(hero: Character): Record<string, string[]> {
    const plan = getLevelUpPlan(hero);
    const choices: Record<string, string[]> = {};
    for (const choice of plan.choices) {
      choices[choice.id] = choice.options
        .slice(0, choice.count)
        .map((option) => option.id);
    }
    return choices;
  }

  function expectOk(result: LevelUpPreview) {
    expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
    if (!result.ok) throw new Error(result.issues.join("; "));
    return result;
  }

  it("4→5 сохраняет выборы и включает особенность 5-го уровня", () => {
    const selections = { "elementalist.enchantment": "Зачарование быстроты" };
    const hero = elementalist(4, selections, {
      subclass: "Земля",
      xp: ENOUGH_XP,
    });
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(5);
    expect(result.next.subclass).toBe("Земля");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);
    const ids = activeIds(result.next);
    expect(ids).toContain("elementalist.specialization.5.gora-ne-sdvinetsya");
    expect(ids).not.toContain("elementalist.specialization.5.tleyushchiy-shag");
    const start = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "start-of-turn",
    );
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("2");
  });

  it("7→8 выдаёт «Призыв Источника Земли» специализации Земля", () => {
    const grantedId = "elementalist-prizyv-istochnika-zemli-c9679a42db";
    const hero = elementalist(7, {}, {
      subclass: "Земля",
      xp: ENOUGH_XP * 2,
    });
    expect(getLevelUpPlan(hero).grantedAbilityIds).toContain(grantedId);

    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(8);
    expect(result.next.subclass).toBe("Земля");
    expect(
      result.next.abilities.filter((ability) => ability.id === grantedId),
    ).toHaveLength(1);
    const ids = activeIds(result.next);
    expect(ids).toContain(
      "elementalist.specialization.8.prizyv-istochnika-zemli",
    );
    expect(ids).not.toContain("elementalist.specialization.8.pervozdannoe-plamya");
  });

  it("9→10 сохраняет подкласс, даёт 4 эссенции и «Веяние»", () => {
    const selections = {
      "elementalist.sanctuary": "Оберег привязанности природы",
    };
    const hero = elementalist(9, selections, {
      subclass: "Пустота",
      xp: ENOUGH_XP * 2,
    });
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(10);
    expect(result.next.subclass).toBe("Пустота");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);

    const gains = resolvedResourceGains(result.next);
    const start = gains.filter((gain) => gain.tag === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("4");
    expect(start[0].sourceId).toBe(
      "elementalist.feature.10.sushchnostnoe-bytie",
    );
    expect(resolvedEpicResourceGains(result.next)).toHaveLength(1);

    const ids = activeIds(result.next);
    expect(ids).toContain("elementalist.specialization.10.master-pustoty");
    expect(ids).not.toContain("elementalist.specialization.10.master-zemli");
  });
});
