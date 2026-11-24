import { CATALOG, type CatalogEntry } from "../data/library";
import type { InventoryItem } from "../types";

/** Translate only untouched catalogue names; saved and player-edited names stay intact. */
export function inventoryItemName(
  item: Pick<InventoryItem, "name" | "catalogId">,
  locale: string,
  entries: readonly CatalogEntry[] = CATALOG,
): string {
  if (locale !== "en" || !item.catalogId) return item.name;
  const entry = entries.find((candidate) => candidate.kind !== "project" &&
    (candidate.id === item.catalogId || candidate.legacyId === item.catalogId));
  return entry && entry.name === item.name ? entry.originalName || item.name : item.name;
}
