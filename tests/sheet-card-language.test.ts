import { describe, expect, it } from "vitest";
import { findAbilityOriginal } from "../src/components/abilityOriginal";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";

describe("original ability text", () => {
  it("matches saved and legacy copies without changing them", () => {
    const source = ABILITY_COMPENDIUM.find((entry) => entry.originalDescription)!;
    const saved = { ...source, id: "saved-instance" };
    const before = structuredClone(saved);
    expect(findAbilityOriginal(saved, ABILITY_COMPENDIUM)).toBe(source);
    expect(findAbilityOriginal({ ...saved, originalId: undefined }, ABILITY_COMPENDIUM)).toBe(source);
    expect(saved).toEqual(before);
  });
  it("matches the picker clone after JSON persistence and old saves without original metadata", () => {
    const source = ABILITY_COMPENDIUM.find((entry) => entry.originalDescription && entry.originalName)!;
    const clone = { ...source, id: "new-generated-id", preferredCharacteristic: source.preferredCharacteristic || source.rollCharacteristics[0] || "" };
    const restored = JSON.parse(JSON.stringify(clone));
    expect(findAbilityOriginal(restored, ABILITY_COMPENDIUM)?.originalName).toBe(source.originalName);
    delete restored.originalId;
    delete restored.originalName;
    delete restored.originalDescription;
    expect(findAbilityOriginal(restored, ABILITY_COMPENDIUM)?.originalName).toBe(source.originalName);
  });
  it("rejects ambiguous legacy names", () => {
    const source = ABILITY_COMPENDIUM.find((entry) => entry.originalDescription)!;
    const saved = { ...source, id: "old-instance", originalId: undefined };
    expect(findAbilityOriginal(saved, [source, { ...source, id: "another", originalId: "different" }])).toBeUndefined();
  });
  it("does not attach stock text to an edited ability", () => {
    const source = ABILITY_COMPENDIUM.find((entry) => entry.originalDescription)!;
    expect(findAbilityOriginal({ ...source, effect: source.effect + " custom" }, ABILITY_COMPENDIUM)).toBeUndefined();
  });
});
