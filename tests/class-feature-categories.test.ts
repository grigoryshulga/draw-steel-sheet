import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  classFeatureGroupsForSheet,
  featureCategoryOptions,
  filterFeatureGroups,
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
    expect(categoryOf(censor(), "censor.feature.1.orden-tsenzora")).toBe(
      "subclass",
    );
    expect(categoryOf(censor(), "censor.feature.1.bozhestvo-i-domeny")).toBe(
      "subclass",
    );
  });

  it("относит правила гнева к ресурсу", () => {
    expect(categoryOf(censor(), "censor.feature.1.gnev-v-boyu")).toBe(
      "resource",
    );
    expect(categoryOf(censor(), "censor.feature.1.gnev-vne-boya")).toBe(
      "resource",
    );
  });

  it("относит срабатывания к триггерам, а выборы способностей — к выбору", () => {
    expect(categoryOf(censor(), "censor.feature.1.moya-zhizn-za-tvoyu")).toBe(
      "trigger",
    );
    expect(categoryOf(censor(), "censor.feature.1.sposobnost-za-3-gneva")).toBe(
      "choice",
    );
  });

  it("оставляет базовые правила класса в категории «Класс»", () => {
    expect(categoryOf(censor(), "censor.feature.1.komplekt")).toBe("class");
  });

  it("строит чипы «Все» и непустые категории, сумма совпадает с числом записей", () => {
    const groups = classFeatureGroupsForSheet(censor());
    const items = groups.flatMap((group) => group.features);
    const options = featureCategoryOptions(groups);
    expect(options[0]).toMatchObject({ key: "all", label: "Все", count: items.length });
    const sum = options
      .slice(1)
      .reduce((total, option) => total + option.count, 0);
    expect(sum).toBe(items.length);
    for (const option of options.slice(1)) {
      expect(option.count).toBeGreaterThan(0);
      expect(option.label).toBe(
        FEATURE_CATEGORY_LABELS[option.key as keyof typeof FEATURE_CATEGORY_LABELS],
      );
    }
  });

  it("фильтрует по категории, сохраняя уровни и убирая пустые группы", () => {
    const groups = classFeatureGroupsForSheet(censor());
    const filtered = filterFeatureGroups(groups, "resource");
    expect(filtered.length).toBeGreaterThan(0);
    const items = filtered.flatMap((group) => group.features);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.category === "resource")).toBe(true);
    // Уровни идут по возрастанию, пустых групп нет.
    expect(filtered.map((group) => group.level)).toEqual(
      [...filtered.map((group) => group.level)].sort((a, b) => a - b),
    );
    expect(filtered.every((group) => group.features.length > 0)).toBe(true);
  });

  it("«Все» возвращает исходный набор без изменений", () => {
    const groups = classFeatureGroupsForSheet(censor());
    const all = filterFeatureGroups(groups, "all");
    expect(all.flatMap((group) => group.features)).toHaveLength(
      groups.flatMap((group) => group.features).length,
    );
  });
});
