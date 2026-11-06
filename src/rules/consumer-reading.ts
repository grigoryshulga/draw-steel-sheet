import projection from "../generated/consumers/reading.json";
import type { CatalogEntry } from "./consumer-data";

/** Navigation and tooltip text only; never import complete library prose here. */
export const READING_CATALOG = projection.catalog as Pick<CatalogEntry,
  "id" | "kind" | "name" | "articleId" | "heading">[];
export const READING_GLOSSARY = projection.glossary;
export const GLOSSARY_TOOLTIP_BY_ID = new Map(READING_GLOSSARY.map((term) => [term.id, term]));
export const CATALOG_LINK_BY_HEADING = new Map<string, typeof READING_CATALOG[number]>();
for (const entry of READING_CATALOG) {
  const key = `${entry.articleId}:${entry.heading}`;
  // Match the historical Array.find behavior if headings repeat.
  if (!CATALOG_LINK_BY_HEADING.has(key)) CATALOG_LINK_BY_HEADING.set(key, entry);
}
