import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AbilityCard } from "../src/components/AbilityCard";
import { PerkCard } from "../src/components/PerkCard";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { PERK_COMPENDIUM } from "../src/data/perks";
import { createCharacter } from "../src/lib/defaults";

describe("compact rule cards", () => {
  it("does not add a language control to ability or perk cards", () => {
    const ability = ABILITY_COMPENDIUM.find(item => item.originalDescription)!;
    const perk = PERK_COMPENDIUM.find(item => item.originalDescription)!;
    const abilityHtml = renderToStaticMarkup(createElement(AbilityCard, { ability, canonical: true, character: createCharacter({ name: "Hero" }) }));
    const perkHtml = renderToStaticMarkup(createElement(PerkCard, { name: perk.name, ruleId: perk.id, originalDescription: perk.originalDescription }));
    for (const html of [abilityHtml, perkHtml]) {
      expect(html).not.toContain("Показать английский оригинал");
      expect(html).not.toContain("Show English original");
    }
  });
});
