import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogView } from "../src/views/CatalogView";
import { catalogBrowserEntryHref, catalogSectionEntries } from "../src/data/reference-catalog";
import { createLibraryMatcher } from "../src/lib/library-utils";
import { emptyDirectorFilters, matchesDirectorFilters } from "../src/lib/director-catalog";

function render(hash: string) {
  vi.stubGlobal("window", {
    location: { hash },
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
  });
  return renderToStaticMarkup(createElement(CatalogView));
}
afterEach(() => vi.unstubAllGlobals());

describe("поиск и доставка каталога", () => {
  it("сохраняет фильтры и одно поле поиска в материалах ведущего", () => {
    const html = render("#/catalog/monsters");
    expect(html.match(/type="search"/g)).toHaveLength(1);
    expect(html).toContain("Название или ключевое слово");
    expect(html).toContain("Минимальный уровень");
    expect(html.match(/class="catalog-card catalog-creature-card"/g)).toHaveLength(24);
  });

  it("при прямой ссылке показывает выбранную запись в нужной странице каталога", () => {
    const entry = catalogSectionEntries("monsters")[300];
    const html = render(catalogBrowserEntryHref("monsters", entry.id));
    expect(html).toContain("13 / 18");
    expect(html).toContain(`href="${catalogBrowserEntryHref("monsters", entry.id)}" aria-current="page"`);
  });

  it("ищет русские слова с ё и сохраняет сочетание запроса с ролью", () => {
    const matches = createLibraryMatcher("  ТЯЖЕЛЫЙ\n удар ");
    expect(matches("Тяжёлый доспех", "точный удар")).toBe(true);
    expect(matches("Тяжёлый доспех")).toBe(false);
    const entries = catalogSectionEntries("monsters");
    const first = entries.find((entry) => entry.director?.role)!;
    const filters = { ...emptyDirectorFilters, role: first.director!.role!, query: first.name };
    const results = entries.filter((entry) => matchesDirectorFilters(entry, filters));
    expect(results.map((entry) => entry.id)).toContain(first.id);
    expect(results.every((entry) => entry.director?.role === filters.role)).toBe(true);
    expect(createLibraryMatcher("  ")("anything")).toBe(true);
  });
});
