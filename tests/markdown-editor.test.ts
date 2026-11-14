import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownManager } from "@tiptap/markdown";
import type { JSONContent } from "@tiptap/core";
import { markdownExtensions, validEditorUrl } from "../src/components/markdown/extensions";
import { MarkdownPreview } from "../src/components/MarkdownPreview";
import { MarkdownEditor } from "../src/components/MarkdownEditor";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";

const manager = new MarkdownManager({ extensions: markdownExtensions() });
const render = (text: string) => renderToStaticMarkup(createElement(MarkdownPreview, { text }));
const nodes = (node: JSONContent): JSONContent[] => [node, ...(node.content ?? []).flatMap(nodes)];
const text = "# Заголовок\n\n**Жирный**, *курсив*, ~~зачёркнутый~~ и `код`.\n\n> Цитата\n\n1. Первый\n2. Второй\n\n- [x] Готово\n- [ ] Дальше\n\n| Герой | Очки |\n| --- | ---: |\n| Анна | 3 |\n\n```js\nconst hero = 3;\n```\n\n[Ссылка](https://example.com)\n\n![Карта](/map.png)\n\n---";

describe("visual Markdown document", () => {
  it("loads stored CommonMark/GFM as editable formatted nodes", () => {
    const document = manager.parse(text);
    const all = nodes(document);
    const types = new Set(all.map(node => node.type));
    for (const type of ["heading", "paragraph", "blockquote", "orderedList", "taskList", "taskItem", "table", "tableHeader", "tableCell", "codeBlock", "image", "horizontalRule"]) expect(types.has(type), type).toBe(true);
    expect(all.find(node => node.type === "heading")?.attrs).toMatchObject({ level: 1 });
    expect(all.filter(node => node.type === "taskItem").map(node => node.attrs?.checked)).toEqual([true, false]);
    expect(all.find(node => node.type === "codeBlock")?.attrs).toMatchObject({ language: "js" });
    expect(all.find(node => node.type === "image")?.attrs).toMatchObject({ src: "/map.png", alt: "Карта" });
    const marks = new Set(all.flatMap(node => node.marks?.map(mark => mark.type) ?? []));
    for (const mark of ["bold", "italic", "strike", "code", "link"]) expect(marks.has(mark), mark).toBe(true);
  });

  it("serializes visual edits back into Markdown readable by existing views", () => {
    const document = manager.parse(text);
    const heading = document.content!.find(node => node.type === "heading")!;
    heading.content = [{ type: "text", text: "Новое название" }];
    nodes(document).filter(node => node.type === "taskItem")[1].attrs = { checked: true };
    const markdown = manager.serialize(document);
    expect(markdown).toContain("# Новое название");
    expect(markdown).toContain("- [x] Дальше");
    const html = render(markdown);
    for (const fragment of ['<h1>Новое название</h1>', '<strong>Жирный</strong>', '<em>курсив</em>', '<del>зачёркнутый</del>', '<blockquote>', '<ol>', 'type="checkbox"', '<table>', 'class="language-js"', 'href="https://example.com"', 'src="/map.png"', '<hr']) expect(html).toContain(fragment);
    expect(nodes(manager.parse(markdown)).find(node => node.type === "tableHeader" && node.attrs?.align === "right")).toBeDefined();
  });

  it("renders a single visual editor without mode switches or a source textarea", () => {
    const html = renderToStaticMarkup(createElement(MarkdownEditor, { value: text, onChange: () => {}, "aria-label": "Заметка" }));
    expect(html).toContain('class="markdown-editor"');
    expect(html).toContain('<h1>Заголовок</h1>');
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("Режим Markdown-редактора");
    expect(html).not.toContain("Редактор</button>");
    expect(html).not.toContain("Рядом</button>");
    expect(html).not.toContain("Просмотр</button>");
  });

  it("keeps author HTML as text in reading views and rejects executable insertion URLs", () => {
    const html = render('<script>alert(1)</script>\n\n[Ссылка](javascript:alert)');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    for (const url of ["javascript:alert(1)", "data:text/html,hello", "", "vbscript:run"]) expect(validEditorUrl(url)).toBe(false);
    for (const url of ["https://example.com", "/map.png", "../map.png", "#section", "mailto:hero@example.com"]) expect(validEditorUrl(url)).toBe(true);
    expect(validEditorUrl("mailto:hero@example.com", true)).toBe(false);
  });

  it("round-trips old journal strings without changing their storage shape", () => {
    const character = createCharacter();
    character.notes = { story: text, contacts: "**Анна**", debts: "- [ ] Письмо", secrets: "> Тайна", misc: "Обычные старые заметки" };
    expect(normalizeCharacter(JSON.parse(JSON.stringify(character))).notes).toEqual(character.notes);
    const markdown = manager.serialize(manager.parse("Обычные старые заметки"));
    expect(markdown.trim()).toBe("Обычные старые заметки");
  });
});
