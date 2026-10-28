import { describe, expect, it, vi } from "vitest";
import { classFeatureSelectionsFromDraft } from "../src/data/class-feature-rules";
import { mechanicsFor } from "../src/data/class-features/mechanics";
import { createCharacter } from "../src/lib/defaults";
import {
  featureAbilityDamageBonus,
  featureAbilityDamageContributions,
  featureAbilityDistanceBonus,
  featureAbilityDistanceContributions,
  featureConditionMet,
  featureStatBonus,
  featureStatContributions,
} from "../src/lib/feature-modifiers";
import type { Ability, Character } from "../src/types";

function selections(
  className: string,
  choices: Record<string, string>,
): Record<string, string> {
  return classFeatureSelectionsFromDraft(className, choices);
}

interface HeroOptions {
  enabled?: boolean;
  adjustments?: NonNullable<Character["automation"]>["adjustments"];
}

function hero(
  className: string,
  level: number,
  choices: Record<string, string> = {},
  options: HeroOptions = {},
): Character {
  const character = createCharacter({ className, level });
  character.automation = {
    enabled: options.enabled ?? true,
    adjustments: options.adjustments ?? {},
    ancestryTraits: [],
    classFeatureSelections: selections(className, choices),
  };
  return character;
}

function ability(overrides: Partial<Ability> = {}): Ability {
  return {
    id: "test-ability",
    name: "Тестовая способность",
    flavor: "",
    actionType: "main",
    kind: "signature",
    keywords: [],
    distance: "Ближний 1",
    target: "",
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

const DENSITY_CHOICE = { "Псионическая аугментация": "Аугментация плотности" };

describe("Class feature stat contributions", () => {
  it.each([
    [1, 6],
    [3, 6],
    [4, 12],
    [6, 12],
    [7, 18],
    [9, 18],
    [10, 24],
  ])("level %i adds +%i stamina for density", (level, expected) => {
    const character = hero("Талант", level, DENSITY_CHOICE);
    expect(featureStatContributions(character, "stamina")).toEqual([
      {
        sourceId: "talent.feature.1.augmentatsiya-plotnosti",
        sourceName: "Аугментация плотности",
        value: expected,
      },
    ]);
    expect(featureStatBonus(character, "stamina")).toBe(expected);
    expect(featureStatBonus(character, "stability")).toBe(1);
  });

  it("reads the same density effect for the Null class", () => {
    const character = hero("Нуль", 4, {
      "Псионическая аугментация":
        "Аугментация плотности (Density Augmentation)",
    });
    expect(featureStatContributions(character, "stamina")).toEqual([
      {
        sourceId:
          "null.feature.1.augmentatsiya-plotnosti-density-augmentation",
        sourceName: "Аугментация плотности (Density Augmentation)",
        value: 12,
      },
    ]);
  });

  it("adds speed and disengage without per-echelon scaling", () => {
    for (const level of [1, 10]) {
      const character = hero("Талант", level, {
        "Псионическая аугментация": "Аугментация скорости",
      });
      expect(featureStatContributions(character, "speed")).toEqual([
        {
          sourceId: "talent.feature.1.augmentatsiya-skorosti",
          sourceName: "Аугментация скорости",
          value: 1,
        },
      ]);
      expect(featureStatBonus(character, "speed")).toBe(1);
      expect(featureStatBonus(character, "disengage")).toBe(1);
      expect(featureStatBonus(character, "stamina")).toBe(0);
    }
  });

  it("adds the Bastion save bonus", () => {
    const character = hero("Проводник", 1, {
      "Оберег проводника": "Оберег бастиона",
    });
    expect(featureStatContributions(character, "save")).toEqual([
      {
        sourceId: "conduit.feature.1.obereg-bastiona",
        sourceName: "Оберег бастиона",
        value: 1,
      },
    ]);
    expect(featureStatBonus(character, "save")).toBe(1);
    expect(featureStatBonus(character, "speed")).toBe(0);
  });

  it("does not duplicate a contribution from another group", () => {
    const character = hero("Проводник", 4, {
      "Молитва": "Молитва о стали",
      "Оберег проводника": "Оберег бастиона",
    });
    const stamina = featureStatContributions(character, "stamina");
    expect(stamina).toHaveLength(1);
    expect(new Set(stamina.map((entry) => entry.sourceId)).size).toBe(1);
    expect(featureStatBonus(character, "stamina")).toBe(12);
    expect(featureStatBonus(character, "save")).toBe(1);
  });
});

describe("Class feature damage contributions", () => {
  const magicHero = () =>
    hero("Проводник", 1, { "Молитва": "Молитва о разрушении" });
  const psionicHero = () =>
    hero("Талант", 1, { "Псионическая аугментация": "Аугментация силы" });

  it("adds magic damage to a rolled magic ability", () => {
    const spell = ability({ keywords: ["Магия"] });
    expect(featureAbilityDamageContributions(spell, magicHero())).toEqual([
      {
        sourceId: "conduit.feature.1.molitva-o-razrushenii",
        sourceName: "Молитва о разрушении",
        value: 1,
      },
    ]);
    expect(featureAbilityDamageBonus(spell, magicHero())).toBe(1);
  });

  it("adds psionic damage to a rolled psionic ability", () => {
    const power = ability({ keywords: ["Псионика", "Дальний"] });
    expect(featureAbilityDamageBonus(power, psionicHero())).toBe(1);
  });

  it("ignores case and surrounding whitespace in keywords", () => {
    const spell = ability({ keywords: ["  мАгИя "] });
    expect(featureAbilityDamageBonus(spell, magicHero())).toBe(1);
  });

  it("requires every keyword of the effect", () => {
    const spell = ability({ keywords: ["Магия", "Дальний"] });
    const meleeSpell = ability({ keywords: ["Магия", "Ближний"] });
    const conduitDistance = hero("Проводник", 1, {
      "Молитва": "Молитва о дистанции",
    });
    expect(featureAbilityDistanceBonus(spell, conduitDistance)).toBe(2);
    expect(featureAbilityDistanceBonus(meleeSpell, conduitDistance)).toBe(0);
  });

  it("does not mix magic, psionic and weapon abilities", () => {
    const psionic = ability({ keywords: ["Псионика"] });
    const magic = ability({ keywords: ["Магия"] });
    const weapon = ability({ keywords: ["Оружие"] });

    expect(featureAbilityDamageBonus(psionic, magicHero())).toBe(0);
    expect(featureAbilityDamageBonus(weapon, magicHero())).toBe(0);
    expect(featureAbilityDamageBonus(magic, psionicHero())).toBe(0);
  });

  it("does not add damage to an ability without a power roll", () => {
    const noRoll = ability({ keywords: ["Магия"], rollCharacteristics: [] });
    expect(featureAbilityDamageContributions(noRoll, magicHero())).toEqual([]);
    expect(featureAbilityDamageBonus(noRoll, magicHero())).toBe(0);
  });

  it("does not add damage to an ability without a damage formula", () => {
    const noDamage = ability({
      keywords: ["Магия"],
      tiers: [
        { damage: "", effect: "эффект" },
        { damage: " ", effect: "эффект" },
        { damage: "", effect: "эффект" },
      ],
    });
    expect(featureAbilityDamageBonus(noDamage, magicHero())).toBe(0);
  });
});

describe("Class feature distance contributions", () => {
  const rangedMagicHero = () =>
    hero("Элементалист", 1, { "Зачарование": "Зачарование дистанции" });
  const rangedPsionicHero = () =>
    hero("Талант", 1, {
      "Псионическая аугментация": "Аугментация дистанции",
    });

  it("adds distance to a ranged magic ability with its source", () => {
    const spell = ability({
      keywords: ["Магия", "Дальний"],
      weaponMode: "ranged",
    });
    expect(featureAbilityDistanceContributions(spell, rangedMagicHero())).toEqual(
      [
        {
          sourceId: "elementalist.feature.1.zacharovanie-distantsii",
          sourceName: "Зачарование дистанции",
          value: 2,
        },
      ],
    );
    expect(featureAbilityDistanceBonus(spell, rangedMagicHero())).toBe(2);
  });

  it("never gives ranged distance to a melee mode", () => {
    const dualMode = ability({
      keywords: ["Магия", "Дальний"],
      weaponMode: "melee",
    });
    expect(featureAbilityDistanceBonus(dualMode, rangedMagicHero())).toBe(0);
    expect(
      featureAbilityDistanceContributions(dualMode, rangedMagicHero()),
    ).toEqual([]);
  });

  it("requires the ranged keyword", () => {
    const meleeOnly = ability({
      keywords: ["Магия", "Ближний"],
      weaponMode: "ranged",
    });
    expect(featureAbilityDistanceBonus(meleeOnly, rangedMagicHero())).toBe(0);
  });

  it("does not mix magic and psionic distance bonuses", () => {
    const psionic = ability({
      keywords: ["Псионика", "Дальний"],
      weaponMode: "ranged",
    });
    const magic = ability({
      keywords: ["Магия", "Дальний"],
      weaponMode: "ranged",
    });
    expect(featureAbilityDistanceBonus(psionic, rangedMagicHero())).toBe(0);
    expect(featureAbilityDistanceBonus(magic, rangedPsionicHero())).toBe(0);
  });

  it("applies to a ranged ability that has no power roll", () => {
    const utility = ability({
      keywords: ["Магия", "Дальний"],
      weaponMode: "ranged",
      rollCharacteristics: [],
    });
    expect(featureAbilityDistanceBonus(utility, rangedMagicHero())).toBe(2);
  });
});

describe("Class feature activation rules", () => {
  it("ignores unknown groups and unknown options", () => {
    const character = hero("Талант", 10, DENSITY_CHOICE);
    const automation = character.automation!;
    const spell = ability({ keywords: ["Магия"] });

    automation.classFeatureSelections = { "unknown.group": "unknown.option" };
    expect(featureStatBonus(character, "stamina")).toBe(0);
    expect(featureAbilityDamageBonus(spell, character)).toBe(0);

    automation.classFeatureSelections = {
      "talent.augmentation": "unknown.option",
    };
    expect(featureStatBonus(character, "stamina")).toBe(0);
    expect(featureStatBonus(character, "stability")).toBe(0);
  });

  it("ignores selections of a different class", () => {
    const character = hero("Талант", 10, {});
    character.automation!.classFeatureSelections = selections("Проводник", {
      "Молитва": "Молитва о разрушении",
      "Оберег проводника": "Оберег бастиона",
    });
    const spell = ability({ keywords: ["Магия"] });
    expect(featureStatBonus(character, "save")).toBe(0);
    expect(featureAbilityDamageBonus(spell, character)).toBe(0);
  });

  it("ignores selections left over after a class change", () => {
    const character = hero("Талант", 4, DENSITY_CHOICE);
    character.className = "Нуль";
    expect(featureStatBonus(character, "stamina")).toBe(0);
  });

  it("does nothing while automation is disabled", () => {
    const character = hero("Нуль", 4, DENSITY_CHOICE, { enabled: false });
    const spell = ability({ keywords: ["Псионика"] });
    const ranged = ability({
      keywords: ["Псионика", "Дальний"],
      weaponMode: "ranged",
    });
    expect(featureStatBonus(character, "stamina")).toBe(0);
    expect(featureStatBonus(character, "stability")).toBe(0);
    expect(featureAbilityDamageBonus(spell, character)).toBe(0);
    expect(featureAbilityDistanceBonus(ranged, character)).toBe(0);
  });

  it("keeps conditional options inert without equipment flags", () => {
    const elementalistBattle = mechanicsFor(
      "elementalist.feature.1.zacharovanie-bitvy",
    );
    const elementalistBattleFields =
      elementalistBattle?.effects?.filter((effect) => effect.kind === "field") ??
      [];
    expect(elementalistBattleFields).toHaveLength(2);
    expect(
      elementalistBattleFields.every(
        (effect) => effect.kind === "field" && effect.when?.equipment,
      ),
    ).toBe(true);

    const talentBattle = mechanicsFor("talent.feature.1.boevaya-augmentatsiya");
    const talentBattleFields =
      talentBattle?.effects?.filter((effect) => effect.kind === "field") ?? [];
    expect(talentBattleFields).toHaveLength(2);
    expect(
      talentBattleFields.every(
        (effect) => effect.kind === "field" && effect.when?.equipment,
      ),
    ).toBe(true);
    const conduitSoldier = mechanicsFor("conduit.feature.1.molitva-o-masterstve-soldata");
    expect(conduitSoldier?.effects).toHaveLength(3);
    expect(conduitSoldier?.effects?.filter((effect) => effect.kind === "field").every((effect) => effect.when)).toBe(true);

    const talent = hero("Талант", 4, {
      "Псионическая аугментация": "Боевая аугментация",
    });
    const conduit = hero("Проводник", 4, {
      "Молитва": "Молитва о мастерстве солдата",
    });
    const elementalist = hero("Элементалист", 4, {
      "Зачарование": "Зачарование битвы",
    });
    const weapon = ability({ keywords: ["Оружие"] });

    for (const character of [talent, conduit, elementalist]) {
      expect(featureStatContributions(character, "stamina")).toEqual([]);
      expect(featureAbilityDamageBonus(weapon, character)).toBe(0);
    }
  });

  it("leaves reactive and immunity options manual without automatic effects", () => {
    for (const id of [
      "talent.feature.1.obereg-entropii",
      "talent.feature.1.stalnoy-obereg",
    ]) {
      const mechanics = mechanicsFor(id);
      expect(mechanics?.effects, id).toBeUndefined();
      expect(mechanics?.trigger, id).toBeTruthy();
    }
    const conduitReaction = mechanicsFor("conduit.feature.1.obereg-reaktsii");
    expect(conduitReaction?.effects).toBeUndefined();
    expect(conduitReaction?.trigger?.detail).toContain("смежное существо");

    const character = hero("Проводник", 4, {
      "Оберег проводника": "Оберег реакции",
    });
    expect(character.automation?.classFeatureSelections).toEqual({
      "conduit.sanctuary": "conduit.sanctuary.reaction",
    });
    expect(featureStatBonus(character, "speed")).toBe(0);
    expect(featureAbilityDamageBonus(ability(), character)).toBe(0);
  });

  it("does not mutate the sheet, saved values or manual adjustments", () => {
    const character = hero(
      "Проводник",
      4,
      {
        "Молитва": "Молитва о стали",
        "Оберег проводника": "Оберег бастиона",
      },
      { adjustments: { stamina: 7, speed: 2 } },
    );
    const before = JSON.parse(JSON.stringify(character));
    const stamina = character.stamina;
    const recoveries = character.recoveries;
    const automation = character.automation;
    const savedSelections = character.automation!.classFeatureSelections;

    expect(featureStatBonus(character, "stamina")).toBe(12);
    expect(featureStatBonus(character, "save")).toBe(1);
    expect(featureAbilityDamageBonus(ability(), character)).toBe(0);
    expect(featureAbilityDistanceBonus(ability(), character)).toBe(0);

    expect(JSON.parse(JSON.stringify(character))).toEqual(before);
    expect(character.stamina).toBe(stamina);
    expect(character.recoveries).toBe(recoveries);
    expect(character.automation).toBe(automation);
    expect(character.automation!.classFeatureSelections).toBe(savedSelections);
  });
});

describe("Keyword normalization", () => {
  it("treats ё and е as the same keyword letter", async () => {
    vi.resetModules();
    vi.doMock("../src/data/ancestry-feature-rules", () => ({
      ANCESTRY_FEATURE_RULES: [
        {
          id: "test.trait",
          name: "Тестовая черта",
          ancestryName: "Тестовая",
          description: "",
          effects: [
            {
              kind: "field" as const,
              field: "rolledDamage" as const,
              value: 2,
              filter: { keywords: ["Всё"] },
            },
          ],
        },
      ],
      ancestryTraitIdsFromNames: () => [],
    }));
    try {
      const modifiers = await import("../src/lib/feature-modifiers");
      const character = createCharacter({ ancestry: "Тестовая" });
      character.automation = {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        ancestryTraitIds: ["test.trait"],
      };
      const power = ability({ keywords: ["ВСЕ"] });
      expect(modifiers.featureAbilityDamageBonus(power, character)).toBe(2);
    } finally {
      vi.doUnmock("../src/data/ancestry-feature-rules");
      vi.resetModules();
    }
  });
});

describe("Equipment condition helper", () => {
  it("is met without a condition and never depends on automation.enabled", () => {
    const character = hero("Талант", 1, {}, { enabled: false });
    expect(featureConditionMet(character)).toBe(true);
    expect(featureConditionMet(character, {})).toBe(true);
    expect(featureConditionMet(character, { equipment: { lightArmor: true } })).toBe(
      false,
    );

    character.automation!.equipment = { lightArmor: true, lightWeapon: false };
    expect(featureConditionMet(character, { equipment: { lightArmor: true } })).toBe(
      true,
    );
    expect(featureConditionMet(character, { equipment: { lightWeapon: true } })).toBe(
      false,
    );
  });

  it("requires both kit slots to be blank for noKit", () => {
    const character = hero("Талант", 1);
    character.automation!.equipment = { lightArmor: true };
    const condition = { equipment: { lightArmor: true }, noKit: true } as const;

    expect(featureConditionMet(character, condition)).toBe(true);
    character.kit = "   ";
    expect(featureConditionMet(character, condition)).toBe(true);
    character.kit = "Беглый Огонь";
    expect(featureConditionMet(character, condition)).toBe(false);
    character.kit = "   ";
    character.secondaryKit = "Снайпер";
    expect(featureConditionMet(character, condition)).toBe(false);
    character.secondaryKit = " ";
    expect(featureConditionMet(character, condition)).toBe(true);
  });

  it("does not guess equipment from weapon, armor or inventory notes", () => {
    const character = hero("Талант", 1);
    character.weapon = "Легкое оружие";
    character.armor = "Легкая броня";
    character.equipmentEffects = "легкая броня";
    character.inventory = [
      {
        id: "item",
        name: "Кинжал",
        category: "gear",
        qty: 1,
        notes: "легкое оружие",
        equipped: true,
      },
    ];

    expect(featureConditionMet(character, { equipment: { lightArmor: true } })).toBe(
      false,
    );
    expect(featureConditionMet(character, { equipment: { lightWeapon: true } })).toBe(
      false,
    );
  });

  it("does not mutate the character or its automation", () => {
    const character = hero("Талант", 1, {}, { enabled: false });
    const before = JSON.parse(JSON.stringify(character));
    const automation = character.automation;

    expect(
      featureConditionMet(character, {
        equipment: { lightArmor: true },
        noKit: true,
      }),
    ).toBe(false);

    expect(JSON.parse(JSON.stringify(character))).toEqual(before);
    expect(character.automation).toBe(automation);
  });
});

describe("Stat stacking groups", () => {
  it("keeps only the largest contribution of a group with its own source", async () => {
    vi.resetModules();
    vi.doMock("../src/data/ancestry-feature-rules", () => ({
      ANCESTRY_FEATURE_RULES: [
        {
          id: "test.small",
          name: "Малый",
          ancestryName: "Тестовая",
          description: "",
          effects: [
            {
              kind: "field" as const,
              field: "speed" as const,
              value: 1,
              stackingGroup: "test.group",
            },
          ],
        },
        {
          id: "test.large",
          name: "Большой",
          ancestryName: "Тестовая",
          description: "",
          effects: [
            {
              kind: "field" as const,
              field: "speed" as const,
              value: 2,
              stackingGroup: "test.group",
            },
          ],
        },
        {
          id: "test.equal",
          name: "Равный",
          ancestryName: "Тестовая",
          description: "",
          effects: [
            {
              kind: "field" as const,
              field: "speed" as const,
              value: 2,
              stackingGroup: "test.group",
            },
          ],
        },
        {
          id: "test.free",
          name: "Свободный",
          ancestryName: "Тестовая",
          description: "",
          effects: [{ kind: "field" as const, field: "speed" as const, value: 1 }],
        },
      ],
      ancestryTraitIdsFromNames: () => [],
    }));
    try {
      const modifiers = await import("../src/lib/feature-modifiers");
      const character = createCharacter({ ancestry: "Тестовая" });
      character.automation = {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        ancestryTraitIds: [
          "test.small",
          "test.large",
          "test.equal",
          "test.free",
        ],
      };

      // The tie between equal values keeps the deterministic first winner.
      expect(modifiers.featureStatContributions(character, "speed")).toEqual([
        { sourceId: "test.large", sourceName: "Большой", value: 2 },
        { sourceId: "test.free", sourceName: "Свободный", value: 1 },
      ]);
      expect(modifiers.featureStatBonus(character, "speed")).toBe(3);
    } finally {
      vi.doUnmock("../src/data/ancestry-feature-rules");
      vi.resetModules();
    }
  });
});
