import { describe, expect, it } from "vitest";
import { LEVEL_UP_RULES } from "../src/data/level-up-rules";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { PERK_COMPENDIUM } from "../src/data/perks";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { levelUpChoiceGroupTitle, choiceValueLabel } from "../src/lib/level-up-history";

describe("level-up history choice labels", () => {
  it.each([2, 6, 9])("labels the Conduit level %i domain ability", (level) => {
    expect(levelUpChoiceGroupTitle(`conduit.ability.domain.${level}`)).toBe(
      `Доменная способность ${level}-го уровня`,
    );
  });

  it("labels the second-domain skill and keeps the saved domain feature labels", () => {
    expect(levelUpChoiceGroupTitle("conduit.domain.skill.2")).toBe("Навык второго домена");
    expect(levelUpChoiceGroupTitle("conduit.domain.4")).toBe("Особенность домена 4-го уровня");
    expect(levelUpChoiceGroupTitle("conduit.domain.7")).toBe("Особенность домена 7-го уровня");
  });

  it("preserves normal rule labels and generic group labels for older records", () => {
    const rule = LEVEL_UP_RULES.find((item) => item.abilityChoices.length > 0)!;
    expect(levelUpChoiceGroupTitle(rule.abilityChoices[0].id, rule)).toBe(rule.abilityChoices[0].label);
    expect(levelUpChoiceGroupTitle("perk", rule)).toBe("Перк");
    expect(levelUpChoiceGroupTitle("skill", rule)).toBe("Навык");
    expect(levelUpChoiceGroupTitle("characteristic", rule)).toBe("Характеристика");
    expect(levelUpChoiceGroupTitle("old-unknown-key", rule)).toBe("Другой выбор");
  });

  it("resolves the actual second-domain skill and ordinary saved choice values", () => {
    expect(choiceValueLabel("conduit.domain.skill.2", "Поиск")).toBe("Поиск");
    expect(choiceValueLabel("skill", "Поиск")).toBe("Поиск");
    const perk = PERK_COMPENDIUM[0];
    expect(choiceValueLabel("perk", perk.id)).toBe(perk.name);
    expect(choiceValueLabel("characteristic", "Мощь")).toBe("Мощь");
  });

  it("keeps domain feature and ability ids mapped to their existing names", () => {
    const feature = GENERATED_CLASS_FEATURES[0];
    const ability = ABILITY_COMPENDIUM.find((item) => item.id.startsWith("conduit.")) ?? ABILITY_COMPENDIUM[0];
    expect(choiceValueLabel("conduit.domain.4", feature.id)).toBe(feature.name);
    expect(choiceValueLabel("conduit.ability.domain.2", ability.id)).toBe(ability.name);
  });

  it("preserves the unavailable-name fallback for older unknown ids", () => {
    expect(choiceValueLabel("conduit.domain.skill.2", "removed-skill")).toBe("Навык (название недоступно)");
    expect(choiceValueLabel("perk", "removed-perk")).toBe("Перк (название недоступно)");
    expect(choiceValueLabel("characteristic", "removed-characteristic")).toBe("Характеристика (название недоступно)");
    expect(choiceValueLabel("old-unknown-key", "removed-ability")).toBe("Способность (название недоступно)");
  });
});
