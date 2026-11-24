import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import monsterPack from "../src/generated/rules/articles/monsters.monster.demon.2nd-echelon.statblock.gunge.json";
import narrativePack from "../src/generated/rules/articles/0101.json";
import perkPack from "../src/generated/rules/articles/1002.json";
import { englishArticleHeadings } from "../src/components/rules/reader-headings";
import classPack from "../src/generated/rules/articles/0801.json";
import type { RuleArticle, RuleEntity } from "../src/rules/schema";

const state = vi.hoisted(() => ({ locale: "en" as "ru" | "en" }));
vi.mock("../src/i18n/locale", () => ({
  useArticleLocale: () => state.locale,
  useLocale: () => ({ locale: state.locale, t: (_ru: string, en: string) => en }),
  useRuleLanguage: (_id: string, original?: string) => ({
    language: original?.trim() ? state.locale : "ru", available: Boolean(original?.trim()), setLanguage: () => {},
  }),
}));
import { RuleArticleContent } from "../src/components/rules/RuleArticle";
import { RuleEntityView } from "../src/components/rules/RuleEntity";

const entity: RuleEntity = { id: "feature.test", kind: "feature", name: "Черта", markdown: "Русский полный текст", originalName: "Feature", originalDescription: "English full text", source: { articleId: "test", path: "test" } };

describe("reader language", () => {
  it("shows the complete English entity and its stable anchor", () => {
    const html = renderToStaticMarkup(createElement(RuleEntityView, { entity }));
    expect(html).toContain("English full text");
    expect(html).toContain("rule-entity-feature.test");
    expect(html).not.toContain("Русский полный текст");
  });
  it("keeps the complete article and nested entities when the original is only an introduction", () => {
    const article: RuleArticle = { id: "test", title: "Статья", chapter: "01", group: "", path: "test", originalDescription: "English introduction", blocks: [{ type: "markdown", text: "Полный перевод" }, { type: "entity", ref: entity.id }] };
    const html = renderToStaticMarkup(createElement(RuleArticleContent, { article, entities: { [entity.id]: entity } }));
    expect(html).toContain("English introduction");
    expect(html).not.toContain("Полный перевод");
    expect(html).toContain("English full text");
  });
  it("marks an absent original and retains Russian prose", () => {
    const html = renderToStaticMarkup(createElement(RuleEntityView, { entity: { ...entity, originalDescription: "  " } }));
    expect(html).toContain("Русский полный текст");
  });
  it("resolves the original source links to real reader destinations", async () => {
    const { sourceRuleHref } = await import("../src/lib/remark-rule-links");
    const { loadEnglishReference } = await import("../src/rules/consumer-english-reference");
    const { links } = await loadEnglishReference();
    const edge = "scc.v1:mcdm.heroes.v1/rule.dice/edge";
    expect(sourceRuleHref(edge, links)).toBe("#/catalog/glossary/glossary.edge");
    expect(sourceRuleHref("scc.v1:mcdm.monsters.v1/rule.monster/malice", links)).toBe("#/codex/monsters.rule.monster.malice");
    expect(sourceRuleHref("constructor", links)).toBeUndefined();
  });
  it("renders Russian monster tabs without nested language switches", () => {
    state.locale = "ru";
    const article = monsterPack.articles[0] as RuleArticle;
    const entities = Object.fromEntries(monsterPack.entities.map(value => [value.id, value])) as Record<string, RuleEntity>;
    const html = renderToStaticMarkup(createElement(RuleArticleContent, { article, entities, headingActions: createElement("button", null, "Bookmark action") }));
    expect(html).toContain("Bookmark action");
    expect(html).not.toContain("Show English original");
    expect(html).toContain('role="tablist"');
    state.locale = "en";
  });
  it("builds both TOCs from displayed original headings and actual anchors", () => {
    const narrative = narrativePack.articles[0] as RuleArticle;
    const narrativeHeadings = englishArticleHeadings(narrative, {});
    expect(narrativeHeadings.map((heading) => heading.title)).toEqual([
      "Tactical", "Heroic", "Cinematic", "Fantasy", "If You're Coming From D20 Fantasy",
    ]);
    const narrativeHtml = renderToStaticMarkup(createElement(RuleArticleContent, { article: narrative, entities: {} }));
    for (const heading of narrativeHeadings) expect(narrativeHtml).toContain(`id="${heading.id}"`);
    expect(narrativeHtml).not.toContain("Glossary Index");
    const article = perkPack.articles[0] as RuleArticle;
    const entities = Object.fromEntries(perkPack.entities.map(value => [value.id, value])) as Record<string, RuleEntity>;
    const headings = englishArticleHeadings(article, entities);
    const html = renderToStaticMarkup(createElement(RuleArticleContent, { article, entities }));
    expect(headings.map(heading => heading.title)).toEqual(Object.values(entities).map(value => value.originalName));
    for (const heading of headings) expect(html).toContain(`id="${heading.id}"`);
  });
  it("keeps an English class ability openable and retains heading actions", () => {
    const ability = classPack.entities.find(value => value.id === "feature.ability.fury.level-1.furious-change") as RuleEntity;
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(createElement(RuleEntityView, { entity: ability, onOpen, headingActions: createElement("button", null, "Bookmark action") }));
    expect(html).toContain("Bookmark action");
    expect(html).toContain('role="button"');
    expect(html).toContain("Open card");
    const rendered = RuleEntityView({ entity: ability, onOpen, headingActions: createElement("button", null, "Bookmark action") });
    const body = rendered.props.children.find((child: { props?: { onClick?: unknown } } | null) => child?.props?.onClick);
    body.props.onClick();
    expect(onOpen).toHaveBeenCalledOnce();
    const preventDefault = vi.fn();
    body.props.onKeyDown({ key: "Enter", preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
