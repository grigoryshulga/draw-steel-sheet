import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { TEXT_ONLY, NOT_YET, mechanicsFor } from "../src/data/class-features/mechanics";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { activeClassFeatures, classFeatureTriggers } from "../src/lib/class-features";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
  withClassFeatureSelection,
} from "../src/lib/class-feature-view";
import { createCharacter } from "../src/lib/defaults";
import {
  featureAbilityDistanceBonus,
  featureDamageImmunities,
  featureFieldBonus,
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

const TALENT_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Талант",
);

function talent(
  level: number,
  selections: Record<string, string> = {},
  overrides: Partial<Character> = {},
): Character {
  const hero = createCharacter({ className: "Талант", level });
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

const rangedPsionic = () => ability(["Псионика", "Дальний"]);
const meleePsionic = () => ability(["Псионика", "Ближний"]);

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

const traditionIds = (hero: Character, level: number) =>
  activeClassFeatures(hero)
    .filter(
      (feature) => feature.keyedBy === "tradition" && feature.level === level,
    )
    .map((feature) => feature.id);

const PSI_BOOSTS = [
  "feature.talent.level-6.dynamic-power",
  "feature.talent.level-6.expanded-power",
  "feature.talent.level-6.extended-power",
  "feature.talent.level-6.heightened-power",
  "feature.talent.level-6.magnified-power",
  "feature.talent.level-6.shared-power",
  "feature.talent.level-6.sharpened-power",
];

describe("Талант: production-покрытие уровней 5–10", () => {
  it("все 93 записи покрыты механикой или прозой, NOT_YET пуст для класса", () => {
    expect(TALENT_FEATURES).toHaveLength(93);
    expect(NOT_YET["Талант"]).toBeUndefined();

    const missing = TALENT_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id) && !TEXT_ONLY[feature.id],
    );
    expect(missing.map((feature) => `${feature.name} (ур. ${feature.level})`)).toEqual(
      [],
    );

    const mechanicsCount = TALENT_FEATURES.filter((feature) =>
      mechanicsFor(feature.id),
    ).length;
    const textOnlyIds = TALENT_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id),
    ).map((feature) => feature.id);
    expect(mechanicsCount).toBe(85);
    expect(textOnlyIds.sort()).toEqual(
      [
        "feature.talent.level-10.skill",
        "feature.talent.level-10.perk",
        "feature.talent.level-2.perk",
        "feature.talent.level-4.skill",
        "feature.talent.level-4.perk",
        "feature.talent.level-6.perk",
        "feature.talent.level-7.skill",
        "feature.talent.level-8.perk",
      ].sort(),
    );
    expect(
      textOnlyIds.every((id) => (TEXT_ONLY[id] ?? "").trim().length > 10),
    ).toBe(true);
  });

  it("механика без чисел, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = TALENT_FEATURES.map((feature) => ({
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

describe("Талант: ресурс на уровнях 5–10", () => {
  it("5/6 — три базовые прибавки, 7/8/9 — усиленное начало хода", () => {
    for (const level of [5, 6]) {
      const gains = resolvedResourceGains(talent(level));
      expect(gains.map((gain) => gain.tag)).toEqual([
        "combat-start",
        "start-of-turn",
        "forced-movement",
      ]);
      expect(gains.map((gain) => gain.amount)).toEqual(["= Победы", "1d3", "2"]);
    }

    for (const level of [7, 8, 9]) {
      const gains = resolvedResourceGains(talent(level));
      expect(gains).toHaveLength(3);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
      const start = gains.filter((gain) => gain.tag === "start-of-turn");
      expect(start).toHaveLength(1);
      expect(start[0].amount).toBe("1d3 + 1");
      expect(start[0].sourceId).toBe("feature.talent.level-7.lucid-mind");
      expect(gains.filter((gain) => gain.tag === "forced-movement")).toHaveLength(1);
    }
  });

  it("10-й уровень: 1d3 + 2 и 3, ровно одна прибавка на тег", () => {
    const gains = resolvedResourceGains(talent(10));
    expect(gains).toHaveLength(3);
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);

    const start = gains.filter((gain) => gain.tag === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("1d3 + 2");
    expect(start[0].sourceId).toBe("feature.talent.level-10.psion");

    const forced = gains.filter((gain) => gain.tag === "forced-movement");
    expect(forced).toHaveLength(1);
    expect(forced[0].amount).toBe("3");
    expect(forced[0].sourceId).toBe("feature.talent.level-10.clear-mind");
  });

  it("эпический пул «Видение» открывается только на 10-м уровне", () => {
    expect(resolvedEpicResourceGains(talent(9))).toEqual([]);
    const epic = resolvedEpicResourceGains(talent(10));
    expect(epic).toHaveLength(1);
    expect(epic[0].amount).toBe("= Опыт");
    expect(epic[0].event).toBe("respite");
    expect(epic[0].frequency).toBe("respite");
  });
});

describe("Талант: традиции 5-го и 8-го уровней", () => {
  it("на 5-м уровне видны ровно две записи своей традиции", () => {
    const telekinez = traditionIds(talent(5, {}, { subclass: "Телекинез" }), 5);
    expect(telekinez.sort()).toEqual([
      "feature.talent.level-5.kinetic-amplifier",
      "feature.talent.level-5.triangulate",
    ]);

    const chrono = traditionIds(talent(5, {}, { subclass: "Хронопатия" }), 5);
    expect(chrono.sort()).toEqual([
      "feature.talent.level-5.distortion-temporal",
      "feature.talent.level-5.speed-of-thought",
    ]);

    const telepathy = traditionIds(talent(5, {}, { subclass: "Телепатия" }), 5);
    expect(telepathy.sort()).toEqual([
      "feature.talent.level-5.compulsion",
      "feature.talent.level-5.remote-amplification",
    ]);
  });

  it("на 8-м уровне: Хронопатия — Стазисный щит, Телекинез — Поле левитации", () => {
    expect(traditionIds(talent(8, {}, { subclass: "Хронопатия" }), 8).sort()).toEqual(
      [
        "feature.talent.level-8.stasis-shield",
        "feature.talent.level-8.doubling-the-hours",
      ].sort(),
    );
    expect(traditionIds(talent(8, {}, { subclass: "Телекинез" }), 8).sort()).toEqual(
      [
        "feature.talent.level-8.low-gravity",
        "feature.talent.level-8.levitation-field",
      ].sort(),
    );
    expect(traditionIds(talent(8, {}, { subclass: "Телепатия" }), 8).sort()).toEqual(
      [
        "feature.talent.level-8.universal-connection",
        "feature.talent.level-8.mindlink",
      ].sort(),
    );
  });

  it("Удалённое усиление: +5 к дальней псионике только у Телепатии", () => {
    const ranged = ability(["Дальний", "Псионика"], { weaponMode: "ranged" });
    expect(
      featureAbilityDistanceBonus(ranged, talent(5, {}, { subclass: "Телепатия" })),
    ).toBe(5);
    expect(
      featureAbilityDistanceBonus(ranged, talent(5, {}, { subclass: "Хронопатия" })),
    ).toBe(0);
  });

  it("контейнеры способностей 6/9 уровней видны только своей традиции", () => {
    const telekinez = activeIds(talent(9, {}, { subclass: "Телекинез" }));
    expect(telekinez).toContain(
      "feature.talent.level-6.telekinesis-abilities",
    );
    expect(telekinez).toContain(
      "feature.talent.level-9.telekinesis-abilities",
    );
    expect(telekinez).not.toContain(
      "feature.talent.level-6.chronopathy-abilities",
    );
    expect(telekinez).not.toContain(
      "feature.talent.level-9.telepathy-abilities",
    );

    const telepathy = activeIds(talent(9, {}, { subclass: "Телепатия" }));
    expect(telepathy).toContain(
      "feature.talent.level-6.telepathy-abilities",
    );
    expect(telepathy).toContain(
      "feature.talent.level-9.telepathy-abilities",
    );
    expect(telepathy).not.toContain(
      "feature.talent.level-6.telekinesis-abilities",
    );
  });

  it("пустой или неизвестный подкласс не включает чужие записи", () => {
    for (const subclass of ["", "Теле", "Пирокинез", "Телекинез, Телепатия"]) {
      expect(traditionIds(talent(9, {}, { subclass }), 9), subclass).toEqual([]);
    }
  });

  it("выбор традиции в панели пишет подкласс и включает её записи", () => {
    const hero = talent(8);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "talent.tradition",
    );
    expect(choice?.options).toEqual(["Хронопатия", "Телекинез", "Телепатия"]);

    const selected = withClassFeatureSelection(hero, "talent.tradition", "Хронопатия");
    expect(selected.subclass).toBe("Хронопатия");
    expect(traditionIds(selected, 8).sort()).toEqual(
      [
        "feature.talent.level-8.stasis-shield",
        "feature.talent.level-8.doubling-the-hours",
      ].sort(),
    );
  });
});

