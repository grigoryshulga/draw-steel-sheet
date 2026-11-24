import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/data/library";
import { inventoryItemName } from "../src/lib/inventory-display";

describe("owned inventory names", () => {
  const entry = CATALOG.find((item) => item.kind === "treasure" && item.originalName)!;
  const item = { name: entry.name, catalogId: entry.id };

  it("uses the original name in English without changing the saved item", () => {
    expect(inventoryItemName(item, "en")).toBe(entry.originalName);
    expect(inventoryItemName(item, "ru")).toBe(entry.name);
    expect(item.name).toBe(entry.name);
  });

  it("keeps renamed, custom and unknown items verbatim", () => {
    expect(inventoryItemName({ ...item, name: "My relic" }, "en")).toBe("My relic");
    expect(inventoryItemName({ name: entry.name }, "en")).toBe(entry.name);
    expect(inventoryItemName({ ...item, catalogId: "unknown" }, "en")).toBe(entry.name);
  });

  it("recognizes legacy IDs and falls back when an original is missing", () => {
    const legacyEntry = { ...entry, legacyId: "legacy-id" };
    expect(inventoryItemName({ ...item, catalogId: "legacy-id" }, "en", [legacyEntry])).toBe(entry.originalName);
    expect(inventoryItemName(item, "en", [{ ...entry, originalName: undefined }])).toBe(entry.name);
  });
});
