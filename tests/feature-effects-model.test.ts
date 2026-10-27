import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { fieldEffectContributions, resolveFeatureAmount } from "../src/lib/feature-modifiers";
import type { FeatureEffect } from "../src/data/class-features/types";
import type { Ability, Character } from "../src/types";
import { currentRuntime } from "../src/lib/runtime";

const ability = (keywords: string[]): Ability => ({
  id: "a", name: "a", flavor: "", actionType: "main", kind: "heroic",
  keywords, distance: "Ближний 1", target: "", rollCharacteristics: ["might"],
  preferredCharacteristic: "might", rollBonus: 0, resourceCost: 1, trigger: "",
  tiers: [{ damage: "3", effect: "" }, { damage: "5", effect: "" }, { damage: "7", effect: "" }],
  effect: "", source: "", notes: "",
});

it("бонус к толчку применяется только к способностям с нужным ключевым словом", () => {
  const hero = createCharacter({ className: "Неистовый" });
  const effects: FeatureEffect[] = [{ kind: "field", field: "push", value: 1, filter: { keywords: ["Оружие"] } }];
  expect(fieldEffectContributions(effects, hero, "push", ability(["Оружие"]))).toHaveLength(1);
  expect(fieldEffectContributions(effects, hero, "push", ability(["Магия"]))).toHaveLength(0);
});

it("значение-характеристика и значение-уровень считаются в числа и следят за уровнем", () => {
  const hero = { ...createCharacter({ className: "Неистовый" }), level: 3 };
  hero.characteristics.might = 2;
  expect(resolveFeatureAmount(hero, { characteristic: "might" })).toBe(2);
  expect(resolveFeatureAmount(hero, { level: true })).toBe(3);
  expect(resolveFeatureAmount({ ...hero, level: 4 }, { level: true })).toBe(4);
  expect(resolveFeatureAmount(hero, 4)).toBe(4);
});

it("эффекты в одной группе не складываются: побеждает максимальный", () => {
  const hero = createCharacter({ className: "Неистовый" });
  const effects: FeatureEffect[] = [
    { kind: "field", field: "speed", value: 1, stackingGroup: "base-speed" },
    { kind: "field", field: "speed", value: 2, stackingGroup: "base-speed" },
  ];
  expect(fieldEffectContributions(effects, hero, "speed")).toHaveLength(1);
  expect(fieldEffectContributions(effects, hero, "speed")[0].value).toBe(2);
});

it("условие по ресурсу и по снаряжению решает, действует ли эффект", () => {
  const hero = createCharacter({ className: "Неистовый" });
  hero.heroicResource.current = 1;
  const effects: FeatureEffect[] = [{ kind: "field", field: "push", value: 2, when: { resourceAtLeast: { name: "Свирепость", value: 2 } } }];
  expect(fieldEffectContributions(effects, hero, "push")).toHaveLength(0);
  hero.heroicResource.current = 2;
  expect(fieldEffectContributions(effects, hero, "push")).toHaveLength(1);

  const equipmentEffects: FeatureEffect[] = [
    { kind: "field", field: "speed", value: 1, when: { equipment: { lightArmor: true } } },
  ];
  expect(fieldEffectContributions(equipmentEffects, hero, "speed")).toHaveLength(0);
  hero.automation = {
    enabled: false,
    adjustments: {},
    ancestryTraits: [],
    equipment: { lightArmor: true },
  };
  expect(fieldEffectContributions(equipmentEffects, hero, "speed")).toHaveLength(1);
});

describe("migrated field semantics", () => {
  it("scales a characteristic amount by echelon instead of losing perEchelon", () => {
    const hero = { ...createCharacter({ className: "Неистовый" }), level: 7 };
    hero.characteristics.might = 2;
    const effects: FeatureEffect[] = [
      { kind: "field", field: "potency", value: { characteristic: "might" }, perEchelon: 1 },
    ];
    // 2 (Мощь) + 1 * эшелон(7) = 5
    expect(fieldEffectContributions(effects, hero, "potency")[0].value).toBe(5);
  });

  it("requires equipment flags and a blank kit for equipment conditions", () => {
    const hero = createCharacter({ className: "Проводник" });
    const effects: FeatureEffect[] = [
      {
        kind: "field",
        field: "stamina",
        value: 0,
        perEchelon: 3,
        when: { equipment: { lightArmor: true }, noKit: true },
      },
    ];
    expect(fieldEffectContributions(effects, hero, "stamina")).toHaveLength(0);

    hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [], equipment: { lightArmor: true } };
    expect(fieldEffectContributions(effects, hero, "stamina")).toHaveLength(1);

    hero.kit = "Сияющие Доспехи";
    expect(fieldEffectContributions(effects, hero, "stamina")).toHaveLength(0);
  });

  it("keeps distance off melee mode and rolled damage off non-roll abilities", () => {
    const hero = createCharacter({ className: "Неистовый" });
    const effects: FeatureEffect[] = [
      { kind: "field", field: "distance", value: 2, filter: { keywords: ["Дальний"] } },
      { kind: "field", field: "rolledDamage", value: 1, filter: { keywords: ["Оружие"] } },
    ];
    const ranged = { ...ability(["Дальний", "Оружие"]), weaponMode: "ranged" as const };
    expect(fieldEffectContributions(effects, hero, "distance", ranged)).toHaveLength(1);
    expect(
      fieldEffectContributions(effects, hero, "distance", { ...ranged, weaponMode: "melee" }),
    ).toHaveLength(0);

    const flat = { ...ability(["Оружие"]), rollCharacteristics: [] as Ability["rollCharacteristics"] };
    expect(fieldEffectContributions(effects, hero, "rolledDamage", flat)).toHaveLength(0);
    expect(
      fieldEffectContributions(effects, hero, "rolledDamage", { ...flat, rollCharacteristics: ["might"] }),
    ).toHaveLength(1);
  });
});

