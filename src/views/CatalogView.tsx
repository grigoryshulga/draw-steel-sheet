import { catalogAccent, catalogLevelSections, catalogTitleText } from "../lib/catalog-presentation";
import { echelon as levelEchelon } from "../lib/progression";
import { CatalogRank } from "../components/rules/CatalogRank";
import { Fragment, useContext, useEffect, useMemo, useState } from "react";
import {
  catalogSectionCount,
  catalogSectionEntries,
  catalogSectionHref,
  catalogBrowserEntryHref,
  resolveCatalogRoute,
  CATALOG_SECTIONS,
  type CatalogBrowserEntry,
  type CatalogSectionId,
} from "../data/reference-catalog";
import {
  matchesLibraryQuery,
  sourceLink,
  type CatalogEntry,
} from "../data/library";
import { type ArtKind } from "../lib/art";
import { AppContext } from "../state/AppContext";
import { ownsCatalogEntry } from "../lib/catalog-character";
import { useLibraryLocation } from "../lib/library-location";
import { CatalogAction } from "../components/CatalogAction";
import { RuleText } from "../components/RuleText";
import { Chip, Select, TextInput, Button } from "../components/ui";
import { ReferenceList } from "../components/rules/ReferenceList";
import { RuleArticleReader } from "../components/rules/RuleArticleReader";
import { RuleMarkdown } from "../components/rules/RuleMarkdown";
import { ClassLandingView } from "./ClassLandingView";
import { DirectorFilters } from "../components/rules/DirectorFilters";
import { emptyDirectorFilters, matchesDirectorFilters } from "../lib/director-catalog";
import "./CodexView.css";
import "./LibraryView.css";
import "./ReferenceView.css";

/** Портреты для разделов, которые читаются как карточки-сущности. */
const ART_KIND_BY_SECTION: Partial<Record<CatalogSectionId, ArtKind>> = {
  classes: "class",
  ancestries: "ancestry",
  careers: "career",
  kits: "kit",
};

/**
 * Единый каталог Справочника: одна полоса вкладок и один браузер карточек для
 * наград, происхождений, карьеры, комплектов, перков и глоссария. Карточки
 * ведут на адрес #/catalog/<раздел>/<запись>, полный текст открывается справа.
 */
