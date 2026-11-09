import { useId, useState } from "react";
import type { CatalogBrowserEntry } from "../../data/reference-catalog";
import {
  emptyDirectorFilters,
  type DirectorFilters as Filters,
} from "../../lib/director-catalog";
import { Button, Select, TextInput } from "../ui";
import { SearchInput } from "../ui/SearchInput";
import "./DirectorReference.css";

export function DirectorFilters({
  entries,
  value,
  onChange,
  compact = false,
  searchShortcut = false,
}: {
  entries: readonly CatalogBrowserEntry[];
  compact?: boolean;
  searchShortcut?: boolean;
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fieldsId = useId();
  const set = (field: keyof Filters, next: string) =>
    onChange({ ...value, [field]: next });
  const choices = (field: "role" | "organization" | "size" | "keywords") =>
    [
      ...new Set(
        entries.flatMap((entry) => {
          const item = entry.director?.[field];
          return item === undefined
            ? []
            : Array.isArray(item)
              ? item
              : [String(item)];
        }),
      ),
    ].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
  const activeFilters = Object.entries(value).filter(
    ([key, val]) => key !== "query" && val,
  ).length;
  const fields = (
    <>
      {(
        [
          ["role", "Роль", "role"],
          ["organization", "Организация / тип", "organization"],
          ["keyword", "Ключевое слово", "keywords"],
          ["size", "Размер", "size"],
        ] as const
      ).map(([field, label, dataField]) => {
        const options = choices(dataField);
        return options.length > 1 ? (
          <label key={field}>
            {label}
            <Select
              value={value[field]}
              onChange={(event) => set(field, event.target.value)}
            >
              <option value="">Все</option>
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </label>
        ) : null;
      })}
      <fieldset>
        <legend>Уровень</legend>
        <div className="director-range">
          <TextInput
            type="number"
            min="0"
            max="11"
            placeholder="От"
            aria-label="Минимальный уровень"
            value={value.minLevel}
            onChange={(event) => set("minLevel", event.target.value)}
          />
          <TextInput
            type="number"
            min="0"
            max="11"
            placeholder="До"
            aria-label="Максимальный уровень"
            value={value.maxLevel}
            onChange={(event) => set("maxLevel", event.target.value)}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend>Боевая ценность (БЦ)</legend>
        <div className="director-range">
          <TextInput
            type="number"
            min="0"
            placeholder="От"
            aria-label="Минимальная боевая ценность"
            value={value.minEv}
            onChange={(event) => set("minEv", event.target.value)}
          />
          <TextInput
            type="number"
            min="0"
            placeholder="До"
            aria-label="Максимальная боевая ценность"
            value={value.maxEv}
            onChange={(event) => set("maxEv", event.target.value)}
          />
        </div>
        {entries.some((entry) => entry.director?.section === "terrain") && (
          <span>Для местности — стоимость указанного в описании участка.</span>
        )}
      </fieldset>
    </>
  );
  return (
    <div className="director-filters">
      <div className="director-query">
        <span>Название или ключевое слово</span>
        <SearchInput
          aria-label="Название или ключевое слово"
          value={value.query}
          placeholder="По-русски или по-английски…"
          onValueChange={(query) => set("query", query)}
          shortcut={searchShortcut}
          canClear={Object.values(value).some(Boolean)}
          clearLabel="Сбросить фильтры"
          onClear={() => onChange(emptyDirectorFilters)}
        />
      </div>
      {compact ? (
        <section className="director-filter-disclosure">
          <Button icon="filter" aria-expanded={filtersOpen} aria-controls={fieldsId} onClick={() => setFiltersOpen((current) => !current)}>
            Фильтры{activeFilters ? ` · ${activeFilters} активно` : ""}
          </Button>
          <div id={fieldsId} className="director-filter-fields" hidden={!filtersOpen}>{fields}</div>
        </section>
      ) : (
        fields
      )}

    </div>
  );
}
