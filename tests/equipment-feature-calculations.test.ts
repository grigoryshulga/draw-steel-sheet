import { describe, expect, it } from "vitest";
import { classFeatureSelectionsFromDraft } from "../src/data/class-feature-rules";
import {
  calculatedValues,
  characterStatBreakdown,
  recalculateCharacter,
} from "../src/lib/character-calculations";
import { createCharacter } from "../src/lib/defaults";
import {
  featureAbilityDamageBonus,
  featureAbilityDamageContributions,
  featureConditionMet,
  featureStatBonus,
  featureStatContributions,
} from "../src/lib/feature-modifiers";
import { evaluateAbilityDamage, evaluateDamage } from "../src/lib/rules";
import type { Ability, Character, FeatureEquipmentFlags } from "../src/types";

/** Real builder labels for the three conditional class options. */
const BATTLE_CHOICES: Record<string, Record<string, string>> = {
  Талант: { "Псионическая аугментация": "Боевая аугментация" },
  Проводник: { "Молитва": "Молитва о мастерстве солдата" },
  Элементалист: { "Зачарование": "Зачарование битвы" },
};

interface BattleHeroOptions {
  className?: string;
  level?: number;
  equipment?: FeatureEquipmentFlags;
  enabled?: boolean;
  kit?: string;
  secondaryKit?: string;
}

function battleHero(options: BattleHeroOptions = {}): Character {
  const className = options.className ?? "Талант";
  const character = createCharacter({ className, level: options.level ?? 1 });
  character.kit = options.kit ?? "";
  character.secondaryKit = options.secondaryKit ?? "";
  character.automation = {
    enabled: options.enabled ?? true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: classFeatureSelectionsFromDraft(
      className,
      BATTLE_CHOICES[className] ?? {},
    ),
    ...(options.equipment
      ? {
          equipment: {
            lightArmor: options.equipment.lightArmor ?? false,
            lightWeapon: options.equipment.lightWeapon ?? false,
          },
        }
      : {}),
  };
  return recalculateCharacter(character, character);
}

function weaponAbility(overrides: Partial<Ability> = {}): Ability {
  return {
    id: "test-weapon",
    name: "Тестовый удар",
    flavor: "",
    actionType: "main",
    kind: "signature",
    keywords: ["Оружие"],
    distance: "Ближний 1",
    target: "",
    rollCharacteristics: ["might"],
    preferredCharacteristic: "might",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "3 + М", effect: "" },
      { damage: "5 + М", effect: "" },
      { damage: "7 + М", effect: "" },
    ],
    effect: "",
    source: "",
    notes: "",
    ...overrides,
  };
}

const BATTLE_STAMINA = {
  sourceId: "talent.augmentation.battle",
  sourceName: "Боевая аугментация",
  value: 3,
};