export function CatalogView() {
  const segments = useLibraryLocation();
  const { section, id } = resolveCatalogRoute(segments);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [echelon, setEchelon] = useState("");
  const [directorFilters, setDirectorFilters] = useState(emptyDirectorFilters);
  const app = useContext(AppContext);

  const entries = catalogSectionEntries(section);
  const categories = [...new Set(entries.map((entry) => entry.eyebrow))];
  const hasEchelon = entries.some((entry) => entry.echelon);
  const results = entries.filter(
    (entry) =>
      (!category || entry.eyebrow === category) &&
      (!echelon || String(entry.echelon) === echelon) &&
      matchesDirectorFilters(entry, directorFilters) &&
      matchesLibraryQuery(query, entry.search),
  );
  const selected = entries.find((entry) => entry.id === id) ?? (!id ? results[0] : undefined);

  useEffect(() => {
    setQuery("");
    setCategory("");
    setEchelon("");
    setDirectorFilters(emptyDirectorFilters);
  }, [section]);
  useEffect(() => {
    if (!id) return;
    document
      .getElementById("catalog-detail")
      ?.scrollIntoView({ block: "start" });
  }, [id]);
  const glossaryFragment = (segments[2] ?? "").split("#")[1] ?? "";
  useEffect(() => {
    if (section !== "glossary" || !glossaryFragment) return;
    document
      .getElementById(decodeURIComponent(glossaryFragment))
      ?.scrollIntoView({ block: "center" });
  }, [section, glossaryFragment]);
  const categoryLabel = section === "perks" ? "Все типы" : "Все категории";
  const artKind = ART_KIND_BY_SECTION[section];
  const glossaryGroups = useMemo(() => {
    if (section !== "glossary") return [];
    const groups = new Map<string, CatalogBrowserEntry[]>();
    for (const entry of results) {
      const bucket = groups.get(entry.eyebrow);
      if (bucket) bucket.push(entry);
      else groups.set(entry.eyebrow, [entry]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [section, results]);
  const globalQuery = query.trim();
  const globalGroups = useMemo(() => {
    if (!globalQuery) return [];
    return CATALOG_SECTIONS.map((catalogSection) => ({
      section: catalogSection,
      entries: catalogSectionEntries(catalogSection.id).filter((entry) =>
        matchesLibraryQuery(globalQuery, entry.search),
      ),
    })).filter((group) => group.entries.length > 0);
  }, [globalQuery]);
  const globalCount = globalGroups.reduce(
    (total, group) => total + group.entries.length,
    0,
  );

  const globalHref = (
    catalogSection: CatalogSectionId,
    entry: CatalogBrowserEntry,
  ) =>
    catalogSection === "glossary"
      ? `#/catalog/glossary#term-${encodeURIComponent(entry.id)}`
      : catalogBrowserEntryHref(catalogSection, entry.id);

  return (
    <div className="library-view">
      <div className="catalog-global-search">
        <TextInput
          type="search"
          aria-label="Поиск по всему справочнику"
          placeholder="Поиск по всему справочнику…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <nav className="catalog-tabs" aria-label="Раздел справочника">
        {CATALOG_SECTIONS.map((item) => (
          <a
            key={item.id}
            href={catalogSectionHref(item.id)}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => setQuery("")}
          >
            {item.title} <span>{catalogSectionCount(item.id)}</span>
          </a>
        ))}
      </nav>
      {globalQuery ? (
        <div className="catalog-global-results">
          <div className="catalog-global-heading">
            <h2>Результаты поиска</h2>
            <p className="muted small">Найдено: {globalCount}</p>
          </div>
          {globalCount === 0 && (
            <div className="library-empty">
              <h3>Ничего не найдено</h3>
              <p>Попробуйте другой термин или более короткий запрос.</p>
              <Button onClick={() => setQuery("")}>Сбросить</Button>
            </div>
          )}
          {globalGroups.map((group) => (
            <section className="catalog-global-group" key={group.section.id}>
              <h3>
                {group.section.title}
                <span>{group.entries.length}</span>
              </h3>
              <div className="catalog-global-rows">
                {group.entries.map((entry) => (
                  <a
                    key={`${group.section.id}-${entry.id}`}
                    className="catalog-global-row"
                    href={globalHref(group.section.id, entry)}
                    onClick={() => setQuery("")}
                  >
                    <span className="catalog-global-name">{entry.name}</span>
                    {entry.eyebrow && (
                      <span className="catalog-global-eyebrow">
                        {entry.eyebrow}
                      </span>
                    )}
                    {entry.summary && (
                      <span className="catalog-global-excerpt">
                        {entry.summary}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className={`catalog-layout${
            section !== "glossary" && selected ? " has-detail" : ""
          }`}
        >
          <section className="catalog-browser" aria-label="Каталог">
            {['monsters', 'retainers', 'terrain'].includes(section) && <>
              <DirectorFilters entries={entries} value={directorFilters} onChange={setDirectorFilters} />
              <p className="muted small" role="status">Найдено: {results.length} из {entries.length}</p>
            </>}
            {(section === "glossary" ||
              categories.length > 1 ||
              hasEchelon) && (
              <div className="catalog-filters">
                {section === "glossary" ? (
                  <nav
                    className="glossary-alphabet catalog-glossary-alphabet"
                    aria-label="Алфавит"
                  >
                    <button
                      type="button"
                      aria-pressed={!category}
                      onClick={() => setCategory("")}
                    >
                      Все
                    </button>
                    {categories.map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        aria-pressed={category === letter}
                        onClick={() => setCategory(letter)}
                      >
                        {letter}
                      </button>
                    ))}
                  </nav>
                ) : categories.length > 1 ? (
                  <Select
                    aria-label={categoryLabel}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">{categoryLabel}</option>
                    {categories.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </Select>
                ) : null}
                {hasEchelon && (
                  <div className="catalog-rank-filter" role="group" aria-label="Эшелон">
                    <button type="button" aria-pressed={!echelon} onClick={() => setEchelon("")}>Все</button>
                    {[1, 2, 3, 4].map((n) => <button key={n} type="button" data-rank={n} aria-label={`Эшелон ${n}`} aria-pressed={echelon === String(n)} onClick={() => setEchelon(String(n))}>{["", "I", "II", "III", "IV"][n]}</button>)}
                  </div>
                )}
              </div>
            )}
            {results.length === 0 && (
              <div className="library-empty">
                <h3>Ничего не найдено</h3>
                <p>Измените запрос или сбросьте фильтры.</p>
                <Button
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setEchelon("");
                    setDirectorFilters(emptyDirectorFilters);
                  }}
                >
                  Сбросить
                </Button>
              </div>
            )}
            {section === "glossary" ? (
              <div className="catalog-glossary">
                {glossaryGroups.map(([letter, items]) => (
                  <Fragment key={letter}>
                    <h3 className="catalog-glossary-letter">{letter}</h3>
                    {items.map((entry) => (
                      <article
                        className="catalog-glossary-entry"
                        key={entry.id}
                        id={`term-${entry.id}`}
                      >
                        <h4 className="catalog-glossary-term">
                          <span>{entry.name}</span>
                          {entry.glossary?.english && (
                            <em>{entry.glossary.english}</em>
                          )}
                        </h4>
                        {entry.glossary && (
                          <RuleMarkdown
                            text={entry.glossary.markdown}
                            className="rule-text catalog-glossary-def"
                          />
                        )}
                      </article>
                    ))}
                  </Fragment>
                ))}
              </div>
            ) : (
              <ReferenceList
                entries={results}
                selectedId={selected?.id}
                artKind={artKind}
                hrefFor={(entry) => catalogBrowserEntryHref(section, entry.id)}
                metaFor={(entry) =>
                  app &&
                  entry.catalog &&
                  ownsCatalogEntry(app.character, entry.catalog) ? (
                    <Chip tone="accent">Уже у героя</Chip>
                  ) : null
                }
              />
            )}
          </section>
          {section !== "glossary" &&
            (selected ? (
              <CatalogDetail entry={selected} characterId={app?.character.id} />
            ) : id ? (
              <p className="library-empty">
                Запись не найдена. Выберите другую в каталоге.
              </p>
            ) : null)}
        </div>
      )}
    </div>
  );
}

function CatalogDetail({
  entry,
  characterId,
}: {
  entry: CatalogBrowserEntry;
  characterId?: string;
}) {
  if (entry.catalog)
    return (
      <CatalogEntryDetail key={entry.catalog.id} entry={entry.catalog} characterId={characterId} />
    );
  if (entry.classSlug)
    return (
      <article
        id="catalog-detail"
        className="catalog-detail catalog-detail-class"
      >
        <ClassLandingView slug={entry.classSlug} embedded />
      </article>
    );
  return (
    <article id="catalog-detail" className={`catalog-detail${entry.perk ? " catalog-detail-perk sheet-perk-card" : ""}`} data-type={entry.perk?.type}>
      {entry.perk && <span className="eyebrow">{entry.eyebrow}</span>}
      {entry.perk ? (
        <>
          {entry.articleId ? (
            <RuleArticleReader key={entry.perk.id} articleId={entry.articleId} entityName={entry.perk.name} />
          ) : <RuleText text={entry.perk.summary} />}
          {entry.articleId && (
            <a className="catalog-source" href={`#/codex/${entry.articleId}`}>
              Открыть в Кодексе →
            </a>
          )}
        </>
      ) : entry.articleId ? (
        <>
          <RuleArticleReader
            key={entry.articleId}
            articleId={entry.articleId}
          />
          <a className="catalog-source" href={`#/codex/${entry.articleId}`}>
            Открыть в Кодексе →
          </a>
        </>
      ) : null}
    </article>
  );
}

function CatalogEntryDetail({
  entry,
  characterId,
}: {
  entry: CatalogEntry;
  characterId?: string;
}) {
  const keywords = entry.keywords.split(/[;,]/).map((word) => word.trim()).filter(Boolean);
  const { flavor, body } = catalogTitleText(entry);
  const markdown = keywords.length ? body.replace(/^\*\*Ключевые слова:\*\*[^\n]*(?:\n|$)/gm, "") : body;
  const progression = catalogLevelSections(markdown);
  const levels = entry.category === "Сокровища с Уровнем" ? progression.levels : [];
  const [level, setLevel] = useState(levels[0]?.level ?? 1);
  const rank = catalogAccent(entry, levels.length ? level : undefined);
  return (
    <article id="catalog-detail" className="catalog-detail" data-rank={rank} data-catalog-kind={entry.kind}>
      <div className="catalog-detail-meta"><span className="eyebrow">
        {entry.category}
        {!rank && entry.echelon ? ` · Эшелон ${entry.echelon}` : ""}
      </span><CatalogRank rank={rank} /></div>
      <h1>{entry.name}</h1>
      {flavor && <div className="catalog-flavor"><RuleText text={flavor} /></div>}
      {keywords.length > 0 && <div className="catalog-keywords" aria-label="Ключевые слова">
        {keywords.map((keyword) => <Chip key={keyword}>{keyword}</Chip>)}
      </div>}
      {entry.prerequisite && (
        <div className="catalog-prerequisite">
          <span className="eyebrow">Условие получения</span>
          <p>{entry.prerequisite}</p>
        </div>
      )}
      {levels.length ? <>
        <RuleText text={progression.introduction} />
        <div className="catalog-level-tabs" role="group" aria-label="Уровень предмета">
          {levels.map((stage) => <button key={stage.level} type="button" data-rank={levelEchelon(stage.level)} aria-pressed={level === stage.level} onClick={() => setLevel(stage.level)}>{stage.level}-й уровень</button>)}
        </div>
        {levels.filter((stage) => stage.level <= level).map((stage) => <section className="catalog-level-section" data-rank={levelEchelon(stage.level)} key={stage.level}>
          <h2>{stage.level}-й уровень</h2><RuleText text={stage.text} />
        </section>)}
      </> : <RuleText text={markdown} />}
      <footer className="catalog-detail-footer">
      <a className="catalog-source" href={sourceLink(entry)}>
        Открыть в Кодексе →
      </a>
      <CatalogAction key={`${characterId}-${entry.id}`} entry={entry} />
      </footer>
    </article>
  );
}
