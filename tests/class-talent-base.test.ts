import { describe, expect, it } from "vitest";
import { CLASS_FEATURE_GROUPS } from "../src/data/class-feature-rules";
import { resourceSpecFor } from "../src/data/class-features/class-resources";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "../src/lib/class-features";
import {
  classFeatureChoicesForSheet,
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
import { featureEquipmentRequirements } from "../src/lib/feature-equipment-requirements";
import {
  featureAbilityDamageBonus,
  featureAbilityDamageContributions,
  featureAbilityDistanceContributions,
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
 * Талант с выбранными аугментацией и оберегом. Значения — русские имена
 * старых опций, как их пишет билдер; движок разворачивает их в ID.
 */
function talent(
  level = 1,
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

const DENSITY = { "talent.augmentation": "Аугментация плотности" };
const SPEED = { "talent.augmentation": "Аугментация скорости" };
const FORCE = { "talent.augmentation": "Аугментация силы" };
const DISTANCE = { "talent.augmentation": "Аугментация дистанции" };
const BATTLE = { "talent.augmentation": "Боевая аугментация" };
const STEEL = { "talent.sanctuary": "Стальной оберег" };

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
const psionicRanged = () =>
  ability(["Псионика", "Дальний"], { weaponMode: "ranged" });
const weaponAbility = () =>
  ability(["Оружие", "Ближний"], {
    rollCharacteristics: ["might"],
    preferredCharacteristic: "might",
  });

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

const TALENT_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Талант",
);

describe("Талант: production-реестры", () => {
  it("ресурс Ясность задан, без временных подмен", () => {
    const spec = resourceSpecFor("Талант");
    expect(spec?.name).toBe("Ясность");
    expect(spec?.canBeNegative).toBe(true);
    expect(spec?.epic?.name).toBe("Видение");
    expect(spec?.epic?.level).toBe(10);
  });

  it("уровни 1–4 покрыты механикой или прозой с причиной", () => {
    const uncovered = TALENT_FEATURES.filter((feature) => feature.level <= 4)
      .filter((feature) => {
        if (mechanicsFor(feature.id)) return false;
        const reason = TEXT_ONLY[feature.id];
        return typeof reason !== "string" || reason.trim() === "";
      });
    expect(
      uncovered.map((feature) => `${feature.name} (ур. ${feature.level})`),
    ).toEqual([]);
  });

  it("механика без эффектов, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = TALENT_FEATURES.filter((feature) => feature.level <= 4)
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

describe("Талант: выбор аугментации и оберега", () => {
  it("активны только выбранные записи, смена выбора меняет набор", () => {
    const chosen = talent(1, { ...DENSITY, ...STEEL });
    const ids = activeIds(chosen);
    expect(ids).toContain("talent.feature.1.augmentatsiya-plotnosti");
    expect(ids).toContain("talent.feature.1.stalnoy-obereg");
    expect(ids).not.toContain("talent.feature.1.augmentatsiya-sily");
    expect(ids).not.toContain("talent.feature.1.obereg-entropii");
    expect(ids).not.toContain("talent.feature.1.ottalkivayushchiy-obereg");
    expect(ids).not.toContain("talent.feature.1.ischezayushchiy-obereg");

    const changed = talent(1, { ...FORCE, "talent.sanctuary": "Оберег энтропии" });
    const changedIds = activeIds(changed);
    expect(changedIds).toContain("talent.feature.1.augmentatsiya-sily");
    expect(changedIds).toContain("talent.feature.1.obereg-entropii");
    expect(changedIds).not.toContain("talent.feature.1.augmentatsiya-plotnosti");
    expect(changedIds).not.toContain("talent.feature.1.stalnoy-obereg");
  });

  it("неизвестное значение не активирует ни одну дочернюю запись", () => {
    const ids = activeIds(
      talent(1, {
        "talent.augmentation": "unknown.option",
        "talent.sanctuary": "unknown.sanctuary",
      }),
    );
    const childIds = [
      "talent.feature.1.boevaya-augmentatsiya",
      "talent.feature.1.augmentatsiya-plotnosti",
      "talent.feature.1.augmentatsiya-distantsii",
      "talent.feature.1.augmentatsiya-sily",
      "talent.feature.1.augmentatsiya-skorosti",
      "talent.feature.1.obereg-entropii",
      "talent.feature.1.ottalkivayushchiy-obereg",
      "talent.feature.1.stalnoy-obereg",
      "talent.feature.1.ischezayushchiy-obereg",
    ];
    expect(ids.filter((id) => childIds.includes(id))).toEqual([]);
    // Контейнеры выбора остаются на листе.
    expect(ids).toContain("talent.feature.1.psionicheskaya-augmentatsiya");
    expect(ids).toContain("talent.feature.1.obereg-talanta");
  });

  it("сохранённый старый ID активирует ту же запись", () => {
    const saved = talent(1, { "talent.augmentation": "talent.augmentation.density" });
    expect(activeIds(saved)).toContain("talent.feature.1.augmentatsiya-plotnosti");
    expect(featureStatBonus(saved, "stamina")).toBe(6);
  });

  it("оберег выбирает ровно один триггер с книжным событием, частотой и подписью", () => {
    const cases = [
      [
        "Оберег энтропии",
        "talent.feature.1.obereg-entropii",
        "take-damage",
        "Существо наносит тебе урон",
      ],
      [
        "Отталкивающий оберег",
        "talent.feature.1.ottalkivayushchiy-obereg",
        "adjacent-enemy-damages-you",
        "Смежное существо наносит тебе урон",
      ],
      [
        "Стальной оберег",
        "talent.feature.1.stalnoy-obereg",
        "take-damage",
        "Ты получаешь урон",
      ],
      [
        "Исчезающий оберег",
        "talent.feature.1.ischezayushchiy-obereg",
        "take-damage",
        "Ты получаешь урон",
      ],
    ] as const;
    for (const [name, featureId, event, label] of cases) {
      const hero = talent(1, { "talent.sanctuary": name });
      const sanctuaryTriggers = classFeatureTriggers(hero).filter((trigger) =>
        trigger.featureId.startsWith("talent.feature.1."),
      );
      expect(sanctuaryTriggers.map((trigger) => trigger.featureId)).toEqual([
        featureId,
      ]);
      expect(sanctuaryTriggers[0].event).toBe(event);
      expect(sanctuaryTriggers[0].frequency).toBe("always");
      expect(sanctuaryTriggers[0].label).toBe(label);
      expect(sanctuaryTriggers[0].detail.trim()).not.toBe("");
    }

    const steel = classFeatureTriggers(talent(1, STEEL))[0];
    expect(steel.event).toBe("take-damage");
    expect(steel.frequency).toBe("always");
    expect(steel.detail).toContain("иммунитет");
    expect(steel.detail).toContain("Разума");

    const entropy = classFeatureTriggers(
      talent(1, { "talent.sanctuary": "Оберег энтропии" }),
    )[0];
    expect(entropy.detail).toContain("скорость");
    expect(entropy.detail).toContain("триггеры");

    const repelling = classFeatureTriggers(
      talent(1, { "talent.sanctuary": "Отталкивающий оберег" }),
    )[0];
    expect(repelling.event).toBe("adjacent-enemy-damages-you");
    expect(repelling.detail).toContain("смежное");
  });
});

describe("Талант: суммы и ровно один источник", () => {
  it("плотность: 6 выносливости и 1 устойчивость, на 4-м уровне 12", () => {
    const hero = talent(1, DENSITY);
    expect(featureStatContributions(hero, "stamina")).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-plotnosti",
        sourceName: "Аугментация плотности",
        value: 6,
      },
    ]);
    expect(featureStatContributions(hero, "stability")).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-plotnosti",
        sourceName: "Аугментация плотности",
        value: 1,
      },
    ]);

    const advanced = { ...hero, level: 4 };
    expect(featureStatContributions(advanced, "stamina")).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-plotnosti",
        sourceName: "Аугментация плотности",
        value: 12,
      },
    ]);
    expect(featureStatBonus(advanced, "stamina")).toBe(12);
  });

  it("сила: +1 только к выброшенному урону псионики", () => {
    const hero = talent(1, FORCE);
    expect(featureAbilityDamageContributions(psionicAbility(), hero)).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-sily",
        sourceName: "Аугментация силы",
        value: 1,
      },
    ]);
    expect(featureAbilityDamageContributions(weaponAbility(), hero)).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(0);

    const flatPsionic = ability(["Псионика"], { rollCharacteristics: [] });
    expect(featureAbilityDamageBonus(flatPsionic, hero)).toBe(0);
  });

  it("скорость: +1 к скорости и отходу, без роста по эшелонам", () => {
    for (const level of [1, 4]) {
      const hero = talent(level, SPEED);
      expect(featureStatContributions(hero, "speed")).toEqual([
        {
          sourceId: "talent.feature.1.augmentatsiya-skorosti",
          sourceName: "Аугментация скорости",
          value: 1,
        },
      ]);
      expect(featureStatBonus(hero, "disengage")).toBe(1);
    }
  });

  it("дистанция: +2 только дальнобойной псионике", () => {
    const hero = talent(1, DISTANCE);
    expect(featureAbilityDistanceContributions(psionicRanged(), hero)).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-distantsii",
        sourceName: "Аугментация дистанции",
        value: 2,
      },
    ]);
    expect(featureAbilityDistanceContributions(weaponAbility(), hero)).toEqual([]);
  });

  it("боевая аугментация: 3/1 с бронёй и оружием, 0 с комплектом или без флагов", () => {
    const hero = talent(1, BATTLE, {
      automation: {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        classFeatureSelections: BATTLE,
        equipment: { lightArmor: true, lightWeapon: true },
      },
    });
    expect(featureStatContributions(hero, "stamina")).toEqual([
      {
        sourceId: "talent.feature.1.boevaya-augmentatsiya",
        sourceName: "Боевая аугментация",
        value: 3,
      },
    ]);
    expect(featureAbilityDamageContributions(weaponAbility(), hero)).toEqual([
      {
        sourceId: "talent.feature.1.boevaya-augmentatsiya",
        sourceName: "Боевая аугментация",
        value: 1,
      },
    ]);

    const withKit = { ...hero, kit: "Воинский комплект" };
    expect(featureStatContributions(withKit, "stamina")).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), withKit)).toBe(0);

    const withoutFlags = {
      ...hero,
      automation: {
        ...hero.automation!,
        equipment: { lightArmor: false, lightWeapon: false },
      },
    };
    expect(featureStatContributions(withoutFlags, "stamina")).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), withoutFlags)).toBe(0);

    // Броня и оружие проверяются независимо: часть аугментации работает без второй.
    const armorOnly = {
      ...hero,
      automation: {
        ...hero.automation!,
        equipment: { lightArmor: true, lightWeapon: false },
      },
    };
    expect(featureStatBonus(armorOnly, "stamina")).toBe(3);
    expect(featureAbilityDamageContributions(weaponAbility(), armorOnly)).toEqual([]);

    const weaponOnly = {
      ...hero,
      automation: {
        ...hero.automation!,
        equipment: { lightArmor: false, lightWeapon: true },
      },
    };
    expect(featureStatContributions(weaponOnly, "stamina")).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), weaponOnly)).toBe(1);
  });

  it("каждый числовой эффект входит один раз: старого реестра больше нет", () => {
    const talentOptions = CLASS_FEATURE_GROUPS.filter(
      (group) => group.className === "Талант",
    ).flatMap((group) => group.options);
    expect(talentOptions.every((option) => option.effects.length === 0)).toBe(true);

    for (const [selections, field, expected] of [
      [DENSITY, "stamina", 6],
      [DENSITY, "stability", 1],
      [SPEED, "speed", 1],
      [SPEED, "disengage", 1],
    ] as const) {
      const contributions = featureStatContributions(
        talent(1, selections),
        field,
      );
      expect(contributions, field).toHaveLength(1);
      expect(contributions[0].value, field).toBe(expected);
    }
    expect(
      featureAbilityDamageContributions(psionicAbility(), talent(1, FORCE)),
    ).toHaveLength(1);
    expect(
      featureAbilityDistanceContributions(psionicRanged(), talent(1, DISTANCE)),
    ).toHaveLength(1);
  });
});