describe("Talent battle augmentation", () => {
  it("keeps plain class stamina without equipment flags", () => {
    const hero = battleHero();

    expect(hero.stamina.max).toBe(18);
    expect(featureStatContributions(hero, "stamina")).toEqual([]);
    expect(featureStatBonus(hero, "stamina")).toBe(0);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(0);
  });

  it("adds +3 stamina per echelon while light armor is flagged", () => {
    const hero = battleHero({ equipment: { lightArmor: true } });
    expect(hero.stamina.max).toBe(21); // 18 class + 3
    expect(hero.stamina.current).toBe(18); // a growing maximum never heals
    expect(featureStatContributions(hero, "stamina")).toEqual([BATTLE_STAMINA]);

    hero.stamina.current = 21;
    const advanced = recalculateCharacter(hero, { ...hero, level: 4 });
    expect(advanced.stamina.max).toBe(42); // 36 class + 6
    expect(advanced.stamina.current).toBe(21);
    expect(characterStatBreakdown(advanced, "stamina")).toEqual({
      base: 36,
      contributions: [
        {
          sourceId: "talent.augmentation.battle",
          sourceName: "Боевая аугментация",
          value: 6,
        },
      ],
      adjustment: 0,
      total: 42,
    });
  });

  it("adds +1 weapon damage while light weapon is flagged", () => {
    const hero = battleHero({ equipment: { lightWeapon: true } });
    const strike = weaponAbility();

    expect(hero.stamina.max).toBe(18); // the armor part stays inactive
    expect(featureAbilityDamageContributions(strike, hero)).toEqual([
      {
        sourceId: "talent.augmentation.battle",
        sourceName: "Боевая аугментация",
        value: 1,
      },
    ]);

    const plain = evaluateDamage(strike.tiers[0].damage, hero);
    const boosted = evaluateAbilityDamage(strike, 1, hero);
    expect(boosted.values).toEqual(plain.values.map((value) => value + 1));
    expect(boosted.breakdown).toContain("Боевая аугментация");

    const magic = weaponAbility({ keywords: ["Магия"] });
    expect(featureAbilityDamageContributions(magic, hero)).toEqual([]);
    expect(
      evaluateAbilityDamage(magic, 1, hero).values,
    ).toEqual(evaluateDamage(magic.tiers[0].damage, hero).values);
  });

  it("applies both effects when both flags are set", () => {
    const hero = battleHero({
      equipment: { lightArmor: true, lightWeapon: true },
    });

    expect(featureStatBonus(hero, "stamina")).toBe(3);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(1);
  });

  it("never activates from weapon, armor or inventory prose alone", () => {
    const hero = battleHero();
    hero.weapon = "Легкое оружие";
    hero.armor = "Легкая броня";
    hero.equipmentEffects = "легкая броня и легкое оружие";
    hero.inventory = [
      {
        id: "item",
        name: "Кинжал",
        category: "gear",
        qty: 1,
        notes: "легкое оружие, легкая броня",
        equipped: true,
      },
    ];

    expect(featureStatContributions(hero, "stamina")).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(0);
    expect(featureConditionMet(hero, { equipment: "lightArmor" })).toBe(false);
    expect(featureConditionMet(hero, { equipment: "lightWeapon" })).toBe(false);
  });

  it("stays inert while automation is disabled, and returns when re-enabled", () => {
    const hero = battleHero({
      enabled: false,
      equipment: { lightArmor: true, lightWeapon: true },
    });
    expect(hero.stamina.max).toBe(18);
    expect(featureStatContributions(hero, "stamina")).toEqual([]);
    expect(featureConditionMet(hero, { equipment: "lightArmor" })).toBe(true);

    const on = recalculateCharacter(hero, {
      ...hero,
      automation: { ...hero.automation!, enabled: true },
    });
    expect(on.stamina.max).toBe(21);
    expect(featureAbilityDamageBonus(weaponAbility(), on)).toBe(1);
  });

  it("ignores selections of another class", () => {
    const hero = battleHero({ equipment: { lightArmor: true } });
    hero.automation!.classFeatureSelections = classFeatureSelectionsFromDraft(
      "Элементалист",
      BATTLE_CHOICES["Элементалист"],
    );
    expect(featureStatContributions(hero, "stamina")).toEqual([]);

    const wrongClass = battleHero({ equipment: { lightArmor: true } });
    wrongClass.className = "Нуль";
    expect(featureStatContributions(wrongClass, "stamina")).toEqual([]);
  });
});

describe("Kit restriction", () => {
  it("blocks the conditional effects when a kit is present", () => {
    const hero = battleHero({
      equipment: { lightArmor: true, lightWeapon: true },
      kit: "Беглый Огонь",
    });

    expect(featureStatContributions(hero, "stamina")).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(0);
    expect(hero.stamina.max).toBe(21); // 18 class + 3 kit only

    const secondary = battleHero({
      equipment: { lightArmor: true, lightWeapon: true },
      secondaryKit: "Снайпер",
    });
    expect(featureStatContributions(secondary, "stamina")).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), secondary)).toBe(0);
  });

  it("treats whitespace-only kit slots as empty", () => {
    const hero = battleHero({
      equipment: { lightArmor: true },
      kit: "   ",
      secondaryKit: " ",
    });

    expect(featureStatContributions(hero, "stamina")).toEqual([BATTLE_STAMINA]);
    expect(hero.stamina.max).toBe(21);
  });

  it("removes the effect when the kit is cleared again", () => {
    const kitted = battleHero({
      level: 4,
      equipment: { lightArmor: true },
      kit: "Сияющие Доспехи",
    });
    expect(featureStatBonus(kitted, "stamina")).toBe(0);

    const bare = recalculateCharacter(kitted, {
      ...kitted,
      kit: "",
      stamina: { ...kitted.stamina, current: 20 },
    });
    expect(featureStatBonus(bare, "stamina")).toBe(6);
    expect(bare.stamina.max).toBe(42); // 36 class + 6 armor trait
    expect(bare.stamina.current).toBe(20);
  });
});

