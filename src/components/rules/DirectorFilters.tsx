import type { CatalogBrowserEntry } from "../../data/reference-catalog";
import {
  emptyDirectorFilters,
  type DirectorFilters as Filters,
} from "../../lib/director-catalog";
import { Button, Select, TextInput } from "../ui";
import "./DirectorReference.css";

export function DirectorFilters({
  entries,
  value,
  onChange,
  compact = false,
}: {
  entries: readonly CatalogBrowserEntry[];
  compact?: boolean;
  value: Filters;
  onChange: (value: Filters) => void;
}) {
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
      <label className="director-query">
        Название или ключевое слово
        <span className="director-search-field">
        <TextInput
          type="search"
          value={value.query}
          placeholder="По-русски или по-английски…"
          onChange={(event) => set("query", event.target.value)}
        />
      {Object.values(value).some(Boolean) && (
        <Button variant="ghost" className="director-filter-reset" icon="close" iconOnly onClick={() => onChange(emptyDirectorFilters)}>
          Сбросить фильтры
        </Button>
      )}
        </span>
      </label>
      {compact ? (
        <section className="director-filter-disclosure">
          <h3>
            Фильтры{activeFilters ? ` · ${activeFilters} активно` : ""}
          </h3>
          <div className="director-filter-fields">{fields}</div>
        </section>
      ) : (
        fields
      )}

    </div>
  );
}
