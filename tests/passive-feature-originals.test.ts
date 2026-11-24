import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { PassiveFeatureCard } from "../src/views/sheet/PassiveFeatureCard";
import type { FeatureSheetItem } from "../src/lib/class-feature-view";

vi.mock("../src/i18n/locale", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/i18n/locale")>();
  return { ...actual, useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }), useRuleLanguage: (_id: string, original?: string) => ({ language: original ? "en" : "ru", available: !!original, setLanguage() {} }) };
});

vi.mock("../src/components/abilityOriginal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/components/abilityOriginal")>();
  const { ABILITY_COMPENDIUM } = await import("../src/data/compendium");
  return { ...actual, useAbilityCatalog: (enabled: boolean) => enabled ? ABILITY_COMPENDIUM : [] };
});

function render(item: FeatureSheetItem) {
  return renderToStaticMarkup(createElement(PassiveFeatureCard, { item }));
}

describe("originals for synthetic class features", () => {
  it.each([
    ["feature.ability.troubadour.level-1.turnabout-is-fair-play", "Turnabout Is Fair Play"],
    ["feature.ability.elementalist.level-1.skin-like-castle-walls", "Skin Like Castle Walls"],
    ["feature.ability.shadow.level-1.in-all-this-confusion", "In All This Confusion"],
    ["feature.ability.fury.level-1.lines-of-force", "Lines of Force"],
    ["feature.fury.level-1.growing-ferocity-berserker-4", "Berserker Growing Ferocity: 4"],
  ])("renders the canonical original for %s", (id, english) => {
    const feature = GENERATED_CLASS_FEATURES.find(feature => feature.id === id)!;
    expect(feature).toBeDefined();
    const html = render({ ...feature, category: "class", passive: true, summary: feature.description, detail: feature.description, badges: [] });
    expect(html.toLowerCase()).toContain(english.toLowerCase());
    expect(html).not.toContain("Russian text only");
  });
  it("keeps custom content without an original in Russian", () => {
    const html = render({ id: "custom", name: "Моя способность", level: 1, category: "class", passive: true, summary: "Свой текст", badges: [] });
    expect(html).toContain("Russian text only");
    expect(html).toContain("Свой текст");
    const canonical = GENERATED_CLASS_FEATURES.find(feature => feature.id === "feature.ability.fury.level-1.lines-of-force")!;
    const changed = render({ ...canonical, category: "class", passive: true, detail: "Свой текст", summary: "Свой текст", badges: [] });
    expect(changed).toContain("Russian text only");
    expect(changed).toContain("Свой текст");
  });
});
