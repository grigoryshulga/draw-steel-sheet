import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import { abilityCardView } from "../src/components/rules/abilityCardView";
import { AbilityBody, referenceAbilityView } from "../src/components/rules/AbilitySheet";
import { EnglishAbilityRemainder } from "../src/components/rules/EnglishAbilityRemainder";
import { printedAbilityView } from "../src/components/rules/printedAbilityView";
import { compilePrintedAbility } from "../scripts/content/lib/printed-ability.mjs";
import type { PrintedAbility } from "../src/rules/printed-ability";

const compile = (source: string): PrintedAbility => compilePrintedAbility(source);

describe("English ability card structure", () => {
  it("preserves Spend prose with calculated damage", () => {
    const ability = ABILITY_COMPENDIUM.find(item => /\*\*Spend/.test(item.originalDescription || "") && item.tiers.some(tier => tier.damage))!;
    const base = abilityCardView(ability, createCharacter({ name: "Hero" }));
    const card = compile(ability.originalDescription!);
    const view = printedAbilityView(base, card, base.cardModifiers);
    expect(view.tiers.map(tier => tier.damage?.value)).toEqual(base.tiers.map(tier => tier.damage?.value));
    expect(view.tiers.map(tier => tier.damage?.calculations?.map(calc => calc.total)))
      .toEqual(base.tiers.map(tier => tier.damage?.calculations?.map(calc => calc.total)));
    expect(card.blocks.some(block => "text" in block && block.text.includes("**Spend"))).toBe(true);
  });
  it("preserves triggers and effects", () => {
    const ability = ABILITY_COMPENDIUM.find(item => /\*\*Trigger:\*\*/.test(item.originalDescription || "") && /\*\*Effect:\*\*/.test(item.originalDescription || ""))!;
    const card = compile(ability.originalDescription!);
    const base = referenceAbilityView(ability);
    const view = printedAbilityView(base, card, base.cardModifiers);
    expect(view.trigger).toBe(card.trigger);
    expect(view.effect).toBeTruthy();
  });
  it("renders linked facts as labels", () => {
    const ability = ABILITY_COMPENDIUM[0];
    const source = "| **[Melee](scc:keyword.melee), Weapon** | **[Main action](scc:action.main)** |\n|---|---|\n| **📏 [Melee 1](scc:distance)** | **🎯 [One creature](scc:target)** |\n\n**Effect:** A safe effect.";
    const base = referenceAbilityView(ability);
    const view = printedAbilityView(base, compile(source), base.cardModifiers);
    expect(view.keywords).toEqual(["Melee", "Weapon"]);
    expect(view.facts.map(fact => fact.value)).toContain("Melee 1");
    expect(view.facts.map(fact => fact.value)).toContain("One creature");
  });
  it("keeps Divine Dragon’s second roll after the intervening prose", () => {
    const ability = ABILITY_COMPENDIUM.find(item => item.name === "Божественный Дракон")!;
    const card = compile(ability.originalDescription!);
    expect(card.roll?.tiers).toHaveLength(3);
    const html = renderToStaticMarkup(createElement(EnglishAbilityRemainder, { blocks: card.blocks }));
    expect(html.match(/data-tier=/g)).toHaveLength(3);
    expect(html.indexOf("Additionally")).toBeLessThan(html.indexOf("Power Roll + Intuition"));
    expect(html).toContain("3 + I");
  });
  it("preserves prose before a primary roll and refuses malformed tier lists", () => {
    const source = "**Effect:** Follow [this rule](scc:rule.test).\n\n**Power Roll + Might:**\n\n- **≤11:** 3 damage\n- **12-16:** 5 damage\n- **17+:** 8 damage";
    const card = compile(source);
    expect(card.beforeRoll).toBe("**Effect:** Follow [this rule](scc:rule.test).");
    expect(card.roll?.tiers).toHaveLength(3);
    const malformed = compile(source.replace("12-16:", "18-20:"));
    expect(malformed.roll).toBeUndefined();
    expect(malformed.blocks.map(block => "text" in block && block.text).join("\n\n")).toBe(source.replace("12-16:", "18-20:"));
  });
  it("recognizes all twelve bold, dice, and compound damage tiers", () => {
    const cases = [
      { name: "Arcane Disruptor", values: ["8 + A", "12 + A", "16 + A"], effects: ["M < WEAK, weakened (save ends)", "M < AVERAGE, weakened (save ends)", "M < STRONG, weakened (save ends)"] },
      { name: "En Garde!", values: ["7 + A", "11 + A", "16 + A"], effects: ["", "", ""] },
      { name: "Coup de Grace", values: ["2d6 + 7 + A", "2d6 + 11 + A", "2d6 + 16 + A"], effects: ["", "", ""] },
      { name: "Godstorm", values: ["2", "3", "5"], effects: ["2 sonic damage", "3 sonic damage", "5 sonic damage"] },
    ];
    for (const entry of cases) {
      const ability = ABILITY_COMPENDIUM.find(item => item.originalName === entry.name)!;
      const card = compile(ability.originalDescription!);
      const reference = referenceAbilityView(ability);
      const printed = printedAbilityView(reference, card, reference.cardModifiers);
      expect(printed.tiers.map(tier => tier.damage?.value), entry.name).toEqual(entry.values);
      expect(printed.tiers.map(tier => tier.effect), entry.name).toEqual(entry.effects);
      const base = abilityCardView(ability, createCharacter({ name: "Hero" }));
      const hero = printedAbilityView(base, card, base.cardModifiers);
      expect(hero.tiers.map(tier => tier.damage?.value), entry.name).toEqual(base.tiers.map(tier => tier.damage?.value));
      expect(hero.tiers.map(tier => tier.effect), entry.name).toEqual(entry.effects);
    }
  });
  it("marks only tier effects containing Markdown as rich", () => {
    const ability = ABILITY_COMPENDIUM.find(item => item.originalName === "Muse of Fire")!;
    const tiers = compile(ability.originalDescription!).roll!.tiers;
    expect(tiers[0].effect).toContain("*Draw Steel: Monsters*");
    expect(tiers.map(tier => tier.richEffect)).toEqual([true, undefined, undefined]);
    const linked = compile("**Power Roll + Might:**\n\n- **≤11:** 2 damage; see [rule](scc:rule.test)\n- **12-16:** 3 damage; ordinary\n- **17+:** 4 damage; **bold**");
    expect(linked.roll!.tiers.map(tier => tier.richEffect)).toEqual([true, undefined, true]);
  });
  it("uses printed formulas in reference and hero calculations on the sheet", () => {
    const ability = ABILITY_COMPENDIUM.find(item => item.originalName === "Weakening Brand")!;
    const card = compile(ability.originalDescription!);
    const reference = referenceAbilityView(ability);
    expect(printedAbilityView(reference, card, reference.cardModifiers).tiers.map(tier => tier.damage?.value)).toEqual(["3 + M, R, I, or P", "5 + M, R, I, or P", "8 + M, R, I, or P"]);
    const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Тактик", characteristics: startingCharacteristics("Тактик"), kit: "Мастер Боевых Искусств", secondaryKit: "Гора", meleeDamageKit: "Гора" });
    hero.damageModifier = 2;
    const base = abilityCardView(ability, hero);
    const view = printedAbilityView(base, card, base.cardModifiers);
    expect(view.tiers.map(tier => tier.damage?.value)).toEqual(base.tiers.map(tier => tier.damage?.value));
    expect(renderToStaticMarkup(createElement(AbilityBody, { view, full: true, language: "en" }))).toContain("weakness");
  });
});
