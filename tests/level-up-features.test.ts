import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  getLevelUpPlan,
  uncoveredRuleFeatures,
} from "../src/lib/level-up";
import { normalizeFeatureText } from "../src/lib/utils";
import { classFeatureGiftsAtLevel, classFeatureGroupsForSheet } from "../src/lib/class-feature-view";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import type { Character } from "../src/types";

/** Записи доменов Проводника: канонические ID строк, привязанных к домену. */
const conduitDomainFeatureIds = new Set(
  GENERATED_CLASS_FEATURES.filter(
    (feature) =>
      feature.className === "Проводник" && feature.keyedBy === "domain",
  ).map((feature) => feature.id),
);
const isConduitDomainFeature = (id: string) =>
  conduitDomainFeatureIds.has(id);

/** Неистовый 1-го уровня с выбранным аспектом: подкласс хранится в `subclass`. */
function fury(aspect: string, level = 1): Character {
  const hero = createCharacter({ className: "Неистовый", level });
  hero.subclass = aspect;
  return hero;
}

describe("план повышения уровня и особенности класса", () => {
  it("показывает выбранный домен и его комплемент на уровнях получения 1–8", () => {
    const hero = createCharacter({ className: "Проводник", level: 1 });
    hero.automation = {
      enabled: false,
      adjustments: {},
      ancestryTraits: [],
      classFeatureSelections: {
        "conduit.domain": "Жизнь, Защита",
        "conduit.domain.1": "Жизнь",
        "conduit.domain.4": "Защита",
        "conduit.domain.7": "Жизнь",
      },
    };
    const expected = new Map([
      [2, ["Защита"]], [3, []], [4, ["Защита"]], [5, ["Жизнь"]],
      [6, []], [7, ["Жизнь"]], [8, ["Защита"]],
    ]);
    for (let level = 2; level <= 8; level += 1) {
      const gifts = classFeatureGiftsAtLevel(hero, level).filter((item) => isConduitDomainFeature(item.id));
      expect(gifts.map((item) => item.level), `gift level ${level}`).toEqual(
        (expected.get(level) ?? []).map(() => level),
      );
      const planHero = { ...hero, level: level - 1 };
      const plan = getLevelUpPlan(planHero);
      expect(plan.classFeatures.filter((item) => isConduitDomainFeature(item.id)).map((item) => item.level), `plan level ${level}`).toEqual(
        (expected.get(level) ?? []).map(() => level),
      );
      const group = classFeatureGroupsForSheet({ ...hero, level }).find((item) => item.level === level);
      expect(group?.features.some((item) => isConduitDomainFeature(item.id)) ?? false).toBe((expected.get(level) ?? []).length > 0);
      if ([2, 5, 8].includes(level)) {
        const currentGroups = classFeatureGroupsForSheet({ ...hero, level: level - 1 });
        expect(currentGroups.some((item) => item.level === level)).toBe(false);
        expect(currentGroups.flatMap((item) => item.features).some(
          (item) => item.level === level && isConduitDomainFeature(item.id),
        )).toBe(false);
      }
    }
  });

  it("план перечисляет особенности нового уровня, а не спрашивает их", () => {
    const plan = getLevelUpPlan(fury("Разоритель"));

    expect(plan.available).toBe(true);
    expect(plan.classFeatures.map((feature) => feature.level)).toEqual([2]);
    expect(plan.classFeatures.map((feature) => feature.name)).toContain(
      "Неизбежный гнев",
    );
    // Никакого нового выбора особенностей на 2-м уровне не появляется.
    expect(
      plan.choices.some(
        (choice) => (choice.kind as string) === "classFeature",
      ),
    ).toBe(false);
  });

  it("подпись особенности та же, что в панели", () => {
    const plan = getLevelUpPlan(fury("Разоритель"));
    const rage = plan.classFeatures.find(
      (feature) => feature.name === "Неизбежный гнев",
    );
    // Ловкость Неистового на 1-м уровне — 2, поэтому скорость +2.
    expect(rage?.summary).toBe("скорость +2 (Ловкость)");
  });

  it("чужие аспекты в план не попадают", () => {
    const raider = getLevelUpPlan(fury("Разоритель")).classFeatures.map(
      (feature) => feature.name,
    );
    expect(raider).not.toContain("Зуб и коготь");
    expect(raider).not.toContain("Непреодолимая сила");

    const berserker = getLevelUpPlan(fury("Берсерк")).classFeatures.map(
      (feature) => feature.name,
    );
    expect(berserker).not.toContain("Неизбежный гнев");
  });

  it("на каждом переходе 1→10 ни одно имя не встречается дважды", () => {
    for (const aspect of ["Берсерк", "Разоритель", "Буревестник"]) {
      for (let level = 1; level < 10; level += 1) {
        const plan = getLevelUpPlan(fury(aspect, level));
        const names = [
          ...plan.classFeatures.map((feature) => feature.name),
          ...uncoveredRuleFeatures(plan).map((feature) => feature.name),
        ].map(normalizeFeatureText);
        expect(
          new Set(names).size,
          `${aspect}: ${level} → ${level + 1}`,
        ).toBe(names.length);
      }
    }
  });

  it("особенности ровно нового уровня, а не всего листа", () => {
    const names = getLevelUpPlan(fury("Разоритель", 2)).classFeatures.map(
      (feature) => feature.name,
    );
    expect(names).not.toContain("Неизбежный гнев");
    expect(getLevelUpPlan(fury("Разоритель", 2)).classFeatures.map(
      (feature) => feature.level,
    ).every((level) => level === 3)).toBe(true);
  });

  it("прозаический дар аспекта всё равно попадает в план повышения", () => {
    // «Непреодолимая сила» описана текстом без эффектов, но это награда
    // 2-го уровня Берсерка: пропадать из плана она не должна.
    const gifts = classFeatureGiftsAtLevel(fury("Берсерк", 1), 2).map(
      (feature) => feature.name,
    );
    expect(gifts).toContain("Непреодолимая сила");
  });
});