describe("Талант: снаряжение через поля авторасчёта", () => {
  function builtBattleHero(equipment?: { lightArmor?: boolean; lightWeapon?: boolean }) {
    return buildCharacter({
      ...emptyBuilderDraft(),
      name: "Боевой талант",
      className: "Талант",
      subclass: "Телекинез",
      characteristics: startingCharacteristics("Талант"),
      featureChoices: { "Псионическая аугментация": "Боевая аугментация" },
      ...(equipment ? { equipment } : {}),
    });
  }

  it("билдер пишет старый ID и флаги, числа идут из механики", () => {
    const hero = builtBattleHero({ lightArmor: true, lightWeapon: true });
    expect(hero.automation?.classFeatureSelections).toEqual({
      "talent.augmentation": "talent.augmentation.battle",
    });
    expect(hero.automation?.equipment).toEqual({
      lightArmor: true,
      lightWeapon: true,
    });
    expect(featureStatBonus(hero, "stamina")).toBe(3);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(1);
  });

  it("комплект и снятые флаги обнуляют условные числа", () => {
    const equipped = builtBattleHero({ lightArmor: true, lightWeapon: true });
    const kitted = { ...equipped, kit: "Проводник комплект" };
    expect(featureStatBonus(kitted, "stamina")).toBe(0);
    expect(featureAbilityDamageBonus(weaponAbility(), kitted)).toBe(0);

    const bare = builtBattleHero({ lightArmor: false, lightWeapon: false });
    expect(featureStatBonus(bare, "stamina")).toBe(0);
    expect(featureAbilityDamageBonus(weaponAbility(), bare)).toBe(0);
  });

  it("featureEquipmentRequirements показывает оба поля только для боевой аугментации", () => {
    expect(
      featureEquipmentRequirements("Талант", {
        "talent.augmentation": "talent.augmentation.battle",
      }),
    ).toEqual({ lightArmor: true, lightWeapon: true });
    expect(
      featureEquipmentRequirements("Талант", {
        "talent.augmentation": "Боевая аугментация",
      }),
    ).toEqual({ lightArmor: true, lightWeapon: true });
    expect(
      featureEquipmentRequirements("Талант", DENSITY),
    ).toBeUndefined();
  });
});

