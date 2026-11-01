import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { SheetAbilitiesPanel } from "../src/views/sheet/SheetAbilitiesPanel";
import { SheetFeaturesPanel } from "../src/views/sheet/SheetFeaturesPanel";

describe("особенности на листе", () => {
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
