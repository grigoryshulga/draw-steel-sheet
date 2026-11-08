import type { CatalogEntry } from "../rules/consumer-data";
import { searchText } from "./codex";

export function field(markdown: string, label: string) {
  return markdown.match(new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*)$`, "mi"))?.[1].trim() || "";
}

export function plainSummary(markdown: string) {
  return markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>`|]/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
}

export function catalogEntryLink(entry: Pick<CatalogEntry, "kind" | "id">) {
  return `#/catalog/${entry.kind}/${encodeURIComponent(entry.id)}`;
}

export function sourceLink(entry: CatalogEntry) {
  return `#/codex/${entry.articleId}${entry.heading ? `/${encodeURIComponent(entry.heading)}` : ""}`;
}

export function glossaryLink(id = "") {
  return `#/catalog/glossary/${encodeURIComponent(id)}`;
}

export function matchesLibraryQuery(query: string, ...fields: string[]) {
  return createLibraryMatcher(query)(...fields);
}

/** Normalize the query once for a whole result set, skip empty searches. */
export function createLibraryMatcher(query: string) {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean);
  return (...fields: string[]) => {
    if (words.length === 0) return true;
    const haystack = searchText(fields.join(" "));
    return words.every((word) => haystack.includes(word));
  };
}
