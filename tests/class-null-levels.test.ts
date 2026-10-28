import { describe, expect, it } from "vitest";
import { NOT_YET, TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "../src/lib/class-features";
import {
  classFeatureGiftsAtLevel,
  classFeatureGroupsForSheet,
} from "../src/lib/class-feature-view";
import { createCharacter } from "../src/lib/defaults";
import {
  featureDamageImmunities,
  featureFieldBonus,
  featureFieldContributions,
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
import type { Character } from "../src/types";

/**
 * Нуль нужного уровня с выбранными опциями. Значения выборов — русские имена
 * старых опций, как их пишет билдер.
 */
function nullHero(
  level = 1,
  selections: Record<string, string> = {},
  overrides: Partial<Character> = {},
): Character {
  const hero = createCharacter({ className: "Нуль", level });
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: selections,
  };
  return { ...hero, ...overrides };
}

const DENSITY = {
  "null.augmentation": "Аугментация плотности (Density Augmentation)",
};

const DENSITY_ID = { "null.augmentation": "null.augmentation.density" };

const NULL_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Нуль",
);

/** Записи второго этапа: уровни 5–10 без строк мастерства 7/10 уровней. */
const STAGE_TWO = NULL_FEATURES.filter(
  (feature) =>
    feature.level >= 5 &&
    !/^null\.feature\.(7|10)\.masterstvo-/.test(feature.id),
);

const PSI_BOOSTS = [
  "null.feature.7.dinamicheskaya-sila-1-distsipliny",
  "null.feature.7.rasshirennaya-sila-3-distsipliny",
  "null.feature.7.prodlennaya-sila-1-distsipliny",
  "null.feature.7.uvelichennaya-sila-1-distsipliny",
  "null.feature.7.potentsialnaya-sila-5-distsipliny",
  "null.feature.7.razdelennaya-sila-5-distsipliny",
  "null.feature.7.obostrennaya-sila-1-distsipliny",
];

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

const traditionIds = (hero: Character, level: number) =>
  activeIds(hero).filter((id) => id.startsWith(`null.tradition.${level}.`));

function withDiscipline(hero: Character, value: number): Character {
  return {
    ...hero,
    heroicResource: { ...hero.heroicResource, current: value },
  };
}

function visibleText(hero: Character): string {
  return classFeatureGroupsForSheet(hero)
    .flatMap((group) => group.features)
    .flatMap((feature) => [
      feature.summary,
      feature.notes ?? "",
      feature.detail ?? "",
      feature.trigger?.label ?? "",
      feature.trigger?.detail ?? "",
      ...feature.badges.map((badge) => badge.label),
    ])
    .join(" ");
}

