import {
  CANONICAL_CATALOG,
  CANONICAL_GLOSSARY,
} from "../rules/consumer-library";
import type {
  CatalogEntry,
  CatalogKind,
  GlossaryEntry,
} from "../rules/consumer-data";
export { field, plainSummary, catalogEntryLink, sourceLink, glossaryLink, matchesLibraryQuery } from "../lib/library-utils";

export type { CatalogEntry, CatalogKind, GlossaryEntry } from "../rules/consumer-data";

export const CATALOG_LABELS: Record<CatalogKind, string> = {
  treasure: "Сокровища",
  title: "Титулы",
  project: "Проекты",
};

/**
 * Каталог и глоссарий реконструированы из канонических статей и их сущностей
 * генератором `scripts/content/build-consumer-data.mjs`. Прежние ID сохранены
 * явным сопоставлением, поэтому сохранённые герои не требуют миграции.
 */
export const CATALOG: CatalogEntry[] = CANONICAL_CATALOG;
export const GLOSSARY: GlossaryEntry[] = CANONICAL_GLOSSARY;