describe("Талант: триггеры уровней 5–8", () => {
  it("триггеры традиций и уровней имеют книжные событие, частоту и подпись", () => {
    const cases = [
      {
        level: 5,
        subclass: "Телекинез",
        featureId: "feature.talent.level-5.kinetic-amplifier",
        event: "forced-movement",
        frequency: "always",
      },
      {
        level: 5,
        subclass: "Телекинез",
        featureId: "feature.talent.level-5.triangulate",
        event: "use-ability",
        frequency: "always",
      },
      {
        level: 5,
        subclass: "Хронопатия",
        featureId: "feature.talent.level-5.speed-of-thought",
        event: "use-ability",
        frequency: "round",
      },
      {
        level: 7,
        subclass: "Телекинез",
        featureId: "feature.talent.level-7.ancestral-memory",
        event: "respite",
        frequency: "respite",
      },
      {
        level: 7,
        subclass: "Телекинез",
        featureId: "feature.talent.level-7.cascading-strain",
        event: "take-damage",
        frequency: "always",
      },
      {
        level: 8,
        subclass: "Телепатия",
        featureId: "feature.talent.level-8.mindlink",
        event: "respite",
        frequency: "respite",
      },
    ] as const;

    for (const item of cases) {
      const triggers = classFeatureTriggers(
        talent(item.level, {}, { subclass: item.subclass }),
      ).filter((trigger) => trigger.featureId === item.featureId);
      expect(triggers, item.featureId).toHaveLength(1);
      expect(triggers[0].event, item.featureId).toBe(item.event);
      expect(triggers[0].frequency, item.featureId).toBe(item.frequency);
      expect(triggers[0].label.trim(), item.featureId).not.toBe("");
      expect(triggers[0].detail.trim(), item.featureId).not.toBe("");
    }
  });

  it("каскадная возбужденность напоминает про урон от возбужденности", () => {
    const trigger = classFeatureTriggers(
      talent(7, {}, { subclass: "Телекинез" }),
    ).find(
      (item) => item.featureId === "feature.talent.level-7.cascading-strain",
    );
    expect(trigger?.label).toContain("возбужденности");
  });
});

