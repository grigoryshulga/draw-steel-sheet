import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { heroicResourceHelp } from "../src/data/resource-help";
import { resourceGainLabels } from "../src/lib/resources";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
vi.mock("../src/i18n/locale", () => ({ useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }) }));
import { ResourcesPanel } from "../src/views/sheet/ResourcesPanel";
import { MechanicDetails } from "../src/views/sheet/class-mechanics/MechanicDetails";
import { resourceHelpLine, resourceLabel } from "../src/i18n/resource-language";

it("renders the Censor's real resource gains, values and help in English without modifying the hero", () => {
  const hero = createCharacter({ className: "Цензор", level: 1 });
  const before = structuredClone(hero);
  const context = { character: hero, performGameAction: vi.fn(), update: vi.fn() } as unknown as AppContextValue;
  const html = renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(ResourcesPanel), createElement(MechanicDetails, { title: "Judgment", children: "text" })));
  for (const text of ["Wrath", "Start of a combat encounter", "= Victories", "Start of your turn in combat", "you damage your judged target", "your judged target damages you", "encounter", "round", "Rules", "Open: Judgment"]) expect(html).toContain(text);
  expect(resourceGainLabels(hero).map(gain => resourceLabel(gain.label, "en")).join(" ")).not.toMatch(/[А-Яа-яЁё]/);
  expect(heroicResourceHelp(hero).map(line => resourceHelpLine(line, "en")).join(" ")).not.toMatch(/[А-Яа-яЁё]/);
  expect(hero).toEqual(before);
});
it("covers the gain labels emitted by each class at milestone levels", () => {
  const missing = new Set<string>();
  for (const name of ["Цензор", "Неистовый", "Нуль", "Проводник", "Тактик", "Талант", "Тень", "Трубадур", "Элементалист"]) for (const level of [1, 4, 7, 10]) {
    for (const gain of resourceGainLabels(createCharacter({ className: name, level }))) if (/[А-Яа-яЁё]/.test(resourceLabel(gain.label, "en"))) missing.add(gain.label);
  }
  expect([...missing]).toEqual([]);
});

it("renders the real resource gains for all twelve Conduit domains in English", () => {
  const domains = ["Созидание", "Смерть", "Судьба", "Знание", "Жизнь", "Любовь", "Природа", "Защита", "Буря", "Солнце", "Хитрость", "Война"];
  const seen = new Set<string>();
  for (let i = 0; i < domains.length; i += 2) {
    const chosen = domains.slice(i, i + 2).join(", ");
    const hero = createCharacter({ className: "Проводник", level: 4 });
    hero.subclass = chosen;
    hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": chosen } };
    const gains = resourceGainLabels(hero).filter(gain => gain.tag.startsWith("conduit-piety-domain-"));
    expect(gains).toHaveLength(2);
    const context = { character: hero, performGameAction: vi.fn(), update: vi.fn() } as unknown as AppContextValue;
    const html = renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(ResourcesPanel)));
    for (const gain of gains) {
      seen.add(gain.tag);
      const translated = resourceLabel(gain.label, "en");
      expect(translated).not.toMatch(/[А-Яа-яЁё]/);
      expect(html).toContain(translated);
      expect(resourceLabel(gain.label, "ru")).toBe(gain.label);
    }
  }
  expect(seen.size).toBe(12);
});