describe("filter mode, keyValue, formActive and cap", () => {
  it("applies a mode filter only to abilities of that weapon mode", () => {
    const hero = createCharacter({ className: "Неистовый" });
    const effects: FeatureEffect[] = [
      { kind: "field", field: "distance", value: 2, filter: { mode: "ranged" } },
    ];
    const ranged = { ...ability([]), weaponMode: "ranged" as const };
    expect(fieldEffectContributions(effects, hero, "distance", ranged)).toHaveLength(1);
    expect(
      fieldEffectContributions(effects, hero, "distance", { ...ranged, weaponMode: "melee" }),
    ).toHaveLength(0);
  });

  it("matches keyValue by selected option id and by its name", () => {
    const hero = createCharacter({ className: "Неистовый" });
    hero.automation = {
      enabled: true,
      adjustments: {},
      ancestryTraits: [],
      classFeatureSelections: { "talent.augmentation": "talent.augmentation.density" },
    };
    const effects: FeatureEffect[] = [
      { kind: "field", field: "speed", value: 1, when: { keyValue: ["talent.augmentation.density"] } },
      { kind: "field", field: "stability", value: 1, when: { keyValue: ["  АУГМЕНТАЦИЯ плотности "] } },
      { kind: "field", field: "save", value: 1, when: { keyValue: ["Берсерк"] } },
    ];
    expect(fieldEffectContributions(effects, hero, "speed")).toHaveLength(1);
    expect(fieldEffectContributions(effects, hero, "stability")).toHaveLength(1);
    expect(fieldEffectContributions(effects, hero, "save")).toHaveLength(0);
  });

  it("does not treat another class's subclass as a Fury aspect", () => {
    const effects: FeatureEffect[] = [
      { kind: "field", field: "speed", value: 1, when: { keyValue: ["Берсерк"] } },
    ];
    const fury = { ...createCharacter({ className: "Неистовый" }), subclass: "Берсерк" };
    const conduit = { ...createCharacter({ className: "Проводник" }), subclass: "Берсерк" };
    fury.automation = { enabled: true, adjustments: {}, ancestryTraits: [] };
    conduit.automation = { enabled: true, adjustments: {}, ancestryTraits: [] };
    expect(fieldEffectContributions(effects, fury, "speed")).toHaveLength(1);
    expect(fieldEffectContributions(effects, conduit, "speed")).toHaveLength(0);

    const selectedDomains = {
      ...conduit,
      automation: {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        classFeatureSelections: { "conduit.domain": "Жизнь, Защита" },
      },
    };
    const commaCompatibility: FeatureEffect[] = [
      {
        kind: "field",
        field: "speed",
        value: 1,
        when: { keyValue: ["Жизнь, Защита"] },
      },
    ];
    expect(
      fieldEffectContributions(commaCompatibility, selectedDomains, "speed"),
    ).toHaveLength(1);
  });

  it("applies formActive only while runtime.forms contains the form", () => {
    const base = createCharacter({ className: "Неистовый" });
    const withForms = (forms: string[]): Character => ({
      ...base,
      runtime: { ...currentRuntime(base), forms },
    });
    const effects: FeatureEffect[] = [
      { kind: "field", field: "speed", value: 1, when: { formActive: "Теневая форма" } },
    ];
    expect(fieldEffectContributions(effects, base, "speed")).toHaveLength(0);
    expect(
      fieldEffectContributions(effects, withForms(["ТЕНЕВАЯ ФОРМА"]), "speed"),
    ).toHaveLength(1);
    expect(
      fieldEffectContributions(effects, withForms(["Элементальная форма"]), "speed"),
    ).toHaveLength(0);
  });

  it("caps the scaled value from above", () => {
    const hero = { ...createCharacter({ className: "Неистовый" }), level: 4 };
    const effects: FeatureEffect[] = [
      { kind: "field", field: "stamina", value: 3, perEchelon: 2, cap: 5 },
      { kind: "field", field: "stability", value: 1, cap: 1 },
    ];
    // 3 + 2 * эшелон(4) = 7, ограничено до 5.
    expect(fieldEffectContributions(effects, hero, "stamina")[0].value).toBe(5);
    expect(fieldEffectContributions(effects, hero, "stability")[0].value).toBe(1);
  });
});
