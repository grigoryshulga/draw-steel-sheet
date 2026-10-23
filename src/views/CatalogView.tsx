import { useContext, useEffect, useMemo, useState } from "react";
import {
  CATALOG,
  CATALOG_LABELS,
  catalogEntryLink,
  sourceLink,
  matchesLibraryQuery,
  type CatalogKind,
} from "../data/library";
import { AppContext } from "../state/AppContext";
import { ownsCatalogEntry } from "../lib/catalog-character";
import { useLibraryLocation } from "../lib/library-location";
import { LibraryNav } from "../components/LibraryNav";
import { CatalogAction } from "../components/CatalogAction";
import { RuleText } from "../components/RuleText";
import { Chip, Select, TextInput, Button } from "../components/ui";
import "./CodexView.css";
import "./LibraryView.css";

export function CatalogView() {
  const [, , rawKind, id] = useLibraryLocation();
  const kind: CatalogKind =
    rawKind === "title" || rawKind === "project" ? rawKind : "treasure";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [echelon, setEchelon] = useState("");
  const app = useContext(AppContext);
  const entries = useMemo(
    () => CATALOG.filter((entry) => entry.kind === kind),
    [kind],
  );
  const selected = entries.find((entry) => entry.id === id);
  const categories = [...new Set(entries.map((entry) => entry.category))];
  const results = entries.filter(
    (entry) =>
      (!category || entry.category === category) &&
      (!echelon || String(entry.echelon) === echelon) &&
      matchesLibraryQuery(query, entry.name, entry.keywords, entry.markdown),
  );
  useEffect(() => {
    setQuery("");
    setCategory("");
    setEchelon("");
  }, [kind]);
  useEffect(() => {
    if (selected)
      document
        .getElementById("catalog-detail")
        ?.scrollIntoView({ block: "start" });
  }, [selected]);
  return (
    <div className="library-view">
      <header className="page-head">
        <div>
          <h1 className="page-title">Каталоги</h1>
          <p className="muted">Находите награды и занятия для своего героя.</p>
        </div>
      </header>
      <LibraryNav current="catalog" />
      <nav className="catalog-tabs" aria-label="Вид каталога">
        {(Object.keys(CATALOG_LABELS) as CatalogKind[]).map((key) => (
          <a
            key={key}
            href={`#/catalog/${key}`}
            aria-current={kind === key ? "page" : undefined}
          >
            {CATALOG_LABELS[key]}{" "}
            <span>{CATALOG.filter((e) => e.kind === key).length}</span>
          </a>
        ))}
      </nav>
      <div className={`catalog-layout${selected ? " has-detail" : ""}`}>
        <section className="catalog-browser" aria-label={CATALOG_LABELS[kind]}>
          <div className="catalog-filters">
            <TextInput
              type="search"
              aria-label="Поиск в каталоге"
              placeholder="Название, свойство или эффект…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {categories.length > 1 && (
              <Select
                aria-label="Категория"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Все категории</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
            {kind !== "project" && (
              <Select
                aria-label="Эшелон"
                value={echelon}
                onChange={(e) => setEchelon(e.target.value)}
              >
                <option value="">Все эшелоны</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}-й эшелон
                  </option>
                ))}
              </Select>
            )}
          </div>
          <p className="muted small catalog-count">Найдено: {results.length}</p>
          {results.length === 0 && (
            <div className="library-empty">
              <h3>Ничего не найдено</h3>
              <p>Измените запрос или сбросьте фильтры.</p>
              <Button
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setEchelon("");
                }}
              >
                Сбросить
              </Button>
            </div>
          )}
          <div className="catalog-cards">
            {results.map((entry) => (
              <a
                key={entry.id}
                className="catalog-card"
                href={catalogEntryLink(entry)}
                aria-current={entry.id === selected?.id ? "page" : undefined}
              >
                <span className="eyebrow">
                  {entry.category}
                  {entry.echelon ? ` · Эшелон ${entry.echelon}` : ""}
                </span>
                <h2>{entry.name}</h2>
                <p>{entry.summary}</p>
                {app && ownsCatalogEntry(app.character, entry) && (
                  <Chip tone="accent">Уже у героя</Chip>
                )}
              </a>
            ))}
          </div>
        </section>
        {selected ? (
          <article id="catalog-detail" className="catalog-detail">
            <a className="catalog-back" href={`#/catalog/${kind}`}>
              ← Весь каталог
            </a>
            <span className="eyebrow">
              {selected.category}
              {selected.echelon ? ` · Эшелон ${selected.echelon}` : ""}
            </span>
            <h1>{selected.name}</h1>
            {selected.prerequisite && (
              <div className="catalog-prerequisite">
                <span className="eyebrow">Условие получения</span>
                <p>{selected.prerequisite}</p>
              </div>
            )}
            <CatalogAction
              key={`${app?.character.id}-${selected.id}`}
              entry={selected}
            />
            <RuleText text={selected.markdown} />
            <a className="catalog-source" href={sourceLink(selected)}>
              Открыть в Кодексе →
            </a>
          </article>
        ) : id ? (
          <p className="library-empty">
            Запись не найдена. Выберите другую в каталоге.
          </p>
        ) : null}
      </div>
    </div>
  );
}