describe("Талант: Ясность", () => {
  it("на 1-м и 3-м уровнях три прибавки из книги", () => {
    for (const level of [1, 3]) {
      const gains = resolvedResourceGains(talent(level));
      expect(gains.map((gain) => `${gain.tag}:${gain.event}:${gain.amount}:${gain.frequency}`)).toEqual([
        "combat-start:combat-start:= Победы:encounter",
        "start-of-turn:start-of-turn:1d3:turn",
        "forced-movement:forced-movement:1:round",
      ]);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
      expect(gains.every((gain) => gain.sourceId === "class:талант")).toBe(true);
    }
  });

  it("4-й уровень заменяет принудительное движение на 2", () => {
    const gains = resolvedResourceGains(talent(4));
    const forced = gains.filter((gain) => gain.tag === "forced-movement");
    expect(forced).toHaveLength(1);
    expect(forced[0].amount).toBe("2");
    expect(forced[0].sourceId).toBe("talent.feature.4.vosstanovlenie-razuma");
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
  });

  it("до 10-го уровня эпического пула нет, на 10-м он «Видение»", () => {
    expect(resolvedEpicResourceGains(talent(9))).toEqual([]);
    const epic = resolvedEpicResourceGains(talent(10));
    expect(epic.map((gain) => `${gain.event}:${gain.amount}:${gain.frequency}`)).toEqual([
      "respite:= Опыт:respite",
    ]);
    expect(resourceSpecFor("Талант")?.epic?.name).toBe("Видение");
  });
});

