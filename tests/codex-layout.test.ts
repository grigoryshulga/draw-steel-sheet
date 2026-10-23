import { describe, expect, it } from "vitest";
import articles from "../src/data/codex.generated.json";
import {
  CODEX_INDEX,
  catalogLink,
  readCodexLocation,
  resolveCodexArticle,
  codexLink,
  headingId,
  searchText,
} from "../src/lib/codex";

describe("Rules navigation", () => {
  it("opens section links directly in rules and preserves article deep links", () => {
    expect(
      resolveCodexArticle(
        articles,
        readCodexLocation(catalogLink("08. Классы", "Неистовый")),
      )?.id,
    ).toBe("0801");
    expect(
      resolveCodexArticle(
        articles,
        readCodexLocation(catalogLink("02. Основы")),
      )?.id,
    ).toBe("0201");
    expect(
      resolveCodexArticle(articles, readCodexLocation("#/codex/0805"))?.id,
    ).toBe("0805");
    expect(
      resolveCodexArticle(articles, readCodexLocation(catalogLink())),
    ).toBeUndefined();
    expect(
      resolveCodexArticle(
        articles,
        readCodexLocation(catalogLink("08. Классы", "Неизвестный")),
      ),
    ).toBeUndefined();
  });
  it("round-trips chapter and class catalog links independently of article links", () => {
    const hash = catalogLink("08. Классы", "Тень");
    expect(readCodexLocation(hash)).toEqual({
      articleId: "",
      heading: "",
      chapter: "08. Классы",
      group: "Тень",
    });
    expect(
      readCodexLocation("#/codex/0801/" + encodeURIComponent("основы")),
    ).toEqual({ articleId: "0801", heading: "основы", chapter: "", group: "" });
    expect(readCodexLocation(catalogLink()).articleId).toBe("");
    expect(readCodexLocation("#/codex/0801/%").heading).toBe("");
  });
  it("retains the two source articles with duplicate 0899 numbers under unique links", () => {
    expect(new Set(articles.map((a) => a.id)).size).toBe(articles.length);
    expect(articles.find((a) => a.id === "0899-9")?.title).toContain("9-й");
    expect(articles.find((a) => a.id === "0899-10")?.title).toContain("10-й");
  });
  it("has a valid destination for every generated internal article link", () => {
    const ids = new Set(CODEX_INDEX.map((a) => a.id));
    for (const article of articles) {
      for (const link of article.markdown.matchAll(/\]\(#\/codex\/([^/)]+)/g))
        expect(ids.has(link[1]), `${article.id} → ${link[1]}`).toBe(true);
    }
  });
  it("normalizes Russian headings and names for links and searching", () => {
    expect(headingId("**Размер И Скорость**")).toBe("размер-и-скорость");
    expect(searchText("ТЯЖЁЛЫЙ")).toBe("тяжелый");
    expect(codexLink("Дварф")).toBe("#/codex/0404");
  });
});
