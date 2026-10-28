import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  classFeatureGroupsForSheet,
  matchesFeatureQuery,
  passiveClassFeatures,
} from "../src/lib/class-feature-view";
import type { Character } from "../src/types";

function censor(level = 3): Character {
  const hero = createCharacter({ className: "Цензор", level });
  hero.subclass = "Идеал";
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: { "censor.domain": "Созидание" },
  };
  return hero;
}

function names(hero: Character) {
  return passiveClassFeatures(hero).map((item) => item.name);
}

describe("пассивные эффекты класса", () => {
  it("переносит ситуативные эффекты без действия и триггера", () => {
    const list = names(censor());
    expect(list).toContain("Вести за собой");
    expect(list).toContain("Непоколебимый символ");
  });

  it("не переносит выборы, ресурсы и триггеры", () => {
    const list = names(censor());
    expect(list).not.toContain("Орден цензора");
    expect(list).not.toContain("Божество и домены");
    expect(list).not.toContain("Способность за 3 гнева");
    expect(list).not.toContain("Гнев в бою");
    expect(list).not.toContain("Суд");
    expect(list).not.toContain("Моя жизнь за твою");
    expect(list).not.toContain("Комплект");
    expect(list).not.toContain("Перк");
  });

  it("не превращает доменную способность в пассивную особенность", () => {
    expect(names(censor())).not.toContain("Руки Творца");
  });

  it("помечает пассивные записи флагом в общем списке", () => {
    const items = classFeatureGroupsForSheet(censor()).flatMap(
      (group) => group.features,
    );
    for (const item of items) {
      if (["Вести за собой", "Непоколебимый символ"].includes(item.name)) {
        expect(item.passive).toBe(true);
      }
      if (item.name === "Орден цензора") {
        expect(item.passive).toBe(false);
      }
    }
  });

  it("ищет по названию, примечанию и тексту особенности", () => {
    const item = passiveClassFeatures(censor()).find(
      (feature) => feature.name === "Непоколебимый символ",
    )!;
    expect(matchesFeatureQuery(item, "непоколебимый")).toBe(true);
    expect(matchesFeatureQuery(item, "запугивания")).toBe(true);
    expect(matchesFeatureQuery(item, "несуществующее")).toBe(false);
  });
});
