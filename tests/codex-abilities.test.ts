import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Nodes } from "mdast";
import { remarkAbilityBlocks } from "../src/lib/remark-ability-blocks";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleText } from "../src/components/RuleText";
import articles from "../src/data/codex.generated.json";

const article = articles.find((a) => a.id === "0805")!;
describe("Codex ability presentation", () => {
  it("preserves rule text and link destinations across the entire book", () => {
    function content(node: Nodes): string {
      if (node.data?.hProperties?.className?.includes("abil-fact-label"))
        return "";
      return (
        ("value" in node
          ? node.value
          : "children" in node
            ? node.children.map(content).join("")
            : "") + (node.type === "link" ? node.url : "")
      );
    }
    const normalize = (s: string) => s.replace(/[\s,*]/g, "");
    let cards = 0;
    for (const article of articles) {
      const tree = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .parse(article.markdown);
      const before = normalize(content(tree));
      remarkAbilityBlocks()(tree);
      expect(normalize(content(tree)), article.id).toBe(before);
      cards += JSON.stringify(tree).split('"codex-ability"').length - 1;
    }
    expect(cards).toBeGreaterThan(540);
  });
  it("renders abilities with shared facts and tier styles, retaining special rules", () => {
    const html = renderToStaticMarkup(
      createElement(RuleText, { text: article.markdown }),
    );
    expect(html).toContain('class="codex-ability"');
    expect(html).toContain('class="abil-facts"');
    for (const tier of [1, 2, 3]) expect(html).toContain(`data-tier="${tier}"`);
    expect(html).toContain("Ослабляющий Удар (9 Свирепости)");
    expect(html).toContain("10 + М урона");
    expect(html).toContain("включая принудительное движение");
    expect(html).toContain("Вы можете потратить Восстановление");
  });
  it("preserves ordinary callouts and tables", () => {
    const html = renderToStaticMarkup(
      createElement(RuleText, {
        text: "> **Важное правило**\n>\n> Обычная заметка.\n\n| A | B |\n|---|---|\n| 1 | 2 |",
      }),
    );
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<table>");
    expect(html).not.toContain('class="codex-ability"');
  });
  it("keeps links, nested lists, extra tables and paragraphs inside an ability", () => {
    const source =
      "> **Тест**\n>\n> | Магия | Маневр |\n> |---|---|\n> | 📏 5 | 🎯 Союзник |\n>\n> **Эффект:** [Правило](#/codex/0801)\n>\n> - Первый\n>   - Вложенный\n>\n> | Дополнение | Значение |\n> |---|---|\n> | Особое | 42 |\n>\n> Последний абзац.";
    const html = renderToStaticMarkup(
      createElement(RuleText, { text: source }),
    );
    expect(html).toContain('href="#/codex/0801"');
    expect(html).toContain("Вложенный");
    expect(html).toContain("<table>");
    expect(html).toContain("42");
    expect(html).toContain("Последний абзац.");
  });
});
