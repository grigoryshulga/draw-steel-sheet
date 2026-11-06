import type { CatalogEntry } from "../rules/consumer-data";
import { echelon } from "./progression";

export function catalogAccent(entry?: Pick<CatalogEntry, "kind" | "category" | "echelon">, level?: number): string | undefined {
  if (!entry || !["treasure", "title"].includes(entry.kind)) return undefined;
  if (entry.category === "Артефакты") return "artifact";
  if (entry.category === "Сокровища с Уровнем") return level ? String(echelon(level)) : "growing";
  return entry.echelon ? String(entry.echelon) : undefined;
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
