import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/data/library";
import { readerLabel } from "../src/components/rules/reader-labels";
import { filterInventoryEntries, inventoryEntrySummary } from "../src/views/InventoryCatalogPicker";

const items = CATALOG.filter(entry => entry.kind === "treasure" || entry.kind === "title");

describe("inventory catalog filtering", () => {
  it("keeps category values stable while translating all category labels", () => {
    const categories = [...new Set(items.map(entry => entry.category))];
    expect(categories.map(category => readerLabel(category, "en"))).toEqual([
      "Artifacts", "Trinkets", "Consumables", "Leveled Treasures", "Titles",
    ]);
    for (const category of categories) {
      const expected = items.filter(entry => entry.category === category);
      expect(filterInventoryEntries(items, "", category)).toEqual(expected);
      expect(filterInventoryEntries(items, readerLabel(category, "en"), category)).toEqual(expected);
      expect(filterInventoryEntries(items, category, category)).toEqual(expected);
    }
  });

  it("finds Russian and English names in every category and keeps the canonical entry", () => {
    for (const category of new Set(items.map(entry => entry.category))) {
      const entry = items.find(item => item.category === category)!;
      expect(filterInventoryEntries(items, entry.name, category)).toContain(entry);
      expect(filterInventoryEntries(items, entry.originalName!, category)).toContain(entry);
      expect(inventoryEntrySummary(entry, "ru")).toBe(entry.summary);
      expect(inventoryEntrySummary(entry, "en")).toBeTruthy();
    }
    expect(filterInventoryEntries(items, "no such item 12345", "")).toEqual([]);
  });
});
