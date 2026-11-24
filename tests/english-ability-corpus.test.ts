import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { referenceAbilityView } from "../src/components/rules/AbilitySheet";
import { printedAbilityView } from "../src/components/rules/printedAbilityView";
import { compilePrintedAbility } from "../scripts/content/lib/printed-ability.mjs";
import type { PrintedAbility } from "../src/rules/printed-ability";

describe("English ability corpus", () => {
  it("compiles all source cards and preserves every body section in order", () => {
    let rolls = 0, tables = 0, triggers = 0;
    for (const ability of ABILITY_COMPENDIUM) {
      const text = ability.originalDescription!;
      expect(text?.trim(), ability.id).toBeTruthy();
      const card: PrintedAbility = compilePrintedAbility(text);
      const base = referenceAbilityView(ability);
      const view = printedAbilityView(base, card, base.cardModifiers);
      if (/^\|[^\n]*\|\s*\n\|[\s:|-]+\|\s*\n\|/m.test(text)) {
        tables++;
        expect(card.facts, ability.id).toBeDefined();
        expect(view.facts).toHaveLength(4);
      }
      const sourceRolls = text.match(/^\*\*Power Roll\b/gim)?.length ?? 0;
      const emittedRolls = Number(Boolean(card.roll)) + card.blocks.filter(block => "roll" in block).length;
      expect(emittedRolls, ability.id).toBe(sourceRolls);
      if (card.roll) { rolls++; expect(view.tiers).toHaveLength(3); }
      if (/^\*\*Trigger:\*\*/m.test(text)) { triggers++; expect(card.trigger, ability.id).toBeTruthy(); }
      // Every unstructured paragraph must remain verbatim and in source order.
      let cursor = 0;
      for (const part of [card.beforeRoll, ...card.blocks.map(block => "text" in block ? block.text : undefined)].filter((part): part is string => !!part)) {
        for (const paragraph of part.split(/\n\s*\n/)) {
          const at = text.indexOf(paragraph, cursor);
          expect(at, `${ability.id}: ${paragraph.slice(0, 60)}`).toBeGreaterThanOrEqual(cursor);
          cursor = at + paragraph.length;
        }
      }
    }
    expect(ABILITY_COMPENDIUM).toHaveLength(512);
    expect(tables).toBe(511);
    expect(rolls).toBeGreaterThan(290);
    expect(triggers).toBeGreaterThan(0);
  });
});
