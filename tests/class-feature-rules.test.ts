import { describe, expect, it } from "vitest";
import { BUILDER_DATA } from "../src/lib/character-builder";
import {
  CLASS_FEATURE_GROUPS,
  classFeatureGroups,
  classFeatureSelectionsFromDraft,
} from "../src/data/class-feature-rules";
import { mechanicsFor } from "../src/data/class-features/mechanics";

/**
 * Старый реестр после миграции — только метаданные выбора: ID, имена и тексты
 * для сохранённых листов и конструктора. Числа и триггеры живут в механиках.
 */
describe("class feature selection metadata", () => {
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

  it("uses unique explicit ASCII IDs and no numeric fields", () => {
    const groupIds = CLASS_FEATURE_GROUPS.map((group) => group.id);
    const optionIds = CLASS_FEATURE_GROUPS.flatMap((group) => group.options.map((option) => option.id));
    const ids = [...groupIds, ...optionIds];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z]+(?:\.[a-z]+)+$/.test(id))).toBe(true);

    for (const option of CLASS_FEATURE_GROUPS.flatMap((group) => group.options)) {
      expect("effects" in option, option.id).toBe(false);
      expect("manualReason" in option, option.id).toBe(false);
    }
    expect(classFeatureGroups("Нуль")).toHaveLength(1);
    expect(classFeatureGroups("Проводник")).toHaveLength(0);
    expect(classFeatureGroups("Талант")).toHaveLength(2);
    expect(classFeatureGroups("Элементалист")).toHaveLength(2);
  });

  it("keeps Talent, Null and Elementalist choice IDs and names", () => {
    expect(classFeatureGroups("Нуль").flatMap((group) => group.options.map((option) => option.id))).toEqual([
      "null.augmentation.density",
      "null.augmentation.force",
      "null.augmentation.speed",
    ]);
    expect(classFeatureGroups("Талант").flatMap((group) => group.options.map((option) => option.id))).toEqual([
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
    expect(classFeatureGroups("Талант").flatMap((group) => group.options.map((option) => option.name))).toEqual([
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
    expect(classFeatureGroups("Элементалист").map((group) => group.id)).toEqual([
      "elementalist.enchantment",
      "elementalist.sanctuary",
    ]);
    expect(classFeatureGroups("Элементалист").map((group) => group.name)).toEqual([
      "Зачарование",
      "Оберег элементалиста",
    ]);
    expect(
      classFeatureGroups("Элементалист").flatMap((group) => group.options.map((option) => option.id)),
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
  });

  it("points saved choices at mechanics, not at old numeric effects", () => {
    expect(mechanicsFor("talent.feature.1.augmentatsiya-plotnosti")?.effects).toEqual([
      { kind: "field", field: "stamina", value: 0, perEchelon: 6 },
      { kind: "field", field: "stability", value: 1 },
    ]);
    expect(mechanicsFor("null.feature.1.augmentatsiya-sily-force-augmentation")?.when).toEqual({
      keyValue: ["Аугментация силы (Force Augmentation)"],
    });
    expect(mechanicsFor("talent.feature.1.stalnoy-obereg")?.trigger?.detail).toContain("иммунитет");
    expect(mechanicsFor("elementalist.feature.1.zacharovanie-bitvy")?.when).toEqual({
      keyValue: ["Зачарование битвы"],
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
