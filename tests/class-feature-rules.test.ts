import { describe, expect, it } from "vitest";
import { BUILDER_DATA } from "../src/lib/character-builder";
import {
  CLASS_FEATURE_GROUPS,
  classFeatureGroups,
  classFeatureSelectionsFromDraft,
} from "../src/data/class-feature-rules";

describe("class feature registry", () => {
  it("covers every generated feature group and option with complete Russian descriptions", () => {
    const sourceGroups = BUILDER_DATA.classes.flatMap((classData) =>
      classData.featureChoices.map((group) => ({ ...group, className: classData.name })),
    );
    const actualGroups = CLASS_FEATURE_GROUPS.map((group) => ({
      ...group,
      optionNames: group.options.map((option) => option.name),
    }));

    expect(CLASS_FEATURE_GROUPS).toHaveLength(7);
    expect(CLASS_FEATURE_GROUPS.reduce((total, group) => total + group.options.length, 0)).toBe(30);
    expect(actualGroups.map(({ name, className, optionNames }) => ({ name, className, optionNames })))
      .toEqual(sourceGroups.map((group) => ({
        name: group.name,
        className: group.className,
        optionNames: group.options.map((option) => option.name),
      })));

    for (const source of sourceGroups) {
      const group = CLASS_FEATURE_GROUPS.find(
        (candidate) => candidate.className === source.className && candidate.name === source.name,
      )!;
      for (const sourceOption of source.options) {
        const option = group.options.find((candidate) => candidate.name === sourceOption.name)!;
        expect(option.description).toBe(sourceOption.text);
        expect(option.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("uses unique explicit ASCII IDs and keeps the supported numerical set fully automated", () => {
    const groupIds = CLASS_FEATURE_GROUPS.map((group) => group.id);
    const optionIds = CLASS_FEATURE_GROUPS.flatMap((group) => group.options.map((option) => option.id));
    const ids = [...groupIds, ...optionIds];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z]+(?:\.[a-z]+)+$/.test(id))).toBe(true);

    const options = CLASS_FEATURE_GROUPS.flatMap((group) => group.options);
    expect(options.filter((option) => option.effects.length > 0)).toHaveLength(19);
    const conditionalOptions = options.filter((option) =>
      option.effects.some((effect) => effect.when !== undefined),
    );
    expect(conditionalOptions.map((option) => option.id)).toEqual([
      "conduit.prayer.soldier",
      "talent.augmentation.battle",
      "elementalist.enchantment.battle",
    ]);
    for (const option of conditionalOptions) {
      expect(option.effects).toEqual([
        { kind: "stat", stat: "stamina", value: 0, perEchelon: 3, when: { equipment: "lightArmor", noKit: true } },
        { kind: "damage", value: 1, keywords: ["Оружие"], rolledOnly: false, when: { equipment: "lightWeapon", noKit: true } },
      ]);
      expect(option.manualReason).toBeUndefined();
    }
    for (const option of options) {
      if (option.effects.length === 0) expect(option.manualReason?.trim()).toBeTruthy();
      else expect(option.manualReason).toBeUndefined();
    }
    expect(classFeatureGroups("Нуль")).toHaveLength(1);
    expect(classFeatureGroups("Проводник")).toHaveLength(2);
    expect(classFeatureGroups("Талант")).toHaveLength(2);
    expect(classFeatureGroups("Элементалист")).toHaveLength(2);
  });

  it("records density, ranged distance, and Bastion save effects", () => {
    const density = CLASS_FEATURE_GROUPS.flatMap((group) => group.options)
      .find((option) => option.id === "talent.augmentation.density");
    expect(density?.effects).toEqual([
      { kind: "stat", stat: "stamina", value: 0, perEchelon: 6 },
      { kind: "stat", stat: "stability", value: 1 },
    ]);

    const distance = CLASS_FEATURE_GROUPS.flatMap((group) => group.options)
      .find((option) => option.id === "conduit.prayer.distance");
    expect(distance?.effects).toEqual([
      { kind: "distance", value: 2, keywords: ["Дальний", "Магия"] },
    ]);

    const bastion = CLASS_FEATURE_GROUPS.flatMap((group) => group.options)
      .find((option) => option.id === "conduit.sanctuary.bastion");
    expect(bastion?.effects).toEqual([{ kind: "stat", stat: "save", value: 1 }]);
  });

  it("keeps Steel Ward manual with a reason matching its triggered temporary immunity", () => {
    const steelWard = CLASS_FEATURE_GROUPS.flatMap((group) => group.options)
      .find((option) => option.id === "talent.sanctuary.steel");

    expect(steelWard?.effects).toEqual([]);
    expect(steelWard?.manualReason).toContain("после получения урона");
    expect(steelWard?.manualReason).toContain("до конца вашего следующего хода");
    expect(steelWard?.manualReason).toContain("отслеживать вручную");
    expect(steelWard?.manualReason).not.toContain("нескольким видам");
  });

  it("maps only known choices belonging to the requested class", () => {
    expect(classFeatureSelectionsFromDraft("Талант", {
      "Псионическая аугментация": "Аугментация плотности",
      "Оберег таланта": "Стальной оберег",
      "Молитва": "Молитва о скорости",
      "несуществующая группа": "несуществующая опция",
    })).toEqual({
      "talent.augmentation": "talent.augmentation.density",
      "talent.sanctuary": "talent.sanctuary.steel",
    });

    expect(classFeatureSelectionsFromDraft("Талант", {
      "Псионическая аугментация": "Аугментация силы (Force Augmentation)",
      "Оберег таланта": "неизвестно",
      "Молитва": "Молитва о разрушении",
    })).toEqual({});
  });
});
