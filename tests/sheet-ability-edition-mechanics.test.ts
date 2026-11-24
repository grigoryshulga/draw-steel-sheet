import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { BUILDER_DATA, buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import { AbilityBody, referenceAbilityView } from "../src/components/rules/AbilitySheet";
import { abilityCardView } from "../src/components/rules/abilityCardView";
import { printedAbilityView } from "../src/components/rules/printedAbilityView";
import type { PrintedAbility } from "../src/rules/printed-ability";

const ability = ABILITY_COMPENDIUM.find(item => item.originalName === "Weakening Brand")!;
const printed: PrintedAbility = {
  facts: { action: "Main action", distance: ["Melee ", { mode: "melee", value: 1 }], target: "One creature", keywords: ["Weapon"] },
  roll: { title: "Power Roll + Might", characteristic: "might", tiers: [{ damage: { value: "3 + M", type: "holy" }, effect: "Push 1" }] },
  blocks: [],
};

it("projects edition facts and original damage type with hero totals and live kit distance", () => {
  const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Тактик", characteristics: startingCharacteristics("Тактик"), kit: "Вихрь" });
  hero.damageModifier = 2;
  const before = structuredClone(hero);
  const weapon = { ...ability, keywords: ["Ближний", "Оружие"] };
  const base = abilityCardView(weapon, hero);
  const reference = printedAbilityView(referenceAbilityView(weapon), printed);
  const sheet = printedAbilityView(base, printed, base.cardModifiers);
  expect(reference.facts.find(f => f.id === "distance")?.value).toBe("Melee 1");
  expect(sheet.facts.find(f => f.id === "distance")?.value).toBe(`Melee ${1 + base.cardModifiers!.distance.melee!}`);
  expect(base.cardModifiers!.distance.melee).not.toBe(0);
  expect(reference.tiers[0].damage?.value).toBe("3 + M");
  expect(sheet.tiers[0].damage?.value).toBe(base.tiers[0].damage?.value);
  expect(sheet.tiers[0].damage?.type?.key).toBe("holy");
  expect(sheet.facts.map(f => f.id)).toEqual(["action", "distance", "target", "roll"]);
  expect(hero).toEqual(before);
});

it("localizes hero alternatives and movement from mechanical values", () => {
  const hero = createCharacter({ className: "Неистовый", level: 1 });
  hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "fury.aspect": "Берсерк" } };
  hero.characteristics.might = 2;
  hero.heroicResource.current = 2;
  const edited = { ...ability, rollCharacteristics: ["might", "agility"] as typeof ability.rollCharacteristics, tiers: ability.tiers.map(t => ({ ...t, effect: "толчок 1" })) };
  const before = structuredClone(hero);
  const base = abilityCardView(edited, hero);
  const sheet = printedAbilityView(base, printed, base.cardModifiers);
  expect(base.forcedMovement).toBe("Толчок +2");
  expect(sheet.forcedMovement).toBe("Push +2");
  expect(sheet.facts.find(f => f.id === "roll")?.title).toContain("also A");
  const html = renderToStaticMarkup(createElement(AbilityBody, { view: sheet, language: "en" }));
  expect(html).toContain("Push +2");
  expect(html).toContain("also A");
  expect(hero).toEqual(before);
});

it("applies an active feature to hero range but leaves printed range unchanged", () => {
  const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Талант", subclass: BUILDER_DATA.classes.find(c => c.name === "Талант")!.subclasses[0].name, characteristics: startingCharacteristics("Талант"), featureChoices: { "Псионическая аугментация": "Аугментация дистанции" } });
  const ranged = { ...ability, keywords: ["Псионика", "Дальний"], distance: "Дальний 10" };
  const card: PrintedAbility = { ...printed, facts: { ...printed.facts!, distance: ["Ranged ", { mode: "ranged", value: 10 }] } };
  const before = structuredClone(hero);
  const base = abilityCardView(ranged, hero);
  expect(printedAbilityView(referenceAbilityView(ranged), card).facts[1].value).toBe("Ranged 10");
  expect(printedAbilityView(base, card, base.cardModifiers).facts[1].value).toBe("Ranged 12");
  expect(hero).toEqual(before);
});

it("localizes the Weakening Brand calculation with kit and manual damage modifiers", () => {
  const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Тактик", characteristics: startingCharacteristics("Тактик"), kit: "Вихрь" });
  hero.damageModifier = 2;
  const weapon = { ...ability, keywords: ["Ближний", "Оружие"] };
  const base = abilityCardView(weapon, hero);
  const view = printedAbilityView(base, printed, base.cardModifiers);
  const html = renderToStaticMarkup(createElement(AbilityBody, { view, language: "en", showCalculations: true }));
  expect(html).toContain("2d10 +");
  expect(html).toContain("Original formula: 3 + M");
  expect(html).toContain("Damage modifier");
  expect(html).toContain("Kit: Whirlwind");
  expect(html).toContain("Might");
  expect(html).not.toContain("Общий модификатор");
  expect(html).not.toContain("Исходная формула");
});

it("renders the English toggle and printed characteristic glyph", async () => {
  const { CalculationToggle } = await import("../src/components/rules/CalculationInline");
  const toggle = renderToStaticMarkup(createElement(CalculationToggle, { checked: false, onChange: () => {}, language: "en" }));
  expect(toggle).toContain("Show calculation");
  const reference = printedAbilityView(referenceAbilityView(ability), printed);
  const html = renderToStaticMarkup(createElement(AbilityBody, { view: reference, language: "en" }));
  expect(html).toContain("glyph-might");
  expect(html).toContain('aria-label="M"');
});

it("translates generated roll receipts while keeping resource changes intact", async () => {
  const { localizeGameMessage } = await import("../src/i18n/game-messages");
  const receipt = "2d10: 4 + 7; итог 13, тир 2. Урон: 8. Героический ресурс: 2 → 2. Всплески: 1 → 1.";
  expect(localizeGameMessage(receipt, "en")).toBe("2d10: 4 + 7; total 13, tier 2. Damage: 8. Heroic resource: 2 → 2. Surges: 1 → 1.");
  expect(localizeGameMessage(receipt, "ru")).toBe(receipt);
});
