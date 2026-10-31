import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  classFeatureGroupsForSheet,
  featureCategoryGroups,
  FEATURE_CATEGORY_LABELS,
} from "../src/lib/class-feature-view";
import type { Character } from "../src/types";

function censor(level = 3): Character {
  const hero = createCharacter({ className: "Цензор", level });
  hero.subclass = "Идеал";
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: { "censor.domain": "Знание" },
  };
  return hero;
}

function itemsOf(hero: Character) {
  return classFeatureGroupsForSheet(hero).flatMap((group) => group.features);
}

function categoryOf(hero: Character, id: string) {
  return itemsOf(hero).find((item) => item.id === id)?.category;
}

describe("категории особенностей класса", () => {
  it("помечает каждую карточку известной категорией", () => {
    const items = itemsOf(censor());
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(FEATURE_CATEGORY_LABELS[item.category]).toBeTruthy();
    }
  });

  it("относит орден и домен к подклассу", () => {
    expect(categoryOf(censor(), "feature.censor.level-1.censor-order")).toBe(
      "subclass",
    );
    expect(categoryOf(censor(), "feature.censor.level-1.deity-and-domains")).toBe(
      "subclass",
    );
  });

  it("относит правила гнева к ресурсу", () => {
    expect(categoryOf(censor(), "feature.censor.level-1.wrath-in-combat")).toBe(
      "resource",
    );
    expect(categoryOf(censor(), "feature.censor.level-1.wrath-outside-of-combat")).toBe(
      "resource",
    );
  });

  it("относит срабатывания к триггерам, а выборы способностей — к выбору", () => {
    expect(categoryOf(censor(), "feature.censor.level-1.my-life-for-yours")).toBe(
      "trigger",
    );
    expect(categoryOf(censor(), "feature.censor.level-1.3-wrath-ability")).toBe(
      "choice",
    );
  });

  it("оставляет базовые правила класса в категории «Класс»", () => {
    expect(categoryOf(censor(), "feature.censor.level-1.kit")).toBe("class");
  });

  it("делит панель на секции категорий в заданном порядке", () => {
    const groups = featureCategoryGroups(classFeatureGroupsForSheet(censor()));
    const order = groups.map((group) => group.key);
    expect(order).toEqual([
      "class",
      "subclass",
      "resource",
      "choice",
      "trigger",
    ]);
    expect(groups.every((group) => group.features.length > 0)).toBe(true);
    expect(groups.map((group) => group.title)).toEqual(
      order.map((key) => FEATURE_CATEGORY_LABELS[key]),
    );
  });

  it("сохраняет все карточки и порядок уровней внутри категории", () => {
    const levels = classFeatureGroupsForSheet(censor());
    const groups = featureCategoryGroups(levels);
    const total = levels.flatMap((group) => group.features).length;
    const flat = groups.flatMap((group) => group.features);
    expect(flat).toHaveLength(total);
    for (const group of groups) {
      const groupLevels = group.features.map((item) => item.level);
      expect(groupLevels).toEqual([...groupLevels].sort((a, b) => a - b));
    }
  });

  it("уровни больше не создают отдельные секции", () => {
    const groups = featureCategoryGroups(classFeatureGroupsForSheet(censor()));
    expect(groups.some((group) => group.title.startsWith("Уровень"))).toBe(
      false,
    );
  });
});
