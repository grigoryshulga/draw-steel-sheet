import { describe, expect, it } from "vitest";
import { CLASS_RESOURCES } from "../src/data/class-features/class-resources";
import { NULL_RESOURCE } from "../src/data/class-features/mechanics/null-resource";
import { TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
  withClassFeatureSelection,
} from "../src/lib/class-feature-view";
import { createCharacter } from "../src/lib/defaults";
import { normalizeFeatureText } from "../src/lib/utils";
import type { Character } from "../src/types";

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

function sheetItems(hero: Character) {
  return classFeatureGroupsForSheet(hero).flatMap((group) => group.features);
}

function visibleText(hero: Character): string {
  return sheetItems(hero)
    .flatMap((feature) => [
      feature.summary,
      feature.notes ?? "",
      feature.detail ?? "",
      feature.trigger?.label ?? "",
      feature.trigger?.detail ?? "",
      ...feature.badges.map((badge) => badge.label),
    ])
    .join(" ");
}

const FORBIDDEN = [
  "light",
  "keyValue",
  "rolledOnly",
  "SUBCLASS_",
  "adjacent-enemy-damages-you",
  "sourceId",
  "generated.json",
  "null.feature.",
  "null.tradition.",
  "null.augmentation.",
  "forced-movement",
  "damageImmunity",
  "when.",
];

describe("Нуль: видимый текст без внутренних имён", () => {
  it("notes, summary, триггеры и бейджи чистые для всех традиций и выборов", () => {
    const heroes: Character[] = [
      nullHero(10),
      nullHero(10, {
        "null.augmentation": "Аугментация плотности (Density Augmentation)",
      }),
      nullHero(10, { "null.augmentation": "null.augmentation.speed" }),
      ...["Хронокинетик", "Криокинетик", "Метакинетик"].flatMap((subclass) =>
        [5, 6, 7, 8, 9, 10].map((level) =>
          nullHero(level, {}, { subclass }),
        ),
      ),
    ];

    const leaks: string[] = [];
    for (const hero of heroes) {
      const text = visibleText(hero);
      for (const token of FORBIDDEN) {
        if (text.includes(token)) {
          leaks.push(
            `${token} в листе ${hero.name || "героя"} (ур. ${hero.level}, ${hero.subclass || "без традиции"})`,
          );
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("notes и причины прозы не содержат технических имён", () => {
    const nullFeatures = GENERATED_CLASS_FEATURES.filter(
      (feature) => feature.className === "Нуль",
    );
    const leaked: string[] = [];
    for (const feature of nullFeatures) {
      const text = [
        mechanicsFor(feature.id)?.notes ?? "",
        TEXT_ONLY[feature.id] ?? "",
      ].join(" ");
      for (const token of FORBIDDEN) {
        if (text.includes(token)) leaked.push(`${feature.id}: ${token}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("строка иммунитета читается по-русски", () => {
    const hero = nullHero(2, {}, { subclass: "Криокинетик" });
    const item = sheetItems(hero).find(
      (feature) => feature.name === "Энтропийная адаптивность",
    );
    expect(item?.summary).toContain("иммунитет к холоду 4");
    expect(item?.summary).not.toContain("damageImmunity");
  });
});

describe("Нуль: старый лист и выборы на 5–10 уровнях", () => {
  it("сохранённая аугментация показывается одной строкой", () => {
    const hero = nullHero(10, {
      "null.augmentation": "Аугментация плотности (Density Augmentation)",
    });
    const augmentations = sheetItems(hero).filter((feature) =>
      feature.name.startsWith("Аугментация"),
    );
    expect(augmentations.map((feature) => feature.name)).toEqual([
      "Аугментация плотности (Density Augmentation)",
    ]);
    expect(augmentations[0].summary).toContain("выносливость");
  });

  it("выбор традиции на 9-м уровне включает записи 5/8 уровней", () => {
    const hero = nullHero(9);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "null.tradition",
    );
    expect(choice?.options).toEqual([
      "Хронокинетик",
      "Криокинетик",
      "Метакинетик",
    ]);

    const selected = withClassFeatureSelection(
      hero,
      "null.tradition",
      "Хронокинетик",
    );
    expect(selected.subclass).toBe("Хронокинетик");
    const ids = sheetItems(selected).map((feature) => feature.id);
    expect(ids).toContain("null.tradition.5.mgnovennoe-deystvie");
    expect(ids).toContain("null.tradition.8.razdelennyy-impuls");
    expect(ids).not.toContain("null.tradition.5.okhlazhdayushchaya-gotovnost");
    expect(ids).not.toContain("null.tradition.8.inertsionnyy-gasitel");
  });

  it("«Порядок» и «Резонанс манифольда» видны прозой на 10-м уровне", () => {
    const text = visibleText(nullHero(10, {}, { subclass: "Метакинетик" }));
    expect(text).toContain("Порядок");
    expect(text).toContain("Пси-усиление");
    expect(text).toContain("Поле нуля");
  });
});

describe("Нуль: частичный перенос класса", () => {
  it("класс в NOT_YET виден на листе только после регистрации ресурса", () => {
    const hidden = classFeatureGroupsForSheet(
      createCharacter({ className: "Трубадур", level: 1 }),
    )
      .flatMap((group) => group.features)
      .map((feature) => feature.name);
    expect(hidden).not.toContain("Партнер по сцене");

    const key = normalizeFeatureText("Трубадур");
    CLASS_RESOURCES[key] = NULL_RESOURCE;
    try {
      const shown = classFeatureGroupsForSheet(
        createCharacter({ className: "Трубадур", level: 1 }),
      )
        .flatMap((group) => group.features)
        .map((feature) => feature.name);
      expect(shown).toContain("Партнер по сцене");
    } finally {
      delete CLASS_RESOURCES[key];
    }
  });
});
