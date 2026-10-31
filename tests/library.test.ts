import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CATALOG,
  GLOSSARY,
  catalogEntryLink,
  sourceLink,
  matchesLibraryQuery,
} from "../src/data/library";
import { addCatalogEntry } from "../src/lib/catalog-character";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { CatalogAction } from "../src/components/CatalogAction";
import { codexIndex } from "../src/rules/codex-navigation";
import { RuleText } from "../src/components/RuleText";
import articles from "../src/data/codex.generated.json";

describe("Library catalogs", () => {
  it("allows reading without a character and offers a route to create one", () => {
    const html = renderToStaticMarkup(
      createElement(CatalogAction, { entry: CATALOG[0] }),
    );
    expect(html).toContain('href="#/sheet"');
    expect(html).not.toContain("<button");
  });
  it("extracts individual treasures and titles without treating nested headings as entries", () => {
    expect(CATALOG.filter((e) => e.kind === "treasure")).toHaveLength(100);
    expect(CATALOG.filter((e) => e.kind === "title")).toHaveLength(59);
    expect(CATALOG.filter((e) => e.kind === "project")).toHaveLength(19);
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length);
    expect(CATALOG.some((e) => e.name === "Свойства боффина")).toBe(false);
    for (const entry of CATALOG) {
      const article = articles.find((a) => a.id === entry.articleId)!;
      expect(article.markdown, entry.id).toContain(entry.markdown);
      if (entry.heading)
        expect(
          codexIndex.find((a) => a.id === entry.articleId)?.headings.some(
            (h) => h.id === entry.heading,
          ),
          entry.id,
        ).toBe(true);
      expect(sourceLink(entry)).toContain(`#/codex/${article.id}`);
      expect(catalogEntryLink(entry)).toContain(`#/catalog/${entry.kind}/`);
    }
  });
  it("extracts English terms, dice and the unformatted final definition", () => {
    expect(GLOSSARY).toHaveLength(234);
    expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length);
    expect(GLOSSARY.find((e) => e.name === "Ясность")?.english).toBe("Clarity");
    expect(GLOSSARY.find((e) => e.name === "d10")).toBeDefined();
    const slowed = GLOSSARY.find((e) => e.name === "Замедление")!;
    expect(matchesLibraryQuery("SLOWED", slowed.name, slowed.english)).toBe(
      true,
    );
    expect(slowed.markdown).toContain("скорость существа до 2");
  });
  it("adds treasures by identity, increments quantity, and retains titles once", () => {
    const seed = createCharacter({ name: "Каталожный герой" });
    const treasure = CATALOG.find((e) => e.name === "Зелье исцеления")!;
    let hero = addCatalogEntry(seed, treasure, "one");
    expect(hero.inventory[0]).toMatchObject({
      name: treasure.name,
      category: "consumable",
      qty: 1,
      catalogId: treasure.id,
    });
    hero.inventory[0].name = "Моё зелье";
    hero = addCatalogEntry(hero, treasure, "two");
    expect(hero.inventory).toHaveLength(1);
    expect(hero.inventory[0].qty).toBe(2);
    const title = CATALOG.find((e) => e.kind === "title")!;
    hero = addCatalogEntry(hero, title, "title");
    expect(addCatalogEntry(hero, title, "duplicate")).toBe(hero);
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(hero)));
    expect(restored.inventory).toEqual(hero.inventory);
    expect(seed.inventory).toHaveLength(0);
  });
  it("starts independent projects with rule defaults and selected characteristics", () => {
    const project = CATALOG.find((e) => e.name === "Выучить Новый Язык")!;
    expect(project.projectGoal).toBe("120");
    let hero = addCatalogEntry(
      createCharacter({ name: "Мира" }),
      project,
      "first",
      { characteristic: "intuition" },
    );
    expect(hero.projects[0]).toMatchObject({
      assigned: "Мира",
      goal: "120",
      points: "0",
      characteristic: "intuition",
      catalogId: project.id,
    });
    hero = addCatalogEntry(hero, project, "second", {
      characteristic: "reason",
      goal: "240",
    });
    expect(hero.projects).toHaveLength(2);
    expect(hero.projects[0].goal).toBe("120");
    expect(
      normalizeCharacter(JSON.parse(JSON.stringify(hero))).projects,
    ).toEqual(hero.projects);
  });
  it("links exact terms and catalog entries without nesting authored links or linking code", () => {
    const html = renderToStaticMarkup(
      createElement(RuleText, {
        text: "Замедление. Замедление. Выучить Новый Язык. [Замедление](#/codex/1301) `Замедление`",
      }),
    );
    expect(html.match(/href="#\/glossary\//g)).toHaveLength(1);
    expect(html).toContain('href="#/catalog/project/learn-new-language"');
    expect(html).toContain('<a href="#/codex/1301">Замедление</a>');
    expect(html).toContain("<code>Замедление</code>");
  });
});
