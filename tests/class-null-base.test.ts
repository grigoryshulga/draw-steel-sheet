import { describe, expect, it } from "vitest";
import { CLASS_FEATURE_GROUPS } from "../src/data/class-feature-rules";
import { resourceSpecFor } from "../src/data/class-features/class-resources";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import {
  NULL_RESOURCE,
  TEXT_ONLY,
  mechanicsFor,
} from "../src/data/class-features/mechanics";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "../src/lib/class-features";
import {
  classFeatureChoicesForSheet,
  classFeatureGiftsAtLevel,
  classFeatureOptionAutomated,
  featureSheetChoiceState,
  withClassFeatureSelection,
} from "../src/lib/class-feature-view";
import {
  buildCharacter,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import {
  featureAbilityDamageBonus,
  featureAbilityDamageContributions,
  featureDamageImmunities,
  featureFieldContributions,
  featureStatBonus,
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

/**
 * Нуль с выбранными аугментациями. Значения — русские имена старых опций,
 * как их пишет билдер; движок разворачивает их в ID.
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
const FORCE = { "null.augmentation": "Аугментация силы (Force Augmentation)" };
const SPEED = {
  "null.augmentation": "Аугментация скорости (Speed Augmentation)",
};

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

const psionicAbility = () => ability(["Псионика", "Дальний"]);
const weaponAbility = () =>
  ability(["Оружие", "Ближний"], {
    rollCharacteristics: ["might"],
    preferredCharacteristic: "might",
  });

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

const NULL_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Нуль",
);

function withDiscipline(hero: Character, value: number): Character {
  return {
    ...hero,
    heroicResource: { ...hero.heroicResource, current: value },
  };
}

describe("Нуль: production-реестры", () => {
  it("ресурс Дисциплина зарегистрирован без временных подмен", () => {
    const spec = resourceSpecFor("Нуль");
    expect(spec).toBe(NULL_RESOURCE);
    expect(spec?.name).toBe("Дисциплина");
    expect(spec?.gains.map((gain) => gain.tag)).toEqual([
      "combat-start",
      "start-of-turn",
      "field-main-action",
      "malice-ability",
    ]);
    expect(spec?.epic?.name).toBe("Порядок");
    expect(spec?.epic?.level).toBe(10);
  });

  it("уровни 1–4 покрыты механикой или прозой с причиной", () => {
    const covered = NULL_FEATURES.filter((feature) => feature.level <= 4);
    expect(covered).toHaveLength(51);
    const uncovered = covered.filter((feature) => {
      if (mechanicsFor(feature.id)) return false;
      const reason = TEXT_ONLY[feature.id];
      return typeof reason !== "string" || reason.trim() === "";
    });
    expect(
      uncovered.map((feature) => `${feature.name} (ур. ${feature.level})`),
    ).toEqual([]);
    expect(covered.filter((feature) => mechanicsFor(feature.id))).toHaveLength(
      48,
    );
    expect(covered.filter((feature) => !mechanicsFor(feature.id))).toHaveLength(
      3,
    );
  });

  it("механика без эффектов, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = NULL_FEATURES.filter((feature) => feature.level <= 4)
      .map((feature) => ({ feature, mechanics: mechanicsFor(feature.id) }))
      .filter(({ mechanics }) => {
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

describe("Нуль: аугментации и ровно один источник", () => {
  it("плотность: 6 выносливости и 1 устойчивость, на 4-м уровне 12", () => {
    const hero = nullHero(1, DENSITY);
    expect(featureStatContributions(hero, "stamina")).toEqual([
      {
        sourceId: "feature.null.level-1.density-augmentation",
        sourceName: "Аугментация плотности (Density Augmentation)",
        value: 6,
      },
    ]);
    expect(featureStatContributions(hero, "stability")).toEqual([
      {
        sourceId: "feature.null.level-1.density-augmentation",
        sourceName: "Аугментация плотности (Density Augmentation)",
        value: 1,
      },
    ]);

    const advanced = { ...hero, level: 4 };
    expect(featureStatContributions(advanced, "stamina")).toEqual([
      {
        sourceId: "feature.null.level-1.density-augmentation",
        sourceName: "Аугментация плотности (Density Augmentation)",
        value: 12,
      },
    ]);
  });

  it("сила: +1 только к выброшенному урону псионики", () => {
    const hero = nullHero(1, FORCE);
    expect(featureAbilityDamageContributions(psionicAbility(), hero)).toEqual([
      {
        sourceId: "feature.null.level-1.force-augmentation",
        sourceName: "Аугментация силы (Force Augmentation)",
        value: 1,
      },
    ]);
    expect(featureAbilityDamageContributions(weaponAbility(), hero)).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(0);
  });

  it("скорость: +1 к скорости и отходу, без роста по эшелонам", () => {
    for (const level of [1, 4]) {
      const hero = nullHero(level, SPEED);
      const augmentation = featureStatContributions(hero, "speed").filter(
        (contribution) =>
          contribution.sourceId ===
          "feature.null.level-1.speed-augmentation",
      );
      expect(augmentation).toEqual([
        {
          sourceId: "feature.null.level-1.speed-augmentation",
          sourceName: "Аугментация скорости (Speed Augmentation)",
          value: 1,
        },
      ]);
      // Скорость нуля прибавляет Ловкость отдельным источником.
      expect(featureStatBonus(hero, "speed")).toBe(
        hero.characteristics.agility + 1,
      );
      expect(featureStatBonus(hero, "disengage")).toBe(
        hero.characteristics.agility + 1,
      );
    }
  });

  it("старый ID и русское имя активируют ровно одну запись", () => {
    for (const selections of [DENSITY, DENSITY_ID]) {
      const hero = nullHero(1, selections);
      expect(featureStatContributions(hero, "stamina")).toHaveLength(1);
      expect(featureStatContributions(hero, "stability")).toHaveLength(1);
      const ids = activeIds(hero);
      expect(ids).toContain(
        "feature.null.level-1.density-augmentation",
      );
      expect(ids).not.toContain(
        "feature.null.level-1.force-augmentation",
      );
      expect(ids).not.toContain(
        "feature.null.level-1.speed-augmentation",
      );
    }
  });

  it("чужая группа и неизвестное значение не активируют аугментацию", () => {
    const cases = [
      { "null.augmentation": "talent.augmentation.density" },
      { "null.augmentation": "Боевая аугментация" },
      { "null.augmentation": "неизвестное значение" },
      { "talent.augmentation": "Аугментация плотности (Density Augmentation)" },
    ];
    for (const selections of cases) {
      const hero = nullHero(1, selections);
      expect(featureStatBonus(hero, "stamina"), JSON.stringify(selections)).toBe(0);
      expect(
        activeIds(hero).filter((id) => id.includes(".augmentatsiya-")),
        JSON.stringify(selections),
      ).toEqual([]);
    }
  });

  it("невыбранные аугментации скрыты и не дают чисел", () => {
    const hero = nullHero(1);
    expect(featureStatBonus(hero, "stamina")).toBe(0);
    const ids = activeIds(hero);
    expect(
      ids.filter((id) => id.includes(".augmentatsiya-")),
    ).toEqual([]);
    // Контейнер выбора остаётся на листе.
    expect(ids).toContain("feature.null.level-1.psionic-augmentation");
  });
});

describe("Нуль: Скорость нуля", () => {
  it("скорость и отход равны Ловкости и меняются вместе с ней", () => {
    const hero = nullHero(1);
    expect(hero.characteristics.agility).toBe(2);
    expect(featureStatContributions(hero, "speed")).toEqual([
      {
        sourceId: "feature.null.level-1.null-speed",
        sourceName: "Скорость нуля",
        value: 2,
      },
    ]);
    expect(featureStatContributions(hero, "disengage")).toEqual([
      {
        sourceId: "feature.null.level-1.null-speed",
        sourceName: "Скорость нуля",
        value: 2,
      },
    ]);

    const faster = {
      ...hero,
      characteristics: { ...hero.characteristics, agility: 3 },
    };
    expect(featureStatContributions(faster, "speed")).toEqual([
      {
        sourceId: "feature.null.level-1.null-speed",
        sourceName: "Скорость нуля",
        value: 3,
      },
    ]);
    expect(featureStatBonus(faster, "disengage")).toBe(3);
  });
});

describe("Нуль: Дисциплина", () => {
  it("на 1-м и 3-м уровнях четыре прибавки из книги", () => {
    for (const level of [1, 3]) {
      const gains = resolvedResourceGains(nullHero(level));
      expect(
        gains.map(
          (gain) => `${gain.tag}:${gain.event}:${gain.amount}:${gain.frequency}`,
        ),
      ).toEqual([
        "combat-start:combat-start:= Победы:encounter",
        "start-of-turn:start-of-turn:2:turn",
        "field-main-action:use-ability:1:round",
        "malice-ability:use-ability:1:round",
      ]);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
      expect(gains.every((gain) => gain.sourceId === "class:нуль")).toBe(true);
    }
  });

  it("4-й уровень заменяет основное действие врага на 2", () => {
    const gains = resolvedResourceGains(nullHero(4));
    const field = gains.filter((gain) => gain.tag === "field-main-action");
    expect(field).toHaveLength(1);
    expect(field[0].amount).toBe("2");
    expect(field[0].sourceId).toBe("feature.null.level-4.regenerative-field");
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
  });

  it("эпический пул «Порядок» открывается на 10-м уровне", () => {
    expect(resolvedEpicResourceGains(nullHero(9))).toEqual([]);
    const epic = resolvedEpicResourceGains(nullHero(10));
    expect(
      epic.map((gain) => `${gain.tag}:${gain.event}:${gain.amount}:${gain.frequency}`),
    ).toEqual(["epic-respite:respite:= Опыт:respite"]);
    expect(resourceSpecFor("Нуль")?.epic?.name).toBe("Порядок");
  });
});

describe("Нуль: мастерство дисциплины", () => {
  it("на 12 дисциплины хронокинетик даёт Интуицию к толчку и 10 временной выносливости", () => {
    const hero = withDiscipline(
      nullHero(10, {}, { subclass: "Хронокинетик" }),
      12,
    );
    const push = featureFieldContributions(hero, "push");
    expect(push).toHaveLength(1);
    expect(push[0].value).toBe(hero.characteristics.intuition);
    expect(push[0].sourceId).toBe(
      "feature.null.level-10.chronokinetic-mastery-12",
    );

    const row = classFeatureTriggers(hero).find(
      (trigger) =>
        trigger.featureId ===
        "feature.null.level-10.chronokinetic-mastery-12",
    );
    expect(row?.event).toBe("use-ability");
    expect(row?.frequency).toBe("always");
    expect(row?.detail).toContain("10");
    expect(row?.detail).toContain("временной выносливости");
  });

  it("метакинетик получает Интуицию на 2 дисциплины и не удваивает её на 12", () => {
    const hero = nullHero(10, {}, { subclass: "Метакинетик" });
    const low = withDiscipline(hero, 2);
    expect(featureFieldContributions(low, "push")).toEqual([
      {
        sourceId: "feature.null.level-1.metakinetic-mastery-2",
        sourceName: "Мастерство метакинетика: 2",
        value: 2,
      },
    ]);

    const high = withDiscipline(hero, 12);
    const push = featureFieldContributions(high, "push");
    expect(push).toHaveLength(1);
    expect(push[0].value).toBe(2);
  });

  it("строки чужой традиции не видны, а порог ниже не активирует эффект", () => {
    const chrono = withDiscipline(
      nullHero(10, {}, { subclass: "Хронокинетик" }),
      12,
    );
    const ids = activeIds(chrono);
    expect(ids).toContain("feature.null.level-1.chronokinetic-mastery-2");
    expect(ids).not.toContain("feature.null.level-1.cryokinetic-mastery-2");
    expect(ids).not.toContain("feature.null.level-1.metakinetic-mastery-2");

    const below = withDiscipline(
      nullHero(4, {}, { subclass: "Хронокинетик" }),
      7,
    );
    expect(featureFieldContributions(below, "push")).toEqual([]);
    expect(
      classFeatureTriggers(below).some(
        (trigger) =>
          trigger.featureId ===
          "feature.null.level-4.chronokinetic-mastery-8",
      ),
    ).toBe(false);
  });
});

describe("Нуль: традиция как подкласс", () => {
  it("криокинетик активирует только свои записи 2-го уровня", () => {
    const hero = nullHero(2, {}, { subclass: "Криокинетик" });
    const ids = activeIds(hero);
    expect(ids).toContain("feature.null.level-2.entropic-adaptability");
    expect(ids).toContain(
      "feature.null.level-2.cryokinetic-ability",
    );
    expect(ids).not.toContain("feature.null.level-2.rapid-processing");
    expect(ids).not.toContain("feature.null.level-2.inertial-sink");
    expect(ids).not.toContain(
      "feature.null.level-2.chronokinetic-ability",
    );
    expect(ids).not.toContain(
      "feature.null.level-2.metakinetic-ability",
    );
  });

  it("энтропийная адаптивность даёт иммунитет к холоду 2×Интуиция", () => {
    const hero = nullHero(2, {}, { subclass: "Криокинетик" });
    const immunity = featureDamageImmunities(hero).find(
      (item) => item.sourceId === "feature.null.level-2.entropic-adaptability",
    );
    expect(immunity?.types).toEqual(["холод"]);
    expect(immunity?.value).toBe(hero.characteristics.intuition * 2);
  });

  it("пустой подкласс: панель предлагает выбор и пишет его в subclass", () => {
    const hero = nullHero(2);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "null.tradition",
    );
    expect(choice?.options).toEqual([
      "Хронокинетик",
      "Криокинетик",
      "Метакинетик",
    ]);
    expect(choice?.selected).toBeUndefined();

    const selected = withClassFeatureSelection(
      hero,
      "null.tradition",
      "Хронокинетик",
    );
    expect(selected.subclass).toBe("Хронокинетик");
    expect(
      selected.automation?.classFeatureSelections?.["null.tradition"],
    ).toBe("Хронокинетик");
    expect(activeIds(selected)).toContain(
      "feature.null.level-2.rapid-processing",
    );
    expect(activeIds(selected)).not.toContain(
      "feature.null.level-2.entropic-adaptability",
    );
  });

  it("чужая и неизвестная традиция не активируют лишние записи", () => {
    for (const subclass of ["Пирокинез", ""]) {
      const ids = activeIds(nullHero(2, {}, { subclass }));
      expect(
        ids.filter((id) => id.startsWith("null.tradition.2.")),
        subclass,
      ).toEqual([]);
    }
  });
});

describe("Нуль: создание и старый лист", () => {
  it("buildCharacter пишет старые ID, подкласс и активирует аугментацию", () => {
    const hero = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Хронокинетик",
      className: "Нуль",
      subclass: "Хронокинетик",
      characteristics: startingCharacteristics("Нуль"),
      featureChoices: {
        "Псионическая аугментация": "Аугментация силы (Force Augmentation)",
      },
    });
    expect(hero.subclass).toBe("Хронокинетик");
    expect(hero.automation?.classFeatureSelections).toEqual({
      "null.augmentation": "null.augmentation.force",
    });
    expect(activeIds(hero)).toContain(
      "feature.null.level-1.force-augmentation",
    );
    expect(featureAbilityDamageBonus(psionicAbility(), hero)).toBe(1);

    const choices = classFeatureChoicesForSheet(hero);
    expect(
      choices.find((choice) => choice.group === "null.augmentation")?.selected,
    ).toBe("null.augmentation.force");
    expect(
      choices.find((choice) => choice.group === "null.tradition"),
    ).toBeUndefined();

    const reloaded = JSON.parse(JSON.stringify(hero)) as Character;
    expect(reloaded.automation?.classFeatureSelections).toEqual(
      hero.automation?.classFeatureSelections,
    );
    expect(reloaded.subclass).toBe("Хронокинетик");
    expect(featureAbilityDamageBonus(psionicAbility(), reloaded)).toBe(1);
  });

  it("старый лист без выбора получает панель и ноль бонусов", () => {
    const hero = nullHero(1);
    expect(featureStatBonus(hero, "stamina")).toBe(0);

    const choices = classFeatureChoicesForSheet(hero);
    const augmentation = choices.find(
      (choice) => choice.group === "null.augmentation",
    );
    expect(augmentation?.options).toEqual([
      "null.augmentation.density",
      "null.augmentation.force",
      "null.augmentation.speed",
    ]);
    expect(augmentation?.optionLabels?.["null.augmentation.density"]).toBe(
      "Аугментация плотности (Density Augmentation)",
    );
    expect(featureSheetChoiceState(augmentation!).selectedOption).toBe("");

    const selected = withClassFeatureSelection(
      hero,
      "null.augmentation",
      "null.augmentation.density",
    );
    expect(featureStatContributions(selected, "stamina")).toEqual([
      {
        sourceId: "feature.null.level-1.density-augmentation",
        sourceName: "Аугментация плотности (Density Augmentation)",
        value: 6,
      },
    ]);
    // Повторное применение выбора не удваивает вклад.
    expect(featureStatBonus(selected, "stamina")).toBe(6);
  });

  it("сохранённое русское название показывается как ID без предупреждения", () => {
    const hero = nullHero(1, DENSITY);
    const augmentation = classFeatureChoicesForSheet(hero).find(
      (choice) => choice.group === "null.augmentation",
    );
    expect(augmentation?.selected).toBe("null.augmentation.density");
    const state = featureSheetChoiceState(augmentation!);
    expect(state.selectedOption).toBe("null.augmentation.density");
    expect(state.warning).toBeUndefined();
  });

  it("подсказка билдера смотрит на механику, а не на старые effects", () => {
    for (const name of [
      "Аугментация плотности (Density Augmentation)",
      "Аугментация силы (Force Augmentation)",
      "Аугментация скорости (Speed Augmentation)",
    ]) {
      expect(classFeatureOptionAutomated("Нуль", name), name).toBe(true);
    }
    const nullOptions = CLASS_FEATURE_GROUPS.filter(
      (group) => group.className === "Нуль",
    ).flatMap((group) => group.options);
    expect(nullOptions.every((option) => !("effects" in option))).toBe(
      true,
    );
  });
});

describe("Нуль: выключенная автоматизация", () => {
  it("особенности и выборы видны, сохранённые значения не меняются", () => {
    const hero = nullHero(4, DENSITY);
    hero.stamina = { ...hero.stamina, current: 30, max: 60 };
    expect(activeIds(hero)).toContain(
      "feature.null.level-1.density-augmentation",
    );
    expect(featureStatBonus(hero, "stamina")).toBe(12);
    expect(hero.stamina.current).toBe(30);

    const off = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(activeIds(off)).toContain(
      "feature.null.level-1.density-augmentation",
    );
    expect(
      classFeatureChoicesForSheet(off).some(
        (choice) => choice.group === "null.augmentation",
      ),
    ).toBe(true);
    expect(featureStatBonus(off, "stamina")).toBe(0);
    expect(off.automation?.classFeatureSelections).toEqual(DENSITY);
    expect(off.stamina.max).toBe(60);
    expect(off.stamina.current).toBe(30);

    const on = { ...off, automation: { ...off.automation!, enabled: true } };
    expect(featureStatContributions(on, "stamina")).toEqual([
      {
        sourceId: "feature.null.level-1.density-augmentation",
        sourceName: "Аугментация плотности (Density Augmentation)",
        value: 12,
      },
    ]);
    expect(on.automation?.classFeatureSelections).toEqual(DENSITY);
  });
});

describe("Нуль: подарки уровней 3–4", () => {
  it("classFeatureGiftsAtLevel на 3 и 4 не пуст и называет прозу уровня", () => {
    const level3 = classFeatureGiftsAtLevel(
      nullHero(2, {}, { subclass: "Хронокинетик" }),
      3,
    ).map((feature) => feature.name);
    expect(level3).toContain("Псионический прыжок");
    expect(level3).toContain("Перестроение");

    const level4 = classFeatureGiftsAtLevel(
      nullHero(3, {}, { subclass: "Хронокинетик" }),
      4,
    ).map((feature) => feature.name);
    expect(level4).toContain("Увеличение характеристик");
    expect(level4).toContain("Улучшенное поле нуля");
    expect(level4).toContain("Улучшение мастерства дисциплины");
  });
});

describe("Нуль: повышение уровня 1→2 и 3→4", () => {
  const ENOUGH_XP = 160;

  function request(hero: Character, choices: Record<string, string[]> = {}): LevelUpRequest {
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

  function baseHero(level: number): Character {
    return nullHero(level, DENSITY, {
      subclass: "Хронокинетик",
      xp: ENOUGH_XP,
    });
  }

  it("1→2 сохраняет выборы, подкласс и прибавки", () => {
    const hero = baseHero(1);
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(2);
    expect(result.next.subclass).toBe("Хронокинетик");
    expect(result.next.automation?.classFeatureSelections).toEqual(DENSITY);
    expect(featureStatBonus(result.next, "stamina")).toBe(6);
    expect(featureStatBonus(result.next, "stability")).toBe(1);
    expect(activeIds(result.next)).toContain(
      "feature.null.level-2.rapid-processing",
    );
    expect(resolvedResourceGains(result.next)).toHaveLength(4);
  });

  it("3→4 сохраняет выборы и делает ресурс/плотность сильнее", () => {
    const hero = baseHero(3);
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(4);
    expect(result.next.automation?.classFeatureSelections).toEqual(DENSITY);
    expect(featureStatContributions(result.next, "stamina")).toEqual([
      {
        sourceId: "feature.null.level-1.density-augmentation",
        sourceName: "Аугментация плотности (Density Augmentation)",
        value: 12,
      },
    ]);
    const field = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "field-main-action",
    );
    expect(field).toHaveLength(1);
    expect(field[0].amount).toBe("2");
    expect(field[0].sourceId).toBe("feature.null.level-4.regenerative-field");
    expect(result.next.characteristics.agility).toBe(3);
    expect(result.next.characteristics.intuition).toBe(3);
  });
});
