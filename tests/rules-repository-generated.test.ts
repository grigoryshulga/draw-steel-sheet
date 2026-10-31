import { describe, expect, it } from "vitest";
import {
  loadRuleArticle,
  loadRuleEntity,
  loadRuleSearchIndex,
  resolveRuleIndexEntry,
  ruleIndex,
} from "../src/rules/repository";
import {
  catalogLink,
  headingId,
  readCodexLocation,
} from "../src/lib/codex";
import { normalizeSearchText, createRuleSearcher } from "../src/rules/search";

describe("generated rules pack wiring", () => {
  it("exposes a stable, unique index with legacy ids and route metadata", () => {
    expect(ruleIndex.length).toBeGreaterThan(200);
    const ids = ruleIndex.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const legacyId of ["0101", "0102", "0201", "0801", "0899-9", "0899-10"]) {
      expect(ids, `legacy id ${legacyId}`).toContain(legacyId);
    }
    for (const entry of ruleIndex) {
      expect(entry.chapter).not.toBe("");
      expect(entry.packId).toMatch(/^[A-Za-z0-9._-]+$/);
      // Проза не попадает в манифест: остаётся только признак текста.
      expect(typeof entry.hasText).toBe("boolean");
      expect("searchText" in entry).toBe(false);
    }
  });

  it("keeps every heading anchor identical to the shared headingId contract", () => {
    for (const entry of ruleIndex) {
      for (const heading of entry.headings) {
        expect(
          heading.id,
          `${entry.id}: ${heading.title}`,
        ).toBe(headingId(heading.title));
      }
    }
  });

  it("resolves old chapter and section links through the lightweight index", () => {
    expect(
      resolveRuleIndexEntry(
        ruleIndex,
        readCodexLocation(catalogLink("02. Основы")),
      )?.id,
    ).toBe("0201");
    expect(
      resolveRuleIndexEntry(
        ruleIndex,
        readCodexLocation(catalogLink("08. Классы", "Неистовый")),
      )?.id,
    ).toBe("0801");
    expect(
      resolveRuleIndexEntry(
        ruleIndex,
        readCodexLocation("#/codex/0805"),
      )?.id,
    ).toBe("0805");
    expect(
      resolveRuleIndexEntry(ruleIndex, readCodexLocation(catalogLink())),
    ).toBeUndefined();
    expect(
      resolveRuleIndexEntry(
        ruleIndex,
        readCodexLocation(catalogLink("08. Классы", "Неизвестный")),
      ),
    ).toBeUndefined();
  });

  it("loads an article with markdown blocks and every referenced entity", async () => {
    const { article, entities } = await loadRuleArticle("0801");
    expect(article.id).toBe("0801");
    expect(article.chapter).toBe("08. Классы");
    expect(article.blocks.some((block) => block.type === "markdown")).toBe(true);
    const refs = article.blocks.flatMap((block) =>
      block.type === "entity" ? [block.ref] : [],
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(entities[ref], `entity ${ref}`).toBeDefined();
      expect(entities[ref].markdown.trim()).not.toBe("");
    }
  });

  it("includes referenced rule prose in the lazy search index", async () => {
    const { article, entities } = await loadRuleArticle("0801");
    const ref = article.blocks.find((block) => block.type === "entity");
    expect(ref?.type).toBe("entity");
    if (!ref || ref.type !== "entity") return;
    const markdown = entities[ref.ref].markdown
      .replace(/[#*_`[\]]/g, "")
      .split("\n")
      .find((line) => line.trim().length > 40)
      ?.trim()
      .slice(0, 40);
    expect(markdown, "entity prose available").toBeTruthy();
    const searchIndex = await loadRuleSearchIndex();
    const document = searchIndex.articles.find(
      (candidate) => candidate.id === "0801",
    );
    expect(document, "0801 search document").toBeDefined();
    expect(normalizeSearchText(document!.text)).toContain(
      normalizeSearchText(markdown!),
    );
  });

  it("covers every indexed article exactly once in the lazy corpus", async () => {
    const searchIndex = await loadRuleSearchIndex();
    const ids = searchIndex.articles.map((document) => document.id);
    expect(ids).toEqual(ruleIndex.map((entry) => entry.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("finds an article by prose of an entity it references", async () => {
    const { article, entities } = await loadRuleArticle("0801");
    const ref = article.blocks.find((block) => block.type === "entity");
    expect(ref?.type).toBe("entity");
    if (!ref || ref.type !== "entity") return;
    const word = entities[ref.ref].markdown.match(/[А-Яа-яЁё]{9,}/u)?.[0];
    expect(word, "long entity word").toBeTruthy();
    const searcher = createRuleSearcher(
      ruleIndex,
      await loadRuleSearchIndex(),
    );
    const matches = searcher.search(word!);
    expect(matches.map((match) => match.entry.id)).toContain("0801");
    expect(matches[0].excerpt.length).toBeGreaterThan(0);
    expect(matches[0].excerpt).not.toContain("**");
  });

  it("resolves every entity reference in every indexed article", async () => {
    const problems: string[] = [];
    for (const entry of ruleIndex) {
      const { article, entities } = await loadRuleArticle(entry.id);
      if (
        article.title !== entry.title ||
        article.chapter !== entry.chapter ||
        article.group !== entry.group
      ) {
        problems.push(`${entry.id}: article metadata differs from index`);
      }
      for (const block of article.blocks) {
        if (block.type === "entity" && !entities[block.ref]) {
          problems.push(`${entry.id} → ${block.ref}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("loads a canonical entity by namespaced id and reports missing ids", async () => {
    const { article } = await loadRuleArticle("0801");
    const ref = article.blocks.find((block) => block.type === "entity");
    expect(ref?.type).toBe("entity");
    if (!ref || ref.type !== "entity") return;
    const entity = await loadRuleEntity(ref.ref);
    expect(entity.id).toBe(ref.ref);
    expect(entity.markdown.trim()).not.toBe("");

    await expect(loadRuleArticle("missing-article")).rejects.toMatchObject({
      name: "RuleDataError",
      code: "unknown-article",
      ruleId: "missing-article",
    });
    await expect(loadRuleEntity("missing-entity")).rejects.toMatchObject({
      name: "RuleDataError",
      code: "unknown-entity",
      ruleId: "missing-entity",
    });
  });
});
