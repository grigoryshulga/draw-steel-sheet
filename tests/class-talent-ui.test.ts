import { describe, expect, it } from "vitest";
import { TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { activeClassFeatures } from "../src/lib/class-features";
import {
  classFeatureGiftsAtLevel,
  classFeatureGroupsForSheet,
  classFeatureLegacyGroupsForSheet,
  classFeatureOptionAutomated,
  featureSheetChoiceState,
} from "../src/lib/class-feature-view";
import { createCharacter } from "../src/lib/defaults";
import type { Character } from "../src/types";

function talent(selections: Record<string, string> = {}): Character {
  const hero = createCharacter({ className: "Талант", level: 4 });
  hero.subclass = "Телекинез";
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: selections,
  };
  return hero;
}

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

describe("Талант: подписи и панель", () => {
  it("владение боевой аугментации читается по-русски", () => {
    const groups = classFeatureGroupsForSheet(
      talent({ "talent.augmentation": "Боевая аугментация" }),
    );
    const battle = groups
      .flatMap((group) => group.features)
      .find((feature) => feature.name === "Боевая аугментация");
    expect(battle?.summary).toContain("владение: лёгкая броня, лёгкое оружие, клады");
    expect(battle?.summary).not.toContain("light");
  });

  it("старая панель не дублирует перенесённые группы Таланта и Нуля", () => {
    expect(classFeatureLegacyGroupsForSheet(talent()).map((group) => group.id)).toEqual([]);
    expect(
      classFeatureLegacyGroupsForSheet(createCharacter({ className: "Нуль" })).map(
        (group) => group.id,
      ),
    ).toEqual([]);
    expect(
      classFeatureLegacyGroupsForSheet(
        createCharacter({ className: "Элементалист" }),
      ).map((group) => group.id),
    ).toEqual([]);
  });

  it("подсказка билдера понимает и числовые аугментации, и обереги-триггеры", () => {
    expect(classFeatureOptionAutomated("Талант", "Аугментация плотности")).toBe(true);
    expect(classFeatureOptionAutomated("Талант", "Стальной оберег")).toBe(true);
    expect(classFeatureOptionAutomated("Талант", "Исчезающий оберег")).toBe(true);
    expect(classFeatureOptionAutomated("Талант", "неизвестная опция")).toBe(false);
  });

  it("предупреждение неизвестного выбора не говорит о доменах", () => {
    const state = featureSheetChoiceState({
      group: "talent.augmentation",
      label: "Псионическая аугментация",
      options: ["talent.augmentation.density"],
      selected: "unknown.value",
    });
    expect(state.selectedOption).toBe("");
    expect(state.warning).toContain("не входит в список доступных вариантов");
    expect(state.warning).not.toContain("домен");
  });
});

describe("Талант: прозаические записи и подарки уровней 1–4", () => {
  const talentAtLevel = (level: number): Character => {
    const hero = createCharacter({ className: "Талант", level });
    hero.subclass = "Телекинез";
    return hero;
  };

  it("после удаления NOT_YET на листе видны прозаические записи", () => {
    const names = classFeatureGroupsForSheet(talentAtLevel(4))
      .flatMap((group) => group.features)
      .map((feature) => feature.name);
    for (const name of [
      "Ясность в бою",
      "Ясность вне боя",
      "Телепатическая речь",
      "Сканирование",
      "Проекция разума",
      "Подвешивающее поле",
      "Увеличение характеристик",
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it("classFeatureGiftsAtLevel на 3 и 4 не пуст и называет прозу уровня", () => {
    const level3 = classFeatureGiftsAtLevel(talentAtLevel(2), 3).map(
      (feature) => feature.name,
    );
    expect(level3).toContain("Сканирование");

    const level4 = classFeatureGiftsAtLevel(talentAtLevel(3), 4).map(
      (feature) => feature.name,
    );
    expect(level4).toContain("Проекция разума");
    expect(level4).toContain("Подвешивающее поле");
    expect(level4).toContain("Увеличение характеристик");
  });
});

describe("Талант: сохранённое значение не активирует чужую группу", () => {
  it("оберег в выборе аугментации не включает оберег", () => {
    const ids = activeIds(talent({ "talent.augmentation": "talent.sanctuary.steel" }));
    expect(ids).not.toContain("talent.feature.1.stalnoy-obereg");
    expect(ids).not.toContain("talent.feature.1.augmentatsiya-plotnosti");
  });

  it("аугментация в выборе оберега не включает аугментацию", () => {
    const ids = activeIds(
      talent({ "talent.sanctuary": "talent.augmentation.density" }),
    );
    expect(ids).not.toContain("talent.feature.1.augmentatsiya-plotnosti");
    expect(ids).not.toContain("talent.feature.1.stalnoy-obereg");
  });

  it("две традиции в одном сохранении не включают обе", () => {
    const hero = talent({ "talent.tradition": "Телекинез, Телепатия" });
    hero.subclass = "Телекинез, Телепатия";
    const ids = activeIds(hero);
    expect(ids.filter((id) => id.startsWith("talent.tradition."))).toEqual([]);
  });
});

describe("Талант: visible sheet text has no internal names", () => {
  const forbidden = [
    "light",
    "keyValue",
    "rolledOnly",
    "SUBCLASS_",
    "adjacent-enemy-damages-you",
    "sourceId",
    "generated.json",
    "talent.feature.",
    "talent.augmentation.",
    "talent.sanctuary.",
    "forced-movement",
    "when.",
  ];

  const visibleText = (hero: Character): string =>
    classFeatureGroupsForSheet(hero)
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

  it("notes, summary, triggers and badges are clean for every choice", () => {
    const leaks: string[] = [];
    const augmentations = [
      "Боевая аугментация",
      "Аугментация плотности",
      "Аугментация дистанции",
      "Аугментация силы",
      "Аугментация скорости",
    ];
    const sanctuaries = [
      "Оберег энтропии",
      "Отталкивающий оберег",
      "Стальной оберег",
      "Исчезающий оберег",
    ];
    const heroes: Character[] = [
      talent(),
      ...["Хронопатия", "Телекинез", "Телепатия"].map((subclass) => {
        const hero = createCharacter({ className: "Талант", level: 10 });
        hero.subclass = subclass;
        hero.automation = {
          enabled: true,
          adjustments: {},
          ancestryTraits: [],
          classFeatureSelections: {},
        };
        return hero;
      }),
      ...augmentations.map((value) =>
        talent({ "talent.augmentation": value }),
      ),
      ...sanctuaries.map((value) => talent({ "talent.sanctuary": value })),
    ];
    for (const hero of heroes) {
      const text = visibleText(hero);
      for (const token of forbidden) {
        if (text.includes(token)) leaks.push(`${token} in ${hero.name || "sheet"}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("mechanic notes never contain technical identifiers", () => {
    const talentFeatures = GENERATED_CLASS_FEATURES.filter(
      (feature) => feature.className === "Талант",
    );
    const leaked: string[] = [];
    for (const feature of talentFeatures) {
      const text = [
        mechanicsFor(feature.id)?.notes ?? "",
        TEXT_ONLY[feature.id] ?? "",
      ].join(" ");
      for (const token of forbidden) {
        if (text.includes(token)) leaked.push(`${feature.id}: ${token}`);
      }
    }
    expect(leaked).toEqual([]);
  });
});
