import { describe, expect, it } from "vitest";
import {
  classLandings,
  classLandingForArticle,
  classLandingHref,
  codexArticleHref,
  codexIndex,
} from "../src/rules/codex-navigation";
import { ruleIndex } from "../src/rules/repository";

describe("лендинги классов в навигации кодекса", () => {
  it("десять лендингов, slug — id класса без префикса", () => {
    expect(classLandings).toHaveLength(10);
    for (const landing of classLandings) {
      expect(landing.slug).toBe(landing.classId.replace(/^class\./, ""));
      expect(landing.levelArticleIds.length).toBeGreaterThan(0);
    }
  });

  it("каждая статья-уровень ведёт на свой класс и уровень без дублей", () => {
    const levelArticles = ruleIndex.filter((entry) =>
      entry.chapter.startsWith("08."),
    );
    expect(levelArticles).toHaveLength(100);

    const seen = new Map<string, string>();
    for (const entry of levelArticles) {
      const target = classLandingForArticle(entry.id);
      expect(target, `нет лендинга для ${entry.id}`).toBeDefined();
      const key = `${target.slug}#${target.level}`;
      expect(
        seen.has(key),
        `${entry.id} и ${seen.get(key)} претендуют на ${key}`,
      ).toBe(false);
      seen.set(key, entry.id);
      expect(codexArticleHref(entry.id)).toBe(
        classLandingHref(target.slug, target.level),
      );
    }
    expect(seen.size).toBe(
      classLandings.reduce((sum, landing) => sum + landing.levelArticleIds.length, 0),
    );
  });

  it("обычные статьи остаются в кодексе", () => {
    expect(codexArticleHref("0201")).toBe("#/codex/0201");
    expect(classLandingForArticle("0201")).toBeUndefined();
  });

  it("ссылки на лендинги имеют якорную форму уровня", () => {
    expect(classLandingHref("fury")).toBe("#/reference/class/fury");
    expect(classLandingHref("fury", 1)).toBe("#/reference/class/fury#level-1");
  });

  it("все 100 статей-уровней остаются в общем индексе кодекса", () => {
    expect(
      codexIndex.filter((entry) => entry.chapter.startsWith("08.")),
    ).toHaveLength(100);
  });
});
