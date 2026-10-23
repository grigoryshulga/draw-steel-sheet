import type { CatalogEntry } from "../data/library";
import type { Character } from "../types";

export function ownsCatalogEntry(character: Character, entry: CatalogEntry) {
  return entry.kind === "project"
    ? character.projects.some((row) => row.catalogId === entry.id)
    : character.inventory.some((row) => row.catalogId === entry.id);
}
/** Keep catalog identity separate from editable names and preserve legacy rows. */
export function addCatalogEntry(
  character: Character,
  entry: CatalogEntry,
  id: string,
  options: { characteristic?: string; goal?: string } = {},
): Character {
  if (entry.kind === "project") {
    return {
      ...character,
      projects: [
        ...character.projects,
        {
          id,
          catalogId: entry.id,
          name: entry.name,
          assigned: character.name,
          characteristic: options.characteristic || "",
          goal:
            options.goal ??
            (/^\d+$/.test(entry.projectGoal) ? entry.projectGoal : ""),
          points: "0",
        },
      ],
    };
  }
  const existing = character.inventory.find(
    (row) => row.catalogId === entry.id,
  );
  if (existing)
    return entry.kind === "title"
      ? character
      : {
          ...character,
          inventory: character.inventory.map((row) =>
            row.id === existing.id ? { ...row, qty: row.qty + 1 } : row,
          ),
        };
  return {
    ...character,
    inventory: [
      ...character.inventory,
      {
        id,
        catalogId: entry.id,
        name: entry.name,
        category:
          entry.kind === "title"
            ? "title"
            : entry.category === "Расходуемые"
              ? "consumable"
              : entry.category === "Безделушки"
                ? "trinket"
                : "treasure",
        qty: 1,
        equipped: false,
        notes: "",
      },
    ],
  };
}
