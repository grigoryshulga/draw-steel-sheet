import { describe, expect, it } from "vitest";
import { CLASS_PRESETS } from "../src/data/classes";
import {
  allocateCharacteristicArray,
  assignCharacteristicValue,
  characteristicArrays,
  isValidCharacteristicAllocation,
} from "../src/lib/characteristic-allocation";
import { CHARACTERISTIC_KEYS, type CharacteristicKey } from "../src/types";

const zero = {
  might: 0,
  agility: 0,
  reason: 0,
  intuition: 0,
  presence: 0,
};

describe("characteristic allocation", () => {
  it("offers every rules array for every one-primary and two-primary class", () => {
    for (const preset of CLASS_PRESETS) {
      const expectedCount = Object.keys(preset.starting).length === 1 ? 4 : 3;
      const arrays = characteristicArrays(preset.name);
      expect(arrays).toHaveLength(expectedCount);
      for (const array of arrays) {
        const allocation = allocateCharacteristicArray(preset.name, array.id);
        expect(isValidCharacteristicAllocation(preset.name, allocation)).toBe(true);
        for (const [key, stat] of Object.entries(preset.starting)) {
          expect(allocation[key as CharacteristicKey]).toBe(stat);
        }
      }
    }
  });

  it("retains the old starting default for one-primary and two-primary classes", () => {
    expect(allocateCharacteristicArray("Тактик", "two-primary-1-0-0")).toEqual({
      might: 2,
      agility: 1,
      reason: 2,
      intuition: 0,
      presence: 0,
    });
    expect(allocateCharacteristicArray("Тень", "one-primary-2-1-0-0")).toEqual({
      might: 2,
      agility: 2,
      reason: 1,
      intuition: 0,
      presence: 0,
    });
  });

  it("swaps a chosen free value while keeping the same legal multiset", () => {
    const current = allocateCharacteristicArray("Тактик", "two-primary-1-0-0");
    const updated = assignCharacteristicValue("Тактик", current, "presence", 1);

    expect(updated).toEqual({ ...current, agility: 0, presence: 1 });
    expect(isValidCharacteristicAllocation("Тактик", updated)).toBe(true);
    expect(current).toEqual({
      might: 2,
      agility: 1,
      reason: 2,
      intuition: 0,
      presence: 0,
    });
  });

  it("does not change fixed stats, invent values, or mutate input", () => {
    const current = allocateCharacteristicArray("Тактик", "two-primary-1-1-minus1");
    const original = { ...current };
    expect(assignCharacteristicValue("Тактик", current, "might", -1)).toEqual(current);
    expect(assignCharacteristicValue("Тактик", current, "presence", 7)).toEqual(current);
    expect(current).toEqual(original);
  });

  it("reports invalid saved values without repairing them implicitly", () => {
    const legacy = { ...zero, might: 7, agility: -3 };
    expect(isValidCharacteristicAllocation("Тактик", legacy)).toBe(false);
    const attemptedEdit = assignCharacteristicValue("Тактик", legacy, "presence", 0);
    expect(attemptedEdit).toEqual(legacy);
    expect(attemptedEdit).not.toBe(legacy);
    expect(allocateCharacteristicArray("Тактик", "two-primary-1-1-minus1", legacy)).not.toEqual(legacy);
    expect(legacy).toEqual({ ...zero, might: 7, agility: -3 });
    expect(isValidCharacteristicAllocation("unknown class", zero)).toBe(false);
    expect(characteristicArrays("unknown class")).toEqual([]);
  });

  it("returns independent array and allocation values", () => {
    const arrays = characteristicArrays("Тень");
    arrays[0].values[0] = 99;
    const allocated = allocateCharacteristicArray("Тень", "one-primary-2-2-minus1-minus1");
    expect(allocated.might).toBe(2);
    expect(allocated.agility).toBe(2);
    expect(isValidCharacteristicAllocation("Тень", allocated)).toBe(true);
    expect(CHARACTERISTIC_KEYS).toContain("presence");
  });
});
