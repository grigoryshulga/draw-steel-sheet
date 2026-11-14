import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { KitRuleBody } from "../src/components/rules/KitRuleBody";
import { RuleEntityView } from "../src/components/rules/RuleEntity";
import { RuleArticleContent } from "../src/components/rules/RuleArticle";
import { readingParts } from "../src/rules/codex-navigation";
import type { RuleEntity, RuleArticle } from "../src/rules/schema";
import { kitVariantEntity } from "../src/rules/kit-variants";

function entity(path: string): RuleEntity { return JSON.parse(readFileSync(path, "utf8")); }
describe("reader feedback", () => {
  it("renders all four stormwight bonus sets as compact kit bonuses", () => {
    const kit = entity("content/rules/entities/kit/kits/kit.kit-5b78887af5df.json");
    const html = renderToStaticMarkup(createElement(KitRuleBody, { text: kit.markdown, articleId: kit.source.articleId, headingOffset: 0 }));
    expect(html.match(/class="kit-rule-bonuses"/g)).toHaveLength(4);
    expect(html.match(/class="kit-rule-bonus"/g)).toHaveLength(15);
    expect(html).toContain("+9 за ");
    expect(html.match(/class="sheet-ability-card/g)).toHaveLength(5);
  });
  it.each(["Борен", "Корвен", "Раден", "Вукен"])("показывает только правила %s вместе с общим превращением", (name) => {
    const kit = entity("content/rules/entities/kit/kits/kit.kit-5b78887af5df.json");
    const variant = kitVariantEntity(kit, name)!;
    const html = renderToStaticMarkup(createElement(RuleEntityView, { entity: variant }));
    expect(html).toContain(`>${name}</h2>`);
    expect(html.match(/class="kit-rule-bonuses"/g)).toHaveLength(1);
    expect(html.match(/class="sheet-ability-card/g)).toHaveLength(2);
    expect(html).toContain("Аспект Дикой Природы");
    expect(html).toContain("Форма животного");
    expect(html).toContain("Форма гибрида");
    expect(html).toContain("Первозданный шторм");
    expect(html).toContain(`Таблица Растущей свирепости ${name === "Борен" ? "Борена" : name === "Корвен" ? "Корвена" : name === "Раден" ? "Радена" : "Вукена"}`);
    for (const other of kit.kitVariants!.filter((item) => item.name !== name)) {
      expect(html).not.toContain(`Таблица Растущей свирепости ${other.name.slice(0, -2)}`);
      expect(html).not.toContain(`>${other.name}</h2>`);
    }
    expect(html).toContain("Потратить 1 Свирепости");
  });
  it("shows an ancestry signature heading once, with its trait label", () => {
    const feature = entity("content/rules/entities/feature/ancestry-dyavol/feature.ancestry.devil.signature.serebryanyy-yazyk.json");
    const html = renderToStaticMarkup(createElement(RuleEntityView, { entity: feature, headingLevel: 3 }));
    expect(html).not.toContain("Знаковая Черта: Серебряный Язык</h");
    expect(html).toContain("Знаковая черта");
    expect(html).toContain("Мотивации и Опасные Темы");
  });
  it("uses the shared ability frame for supernatural perks and retains their full effect", () => {
    const perk = entity("content/rules/entities/perk/perk-supernatural/perk.perk-a77b514ed64c.json");
    const html = renderToStaticMarkup(createElement(RuleEntityView, { entity: perk }));
    expect(html).toContain("sheet-ability-card");
    expect(html).toContain("Невидимая Сила");
    expect(html).toContain("отломить меньший кусок");
  });
  it("puts complications in hero creation and keeps Director material together", () => {
    expect(readingParts.find(part => part.id === "how-to-play")!.chapters.some(chapter => chapter.startsWith("11."))).toBe(false);
    expect(readingParts.find(part => part.id === "creating-hero")!.chapters.some(chapter => chapter.startsWith("11."))).toBe(true);
    expect(readingParts).toHaveLength(4);
    expect(readingParts.find(part => part.id === "for-director")!.chapters.some(chapter => chapter.startsWith("23."))).toBe(true);
  });
  it("nests ancestry features below the ancestry and keeps the existing anchor", () => {
    const feature = entity("content/rules/entities/feature/ancestry-dyavol/feature.ancestry.devil.signature.serebryanyy-yazyk.json");
    const article = { id: "0405", chapter: "04. Происхождения", blocks: [{ type: "entity", ref: feature.id }] } as RuleArticle;
    const html = renderToStaticMarkup(createElement(RuleArticleContent, { article, entities: { [feature.id]: feature } }));
    expect(html).toMatch(/<h3 class="rule-entity-name"/);
    expect(html).toContain("знаковая-черта-серебряный-язык");
  });
});
