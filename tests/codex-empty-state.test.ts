import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CodexView } from "../src/views/CodexView";

const renderCodex = (hash: string) => {
  vi.stubGlobal("window", {
    location: { hash, replace() {} },
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
  });
  return renderToStaticMarkup(createElement(CodexView));
};

describe("оглавление Кодекса", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem() {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("не показывает «Ничего не найдено» при открытии оглавления", () => {
    const html = renderCodex("#/codex/");
    expect(html).not.toContain("Ничего не найдено");
    expect(html).toContain("Оглавление");
    expect(html).toContain("codex-collections");
  });

  it("показывает недавние статьи и скрывает устаревшие идентификаторы", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === "ds-reading-history-v1" ? '["0201","deleted-article"]' : null,
    });
    const html = renderCodex("#/codex/");
    expect(html).toContain("Недавно открытые");
    expect(html).toContain('href="#/codex/0201"');
    expect(html).toContain("Очистить историю чтения");
    expect(html).not.toContain("deleted-article");
  });

  it("начинает с закрытых глав и нумерует их в порядке чтения", () => {
    const html = renderCodex("#/codex/");
    expect(html).toContain('<details class="codex-tree-chapter">');
    expect(html).not.toContain('<details open=""');
    expect(html).toContain("3. Тесты");
    expect(html).toContain("Глава 03");
    expect(html).not.toContain("Часть V");
  });

  it("открывает начало выбранной главы по прежней ссылке", () => {
    const html = renderCodex("#/codex/?chapter=" + encodeURIComponent("12. Тесты"));
    const main = html.slice(html.indexOf('class="codex-main"'));
    expect(main).toContain("<h1>О Тестах</h1>");
    expect(main).not.toContain("codex-collections");
    expect(html).toContain('<details open="" class="codex-tree-chapter">');
  });
});