describe("Талант: традиция как подкласс", () => {
  it("Телекинез активирует только свои записи 1–2 уровней", () => {
    const hero = talent(2, {}, { subclass: "Телекинез" });
    const ids = activeIds(hero);
    expect(ids).toContain("talent.tradition.1.malyy-telekinez");
    expect(ids).toContain("talent.tradition.1.otrazhenie");
    expect(ids).toContain("talent.tradition.2.oblegchenie-padeniya");
    expect(ids).toContain("talent.feature.2.sposobnosti-telekineza-2-go-urovnya");
    expect(ids).not.toContain("talent.tradition.1.uskorenie");
    expect(ids).not.toContain("talent.tradition.1.petlya-obratnoy-svyazi");
    expect(ids).not.toContain("talent.tradition.2.oblegchenie-chasov");
    expect(ids).not.toContain("talent.feature.2.sposobnosti-khronopatii-2-go-urovnya");
    expect(ids).not.toContain("talent.feature.2.sposobnosti-telepatii-2-go-urovnya");
  });

  it("чужая и неизвестная традиция не активируют лишние записи", () => {
    const chrono = activeIds(talent(2, {}, { subclass: "Хронопатия" }));
    expect(chrono).toContain("talent.tradition.2.oblegchenie-chasov");
    expect(chrono).not.toContain("talent.tradition.2.oblegchenie-padeniya");

    for (const subclass of ["Пирокинез", "Теле", ""]) {
      const ids = activeIds(talent(2, {}, { subclass }));
      expect(
        ids.filter((id) => id.startsWith("talent.tradition.1.") || id.startsWith("talent.tradition.2.")),
        subclass,
      ).toEqual([]);
    }
  });

  it("пустой подкласс: панель предлагает выбор и пишет его в subclass", () => {
    const hero = talent(2);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "talent.tradition",
    );
    expect(choice?.options).toEqual(["Хронопатия", "Телекинез", "Телепатия"]);
    expect(choice?.selected).toBeUndefined();

    const selected = withClassFeatureSelection(hero, "talent.tradition", "Телекинез");
    expect(selected.subclass).toBe("Телекинез");
    expect(selected.automation?.classFeatureSelections?.["talent.tradition"]).toBe(
      "Телекинез",
    );
    expect(activeIds(selected)).toContain("talent.tradition.2.oblegchenie-padeniya");
  });
});

