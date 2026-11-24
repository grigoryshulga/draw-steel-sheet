import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { CATALOG } from "../src/data/library";
import { createCharacter } from "../src/lib/defaults";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
vi.mock("../src/i18n/locale", () => ({ useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }) }));
import { HeaderPanel } from "../src/views/sheet/HeaderPanel";

it("shows the Censor identity and unchanged catalog title in English without changing saved data", () => {
  const title = CATALOG.find(item => item.kind === "title" && item.originalName)!;
  const hero = createCharacter({ name: "Censor QA", ancestry: "Дварф", className: "Цензор", career: "Солдат" });
  hero.subclass = "Экзорцист";
  hero.career = "Солдат";
  hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "censor.domain": "Жизнь" } };
  hero.inventory = [{ id: "title", name: title.name, catalogId: title.id, category: "title", qty: 1, equipped: false, notes: "" }, { id: "custom", name: "Мой титул", catalogId: title.id, category: "title", qty: 1, equipped: false, notes: "" }];
  const before = structuredClone(hero);
  const context = { character: hero, update: vi.fn(), patch: vi.fn(), notify: vi.fn() } as unknown as AppContextValue;
  const html = renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(HeaderPanel)));
  for (const expected of ["Dwarf", "Censor", "Exorcist", "Soldier", "Life", title.originalName!, "Мой титул"]) expect(html).toContain(expected);
  expect(hero).toEqual(before);
});
