import type { CatalogBrowserEntry } from "../../data/reference-catalog";
import type { Locale } from "../../i18n/locale";
import type { EnglishReference } from "../../rules/consumer-english-reference";
import { readerLabel } from "./reader-labels";

export function localizedCatalogEntries(entries: readonly CatalogBrowserEntry[], locale: Locale, english?: EnglishReference): readonly CatalogBrowserEntry[] {
  if (locale === "ru") return entries;
  const label = (text: string) => english?.labels[text] ?? readerLabel(text, locale);
  return entries.map(entry => {
    const name = entry.glossary?.english || entry.originalName || entry.name;
    const eyebrow = entry.glossary ? name[0].toUpperCase() : label(entry.eyebrow);
    const summary = english?.summaries[entry.originalId || entry.articleId || ""] ?? "";
    const director = entry.director && {
      ...entry.director,
      organization: entry.director.organization && label(entry.director.organization),
      role: entry.director.role && label(entry.director.role),
      size: entry.director.size && label(String(entry.director.size)),
      keywords: entry.director.keywords?.map(label),
    };
    return { ...entry, name, eyebrow, summary, director, search: [entry.search, name, eyebrow, summary, director?.role, director?.organization, ...(director?.keywords ?? [])].join(" ") };
  }).sort((a, b) => a.name.localeCompare(b.name, "en"));
}
