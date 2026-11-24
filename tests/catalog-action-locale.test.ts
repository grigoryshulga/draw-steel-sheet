import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CATALOG } from "../src/data/library";
import { addCatalogEntry } from "../src/lib/catalog-character";
import { createCharacter } from "../src/lib/defaults";
import { deriveStats } from "../src/lib/rules";
import { AppContext, type AppContextValue } from "../src/state/AppContext";

vi.mock("../src/i18n/locale", () => ({ useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }) }));
import { CatalogAction } from "../src/components/CatalogAction";

function render(entry: typeof CATALOG[number], character = createCharacter({ name: "Герой" })) {
  const context: AppContextValue = { character, derived: deriveStats(character), update: vi.fn(), patch: vi.fn(), performGameAction: vi.fn(() => true), undoGameAction: vi.fn(), gameHistory: [], saveStatus: "idle", saveError: "", notify: vi.fn(), goTo: vi.fn() };
  return renderToStaticMarkup(createElement(AppContext.Provider, { value: context }, createElement(CatalogAction, { entry })));
}

describe("English catalog actions", () => {
  it("localizes project options while retaining characteristic values", () => {
    const project = CATALOG.find((entry) => entry.kind === "project" && entry.projectGoal.startsWith("240,"))!;
    const html = render(project);
    expect(html).toContain("New project characteristic");
    expect(html).toContain("Choose later");
    expect(html).toContain("New project goal");
    expect(html).toContain("240 if your career granted you two skills, or 360 if your career granted you three skills");
    expect(html).toContain("Start project");
    expect(html).not.toContain(project.projectGoal);
  });

  it("keeps a leveled treasure's catalog identity when added again", () => {
    const entry = CATALOG.find((item) => item.category === "Сокровища с Уровнем")!;
    const first = addCatalogEntry(createCharacter({ name: "Герой" }), entry, "first");
    expect(render(entry, first)).toContain("Add another");
    const second = addCatalogEntry(first, entry, "second");
    expect(second.inventory).toHaveLength(1);
    expect(second.inventory[0]).toMatchObject({ id: "first", catalogId: entry.id, name: entry.name, qty: 2 });
  });
});