describe("Conditional weapon damage", () => {
  it("allows a numeric non-roll tier for an explicit rolledOnly: false effect", () => {
    const hero = battleHero({ equipment: { lightWeapon: true } });
    const flat = weaponAbility({ rollCharacteristics: [] });

    expect(featureAbilityDamageContributions(flat, hero)).toEqual([
      {
        sourceId: "talent.augmentation.battle",
        sourceName: "Боевая аугментация",
        value: 1,
      },
    ]);
    const plain = evaluateDamage(flat.tiers[0].damage, hero);
    const boosted = evaluateAbilityDamage(flat, 1, hero);
    expect(boosted.values).toEqual(plain.values.map((value) => value + 1));
    expect(boosted.breakdown).toContain("Боевая аугментация");
  });

  it("keeps dice-only non-roll damage out of the flat bonus", () => {
    const hero = battleHero({ equipment: { lightWeapon: true } });
    const dice = weaponAbility({
      rollCharacteristics: [],
      tiers: [
        { damage: "1d6 + М", effect: "" },
        { damage: "2d6 + М", effect: "" },
        { damage: "3d6 + М", effect: "" },
      ],
    });

    expect(featureAbilityDamageContributions(dice, hero)).toEqual([]);
  });

  it("never invents damage for an empty tier", () => {
    const hero = battleHero({ equipment: { lightWeapon: true } });
    const noDamage = weaponAbility({
      rollCharacteristics: [],
      tiers: [
        { damage: "", effect: "эффект" },
        { damage: " ", effect: "эффект" },
        { damage: "", effect: "эффект" },
      ],
    });

    expect(featureAbilityDamageContributions(noDamage, hero)).toEqual([]);
    const evaluated = evaluateAbilityDamage(noDamage, 1, hero);
    expect(evaluated.values).toEqual([]);
    expect(evaluated.display).toBe("");
  });

  it("keeps the default rolledOnly rule for other damage effects", () => {
    const hero = battleHero();
    hero.automation!.classFeatureSelections = classFeatureSelectionsFromDraft(
      "Талант",
      { "Псионическая аугментация": "Аугментация силы" },
    );
    const psionic = weaponAbility({
      keywords: ["Псионика"],
      rollCharacteristics: [],
      tiers: [
        { damage: "3", effect: "" },
        { damage: "5", effect: "" },
        { damage: "7", effect: "" },
      ],
    });

    expect(featureAbilityDamageContributions(psionic, hero)).toEqual([]);
    expect(
      featureAbilityDamageBonus(weaponAbility({ keywords: ["Псионика"] }), hero),
    ).toBe(1);
  });
});

describe("Equipment changes on a saved sheet", () => {
  it("removes the stamina bonus on unequip without healing or losing the adjustment", () => {
    const armed = battleHero({
      level: 4,
      equipment: { lightArmor: true },
    });
    expect(armed.stamina.max).toBe(42);
    armed.stamina.current = 30;

    const adjusted = recalculateCharacter(armed, {
      ...armed,
      stamina: { ...armed.stamina, max: 50 },
    });
    expect(adjusted.automation?.adjustments.stamina).toBe(8);

    const unarmed = recalculateCharacter(adjusted, {
      ...adjusted,
      automation: {
        ...adjusted.automation!,
        equipment: { lightArmor: false, lightWeapon: false },
      },
    });
    expect(featureStatContributions(unarmed, "stamina")).toEqual([]);
    expect(unarmed.stamina.max).toBe(44); // 36 base + 8 manual
    expect(unarmed.stamina.current).toBe(30);
    expect(unarmed.automation?.adjustments.stamina).toBe(8);
    expect(characterStatBreakdown(unarmed, "stamina")).toEqual({
      base: 36,
      contributions: [],
      adjustment: 8,
      total: 44,
    });
  });

  it("keeps the saved numbers of a disabled sheet while flags change", () => {
    const hero = battleHero({ level: 4 });
    const off = recalculateCharacter(hero, {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    });
    const equipped = recalculateCharacter(off, {
      ...off,
      automation: {
        ...off.automation!,
        equipment: { lightArmor: true, lightWeapon: true },
      },
    });

    expect(equipped.stamina).toEqual(off.stamina);
    expect(featureStatContributions(equipped, "stamina")).toEqual([]);
    expect(calculatedValues(equipped).stamina).toBe(36);
  });
});

describe("Conditional sources for every supported class option", () => {
  it.each([
    ["Талант", "talent.augmentation.battle", "Боевая аугментация"],
    ["Проводник", "conduit.prayer.soldier", "Молитва о мастерстве солдата"],
    ["Элементалист", "elementalist.enchantment.battle", "Зачарование битвы"],
  ])("%s adds its conditional stamina source once", (className, id, name) => {
    const hero = battleHero({
      className,
      level: 4,
      equipment: { lightArmor: true, lightWeapon: true },
    });

    expect(featureStatContributions(hero, "stamina")).toEqual([
      { sourceId: id, sourceName: name, value: 6 },
    ]);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(1);
    expect(hero.stamina.max).toBe(42);
  });
});
