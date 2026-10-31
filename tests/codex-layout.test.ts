import { describe, expect, it } from "vitest";
import searchIndex from "../src/generated/rules/search.json";
import {
  catalogLink,
  readCodexLocation,
  headingId,
  searchText,
} from "../src/lib/codex";
import { codexIndex, codexLink } from "../src/rules/codex-navigation";
import { resolveRuleIndexEntry } from "../src/rules/repository-core";

describe("Rules navigation", () => {
  it("opens section links directly in rules and preserves article deep links", () => {
    expect(
      resolveRuleIndexEntry(
        codexIndex,
        readCodexLocation(catalogLink("08. Классы", "Неистовый")),
      )?.id,
    ).toBe("0801");
    expect(
      resolveRuleIndexEntry(
        codexIndex,
        readCodexLocation(catalogLink("02. Основы")),
      )?.id,
    ).toBe("0201");
    expect(
      resolveRuleIndexEntry(codexIndex, readCodexLocation("#/codex/0805"))?.id,
    ).toBe("0805");
    expect(
      resolveRuleIndexEntry(codexIndex, readCodexLocation(catalogLink())),
    ).toBeUndefined();
    expect(
      resolveRuleIndexEntry(
        codexIndex,
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
    expect(new Set(codexIndex.map((a) => a.id)).size).toBe(codexIndex.length);
    expect(codexIndex.find((a) => a.id === "0899-9")?.title).toContain("9-й");
    expect(codexIndex.find((a) => a.id === "0899-10")?.title).toContain("10-й");
  });
  it("has a valid destination for every generated internal article link", () => {
    const ids = new Set(codexIndex.map((a) => a.id));
    for (const article of searchIndex.articles) {
      for (const link of article.text.matchAll(/\]\(#\/codex\/([^/)]+)/g))
        expect(ids.has(link[1]), `${article.id} → ${link[1]}`).toBe(true);
    }
  });
  it("keeps article prose out of the navigation index", () => {
    for (const entry of codexIndex) {
      expect(entry.hasText).toBeTypeOf("boolean");
      expect("markdown" in entry).toBe(false);
    }
  });
  it("normalizes Russian headings and names for links and searching", () => {
    expect(headingId("**Размер И Скорость**")).toBe("размер-и-скорость");
    expect(searchText("ТЯЖЁЛЫЙ")).toBe("тяжелый");
    expect(codexLink("Дварф")).toBe("#/codex/0404");
  });
});