describe("Талант: создание и старый лист", () => {
  it("buildCharacter пишет старые ID, подкласс и способности традиции", () => {
    const hero = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Телекинетик",
      className: "Талант",
      subclass: "Телекинез",
      characteristics: startingCharacteristics("Талант"),
      featureChoices: {
        "Псионическая аугментация": "Аугментация силы",
        "Оберег таланта": "Стальной оберег",
      },
    });
    expect(hero.subclass).toBe("Телекинез");
    expect(hero.automation?.classFeatureSelections).toEqual({
      "talent.augmentation": "talent.augmentation.force",
      "talent.sanctuary": "talent.sanctuary.steel",
    });
    expect(activeIds(hero)).toContain("talent.feature.1.augmentatsiya-sily");
    expect(activeIds(hero)).toContain("talent.feature.1.stalnoy-obereg");

    const choices = classFeatureChoicesForSheet(hero);
    expect(choices.find((choice) => choice.group === "talent.augmentation")?.selected).toBe(
      "talent.augmentation.force",
    );
    expect(choices.find((choice) => choice.group === "talent.sanctuary")?.selected).toBe(
      "talent.sanctuary.steel",
    );

    const reloaded = JSON.parse(JSON.stringify(hero)) as Character;
    expect(reloaded.automation?.classFeatureSelections).toEqual(
      hero.automation?.classFeatureSelections,
    );
    expect(reloaded.subclass).toBe("Телекинез");
    expect(featureAbilityDamageBonus(psionicAbility(), reloaded)).toBe(1);
  });

  it("старый лист без выбора получает панель и ноль бонусов", () => {
    const hero = talent(1);
    expect(featureStatBonus(hero, "stamina")).toBe(0);

    const choices = classFeatureChoicesForSheet(hero);
    const augmentation = choices.find(
      (choice) => choice.group === "talent.augmentation",
    );
    expect(augmentation?.options).toEqual([
      "talent.augmentation.battle",
      "talent.augmentation.density",
      "talent.augmentation.distance",
      "talent.augmentation.force",
      "talent.augmentation.speed",
    ]);
    expect(augmentation?.optionLabels?.["talent.augmentation.density"]).toBe(
      "Аугментация плотности",
    );
    expect(featureSheetChoiceState(augmentation!).selectedOption).toBe("");

    const selected = withClassFeatureSelection(
      hero,
      "talent.augmentation",
      "talent.augmentation.density",
    );
    expect(featureStatContributions(selected, "stamina")).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-plotnosti",
        sourceName: "Аугментация плотности",
        value: 6,
      },
    ]);
    // Повторное применение выбора не удваивает вклад.
    expect(featureStatBonus(selected, "stamina")).toBe(6);
  });

  it("сохранённое русское название показывается как ID без предупреждения", () => {
    const hero = talent(1, DENSITY);
    const augmentation = classFeatureChoicesForSheet(hero).find(
      (choice) => choice.group === "talent.augmentation",
    );
    expect(augmentation?.selected).toBe("talent.augmentation.density");
    const state = featureSheetChoiceState(augmentation!);
    expect(state.selectedOption).toBe("talent.augmentation.density");
    expect(state.warning).toBeUndefined();
  });

  it("подсказка билдера смотрит на механику, а не на старые effects", () => {
    expect(classFeatureOptionAutomated("Талант", "Боевая аугментация")).toBe(true);
    expect(classFeatureOptionAutomated("Талант", "Аугментация плотности")).toBe(true);
    expect(classFeatureOptionAutomated("Талант", "Стальной оберег")).toBe(true);
    expect(
      classFeatureOptionAutomated(
        "Нуль",
        "Аугментация плотности (Density Augmentation)",
      ),
    ).toBe(true);
  });
});

