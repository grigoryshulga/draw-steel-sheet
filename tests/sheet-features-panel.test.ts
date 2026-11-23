import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { ancestrySignatureFeatures } from "../src/data/ancestry-features/skeleton";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { SheetAbilitiesPanel } from "../src/views/sheet/SheetAbilitiesPanel";
import { SheetFeaturesPanel } from "../src/views/sheet/SheetFeaturesPanel";

describe("особенности на листе", () => {
  it.each(["Ящер", "Дварф", "Ревенант"])("показывает знаковые черты %s у старого героя без автоматизации", (ancestry) => {
    const character = createCharacter({ ancestry });
    delete character.automation;
    const value = { character } as AppContextValue;
    const html = renderToStaticMarkup(
      createElement(AppContext.Provider, { value }, createElement(SheetFeaturesPanel)),
    );
    const signatures = ancestrySignatureFeatures(ancestry);
    expect(signatures.length).toBeGreaterThan(0);
    for (const feature of signatures) {
      expect(html).toContain(`Открыть особенность: ${feature.name}`);
    }
    expect(html).toContain('data-category="ancestry"');
  });

  it.each([
    [2, "Идеал", false, false],
    [3, "Идеал", true, false],
    [4, "Идеал", true, false],
    [5, "Идеал", true, true],
    [5, "Оракул", true, false],
  ] as const)("показывает полученные триггеры Цензора: уровень %i, орден %s", (level, subclass, judgment, standFast) => {
    const character = { ...createCharacter({ className: "Цензор", level }), subclass };
    const html = renderToStaticMarkup(createElement(AppContext.Provider,
      { value: { character } as AppContextValue }, createElement(SheetFeaturesPanel)));
    expect(html.includes("Открыть особенность: Узрите мои дела и отчайтесь")).toBe(judgment);
    expect(html.includes("Открыть особенность: Стой твердо!")).toBe(standFast);
  });

  it("показывает пассивные особенности отдельно от способностей", () => {
    const character = createCharacter({ className: "Цензор", level: 3 });
    character.subclass = "Идеал";
    character.automation = {
      enabled: true,
      adjustments: {},
      ancestryTraits: [],
      classFeatureSelections: { "censor.domain": "Созидание" },
    };
    character.abilities = [];
    const value = { character, update() {}, notify() {} } as unknown as AppContextValue;
    const render = (component: typeof SheetFeaturesPanel) => renderToStaticMarkup(
      createElement(AppContext.Provider, { value }, createElement(component)),
    );
    const features = render(SheetFeaturesPanel);
    expect(features).toContain("Особенности");
    expect(features).toContain("Вести за собой");
    expect(render(SheetAbilitiesPanel)).not.toContain("Вести за собой");
  });
});

it("сохраняет избранное конкретного героя и показывает его над действиями", () => {
  const source = createCharacter();
  const [favorite] = source.abilities;
  const character = normalizeCharacter(JSON.parse(JSON.stringify({
    ...source,
    favoriteAbilityIds: [favorite.id, favorite.id, null, ""],
  })));
  expect(character.favoriteAbilityIds).toEqual([favorite.id]);
  expect(normalizeCharacter(source).favoriteAbilityIds).toBeUndefined();

  const render = (readOnly: boolean) => renderToStaticMarkup(createElement(AppContext.Provider,
    { value: { character, readOnly } as AppContextValue }, createElement(SheetAbilitiesPanel)));
  const html = render(false);
  expect(html).toMatch(/data-action="favorites".*Избранное/);
  expect(html).toContain(`Убрать из избранного: ${favorite.name}`);
  expect(render(true)).not.toContain('data-action="favorites"');
});
