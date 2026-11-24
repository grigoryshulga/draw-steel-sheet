import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { deriveStats } from "../src/lib/rules";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
vi.mock("../src/i18n/locale", () => ({ useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }), useArticleLocale: () => null, useRuleLanguage: (_id: string, text?: string) => ({ language: text ? "en" : "ru", available: !!text, setLanguage: vi.fn() }) }));
import { HeaderPanel } from "../src/views/sheet/HeaderPanel";
import { VitalsPanel } from "../src/views/sheet/VitalsPanel";
import { CharacteristicsPanel } from "../src/views/sheet/CharacteristicsPanel";
import { SheetPerksPanel } from "../src/views/sheet/SheetPerksPanel";
import { SheetAbilitiesPanel } from "../src/views/sheet/SheetAbilitiesPanel";
import { ConditionsPanel } from "../src/views/sheet/ConditionsPanel";
import { ResourcesPanel } from "../src/views/sheet/ResourcesPanel";

describe("English first fold", () => {
  it("renders a blank hero's counters and labels without modifying saved data", () => {
    const character = createCharacter({ name: "Test Hero" });
    character.conditions.bleeding = { active: true, ends: "save" };
    const before = structuredClone(character);
    const context: AppContextValue = { character, derived: deriveStats(character), update: vi.fn(), patch: vi.fn(), performGameAction: vi.fn(() => true), undoGameAction: vi.fn(), gameHistory: [], saveStatus: "idle", saveError: "", notify: vi.fn(), goTo: vi.fn() };
    const html = renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, ...[HeaderPanel, VitalsPanel, CharacteristicsPanel, ResourcesPanel, ConditionsPanel, SheetPerksPanel, SheetAbilitiesPanel].map((Component, i) => createElement(Component, { key: i }))));
    for (const label of ["Level 1", "1st echelon", "Victories", "Experience", "Wealth", "Renown", "Immunities and weaknesses", "Ready", "Potency", "Weak", "Average", "Strong", "Hero tokens", "Heroic resource", "Bleeding", "Save ends", "Career", "Main action"]) expect(html).toContain(label);
    for (const label of ["Уровень 1", "уровень</span>", "1-й эшелон", "Победы", "Опыт", "Богатство", "Известность", "Иммунитеты и уязвимости", "В строю", "Потенциал", "Слабый", "Средний", "Сильный"]) expect(html).not.toContain(label);
    expect(character).toEqual(before);
  });
});
