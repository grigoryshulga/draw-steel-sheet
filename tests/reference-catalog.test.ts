import { describe, expect, it } from "vitest";
import {
  CATALOG_SECTIONS,
  catalogBrowserEntryHref,
  catalogSectionCount,
  catalogSectionEntries,
  catalogSectionHref,
  resolveCatalogRoute,
} from "../src/data/reference-catalog";
import { codexIndex } from "../src/rules/codex-navigation";

describe("Единый каталог Справочника", () => {
  it("все разделы живут в одной полосе вкладок с ожидаемыми счётчиками", () => {
    expect(CATALOG_SECTIONS.map((section) => section.id)).toEqual([
      "classes",
      "ancestries",
      "careers",
      "kits",
      "perks",
      "treasure",
      "title",
      "project",
      "glossary",
    ]);
    expect(catalogSectionCount("classes")).toBe(10);
    expect(catalogSectionCount("ancestries")).toBe(14);
    expect(catalogSectionCount("careers")).toBe(18);
    expect(catalogSectionCount("kits")).toBe(22);
    expect(catalogSectionCount("perks")).toBe(47);
    expect(catalogSectionCount("treasure")).toBe(100);
    expect(catalogSectionCount("title")).toBe(59);
    expect(catalogSectionCount("project")).toBe(19);
    expect(catalogSectionCount("glossary")).toBe(234);
  });

  it("каждая запись списка ссылается на существующую статью", () => {
    for (const section of ["ancestries", "careers", "kits"] as const) {
      const entries = catalogSectionEntries(section);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.articleId, entry.name).toBeDefined();
        expect(
          codexIndex.some((article) => article.id === entry.articleId),
          `${section}: ${entry.name}`,
        ).toBe(true);
        expect(entry.name.trim()).not.toBe("");
        expect(entry.summary.trim()).not.toBe("");
      }
    }
    for (const entry of catalogSectionEntries("perks")) {
      expect(entry.perk).toBeDefined();
      expect(entry.articleId).toMatch(/^100[2-7]$/);
    }
  });

  it("разбирает новые адреса каталога и старые адреса Справочника", () => {
    expect(resolveCatalogRoute(["#", "catalog", "treasure"])).toEqual({
      section: "treasure",
      id: "",
    });
    expect(resolveCatalogRoute(["#", "catalog", "treasures", "abc"])).toEqual({
      section: "treasure",
      id: "abc",
    });
    expect(resolveCatalogRoute(["#", "reference"])).toEqual({
      section: "classes",
      id: "",
    });
    expect(resolveCatalogRoute(["#", "reference", "ancestries"])).toEqual({
      section: "ancestries",
      id: "",
    });
    expect(resolveCatalogRoute(["#", "glossary", "замедление"])).toEqual({
      section: "glossary",
      id: "замедление",
    });
    expect(resolveCatalogRoute(["#", "catalog", "glossary", "замедление"])).toEqual(
      { section: "glossary", id: "замедление" },
    );
    expect(resolveCatalogRoute(["#", "catalog"])).toEqual({
      section: "treasure",
      id: "",
    });
    expect(resolveCatalogRoute(["#", "catalog", "unknown", "x"])).toEqual({
      section: "treasure",
      id: "x",
    });
  });

  it("строит адреса вкладки и записи", () => {
    expect(catalogSectionHref("ancestries")).toBe("#/catalog/ancestries");
    expect(catalogBrowserEntryHref("ancestries", "0402")).toBe(
      "#/catalog/ancestries/0402",
    );
    expect(catalogBrowserEntryHref("glossary", "замедление")).toBe(
      "#/catalog/glossary/%D0%B7%D0%B0%D0%BC%D0%B5%D0%B4%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5",
    );
  });
});