describe("Нуль: production-покрытие уровней 5–10", () => {
  it("все 99 записей покрыты, NOT_YET пуст для класса", () => {
    expect(NULL_FEATURES).toHaveLength(99);
    expect(STAGE_TWO).toHaveLength(42);
    expect(NOT_YET["Нуль"]).toBeUndefined();

    const missing = NULL_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id) && !TEXT_ONLY[feature.id],
    );
    expect(missing.map((feature) => `${feature.name} (ур. ${feature.level})`)).toEqual(
      [],
    );

    expect(
      NULL_FEATURES.filter((feature) => mechanicsFor(feature.id)),
    ).toHaveLength(91);

    const textOnlyIds = NULL_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id),
    ).map((feature) => feature.id);
    expect(textOnlyIds.sort()).toEqual(
      [
        "null.feature.10.navyk",
        "null.feature.10.perk",
        "null.feature.2.perk",
        "null.feature.4.navyk",
        "null.feature.4.perk",
        "null.feature.6.perk",
        "null.feature.7.navyk",
        "null.feature.8.perk",
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

describe("Нуль: ресурс на уровнях 5–10", () => {
  it("5/6 — базовая дисциплина, 7/8/9 — 3 вместо 2, 10 — 4 вместо 3", () => {
    for (const level of [5, 6]) {
      const gains = resolvedResourceGains(nullHero(level));
      expect(gains.map((gain) => `${gain.tag}:${gain.amount}`)).toEqual([
        "combat-start:= Победы",
        "start-of-turn:2",
        "malice-ability:1",
        "field-main-action:2",
      ]);
    }

    for (const level of [7, 8, 9]) {
      const gains = resolvedResourceGains(nullHero(level));
      expect(gains).toHaveLength(4);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
      const start = gains.filter((gain) => gain.tag === "start-of-turn");
      expect(start).toHaveLength(1);
      expect(start[0].amount).toBe("3");
      expect(start[0].sourceId).toBe("null.feature.7.uluchshennoe-telo");
    }

    const top = resolvedResourceGains(nullHero(10));
    expect(top).toHaveLength(4);
    expect(new Set(top.map((gain) => gain.tag)).size).toBe(top.length);
    const start = top.filter((gain) => gain.tag === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("4");
    expect(start[0].sourceId).toBe("null.feature.10.telo-manifolda");
  });

  it("эпический «Порядок» начисляется только с 10-го уровня", () => {
    expect(resolvedEpicResourceGains(nullHero(9))).toEqual([]);
    const epic = resolvedEpicResourceGains(nullHero(10));
    expect(
      epic.map(
        (gain) => `${gain.tag}:${gain.event}:${gain.amount}:${gain.frequency}`,
      ),
    ).toEqual(["epic-respite:respite:= Опыт:respite"]);
  });
});

describe("Нуль: традиции 5-го и 8-го уровней", () => {
  it("на 5-м уровне видна ровно одна запись своей традиции", () => {
    expect(
      traditionIds(nullHero(5, {}, { subclass: "Хронокинетик" }), 5),
    ).toEqual(["null.tradition.5.mgnovennoe-deystvie"]);
    expect(
      traditionIds(nullHero(5, {}, { subclass: "Криокинетик" }), 5),
    ).toEqual(["null.tradition.5.okhlazhdayushchaya-gotovnost"]);
    expect(
      traditionIds(nullHero(5, {}, { subclass: "Метакинетик" }), 5),
    ).toEqual(["null.tradition.5.inertsionnaya-tochka-opory"]);
  });

  it("на 8-м уровне видна ровно одна запись своей традиции", () => {
    expect(
      traditionIds(nullHero(8, {}, { subclass: "Хронокинетик" }), 8),
    ).toEqual(["null.tradition.8.razdelennyy-impuls"]);
    expect(
      traditionIds(nullHero(8, {}, { subclass: "Криокинетик" }), 8),
    ).toEqual(["null.tradition.8.sinapticheskaya-sortirovka"]);
    expect(
      traditionIds(nullHero(8, {}, { subclass: "Метакинетик" }), 8),
    ).toEqual(["null.tradition.8.inertsionnyy-gasitel"]);
  });

  it("пустой или неизвестный подкласс не включает записи традиций", () => {
    for (const subclass of ["", "Пирокинез", "Хронокинетик, Криокинетик"]) {
      const hero = nullHero(10, {}, { subclass });
      expect(
        [...traditionIds(hero, 5), ...traditionIds(hero, 8)],
        subclass,
      ).toEqual([]);
    }
  });

  it("контейнеры способностей 6/9 уровней видны только своей традиции", () => {
    const chrono = activeIds(nullHero(9, {}, { subclass: "Хронокинетик" }));
    expect(chrono).toContain(
      "null.feature.6.sposobnosti-khronokinetika-6-go-urovnya",
    );
    expect(chrono).toContain(
      "null.feature.9.sposobnosti-khronokinetika-9-go-urovnya",
    );
    expect(chrono).not.toContain(
      "null.feature.6.sposobnosti-kriokinetika-6-go-urovnya",
    );
    expect(chrono).not.toContain(
      "null.feature.9.sposobnosti-metakinetika-9-go-urovnya",
    );

    const meta = activeIds(nullHero(9, {}, { subclass: "Метакинетик" }));
    expect(meta).toContain(
      "null.feature.6.sposobnosti-metakinetika-6-go-urovnya",
    );
    expect(meta).toContain(
      "null.feature.9.sposobnosti-metakinetika-9-go-urovnya",
    );
    expect(meta).not.toContain(
      "null.feature.9.sposobnosti-khronokinetika-9-go-urovnya",
    );
  });

  it("триггеры 5/8 уровней имеют книжные событие и частоту", () => {
    const cases = [
      {
        level: 5,
        subclass: "Криокинетик",
        featureId: "null.tradition.5.okhlazhdayushchaya-gotovnost",
        event: "combat-start",
        frequency: "encounter",
      },
      {
        level: 8,
        subclass: "Криокинетик",
        featureId: "null.tradition.8.sinapticheskaya-sortirovka",
        event: "start-of-turn",
        frequency: "turn",
      },
    ] as const;

    for (const item of cases) {
      const triggers = classFeatureTriggers(
        nullHero(item.level, {}, { subclass: item.subclass }),
      ).filter((trigger) => trigger.featureId === item.featureId);
      expect(triggers, item.featureId).toHaveLength(1);
      expect(triggers[0].event, item.featureId).toBe(item.event);
      expect(triggers[0].frequency, item.featureId).toBe(item.frequency);
      expect(triggers[0].label.trim(), item.featureId).not.toBe("");
      expect(triggers[0].detail.trim(), item.featureId).not.toBe("");
    }
  });

  it("инерционный гаситель даёт устойчивость, равную Интуиции, только Метакинетику", () => {
    const hero = nullHero(8, {}, { subclass: "Метакинетик" });
    expect(featureStatContributions(hero, "stability")).toEqual([
      {
        sourceId: "null.tradition.8.inertsionnyy-gasitel",
        sourceName: "Инерционный гаситель",
        value: hero.characteristics.intuition,
      },
    ]);

    for (const subclass of ["Хронокинетик", "Криокинетик"]) {
      expect(
        featureFieldContributions(
          nullHero(8, {}, { subclass }),
          "stability",
        ),
        subclass,
      ).toEqual([]);
    }
  });
});

describe("Нуль: элементальное поглощение 6-го уровня", () => {
  it("поглощение — триггер, а не постоянный иммунитет", () => {
    const hero = nullHero(6, {}, { subclass: "Хронокинетик" });
    const mechanics = mechanicsFor("null.feature.6.elementalnoe-pogloshchenie");
    expect(mechanics?.trigger?.event).toBe("take-damage");
    expect(mechanics?.trigger?.frequency).toBe("always");
    expect(mechanics?.trigger?.label).toContain("Инерционный щит");
    expect(mechanics?.effects ?? []).toEqual([]);
    expect(
      mechanics?.notes,
      "временный иммунитет объясняется прозой",
    ).toContain("временный");

    expect(featureDamageImmunities(hero)).toEqual([]);
    const ids = activeIds(hero);
    expect(ids).toContain("null.feature.6.elementalnoe-pogloshchenie");
    expect(ids).toContain("null.feature.6.elementalnyy-bufer");
  });

  it("буфер — триггер на 2 всплеска для следующего удара", () => {
    const mechanics = mechanicsFor("null.feature.6.elementalnyy-bufer");
    expect(mechanics?.trigger?.event).toBe("take-damage");
    expect(mechanics?.trigger?.frequency).toBe("always");
    expect(mechanics?.trigger?.detail).toContain("2 всплеска");
    expect(mechanics?.effects ?? []).toEqual([]);
  });
});

describe("Нуль: пси-усиления 7-го уровня", () => {
  it("все семь вариантов имеют механику и объяснение, но не пассивные числа", () => {
    for (const id of PSI_BOOSTS) {
      const mechanics = mechanicsFor(id);
      expect(mechanics, id).toBeDefined();
      expect(mechanics?.notes?.trim(), id).toBeTruthy();
      expect(mechanics?.effects ?? [], id).toEqual([]);
      expect(mechanics?.trigger, id).toBeUndefined();
      expect(mechanics?.resource, id).toBeUndefined();
    }

    const hero = nullHero(7, {}, { subclass: "Хронокинетик" });
    for (const field of [
      "distance",
      "rolledDamage",
      "push",
      "pull",
      "slide",
      "potency",
    ] as const) {
      expect(featureFieldBonus(hero, field), field).toBe(0);
    }
  });

  it("контейнер пси-усиления перечисляет все семь вариантов", () => {
    const notes = mechanicsFor("null.feature.7.psi-usilenie")?.notes ?? "";
    for (const name of [
      "Динамическая сила",
      "Расширенная сила",
      "Продленная сила",
      "Увеличенная сила",
      "Потенциальная сила",
      "Разделенная сила",
      "Обостренная сила",
    ]) {
      expect(notes, name).toContain(name);
    }
  });
});

describe("Нуль: мастерство дисциплины на 7-м и 10-м уровнях", () => {
  it("порог 10 виден на 7-м уровне, порог 12 — на 10-м", () => {
    const low = withDiscipline(nullHero(7, {}, { subclass: "Хронокинетик" }), 9);
    expect(activeIds(low)).toContain(
      "null.feature.7.masterstvo-khronokinetika-10-7-y-uroven",
    );
    expect(activeIds(low)).not.toContain(
      "null.feature.10.masterstvo-khronokinetika-12-10-y-uroven",
    );
    expect(featureFieldContributions(low, "push")).toEqual([]);

    const high = withDiscipline(
      nullHero(10, {}, { subclass: "Хронокинетик" }),
      12,
    );
    expect(activeIds(high)).toContain(
      "null.feature.10.masterstvo-khronokinetika-12-10-y-uroven",
    );
    expect(featureFieldContributions(high, "push")).toHaveLength(1);
  });

  it("улучшение мастерства называет новый порог в прозе", () => {
    expect(
      mechanicsFor("null.feature.7.uluchshenie-masterstva-distsipliny")?.notes,
    ).toContain("10");
    expect(
      mechanicsFor("null.feature.10.uluchshenie-masterstva-distsipliny")?.notes,
    ).toContain("12");
  });
});

describe("Нуль: 9-й и 10-й уровни", () => {
  it("«Я и есть оружие» даёт ровно +21 выносливости", () => {
    const hero = nullHero(9, {}, { subclass: "Хронокинетик" });
    expect(featureStatContributions(hero, "stamina")).toEqual([
      {
        sourceId: "null.feature.9.ya-i-est-oruzhie",
        sourceName: "Я и есть оружие",
        value: 21,
      },
    ]);
    const mechanics = mechanicsFor("null.feature.9.ya-i-est-oruzhie");
    expect(mechanics?.kinds).toContain("bonus");
    expect(mechanics?.notes).toContain("кровотечение");
    expect(mechanics?.notes).toContain("Интуицию");
  });

  it("на 10-м уровне видны «Порядок», «Резонанс манифольда» и «Я и есть оружие»", () => {
    const hero = nullHero(10, {}, { subclass: "Криокинетик" });
    const names = classFeatureGroupsForSheet(hero)
      .flatMap((group) => group.features)
      .map((feature) => feature.name);
    for (const name of [
      "Я и есть оружие",
      "Порядок",
      "Резонанс манифольда",
      "Тело манифольда",
      "Увеличение характеристик",
      "Улучшение мастерства дисциплины",
    ]) {
      expect(names, name).toContain(name);
    }
    expect(mechanicsFor("null.feature.10.poryadok")?.kinds).toEqual([
      "resource",
    ]);
    expect(mechanicsFor("null.feature.10.poryadok")?.notes).toContain("Опыту");
    expect(
      mechanicsFor("null.feature.10.rezonans-manifolda")?.notes,
    ).toContain("пси-усиление");
  });
});

describe("Нуль: подарки уровней 5–10", () => {
  it("classFeatureGiftsAtLevel называет прозу и традиционные записи", () => {
    const level5 = classFeatureGiftsAtLevel(
      nullHero(4, {}, { subclass: "Хронокинетик" }),
      5,
    ).map((feature) => feature.name);
    expect(level5).toContain("Мгновенное действие");
    expect(level5).not.toContain("Инерционная точка опоры");

    const level8 = classFeatureGiftsAtLevel(
      nullHero(7, {}, { subclass: "Метакинетик" }),
      8,
    ).map((feature) => feature.name);
    expect(level8).toContain("Инерционный гаситель");
    expect(level8).not.toContain("Способность за 11 дисциплины");

    const level10 = classFeatureGiftsAtLevel(
      nullHero(9, {}, { subclass: "Криокинетик" }),
      10,
    ).map((feature) => feature.name);
    for (const name of [
      "Тело манифольда",
      "Резонанс манифольда",
      "Увеличение характеристик",
    ]) {
      expect(level10, name).toContain(name);
    }
  });
});

describe("Нуль: повышение уровня 6→7 и 9→10", () => {
  const ENOUGH_XP = 160;

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

  it("6→7 сохраняет выборы, подкласс и усиливает начало хода", () => {
    const hero = nullHero(6, DENSITY, {
      subclass: "Хронокинетик",
      xp: ENOUGH_XP,
    });
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(7);
    expect(result.next.subclass).toBe("Хронокинетик");
    expect(result.next.automation?.classFeatureSelections).toEqual(DENSITY);
    const gains = resolvedResourceGains(result.next);
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
    const start = gains.filter((gain) => gain.tag === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("3");
    expect(start[0].sourceId).toBe("null.feature.7.uluchshennoe-telo");
  });

  it("9→10 сохраняет выборы, подкласс и даёт 4 дисциплины с «Порядком»", () => {
    const hero = nullHero(9, DENSITY_ID, {
      subclass: "Криокинетик",
      xp: ENOUGH_XP,
    });
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(10);
    expect(result.next.subclass).toBe("Криокинетик");
    expect(result.next.automation?.classFeatureSelections).toEqual(DENSITY_ID);

    const gains = resolvedResourceGains(result.next);
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
    const start = gains.filter((gain) => gain.tag === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("4");
    expect(start[0].sourceId).toBe("null.feature.10.telo-manifolda");

    expect(resolvedEpicResourceGains(result.next)).toHaveLength(1);
    expect(
      featureStatContributions(result.next, "stamina").some(
        (contribution) =>
          contribution.sourceId === "null.feature.9.ya-i-est-oruzhie" &&
          contribution.value === 21,
      ),
    ).toBe(true);
  });
});
