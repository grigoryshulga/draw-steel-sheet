import { describe, expect, it } from "vitest";
import { LEVEL_UP_RULES, levelUpRule } from "../src/data/level-up-rules";
import codex from "../src/data/codex.generated.json";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";

const classes = ["Неистовый", "Нуль", "Проводник", "Тактик", "Талант", "Тень", "Трубадур", "Цензор", "Элементалист"];
const abilityById = new Map(ABILITY_COMPENDIUM.map((ability) => [ability.id, ability]));

describe("level-up rule data", () => {
  it("covers each nonempty class article from levels 2 through 10 exactly once", () => {
    expect(LEVEL_UP_RULES).toHaveLength(81);
    for (const className of classes) {
      for (let level = 2; level <= 10; level++) {
        const rule = levelUpRule(className, level);
        const article = codex.find((entry) => entry.id === rule?.articleId);
        expect(rule).toBeDefined();
        expect(article?.path).toContain(`/` + className + `/`);
        expect(article?.markdown.trim()).toBeTruthy();
        expect(rule?.level).toBe(level);
      }
    }
    expect(levelUpRule("Призыватель", 2)).toBeUndefined();
    expect(new Set(LEVEL_UP_RULES.map((rule) => `${rule.className}:${rule.level}`)).size).toBe(81);
  });

  it("preserves source section text and uses stable ASCII ids", () => {
    for (const rule of LEVEL_UP_RULES) {
      const article = codex.find((entry) => entry.id === rule.articleId)!;
      expect(rule.features.length).toBeGreaterThan(0);
      rule.features.forEach((feature) => {
        expect(feature.id).toMatch(/^\d{4}(?:-\d+)?-f\d{2}$/);
        expect(feature.name.trim()).toBeTruthy();
        expect(article.markdown).toContain(`#### ${feature.name}`);
        if (feature.description) expect(article.markdown).toContain(feature.description);
      });
      for (const group of rule.abilityChoices) {
        expect(group.id).toMatch(/^\d{4}(?:-\d+)?-g\d{2}$/);
        expect(group.count).toBeGreaterThan(0);
        expect(group.abilityIds.length).toBeGreaterThan(0);
        expect(group.abilityIds.every((id) => abilityById.has(id))).toBe(true);
      }
      for (const grant of rule.grantedAbilities) {
        expect(grant.abilityIds.length).toBeGreaterThan(0);
        expect(grant.abilityIds.every((id) => abilityById.has(id))).toBe(true);
      }
    }
  });

  it("keeps source subclass groups scoped and generic ability lists separate", () => {
    for (const [className, subclasses] of [
      ["Неистовый", ["Берсерк", "Разоритель", "Буревестник"]],
      ["Нуль", ["Хронокинетик", "Криокинетик", "Метакинетик"]],
      ["Тактик", ["Повстанец", "Воевода", "Авангард"]],
      ["Талант", ["Хронопатия", "Телекинез", "Телепатия"]],
      ["Тень", ["Коллегия Черного Пепла", "Коллегия Едкой Алхимии", "Коллегия Маски Арлекина"]],
      ["Трубадур", ["Автор", "Дуэлянт", "Виртуоз"]],
      ["Цензор", ["Экзорцист", "Оракул", "Идеал"]],
    ] as const) {
      for (const level of [2, 6, 9]) {
        const groups = levelUpRule(className, level)!.abilityChoices;
        expect(groups.map((group) => group.subclasses?.[0])).toEqual(subclasses);
        expect(groups.every((group) => group.count === 1 && group.abilityIds.length === 2)).toBe(true);
      }
    }
    expect(levelUpRule("Неистовый", 3)!.abilityChoices[0].subclasses).toBeUndefined();
  });

  it("records primary stat caps, all-stat increases, and skills from source articles", () => {
    expect(levelUpRule("Неистовый", 4)?.characteristics).toEqual({ set: { might: 3, agility: 3 } });
    expect(levelUpRule("Проводник", 4)?.characteristics).toEqual({ set: { intuition: 3 }, choice: { amount: 1, cap: 3 } });
    expect(levelUpRule("Элементалист", 10)?.characteristics).toEqual({ set: { reason: 5 }, choice: { amount: 1, cap: 5 } });
    for (const rule of LEVEL_UP_RULES.filter((entry) => entry.level === 7)) {
      expect(rule.characteristics).toEqual({ increaseAll: { amount: 1, cap: 4 } });
      expect(rule.skillCount).toBe(1);
    }
  });

  it("separates verified grants from picks and attaches known subclass/domain guards", () => {
    expect(levelUpRule("Талант", 8)?.abilityChoices[0].abilityIds).toHaveLength(4);
    expect(levelUpRule("Талант", 8)?.grantedAbilities).toEqual([
      { abilityIds: ["feature.ability.talent.level-8.levitation-field"], subclasses: ["Телекинез"] },
      { abilityIds: ["feature.ability.talent.level-8.stasis-shield"], subclasses: ["Хронопатия"] },
    ]);
    expect(levelUpRule("Элементалист", 2)?.grantedAbilities[0]).toEqual({
      abilityIds: ["feature.ability.elementalist.level-2.there-is-no-space-between"], subclasses: ["Пустота"],
    });
    expect(levelUpRule("Элементалист", 8)?.grantedAbilities[0]).toEqual({
      abilityIds: ["feature.ability.elementalist.level-8.summon-source-of-earth"], subclasses: ["Земля"],
    });
    expect(levelUpRule("Проводник", 4)?.grantedAbilities).toEqual([]);
    expect(levelUpRule("Проводник", 7)?.grantedAbilities).toEqual([]);
    expect(levelUpRule("Цензор", 4)?.grantedAbilities).toEqual([]);
    expect(levelUpRule("Цензор", 7)?.grantedAbilities).toEqual([]);
    expect(levelUpRule("Трубадур", 6)?.grantedAbilities[0].abilityIds).toEqual(["feature.ability.troubadour.level-6.spotlight"]);
    expect(levelUpRule("Трубадур", 8)?.abilityChoices[0].abilityIds).toHaveLength(4);
    expect(levelUpRule("Трубадур", 8)?.grantedAbilities).toEqual([
      { abilityIds: ["feature.ability.troubadour.level-8.moonlight-sonata", "feature.ability.troubadour.level-8.radical-fantasia"], subclasses: ["Виртуоз"] },
    ]);
    expect(levelUpRule("Тень", 4)?.grantedAbilities[0].abilityIds).toEqual(["feature.ability.shadow.level-4.night-watch"]);
    expect(levelUpRule("Тень", 8)?.grantedAbilities[0].abilityIds).toEqual(["feature.ability.shadow.level-8.time-bomb"]);
    expect(levelUpRule("Тень", 8)?.grantedAbilities[0].subclasses).toEqual(["Коллегия Едкой Алхимии"]);
  });

  it("does not turn domain choices into multiple grants or infer grants from ability options", () => {
    for (const level of [2, 4, 6, 7, 9]) {
      const rule = levelUpRule("Проводник", level)!;
      expect(rule.abilityChoices).toEqual([]);
      expect(rule.grantedAbilities).toEqual([]);
      expect(rule.features.some((feature) => feature.description.includes("Выберите один из ваших доменов"))).toBe(true);
    }
    for (const rule of LEVEL_UP_RULES) {
      const selectedIds = new Set(rule.abilityChoices.flatMap((group) => group.abilityIds));
      for (const grant of rule.grantedAbilities)
        for (const id of grant.abilityIds) expect(selectedIds.has(id)).toBe(false);
    }
  });

  it("grants fixed level abilities from their source and scopes subclass rewards exactly", () => {
    const expected = [
      ["Тень", 3, "feature.ability.shadow.level-3.careful-observation", undefined],
      ["Трубадур", 3, "feature.ability.troubadour.level-3.fire-up-the-night", "Виртуоз"],
      ["Трубадур", 3, "feature.ability.troubadour.level-3.never-ending-hero", "Виртуоз"],
      ["Элементалист", 3, "feature.ability.elementalist.level-3.earth-accepts-me", "Земля"],
      ["Элементалист", 3, "feature.ability.elementalist.level-3.remember-growth-and-sun-and-rain", "Зелень"],
    ] as const;
    for (const [className, level, id, subclass] of expected) {
      const rule = levelUpRule(className, level)!;
      const source = codex.find((article) => article.id === rule.articleId)!;
      const ability = abilityById.get(id)!;
      expect(rule.grantedAbilities.flatMap((grant) => grant.abilityIds)).toContain(id);
      expect(rule.abilityChoices.flatMap((group) => group.abilityIds)).not.toContain(id);
      expect(ability.className).toBe(className);
      expect(ability.level).toBe(level);
      expect(source.markdown).toContain(ability.name.replaceAll('"', ""));
      if (subclass) expect(source.markdown).toContain(subclass);
      const grant = rule.grantedAbilities.find((entry) => entry.abilityIds.includes(id));
      expect(grant?.subclasses).toEqual(subclass ? [subclass] : undefined);
    }
    const shadowSource = codex.find((article) => article.id === levelUpRule("Тень", 8)!.articleId)!;
    expect(shadowSource.markdown).toContain("Едкая Алхимия");
    expect(shadowSource.markdown).toContain("Бомба замедленного действия");
    expect(levelUpRule("Тень", 8)!.abilityChoices.flatMap((group) => group.abilityIds))
      .not.toContain("feature.ability.shadow.level-8.time-bomb");
  });

  it("allows only source-backed previous-level Elementalist abilities at matching costs", () => {
    const cases = [
      { target: 6, prior: 5, cost: 9, source: "не выбрали на 5-м уровне" },
      { target: 9, prior: 8, cost: 11, source: "не выбрали на 8-м уровне" },
    ];
    for (const { target, prior, cost, source } of cases) {
      const rule = levelUpRule("Элементалист", target)!;
      const [group] = rule.abilityChoices;
      const article = codex.find((entry) => entry.id === rule.articleId)!;
      expect(rule.abilityChoices).toHaveLength(1);
      expect(group.allowedLevels).toEqual([prior, target]);
      expect(group.label).toContain(`${cost} эссенции`);
      expect(group.label).not.toContain(`${target}-го уровня`);
      expect(article.markdown).toContain(source);
      const options = group.abilityIds.map((id) => abilityById.get(id)!);
      expect(options).toHaveLength(8);
      expect(options.every((ability) => ability.className === "Элементалист" && [prior, target].includes(ability.level)))
        .toBe(true);
      expect(options.every((ability) => ability.resourceCost === cost)).toBe(true);
      expect(rule.grantedAbilities.flatMap((grant) => grant.abilityIds).some((id) => group.abilityIds.includes(id)))
        .toBe(false);
    }
  });
});
