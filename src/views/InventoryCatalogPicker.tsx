import { useState } from "react";
import { CATALOG, matchesLibraryQuery } from "../data/library";
import { Button, EmptyState, Modal, Select } from "../components/ui";
import { SearchInput } from "../components/ui/SearchInput";
import { PaginatedResults } from "../components/ui/PaginatedResults";
import { ReferenceList } from "../components/rules/ReferenceList";
import { RuleText } from "../components/RuleText";
import type { CatalogEntry } from "../data/library";

const ITEMS = CATALOG.filter(entry => entry.kind === "treasure" || entry.kind === "title");

export function InventoryCatalogPicker({ onClose, onAdd, onCreate }: {
  onClose: () => void;
  onAdd: (entry: CatalogEntry) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const filtered = ITEMS.filter(entry => (!category || entry.category === category) &&
    matchesLibraryQuery(query, entry.name, entry.originalName ?? "", entry.summary, entry.keywords));
  const selected = filtered.find(entry => entry.id === selectedId) ?? filtered[0];
  return <Modal open wide title="Добавить предмет" className="inv-catalog-modal" onClose={onClose} footer={<>
    <Button icon="plus" onClick={onCreate}>Создать свой предмет</Button>
    <span className="grow" />
    <Button variant="primary" icon="plus" disabled={!selected} onClick={() => selected && onAdd(selected)}>Добавить в инвентарь</Button>
  </>}>
    <div className="inv-catalog-filters">
      <SearchInput aria-label="Поиск предметов" placeholder="Поиск по каталогу…" value={query} onValueChange={setQuery} />
      <Select aria-label="Категория каталога предметов" value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">Все категории</option>
        {[...new Set(ITEMS.map(entry => entry.category))].map(category => <option key={category}>{category}</option>)}
      </Select>
    </div>
    {!selected ? <EmptyState icon="search" title="Предметы не найдены" text="Попробуйте другой запрос или создайте свой предмет." /> :
      <div className="inv-catalog-layout">
        <PaginatedResults key={`${query}:${category}`} items={filtered} label="Предметы">
          {entries => <ReferenceList entries={entries.map(entry => ({ ...entry, catalog: entry }))} selectedId={selected.id} onSelect={entry => setSelectedId(entry.id)} />}
        </PaginatedResults>
        <article className="inv-catalog-preview"><h3>{selected.name}</h3><RuleText text={selected.markdown} articleId={selected.articleId} /></article>
      </div>}
  </Modal>;
}
