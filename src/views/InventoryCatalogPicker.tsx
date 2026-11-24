import { useLocale } from "../i18n/locale";
import { useState } from "react";
import { CATALOG, matchesLibraryQuery, plainSummary } from "../data/library";
import { Button, EmptyState, Modal, Select } from "../components/ui";
import { SearchInput } from "../components/ui/SearchInput";
import { PaginatedResults } from "../components/ui/PaginatedResults";
import { ReferenceList } from "../components/rules/ReferenceList";
import { CatalogEntryCard } from "../components/rules/CatalogEntryCard";
import type { CatalogEntry } from "../data/library";
import { readerLabel } from "../components/rules/reader-labels";
import type { Locale } from "../i18n/locale";

const ITEMS = CATALOG.filter(entry => entry.kind === "treasure" || entry.kind === "title");

export function inventoryEntrySummary(entry: CatalogEntry, locale: Locale) {
  if (locale === "ru") return entry.summary;
  return entry.originalDescription ? plainSummary(entry.originalDescription.split(/\n\s*\n/)[0]) : "";
}

export function filterInventoryEntries(entries: readonly CatalogEntry[], query: string, category: string) {
  return entries.filter(entry => (!category || entry.category === category) &&
    matchesLibraryQuery(query, entry.name, entry.originalName ?? "", entry.summary, entry.keywords,
      entry.originalDescription ?? "", entry.category, readerLabel(entry.category, "en")));
}

export function InventoryCatalogPicker({ onClose, onAdd, onCreate }: {
  onClose: () => void;
  onAdd: (entry: CatalogEntry) => void;
  onCreate: () => void;
}) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const filtered = filterInventoryEntries(ITEMS, query, category);
  const selected = filtered.find(entry => entry.id === selectedId) ?? filtered[0];
  return <Modal open wide title={t("Добавить предмет", "Add item")} className="inv-catalog-modal" onClose={onClose} footer={<>
    <Button icon="plus" onClick={onCreate}>{t("Создать свой предмет", "Create custom item")}</Button>
    <span className="grow" />
    <Button variant="primary" icon="plus" disabled={!selected} onClick={() => selected && onAdd(selected)}>{t("Добавить в инвентарь", "Add to inventory")}</Button>
  </>}>
    <div className="inv-catalog-filters">
      <SearchInput aria-label={t("Поиск предметов", "Search items")} placeholder={t("Поиск по каталогу…", "Search the catalog…")} value={query} onValueChange={setQuery} />
      <Select aria-label={t("Категория каталога предметов", "Item catalog category")} value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">{t("Все категории", "All categories")}</option>
        {[...new Set(ITEMS.map(entry => entry.category))].map(category => <option key={category} value={category}>{readerLabel(category, locale)}</option>)}
      </Select>
    </div>
    {!selected ? <EmptyState icon="search" title={t("Предметы не найдены", "No items found")} text={t("Попробуйте другой запрос или создайте свой предмет.", "Try a different search or create a custom item.")} /> :
      <div className="inv-catalog-layout">
        <PaginatedResults key={`${query}:${category}`} items={filtered} label={t("Предметы", "Items")}>
          {entries => <ReferenceList entries={entries.map(entry => ({ ...entry, name: locale === "en" && entry.originalName ? entry.originalName : entry.name, summary: inventoryEntrySummary(entry, locale), catalog: entry }))} selectedId={selected.id} onSelect={entry => setSelectedId(entry.id)} />}
        </PaginatedResults>
        <div className="inv-catalog-preview"><CatalogEntryCard key={selected.id} entry={selected} /></div>
      </div>}
  </Modal>;
}
