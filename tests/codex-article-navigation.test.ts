import { createElement, type EffectCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { CodexView } from "../src/views/CodexView";
import { loadRuleArticle } from "../src/rules/repository";

// Run mount effects after rendering so a second, independent load is observable.
const effects = vi.hoisted(() => [] as EffectCallback[]);
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: EffectCallback) => { effects.push(effect); },
}));
vi.mock("../src/rules/repository", async (original) => ({
  ...await original<typeof import("../src/rules/repository")>(),
  loadRuleArticle: vi.fn(() => new Promise(() => {})),
}));

function openLink(hash: string) {
  const replace = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => null });
  const listeners = { addEventListener() {}, removeEventListener() {} };
  vi.stubGlobal("window", {
    ...listeners,
    location: { hash, replace },
    matchMedia: () => ({ ...listeners, matches: false }),
  });
  vi.stubGlobal("document", { ...listeners, getElementById: () => null });
  renderToStaticMarkup(createElement(CodexView));
  const cleanups = effects.splice(0).map(effect => effect());
  cleanups.forEach(cleanup => cleanup?.());
  return replace;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  effects.length = 0;
});

it.each([
  ["monsters.monster.goblin.statblock.goblin-warrior", "#/catalog/monsters/monsters.monster.goblin.statblock.goblin-warrior"],
  ["monsters.dynamic-terrain.environmental-hazards.angry-beehive", "#/catalog/terrain/monsters.dynamic-terrain.environmental-hazards.angry-beehive"],
  ["monsters.rule.keyword.abyssal", "#/catalog/glossary#term-glossary.abyssal"],
  ["0882", "#/reference/class/censor#level-2"],
])("перенаправляет старую ссылку %s до загрузки статьи", (id, href) => {
  const replace = openLink(`#/codex/${id}`);
  expect(replace).toHaveBeenCalledExactlyOnceWith(href);
  expect(loadRuleArticle).not.toHaveBeenCalled();
});

it("загружает обычную статью один раз при открытии ссылки на заголовок", () => {
  const replace = openLink("#/codex/0201/" + encodeURIComponent("характеристики"));
  expect(replace).not.toHaveBeenCalled();
  expect(loadRuleArticle).toHaveBeenCalledExactlyOnceWith("0201");
});