describe("Талант: пси-усиления 6-го уровня", () => {
  it("все семь записей имеют механику и объяснение, но не пассивные числа", () => {
    for (const id of PSI_BOOSTS) {
      const mechanics = mechanicsFor(id);
      expect(mechanics, id).toBeDefined();
      expect(mechanics?.notes?.trim(), id).toBeTruthy();
      expect(mechanics?.effects ?? [], id).toEqual([]);
      expect(mechanics?.trigger, id).toBeUndefined();
    }

    const hero = talent(6, {}, { subclass: "" });
    const psionic = rangedPsionic();
    for (const field of [
      "distance",
      "rolledDamage",
      "push",
      "pull",
      "slide",
      "potency",
    ] as const) {
      expect(featureFieldBonus(hero, field, psionic), field).toBe(0);
    }
    expect(featureAbilityDistanceBonus(psionic, hero)).toBe(0);
  });
});

describe("Талант: 9-й уровень", () => {
  it("даёт иммунитет к психическому 10 и состояниям Провокация/Испуг", () => {
    const hero = talent(9, {}, { subclass: "" });
    expect(featureDamageImmunities(hero)).toEqual([
      {
        sourceId: "feature.talent.level-9.fortress-of-perfect-thought",
        sourceName: "Крепость идеальной мысли",
        types: ["психический"],
        value: 10,
      },
    ]);

    const item = classFeatureGroupsForSheet(hero)
      .flatMap((group) => group.features)
      .find((feature) => feature.name === "Крепость идеальной мысли");
    expect(item?.summary).toContain("иммунитет к психическому 10");
    const immunity = item?.badges.find((badge) => badge.kind === "immunity");
    expect(immunity?.label).toBe("иммунитет к состояниям: Провокация, Испуг");
  });

  it("с выключенной автоматизацией иммунитет виден на листе, но не считается", () => {
    const hero = talent(9, {}, { subclass: "" });
    const off = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(featureDamageImmunities(off)).toEqual([]);
    expect(
      featureDamageImmunities(off, { includeWhenAutomationOff: true }),
    ).toHaveLength(1);
  });
});

