import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CodexView } from "../src/views/CodexView";

const renderCodex = (hash: string) => {
  vi.stubGlobal("window", {
    location: { hash, replace() {} },
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
});
