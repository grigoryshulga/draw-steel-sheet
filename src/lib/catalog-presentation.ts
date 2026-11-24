import type { CatalogEntry } from "../rules/consumer-data";
import { echelon } from "./progression";

export function catalogEditionText(entry: CatalogEntry, language: "ru" | "en") {
  const english = language === "en" && Boolean(entry.originalDescription?.trim());
  const source = english ? entry.originalDescription! : entry.markdown;
  // Only lift complete metadata paragraphs; leave all other prose in order.
  const paragraphs = source.trim().split(/\n\s*\n/);
  const flavor = ["title", "treasure"].includes(entry.kind) && /^\*(?!\*)[\s\S]+\*$/.test(paragraphs[0] ?? "")
    ? paragraphs.shift()! : "";
  const prerequisitePrefix = english ? "**Prerequisite:**" : "**Предварительное условие:**";
  const prerequisiteIndex = entry.kind === "title" ? paragraphs.findIndex(p => p.startsWith(prerequisitePrefix)) : -1;
  const prerequisite = prerequisiteIndex >= 0
    ? paragraphs.splice(prerequisiteIndex, 1)[0].slice(prerequisitePrefix.length).trim()
    : english ? "" : entry.prerequisite;
  const body = paragraphs.join("\n\n");
  return { flavor, prerequisite, body };
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

export function catalogLevelSections(markdown: string, language: "ru" | "en" = "ru") {
  const heading = language === "en" ? /\*\*(\d+)(?:st|nd|rd|th) Level:\*\*/gi : /\*\*(\d+)-й уровень:\*\*/g;
  const matches = [...markdown.matchAll(heading)];
  return {
    introduction: matches.length ? markdown.slice(0, matches[0].index).trim() : markdown,
    levels: matches.map((match, index) => ({
      level: Number(match[1]),
      text: markdown.slice(match.index! + match[0].length, matches[index + 1]?.index ?? markdown.length).trim(),
    })),
  };
}
