import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { createCharacter } from "../src/lib/defaults";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import type { Character } from "../src/types";

const settings = vi.hoisted(() => ({ locale: "en", openNext: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    if (settings.openNext && initial === false) {
      settings.openNext = false;
      return [true, () => {}];
    }
    return actual.useState(initial);
  } };
});
vi.mock("../src/i18n/locale", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/i18n/locale")>();
  return { ...actual, useLocale: () => ({ locale: settings.locale, t: (ru: string, en: string) => settings.locale === "en" ? en : ru }) };
});
vi.mock("../src/components/abilityOriginal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/components/abilityOriginal")>();
  const { ABILITY_COMPENDIUM } = await import("../src/data/compendium");
  return { ...actual, useAbilityCatalog: () => ABILITY_COMPENDIUM };
});
vi.mock("../src/components/CardDetailModal", () => ({ CardDetailModal: ({ children, title, footer }: { children: React.ReactNode; title: React.ReactNode; footer: React.ReactNode }) => createElement("div", null, title, children, footer) }));
import { ElementalistPanel, TroubadourPanel } from "../src/views/sheet/class-mechanics/RoutinesMagicPanels";

function render(character: Character, panel: typeof ElementalistPanel, locale: "en" | "ru", editing = false) {
  settings.locale = locale;
  settings.openNext = editing;
  const context = { character, performGameAction: () => false } as unknown as AppContextValue;
  return renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(panel)));
}

describe("routine and persistent magic localization", () => {
  it("localizes active routines, selectors, warning and custom names in both languages", () => {
    const routine = ABILITY_COMPENDIUM.find(a => a.name === "Хореография")!;
    const renamed = { ...ABILITY_COMPENDIUM.find(a => a.name === "Живительный Лимерик")!, name: "My song" };
    const hero = createCharacter({ className: "Трубадур", level: 5 });
    hero.subclass = "Виртуоз";
    hero.automation = { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "troubadour.feature.5.virtuoz": "Медли" } };
    hero.abilities = [routine, renamed];
    hero.classMechanics = { troubadour: { activeRoutineId: routine.id, activeRoutineIds: [routine.id], incapacitated: true } };
    const en = render(hero, TroubadourPanel, "en", true);
    expect(en).toContain(routine.originalName);
    expect(en).toContain("My song");
    expect(en).toContain("Aura 5");
    expect(en).toContain("The routine cannot be maintained");
    expect(en).toContain("Second routine · Medley");
    const ru = render(hero, TroubadourPanel, "ru", true);
    expect(ru).toContain("Хореография");
    expect(ru).toContain("My song");
    expect(ru).toContain("Аура 5");
    expect(ru).toContain("Выступление нельзя поддерживать");
  });
  it("localizes actual persistent ability costs and end labels while preserving custom names", () => {
    const ability = ABILITY_COMPENDIUM.find(a => a.name === "Мгновенные Раскопки")!;
    const renamed = { ...ability, id: "custom", name: "My excavation" };
    const hero = createCharacter({ className: "Элементалист" });
    hero.abilities = [ability, renamed];
    hero.classMechanics = { elementalist: { sustained: [{ abilityId: ability.id, target: "Target" }], damageThisTurn: 0 } };
    const en = render(hero, ElementalistPanel, "en", true);
    expect(en).toContain(`${ability.originalName} · 1 essence`);
    expect(en).toContain("My excavation · 1 essence");
    expect(en).toContain(`End: ${ability.originalName}`);
    expect(en).toContain("Outside combat, sustaining lasts a number of rounds equal to Victories; track it separately.");
    const ru = render(hero, ElementalistPanel, "ru", true);
    expect(ru).toContain("Мгновенные Раскопки · 1 эссенции");
    expect(ru).toContain("Прекратить: Мгновенные Раскопки");
  });
});