describe("Талант: 10-й уровень", () => {
  it("дистанция +10 только для дальних способностей", () => {
    const hero = talent(10, {}, { subclass: "" });
    expect(featureAbilityDistanceBonus(rangedPsionic(), hero)).toBe(10);
    expect(featureAbilityDistanceBonus(meleePsionic(), hero)).toBe(0);

    const meleeMode = ability(["Псионика", "Дальний"], { weaponMode: "melee" });
    expect(featureAbilityDistanceBonus(meleeMode, hero)).toBe(0);
  });

  it("«Омнисенсорика» и «Псион» объяснены в notes без внутренних имён", () => {
    for (const id of [
      "feature.talent.level-10.omnisensory",
      "feature.talent.level-10.psion",
      "feature.talent.level-10.vision",
    ]) {
      expect(mechanicsFor(id)?.notes?.trim(), id).toBeTruthy();
    }
  });
});

describe("Талант: повышение уровня 6→7, 7→8, 9→10", () => {
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

  const selections = {
    "talent.augmentation": "Аугментация плотности",
    "talent.sanctuary": "Стальной оберег",
  };

  function baseHero(level: number, subclass: string): Character {
    return talent(level, selections, { subclass, xp: ENOUGH_XP });
  }

  it("6→7 сохраняет выборы и усиливает начало хода", () => {
    const hero = baseHero(6, "Телекинез");
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(7);
    expect(result.next.subclass).toBe("Телекинез");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);
    const start = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "start-of-turn",
    );
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("1d3 + 1");
  });

  it("7→8 выдаёт «Поле Левитации» Телекинеза из данных", () => {
    const hero = baseHero(7, "Телекинез");
    const plan = getLevelUpPlan(hero);
    expect(plan.grantedAbilityIds).toContain(
      "feature.ability.talent.level-8.levitation-field",
    );
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(8);
    expect(result.next.subclass).toBe("Телекинез");
    expect(result.next.abilities.map((item) => item.name)).toContain(
      "Поле Левитации",
    );
    expect(
      ABILITY_COMPENDIUM.find(
        (item) => item.id === "feature.ability.talent.level-8.levitation-field",
      )?.name,
    ).toBe("Поле Левитации");
  });

  it("7→8 выдаёт «Стазисный Щит» Хронопатии", () => {
    const hero = baseHero(7, "Хронопатия");
    const plan = getLevelUpPlan(hero);
    expect(plan.grantedAbilityIds).toContain(
      "feature.ability.talent.level-8.stasis-shield",
    );
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.abilities.map((item) => item.name)).toContain(
      "Стазисный Щит",
    );
  });

  it("9→10 не теряет выборы и открывает «Видение» с заменами", () => {
    const hero = baseHero(9, "Телекинез");
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(10);
    expect(result.next.subclass).toBe("Телекинез");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);

    const gains = resolvedResourceGains(result.next);
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
    expect(
      gains.find((gain) => gain.tag === "start-of-turn")?.amount,
    ).toBe("1d3 + 2");
    expect(gains.find((gain) => gain.tag === "forced-movement")?.amount).toBe(
      "3",
    );

    const epic = resolvedEpicResourceGains(result.next);
    expect(epic.map((gain) => `${gain.event}:${gain.amount}:${gain.frequency}`)).toEqual([
      "respite:= Опыт:respite",
    ]);
  });
});
