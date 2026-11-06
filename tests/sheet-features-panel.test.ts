import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
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
