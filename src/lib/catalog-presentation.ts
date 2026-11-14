import type { CatalogEntry } from "../rules/consumer-data";
import { echelon } from "./progression";

/** Отделяет вступление титула и условие, которое карточка показывает отдельно. */
export function catalogTitleText(entry: Pick<CatalogEntry, "kind" | "markdown" | "prerequisite">) {
  if (entry.kind !== "title") return { flavor: "", body: entry.markdown };
  const paragraphs = entry.markdown.trim().split(/\n\s*\n/);
  const flavor = /^\*(?!\*)[\s\S]+\*$/.test(paragraphs[0] ?? "")
    ? paragraphs.shift()!
    : "";
  const body = paragraphs.filter((paragraph) => !(
    entry.prerequisite &&
    paragraph.startsWith("**Предварительное условие:**") &&
    paragraph.slice("**Предварительное условие:**".length).trim() === entry.prerequisite.trim()
  )).join("\n\n");
  return { flavor, body };
}

export function catalogAccent(entry?: Pick<CatalogEntry, "kind" | "category" | "echelon">, level?: number): string | undefined {
  if (!entry || !["treasure", "title"].includes(entry.kind)) return undefined;
  if (entry.category === "Артефакты") return "artifact";
  if (entry.category === "Сокровища с Уровнем") return level ? String(echelon(level)) : "growing";
  return entry.echelon ? String(entry.echelon) : undefined;
}

export function treasureEquipmentKind(entry?: Pick<CatalogEntry, "kind" | "category" | "keywords">): "armor" | "weapon" | "implement" | "other" | undefined {
  if (entry?.kind !== "treasure" || entry.category !== "Сокровища с Уровнем") return undefined;
  if (/броня|щит/i.test(entry.keywords)) return "armor";
  if (/оружие/i.test(entry.keywords)) return "weapon";
  if (/катализатор/i.test(entry.keywords)) return "implement";
  return "other";
}

export function catalogLevelSections(markdown: string) {
  const matches = [...markdown.matchAll(/^\*\*(\d+)-й уровень:\*\*/gm)];
  return {
    introduction: matches.length ? markdown.slice(0, matches[0].index).trim() : markdown,
    levels: matches.map((match, index) => ({
      level: Number(match[1]),
      text: markdown.slice(match.index! + match[0].length, matches[index + 1]?.index ?? markdown.length).trim(),
    })),
  };
}
