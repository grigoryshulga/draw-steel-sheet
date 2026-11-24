import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { deriveStats } from "../src/lib/rules";
import { abilityFromTemplate, BASIC_ABILITIES } from "../src/data/templates";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
vi.mock("../src/i18n/locale", () => ({ useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }) }));
vi.mock("../src/components/ui", async (importOriginal) => ({ ...await importOriginal<object>(), Modal: ({ children, title }: { children: ReactNode; title: ReactNode }) => createElement("div", null, title, children) }));
import { AbilityEditor } from "../src/views/abilities/AbilityEditor";
import { AbilityRollPanel } from "../src/views/abilities/RollModal";
import { ClassMechanicsPanel } from "../src/views/sheet/ClassMechanicsPanel";
import { HealthDialog } from "../src/views/sheet/HealthDialog";

describe("English editors", () => {
  it("renders ability editing and roll controls without mutating authored values", () => {
    const character = createCharacter({ name: "Герой" });
    const ability = { ...abilityFromTemplate(BASIC_ABILITIES[0]), name: "Своя способность", notes: "Моя заметка" };
    const before = structuredClone({ character, ability });
    const context: AppContextValue = { character, derived: deriveStats(character), update: vi.fn(), patch: vi.fn(), performGameAction: vi.fn(() => true), undoGameAction: vi.fn(), gameHistory: [], saveStatus: "idle", saveError: "", notify: vi.fn(), goTo: vi.fn() };
    const html = renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(AbilityEditor, { initial: ability, isNew: false, onClose: vi.fn(), onSave: vi.fn() }), createElement(AbilityRollPanel, { ability, character }), createElement(HealthDialog, { onClose: vi.fn() })));
    expect(html).toContain("Roll bonus");
    expect(html).toContain("Power roll");
    expect(html).toContain("Своя способность");
    expect(html).toContain("Моя заметка");
    expect({ character, ability }).toEqual(before);
  });
  it.each([["Нуль", "Discipline mastery"], ["Талант", "Clarity and strain"], ["Трубадур", "Routine"], ["Элементалист", "Persistent magic"], ["Тактик", "Mark"], ["Цензор", "Judgment"], ["Проводник", "Prayer"]])("renders the %s mechanics heading in English", (className, heading) => {
    const character = createCharacter({ className });
    const before = structuredClone(character);
    const context: AppContextValue = { character, derived: deriveStats(character), update: vi.fn(), patch: vi.fn(), performGameAction: vi.fn(() => true), undoGameAction: vi.fn(), gameHistory: [], saveStatus: "idle", saveError: "", notify: vi.fn(), goTo: vi.fn() };
    const html = renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(ClassMechanicsPanel)));
    expect(html).toContain(heading);
    expect(character).toEqual(before);
  });

});
