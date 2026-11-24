import { describe, expect, it } from "vitest";
import { mechanicAbilityName } from "../src/components/abilityOriginal";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { LEGACY_ABILITY_IDS } from "../src/data/originals";

describe("mechanic ability names", () => {
  const source = ABILITY_COMPENDIUM.find(entry => entry.originalName && entry.originalId)!;

  it("translates unchanged names even when the ability's other fields were edited", () => {
    expect(mechanicAbilityName(Object.assign({}, source, { effect: "edited" }), ABILITY_COMPENDIUM)).toBe(source.originalName);
    expect(mechanicAbilityName({ ...source, id: "saved-instance" }, ABILITY_COMPENDIUM)).toBe(source.originalName);
  });

  it("preserves renamed and ambiguous abilities", () => {
    expect(mechanicAbilityName({ ...source, name: "Моё название" }, ABILITY_COMPENDIUM)).toBe("Моё название");
    const saved = { ...source, id: "saved-instance", originalId: undefined };
    expect(mechanicAbilityName(saved, [source, { ...source, id: "other" }])).toBe(source.name);
  });

  it("recognizes legacy ids", () => {
    const legacy = Object.entries(LEGACY_ABILITY_IDS).find(([, id]) => ABILITY_COMPENDIUM.some(entry => entry.id === id && entry.originalName));
    expect(legacy).toBeDefined();
    const [oldId, id] = legacy!;
    const entry = ABILITY_COMPENDIUM.find(ability => ability.id === id)!;
    expect(mechanicAbilityName({ ...entry, id: oldId, originalId: undefined }, ABILITY_COMPENDIUM)).toBe(entry.originalName);
  });
});
