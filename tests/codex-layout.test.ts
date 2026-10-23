import { describe, expect, it } from "vitest";
import articles from "../src/data/codex.generated.json";
import {
  CODEX_INDEX,
  codexLink,
  headingId,
  searchText,
} from "../src/lib/codex";

describe("Rules navigation", () => {
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