describe("Талант: выключенная автоматизация", () => {
  it("особенности и выборы видны, сохранённые значения не меняются", () => {
    const first = talent(1, DENSITY);
    expect(featureStatBonus(first, "stamina")).toBe(6);

    const hero = talent(4, DENSITY);
    hero.stamina = { ...hero.stamina, current: 30, max: 60 };
    expect(activeIds(hero)).toContain("talent.feature.1.augmentatsiya-plotnosti");
    expect(featureStatBonus(hero, "stamina")).toBe(12);
    expect(hero.stamina.current).toBe(30);

    const off = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(activeIds(off)).toContain("talent.feature.1.augmentatsiya-plotnosti");
    expect(classFeatureChoicesForSheet(off).some(
      (choice) => choice.group === "talent.augmentation",
    )).toBe(true);
    expect(featureStatBonus(off, "stamina")).toBe(0);
    expect(off.automation?.classFeatureSelections).toEqual(DENSITY);
    expect(off.stamina.max).toBe(60);
    expect(off.stamina.current).toBe(30);

    const on = { ...off, automation: { ...off.automation!, enabled: true } };
    expect(featureStatContributions(on, "stamina")).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-plotnosti",
        sourceName: "Аугментация плотности",
        value: 12,
      },
    ]);
    expect(on.automation?.classFeatureSelections).toEqual(DENSITY);
  });
});

describe("Талант: повышение уровня 1→2 и 3→4", () => {
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
    const hero = talent(level, { ...DENSITY, ...STEEL }, {
      subclass: "Телекинез",
      xp: ENOUGH_XP,
    });
    return hero;
  }

  it("1→2 сохраняет выборы, уровень и прибавки", () => {
    const hero = baseHero(1);
    const result = expectOk(previewLevelUp(hero, request(hero, firstChoices(hero))));
    expect(result.next.level).toBe(2);
    expect(result.next.subclass).toBe("Телекинез");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      ...DENSITY,
      ...STEEL,
    });
    expect(featureStatBonus(result.next, "stamina")).toBe(6);
    expect(featureStatBonus(result.next, "stability")).toBe(1);
    expect(activeIds(result.next)).toContain("talent.tradition.2.oblegchenie-padeniya");
    expect(resolvedResourceGains(result.next)).toHaveLength(3);
  });

  it("3→4 сохраняет выборы и делает ресурс/плотность сильнее", () => {
    const hero = baseHero(3);
    const result = expectOk(previewLevelUp(hero, request(hero, firstChoices(hero))));
    expect(result.next.level).toBe(4);
    expect(result.next.automation?.classFeatureSelections).toEqual({
      ...DENSITY,
      ...STEEL,
    });
    expect(featureStatContributions(result.next, "stamina")).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-plotnosti",
        sourceName: "Аугментация плотности",
        value: 12,
      },
    ]);
    const forced = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "forced-movement",
    );
    expect(forced).toHaveLength(1);
    expect(forced[0].amount).toBe("2");
    expect(forced[0].sourceId).toBe("talent.feature.4.vosstanovlenie-razuma");
  });
});
