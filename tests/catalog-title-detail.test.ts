import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CATALOG } from "../src/data/library";
import { CatalogView } from "../src/views/CatalogView";

vi.mock("../src/lib/library-location", () => ({
  useLibraryLocation: () => ["#", "catalog", "title", "ancient-loremaster"],
}));

describe("карточка титула в справочнике", () => {
  it("показывает флейвор под названием, затем единственное условие и эффект", () => {
    const entry = CATALOG.find((item) => item.id === "ancient-loremaster")!;
    const html = renderToStaticMarkup(createElement(CatalogView));
    const detail = html.slice(html.indexOf('<article id="catalog-detail"'));
    expect(detail.split(entry.prerequisite)).toHaveLength(2);
    expect(detail).not.toContain("Предварительное условие:");
    expect(detail).toMatch(/<h1>Знаток древних тайн<\/h1>.*?<em>Удивительно/s);
    expect(detail.indexOf("<em>Удивительно")).toBeLessThan(detail.indexOf("Условие получения"));
    expect(detail.indexOf("Условие получения")).toBeLessThan(detail.indexOf("Эффект:"));
    expect(detail).toContain("Кодекс шепота:");
  });
});
