import { describe, expect, it } from "vitest";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { recalculateCharacter } from "../src/lib/character-calculations";
import { featureFieldBonus, featureStatContributions } from "../src/lib/feature-modifiers";
import { normalizeItemEffects } from "../src/lib/item-effects";
import type { InventoryItem } from "../src/types";

const item: InventoryItem = { id: "a", name: "Щит", category: "gear", qty: 3, notes: "", equipped: true, effects: [{ field: "stamina", value: 5 }, { field: "speed", value: 2 }] };
function hero() {
  const base = createCharacter({ className: "Талант", level: 1 });
  base.automation = { enabled: true, adjustments: {}, ancestryTraits: [] };
  return recalculateCharacter(base, base);
}

describe("equipped item effects", () => {
  it("applies once per identity, attributes the source, and restores bases when unequipped", () => {
    const base = hero();
    const equipped = recalculateCharacter(base, { ...base, inventory: [item, { ...item, id: "b", qty: 1 }] });
    expect(equipped.stamina.max).toBe(base.stamina.max + 5);
    expect(Number(equipped.speed)).toBe(Number(base.speed) + 2);
    expect(featureStatContributions(equipped, "stamina")).toContainEqual({ sourceId: "item:a", sourceName: "Щит", value: 5 });
    const removed = recalculateCharacter(equipped, { ...equipped, inventory: equipped.inventory.map((entry) => ({ ...entry, equipped: false })) });
    expect(removed.stamina.max).toBe(base.stamina.max);
    expect(removed.speed).toBe(base.speed);
    expect(featureFieldBonus(removed, "stamina")).toBe(0);
  });
  it("stacks different items and ignores zero quantity or disabled automation", () => {
    const base = hero();
    const inventory = [item, { ...item, id: "b", name: "Шлем" }, { ...item, id: "c", name: "Пусто", qty: 0 }];
    expect(featureFieldBonus({ ...base, inventory }, "stamina")).toBe(10);
    expect(featureFieldBonus({ ...base, inventory, automation: { ...base.automation!, enabled: false } }, "stamina")).toBe(0);
  });
  it("rejects invalid data and preserves old inventory and catalog IDs", () => {
    const unsafe = [{ field: "speed", value: 2 }, { field: "speed", value: 101 }, { field: "stamina", value: 1.5 }, { field: "constructor", value: 1 }, { field: "save", value: "2" }];
    expect(normalizeItemEffects(unsafe)).toEqual([{ field: "speed", value: 2 }]);
    expect(normalizeItemEffects(Array(20).fill({ field: "speed", value: 1 }))).toHaveLength(16);
    const old = { ...item, effects: undefined, catalogId: "unknown-catalog-id" };
    const normalized = normalizeCharacter({ ...hero(), inventory: [old, { ...item, effects: unsafe as never }] });
    expect(normalized.inventory[0].catalogId).toBe(old.catalogId);
    expect(normalized.inventory[0].effects).toBeUndefined();
    expect(normalized.inventory[1].effects).toEqual([{ field: "speed", value: 2 }]);
  });
});
