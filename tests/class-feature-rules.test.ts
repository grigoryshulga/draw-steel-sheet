import { describe, expect, it } from "vitest";
import { BUILDER_DATA } from "../src/lib/character-builder";
import {
  CLASS_FEATURE_GROUPS,
  classFeatureGroups,
  classFeatureSelectionsFromDraft,
} from "../src/data/class-feature-rules";
import { mechanicsFor } from "../src/data/class-features/mechanics";

describe("class feature registry", () => {
  it("covers every generated feature group and option with complete Russian descriptions", () => {
    const sourceGroups = BUILDER_DATA.classes.flatMap((classData) =>
      classData.featureChoices.map((group) => ({ ...group, className: classData.name })),
    );
    const actualGroups = CLASS_FEATURE_GROUPS.map((group) => ({
      ...group,
      optionNames: group.options.map((option) => option.name),
    }));

    const legacyGroups = sourceGroups.filter((group) => group.className !== "Проводник");
    expect(CLASS_FEATURE_GROUPS).toHaveLength(legacyGroups.length);
    expect(CLASS_FEATURE_GROUPS.reduce((total, group) => total + group.options.length, 0))
      .toBe(legacyGroups.reduce((total, group) => total + group.options.length, 0));
    expect(actualGroups.map(({ name, className, optionNames }) => ({ name, className, optionNames })))
      .toEqual(legacyGroups.map((group) => ({
        name: group.name,
        className: group.className,
        optionNames: group.options.map((option) => option.name),
      })));

    for (const source of legacyGroups) {
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
    // Числа Таланта, Нуля и Элементалиста переехали в механики: эффектных
    // и условных опций старого реестра больше нет.
    expect(options.filter((option) => option.effects.length > 0)).toEqual([]);
    const conditionalOptions = options.filter((option) =>
      option.effects.some((effect) => effect.when !== undefined),
    );
    expect(conditionalOptions).toEqual([]);
    for (const option of options) {
      expect(option.effects, option.id).toEqual([]);
      expect(option.manualReason?.trim(), option.id).toBeTruthy();
    }
    expect(classFeatureGroups("Нуль")).toHaveLength(1);
    expect(classFeatureGroups("Проводник")).toHaveLength(0);
    expect(classFeatureGroups("Талант")).toHaveLength(2);
    expect(classFeatureGroups("Элементалист")).toHaveLength(2);
  });

  it("moves Talent density into mechanics and keeps the old choice as metadata", () => {
    const density = CLASS_FEATURE_GROUPS.flatMap((group) => group.options)
      .find((option) => option.id === "talent.augmentation.density");
    expect(density?.effects).toEqual([]);
    expect(density?.manualReason).toMatch(/перенес[её]н/);
    expect(density?.manualReason).not.toContain("talent.feature.1.");

    const mechanics = mechanicsFor("talent.feature.1.augmentatsiya-plotnosti");
    expect(mechanics?.effects).toEqual([
      { kind: "field", field: "stamina", value: 0, perEchelon: 6 },
      { kind: "field", field: "stability", value: 1 },
    ]);

    const distance = mechanicsFor("conduit.feature.1.molitva-o-distantsii");
    expect(distance?.effects).toEqual([
      { kind: "field", field: "distance", value: 2, filter: { keywords: ["Магия", "Дальний"] } },
    ]);

    const bastion = mechanicsFor("conduit.feature.1.obereg-bastiona");
    expect(bastion?.effects).toEqual([{ kind: "field", field: "save", value: 1 }]);
  });

  it("moves Null density into mechanics and keeps the old choice as metadata", () => {
    const nullOptions = classFeatureGroups("Нуль").flatMap((group) => group.options);
    expect(nullOptions.map((option) => option.id)).toEqual([
      "null.augmentation.density",
      "null.augmentation.force",
      "null.augmentation.speed",
    ]);
    expect(nullOptions.map((option) => option.name)).toEqual([
      "Аугментация плотности (Density Augmentation)",
      "Аугментация силы (Force Augmentation)",
      "Аугментация скорости (Speed Augmentation)",
    ]);
    for (const option of nullOptions) {
      expect(option.effects, option.id).toEqual([]);
      expect(option.manualReason, option.id).toMatch(/перенес[её]н/);
      expect(option.manualReason, option.id).not.toContain("null.feature.");
    }

    expect(
      mechanicsFor("null.feature.1.augmentatsiya-plotnosti-density-augmentation")
        ?.effects,
    ).toEqual([
      { kind: "field", field: "stamina", value: 0, perEchelon: 6 },
      { kind: "field", field: "stability", value: 1 },
    ]);
    expect(
      mechanicsFor("null.feature.1.augmentatsiya-sily-force-augmentation")
        ?.effects,
    ).toEqual([
      {
        kind: "field",
        field: "rolledDamage",
        value: 1,
        filter: { keywords: ["Псионика"] },
      },
    ]);
    expect(
      mechanicsFor("null.feature.1.augmentatsiya-skorosti-speed-augmentation")
        ?.effects,
    ).toEqual([
      { kind: "field", field: "speed", value: 1 },
      { kind: "field", field: "disengage", value: 1 },
    ]);
    for (const [id, name] of [
      [
        "null.feature.1.augmentatsiya-plotnosti-density-augmentation",
        "Аугментация плотности (Density Augmentation)",
      ],
      [
        "null.feature.1.augmentatsiya-sily-force-augmentation",
        "Аугментация силы (Force Augmentation)",
      ],
      [
        "null.feature.1.augmentatsiya-skorosti-speed-augmentation",
        "Аугментация скорости (Speed Augmentation)",
      ],
    ] as const) {
      expect(mechanicsFor(id)?.when).toEqual({ keyValue: [name] });
    }
  });

  it("moves Steel Ward into a trigger and leaves no numeric effect in the old registry", () => {
    const steelWard = CLASS_FEATURE_GROUPS.flatMap((group) => group.options)
      .find((option) => option.id === "talent.sanctuary.steel");

    expect(steelWard?.effects).toEqual([]);
    expect(steelWard?.manualReason).toMatch(/перенес[её]н/);
    expect(steelWard?.manualReason).not.toContain("talent.feature.1.");

    const mechanics = mechanicsFor("talent.feature.1.stalnoy-obereg");
    expect(mechanics?.trigger?.detail).toContain("иммунитет");
    expect(mechanics?.trigger?.detail).toContain("Разума");
    expect(mechanics?.trigger?.detail).toContain("следующего хода");
  });

  it("keeps the old Talent groups, option IDs and names without numeric effects", () => {
    const talentGroups = classFeatureGroups("Талант");
    expect(talentGroups.map((group) => group.id)).toEqual([
      "talent.augmentation",
      "talent.sanctuary",
    ]);
    expect(talentGroups.map((group) => group.name)).toEqual([
      "Псионическая аугментация",
      "Оберег таланта",
    ]);
    expect(
      talentGroups.flatMap((group) => group.options.map((option) => option.id)),
    ).toEqual([
      "talent.augmentation.battle",
      "talent.augmentation.density",
      "talent.augmentation.distance",
      "talent.augmentation.force",
      "talent.augmentation.speed",
      "talent.sanctuary.entropy",
      "talent.sanctuary.repelling",
      "talent.sanctuary.steel",
      "talent.sanctuary.vanishing",
    ]);
    expect(
      talentGroups.flatMap((group) => group.options.map((option) => option.name)),
    ).toEqual([
      "Боевая аугментация",
      "Аугментация плотности",
      "Аугментация дистанции",
      "Аугментация силы",
      "Аугментация скорости",
      "Оберег энтропии",
      "Отталкивающий оберег",
      "Стальной оберег",
      "Исчезающий оберег",
    ]);
    for (const option of talentGroups.flatMap((group) => group.options)) {
      expect(option.effects).toEqual([]);
      expect(option.manualReason).toMatch(/перенес/);
    }
  });

  it("keeps the last old Elementalist groups, option IDs and names without numeric effects", () => {
    const groups = classFeatureGroups("Элементалист");
    expect(groups.map((group) => group.id)).toEqual([
      "elementalist.enchantment",
      "elementalist.sanctuary",
    ]);
    expect(groups.map((group) => group.name)).toEqual([
      "Зачарование",
      "Оберег элементалиста",
    ]);
    expect(
      groups.flatMap((group) => group.options.map((option) => option.id)),
    ).toEqual([
      "elementalist.enchantment.battle",
      "elementalist.enchantment.speed",
      "elementalist.enchantment.destruction",
      "elementalist.enchantment.distance",
      "elementalist.enchantment.constancy",
      "elementalist.sanctuary.delightful",
      "elementalist.sanctuary.superior",
      "elementalist.sanctuary.nature",
      "elementalist.sanctuary.reactivity",
    ]);
    expect(
      groups.flatMap((group) => group.options.map((option) => option.name)),
    ).toEqual([
      "Зачарование битвы",
      "Зачарование быстроты",
      "Зачарование разрушения",
      "Зачарование дистанции",
      "Зачарование постоянства",
      "Оберег восхитительных последствий",
      "Оберег превосходной защиты",
      "Оберег привязанности природы",
      "Оберег удивительной реактивности",
    ]);
    for (const option of groups.flatMap((group) => group.options)) {
      expect(option.effects, option.id).toEqual([]);
      expect(option.manualReason, option.id).toMatch(/перенес/);
      expect(option.manualReason, option.id).not.toContain("elementalist.feature.");
      expect(option.manualReason, option.id).not.toMatch(/\d/);
    }

    // Числа зачарований и триггеры оберегов живут во вложенных механиках.
    expect(mechanicsFor("elementalist.feature.1.zacharovanie-bitvy")?.when).toEqual({
      keyValue: ["Зачарование битвы"],
    });
    expect(mechanicsFor("elementalist.feature.1.obereg-prevoskhodnoy-zashchity")?.when).toEqual({
      keyValue: ["Оберег превосходной защиты"],
    });
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
