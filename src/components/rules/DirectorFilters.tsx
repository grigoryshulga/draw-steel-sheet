import { useId, useState } from "react";
import type { CatalogBrowserEntry } from "../../data/reference-catalog";
import {
  emptyDirectorFilters,
  type DirectorFilters as Filters,
} from "../../lib/director-catalog";
import { Button, Select, TextInput } from "../ui";
import { SearchInput } from "../ui/SearchInput";
import "./DirectorReference.css";
import { loadEnglishReference } from "../../rules/consumer-english-reference";
import { useLocalizedData } from "../../i18n/use-localized-data";
import { useLocale } from "../../i18n/locale";

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
  const { t, locale } = useLocale();
  const reference = useLocalizedData(locale, loadEnglishReference);
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
          ["role", t("Роль", "Role"), "role"],
          ["organization", t("Организация / тип", "Organization / type"), "organization"],
          ["keyword", t("Ключевое слово", "Keyword"), "keywords"],
          ["size", t("Размер", "Size"), "size"],
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
              <option value="">{t("Все", "All")}</option>
              {options.map((option) => (
                <option key={option} value={option}>{reference?.labels[option] ?? option}</option>
              ))}
            </Select>
          </label>
        ) : null;
      })}
      <fieldset>
        <legend>{t("Уровень", "Level")}</legend>
        <div className="director-range">
          <TextInput
            type="number"
            min="0"
            max="11"
            placeholder={t("От", "Min")}
            aria-label={t("Минимальный уровень", "Minimum level")}
            value={value.minLevel}
            onChange={(event) => set("minLevel", event.target.value)}
          />
          <TextInput
            type="number"
            min="0"
            max="11"
            placeholder={t("До", "Max")}
            aria-label={t("Максимальный уровень", "Maximum level")}
            value={value.maxLevel}
            onChange={(event) => set("maxLevel", event.target.value)}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("Боевая ценность (БЦ)", "Encounter Value (EV)")}</legend>
        <div className="director-range">
          <TextInput
            type="number"
            min="0"
            placeholder={t("От", "Min")}
            aria-label={t("Минимальная боевая ценность", "Minimum encounter value")}
            value={value.minEv}
            onChange={(event) => set("minEv", event.target.value)}
          />
          <TextInput
            type="number"
            min="0"
            placeholder={t("До", "Max")}
            aria-label={t("Максимальная боевая ценность", "Maximum encounter value")}
            value={value.maxEv}
            onChange={(event) => set("maxEv", event.target.value)}
          />
        </div>
        {entries.some((entry) => entry.director?.section === "terrain") && (
          <span>{t("Для местности — стоимость указанного в описании участка.", "For terrain, the value applies to the area described.")}</span>
        )}
      </fieldset>
    </>
  );
  return (
    <div className="director-filters">
      <div className="director-query">
        <span>{t("Название или ключевое слово", "Name or keyword")}</span>
        <SearchInput
          aria-label={t("Название или ключевое слово", "Name or keyword")}
          value={value.query}
          placeholder={t("По-русски или по-английски…", "In English or Russian…")}
          onValueChange={(query) => set("query", query)}
          shortcut={searchShortcut}
          canClear={Object.values(value).some(Boolean)}
          clearLabel={t("Сбросить фильтры", "Clear filters")}
          onClear={() => onChange(emptyDirectorFilters)}
        />
      </div>
      {compact ? (
        <section className="director-filter-disclosure">
          <Button icon="filter" aria-expanded={filtersOpen} aria-controls={fieldsId} onClick={() => setFiltersOpen((current) => !current)}>
            {t("Фильтры", "Filters")}{activeFilters ? ` · ${activeFilters}` : ""}
          </Button>
          <div id={fieldsId} className="director-filter-fields" hidden={!filtersOpen}>{fields}</div>
        </section>
      ) : (
        fields
      )}

    </div>
  );
}
