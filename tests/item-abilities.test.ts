import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { itemAbilityEntries } from "../src/lib/item-abilities";
import { normalizeItemAbilityIds } from "../src/lib/item-ability-ids";
import { treasureEquipmentKind } from "../src/lib/catalog-presentation";
import { CATALOG } from "../src/data/library";
import type { InventoryItem } from "../src/types";

const ability = ABILITY_COMPENDIUM[0];
const item: InventoryItem = { id: "amulet", name: "Амулет", category: "trinket", qty: 3, equipped: true, notes: "", abilityIds: [ability.id, ability.id] };

describe("item ability grants", () => {
  it("grants one card per reference while equipped, without changing saved hero abilities", () => {
    const hero = { ...createCharacter(), inventory: [item] };
    const saved = JSON.stringify(hero);
    const entries = itemAbilityEntries(hero);
    expect(entries).toHaveLength(1);
    expect(entries[0].ability).toMatchObject({ id: `item:amulet:${ability.id}`, name: ability.name, source: "Предмет · Амулет", tiers: ability.tiers, effect: ability.effect });
    expect(itemAbilityEntries(hero)).toEqual(entries);
    expect(JSON.stringify(hero)).toBe(saved);
    expect(itemAbilityEntries({ ...hero, inventory: [{ ...item, equipped: false }] })).toEqual([]);
    expect(itemAbilityEntries({ ...hero, inventory: [{ ...item, qty: 0 }] })).toEqual([]);
    expect(itemAbilityEntries({ ...hero, inventory: [] })).toEqual([]);
  });
  it("keeps grants distinct for two items and ignores unknown future references without deleting them", () => {
    const hero = { ...createCharacter(), inventory: [{ ...item, abilityIds: [ability.id, "future-ability"] }, { ...item, id: "second" }] };
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(hero)));
    expect(restored.inventory[0].abilityIds).toEqual([ability.id, "future-ability"]);
    const entries = itemAbilityEntries(restored);
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map(entry => entry.ability.id)).size).toBe(2);
    const old = normalizeCharacter({ ...hero, inventory: [{ ...item, abilityIds: undefined }] });
    expect(old.inventory[0].abilityIds).toBeUndefined();
    expect(itemAbilityEntries(old)).toEqual([]);
  });
  it("bounds and normalizes persisted references", () => {
    expect(normalizeItemAbilityIds(null)).toEqual([]);
    expect(normalizeItemAbilityIds([null, 7, "", "x".repeat(201), ability.id, ability.id])).toEqual([ability.id]);
    expect(normalizeItemAbilityIds(Array.from({ length: 20 }, (_, i) => `future-${i}`))).toHaveLength(16);
  });
});


it("classifies every leveled treasure from its printed keywords", () => {
  const kinds = new Set(CATALOG.filter(entry => entry.category === "Сокровища с Уровнем").map(treasureEquipmentKind));
  expect(kinds).toEqual(new Set(["armor", "weapon", "implement", "other"]));
  expect(treasureEquipmentKind(CATALOG.find(entry => entry.kind === "title"))).toBeUndefined();
});
