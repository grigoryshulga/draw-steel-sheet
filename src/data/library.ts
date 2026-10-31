import {
  CANONICAL_CATALOG,
  CANONICAL_GLOSSARY,
} from "../rules/consumer-library";
import type {
  CatalogEntry,
  CatalogKind,
  GlossaryEntry,
} from "../rules/consumer-data";
import { searchText } from "../lib/codex";

export type { CatalogEntry, CatalogKind, GlossaryEntry } from "../rules/consumer-data";

export const CATALOG_LABELS: Record<CatalogKind, string> = {
  treasure: "Сокровища",
  title: "Титулы",
  project: "Проекты",
};

export function field(markdown: string, label: string) {
  return (
    markdown
      .match(new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*)$`, "mi"))?.[1]
      .trim() || ""
  );
}

export function plainSummary(markdown: string) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>`|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/**
 * Каталог и глоссарий реконструированы из канонических статей и их сущностей
 * генератором `scripts/content/build-consumer-data.mjs`. Прежние ID сохранены
 * явным сопоставлением, поэтому сохранённые герои не требуют миграции.
 */
export const CATALOG: CatalogEntry[] = CANONICAL_CATALOG;
export const GLOSSARY: GlossaryEntry[] = CANONICAL_GLOSSARY;

export function catalogEntryLink(entry: Pick<CatalogEntry, "kind" | "id">) {
  return `#/catalog/${entry.kind}/${encodeURIComponent(entry.id)}`;
}

export function sourceLink(entry: CatalogEntry) {
  return `#/codex/${entry.articleId}${entry.heading ? `/${encodeURIComponent(entry.heading)}` : ""}`;
}

export function glossaryLink(id = "") {
  return `#/glossary/${encodeURIComponent(id)}`;
}

export function matchesLibraryQuery(query: string, ...fields: string[]) {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean);
  const haystack = searchText(fields.join(" "));
  return words.every((word) => haystack.includes(word));
}
