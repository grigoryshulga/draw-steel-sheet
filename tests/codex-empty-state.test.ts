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
});
