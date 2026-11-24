import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ language: "ru" as "ru" | "en", article: null as "ru" | "en" | null }));
vi.mock("../src/i18n/locale", () => ({
  useLocale: () => ({ locale: state.language, t: (ru: string, en: string) => state.language === "ru" ? ru : en }),
  useRuleLanguage: (_id: string, text?: string) => ({ language: text ? state.article || state.language : "ru", available: !!text, setLanguage: vi.fn() }),
}));
vi.mock("../src/components/rules/usePrintedAbility", async () => {
  const cards = (await import("../src/generated/consumers/ability-cards-en.json")).default;
  return { usePrintedAbility: (id: string) => ({ card: (cards as Record<string, unknown>)[id], loading: false, error: false, retry: vi.fn() }) };
});
import { AbilityCard } from "../src/components/AbilityCard";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { createCharacter } from "../src/lib/defaults";

describe("ability card language parity", () => {
  it("uses the same card frame, fact row, tiers, and calculated damage in both languages", () => {
    const ability = ABILITY_COMPENDIUM.find(item => item.originalDescription && item.tiers.every(tier => tier.damage) && /\*\*Power Roll/.test(item.originalDescription))!;
    const character = createCharacter({ name: "Hero" });
    const before = structuredClone(character);
    state.language = "ru";
    const ru = renderToStaticMarkup(createElement(AbilityCard, { ability, character, canonical: true, full: true }));
    state.language = "en";
    const en = renderToStaticMarkup(createElement(AbilityCard, { ability, character, canonical: true, full: true }));
    for (const html of [ru, en]) {
      expect(html).toContain("sheet-ability-card-head");
      expect(html).toContain("sheet-ability-meta");
      expect(html).toContain("sheet-ability-keywords");
      expect(html.match(/data-tier=/g)).toHaveLength(3);
      expect(html).toContain("damage-chip");
    }
    expect(en).toContain(ability.originalName);
    expect(en).not.toContain("Расчёты героя");
    expect(character).toEqual(before);
  });
  it("renders English card semantics under an English article on a Russian site", () => {
    state.language = "ru";
    state.article = "en";
    const character = createCharacter({ name: "Hero" });
    const brutal = ABILITY_COMPENDIUM.find(item => item.originalName === "Brutal Slam")!;
    const html = renderToStaticMarkup(createElement(AbilityCard, { ability: brutal, character, canonical: true, full: true, onOpen: () => {} }));
    expect(html).toContain("Brutal Slam");
    expect(html).toContain("Power Roll");
    expect(html).toContain("Keywords");
    expect(html).not.toMatch(/урона/i);
    expect(html).not.toContain("📏");
    expect(html).not.toContain("🎯");
    expect(html).not.toContain("Открыть способность");
    expect(html).not.toContain("Стоимость:");
    expect(html).not.toContain("Ключевые слова:");
    const paid = ABILITY_COMPENDIUM.find(item => item.resourceCost > 0 && item.originalDescription)!;
    const paidHtml = renderToStaticMarkup(createElement(AbilityCard, { ability: paid, character, canonical: true, full: true }));
    expect(paidHtml).toContain(`Cost: ${paid.resourceCost} resource`);
    expect(paidHtml).not.toContain("Стоимость:");
    const change = ABILITY_COMPENDIUM.find(item => item.originalName === "Furious Change")!;
    const changeHtml = renderToStaticMarkup(createElement(AbilityCard, { ability: change, character, canonical: true, full: true }));
    expect(changeHtml).not.toContain("Бросок силы");
    expect(changeHtml).not.toContain("📏");
    expect(changeHtml).not.toContain("🎯");
    state.article = null;
  });

});
