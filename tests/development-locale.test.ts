import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { BUILDER_DATA, buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { deriveStats } from "../src/lib/rules";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
vi.mock("../src/i18n/locale", async (original) => ({ ...await original<object>(), useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }), useRuleLanguage: (_id: string, original: unknown) => ({ language: original ? "en" : "ru", available: !!original, setLanguage: vi.fn() }) }));
vi.mock("../src/views/sheet/ClassFeaturesPanel", () => ({ ClassFeatureChoices: () => null, FeatureTriggerButton: () => null }));
import { DevelopmentPanel } from "../src/views/sheet/DevelopmentPanel";
import { LevelUpShortcut } from "../src/views/sheet/LevelUpShortcut";

function render(character: ReturnType<typeof createCharacter>) {
  const context: AppContextValue = { character, derived: deriveStats(character), update: vi.fn(), patch: vi.fn(), performGameAction: vi.fn(() => true), undoGameAction: vi.fn(), gameHistory: [], saveStatus: "idle", saveError: "", notify: vi.fn(), goTo: vi.fn() };
  return renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(LevelUpShortcut), createElement(DevelopmentPanel, {})));
}
it("renders an empty sheet's unavailable reason in English without changing it", () => {
  const hero = createCharacter({ name: "Моё имя" }); const before = structuredClone(hero);
  const html = render(hero);
  expect(html).toContain("No class is selected");
  expect(html).not.toContain("не распознан");
  expect(hero).toEqual(before);
});
it("renders level two class advancement and canonical perk originals in English", () => {
  const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Тактик", subclass: BUILDER_DATA.classes.find(c => c.name === "Тактик")!.subclasses[0].name, characteristics: startingCharacteristics("Тактик") });
  const nextHtml = render(hero);
  expect(nextHtml).toContain("Level 2 class perk");
  expect(nextHtml).toContain("Choose a perk");
  hero.level = 2;
  const before = structuredClone(hero); const html = render(hero);
  expect(html).toContain("Level 2");
  expect(html).toContain("Choose a perk");
  expect(html).toContain("Level 2 class perk");
  expect(html).toContain("Interpersonal");
  expect(html).toContain("Open Book");
  expect(html).toContain("Level 3 heroic ability");
  expect(html).not.toContain("Выбор перка");
  expect(hero).toEqual(before);
});

it("renders the Censor Exorcist level-two choice labels in English", () => {
  const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Цензор", subclass: "Экзорцист", characteristics: startingCharacteristics("Цензор") });
  const html = render(hero);
  expect([...new Set((html.match(/[А-Яа-яЁё][^<]{0,100}/g) ?? []))]).toEqual([]);
  expect(html).toContain("Exorcist: level 2 ability");
  expect(html).toContain("Choose an ability");
  expect(html).not.toContain("Экзорцист: способность");
});
