import { isDirectorSection } from "../navigation";
import { useMediaQuery } from "../lib/hooks";
import {
  catalogAccent,
  catalogLevelSections,
  catalogTitleText,
} from "../lib/catalog-presentation";
import { echelon as levelEchelon } from "../lib/progression";
import { CatalogRank } from "../components/rules/CatalogRank";
import { Icon } from "../components/Icons";
import {
  Fragment,
  lazy,
  Suspense,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  sourceLink,
  type CatalogEntry,
} from "../data/library";
import { type ArtKind } from "../lib/art";
import { AppContext } from "../state/AppContext";
import { ownsCatalogEntry } from "../lib/catalog-character";
import { useLibraryLocation } from "../lib/library-location";
import { RuleText } from "../components/RuleText";
import { Chip, Select, Button, EmptyState } from "../components/ui";
import { SearchInput } from "../components/ui/SearchInput";
import { PaginatedResults } from "../components/ui/PaginatedResults";
import { createLibraryMatcher } from "../lib/library-utils";
import { ReferenceList } from "../components/rules/ReferenceList";
import { RuleArticleReader } from "../components/rules/RuleArticleReader";
import { RuleMarkdown } from "../components/rules/RuleMarkdown";
import { DirectorFilters } from "../components/rules/DirectorFilters";
import {
  emptyDirectorFilters,
  matchesDirectorFilters,
} from "../lib/director-catalog";
import "./CodexView.css";
import "./LibraryView.css";
import "./ReferenceView.css";

const ClassLandingView = lazy(() =>
  import("./ClassLandingView").then((module) => ({ default: module.ClassLandingView })),
);
const CatalogAction = lazy(() =>
  import("../components/CatalogAction").then((module) => ({ default: module.CatalogAction })),
);

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
  const director = isDirectorSection(section);
  const sections = CATALOG_SECTIONS.filter(
    (item) => isDirectorSection(item.id) === director,
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [echelon, setEchelon] = useState("");
  const [directorFilters, setDirectorFilters] = useState(emptyDirectorFilters);
  const deferredQuery = useDeferredValue(query);
  const deferredDirectorFilters = useDeferredValue(directorFilters);
  const app = useContext(AppContext);
  const compact = useMediaQuery("(max-width: 850px)");
  const groupSlug = id.startsWith("group:") ? id.slice(6) : undefined;
  const isList = !id || !!groupSlug;
  const detailOpen = compact && section !== "glossary" && !isList;
  const browsing = useRef({
    section,
    query: "",
    category: "",
    echelon: "",
    directorFilters: emptyDirectorFilters,
    scrollY: 0,
    selectedId: "",
    listId: id,
  });
  const previousId = useRef(id);
  const rememberList = (event: React.MouseEvent<HTMLElement>) => {
    if (
      !compact ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      "a[href^='#/catalog/']",
    );
    if (!anchor) return;
    browsing.current = {
      section,
      query,
      category,
      echelon,
      directorFilters,
      listId: id,
      scrollY: window.scrollY,
      selectedId: anchor.hash.split("/").slice(3).join("/"),
    };
  };

  const entries = useMemo(
    () => catalogSectionEntries(section).filter(
      (entry) => !groupSlug || entry.director?.groupSlug === groupSlug,
    ),
    [section, groupSlug],
  );
  const categories = useMemo(() => [...new Set(entries.map((entry) => entry.eyebrow))], [entries]);
  const hasEchelon = entries.some((entry) => entry.echelon);
  const results = useMemo(() => {
    const matchesQuery = createLibraryMatcher(deferredQuery);
    return entries.filter((entry) =>
      (!category || entry.eyebrow === category) &&
      (!echelon || String(entry.echelon) === echelon) &&
      matchesDirectorFilters(entry, deferredDirectorFilters) &&
      matchesQuery(entry.search),
    );
  }, [entries, category, echelon, deferredDirectorFilters, deferredQuery]);
  const resultsKey = JSON.stringify([section, groupSlug, category, echelon, deferredDirectorFilters, deferredQuery]);
  const selected =
    entries.find((entry) => entry.id === id) ??
    (isList && !compact ? results[0] : undefined);

  useEffect(() => {
    const returning =
      compact &&
      isList &&
      previousId.current &&
      previousId.current !== id &&
      browsing.current.section === section &&
      browsing.current.listId === id;
    previousId.current = id;
    if (returning) {
      const saved = browsing.current;
      setQuery(saved.query);
      setCategory(saved.category);
      setEchelon(saved.echelon);
      setDirectorFilters(saved.directorFilters);
      const timer = window.setTimeout(() => {
        const link = [
          ...document.querySelectorAll<HTMLAnchorElement>(
            ".catalog-browser a, .catalog-global-results a",
          ),
        ].find((a) => a.hash.endsWith(saved.selectedId));
        link?.focus({ preventScroll: true });
        window.scrollTo(0, saved.scrollY);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!isList) {
      const target = document.getElementById(
        compact ? "catalog-reading" : "catalog-detail",
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start" });
    }
  }, [id, section, compact]);
  useEffect(() => {
    if (compact && isList && browsing.current.section === section) return;
    setQuery("");
    setCategory("");
    setEchelon("");
    setDirectorFilters(emptyDirectorFilters);
  }, [section]);
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
  const globalQuery = director ? "" : deferredQuery.trim();
  const globalGroups = useMemo(() => {
    if (!globalQuery) return [];
    const matchesQuery = createLibraryMatcher(globalQuery);
    return CATALOG_SECTIONS.filter(
      (item) => isDirectorSection(item.id) === director,
    )
      .map((catalogSection) => ({
        section: catalogSection,
        entries: catalogSectionEntries(catalogSection.id).filter((entry) =>
          matchesQuery(entry.search),
        ),
      }))
      .filter((group) => group.entries.length > 0);
  }, [globalQuery, director]);
  const globalCount = globalGroups.reduce(
    (total, group) => total + group.entries.length,
    0,
  );
  const globalResults = useMemo(() => globalGroups.flatMap((group) =>
    group.entries.map((entry) => ({ section: group.section.id, entry })),
  ), [globalGroups]);

  const globalHref = (
    catalogSection: CatalogSectionId,
    entry: CatalogBrowserEntry,
  ) =>
    catalogSection === "glossary"
      ? `#/catalog/glossary#term-${encodeURIComponent(entry.id)}`
      : catalogBrowserEntryHref(catalogSection, entry.id);

  return (
    <div className="library-view">
      {detailOpen ? (
        <div className="catalog-reading-bar">
          <a
            className="btn btn-icon"
            aria-label="К списку"
            title="К списку"
            href={
              browsing.current.selectedId
                ? `${catalogSectionHref(browsing.current.section)}${browsing.current.listId ? `/${encodeURIComponent(browsing.current.listId)}` : ""}`
                : catalogSectionHref(section)
            }
          >
            <Icon name="arrow-left" />
          </a>
          <span className="muted small">
            {CATALOG_SECTIONS.find((item) => item.id === section)?.title}
          </span>
        </div>
      ) : (
        <>
          {!director && <div className="catalog-global-search">
            <SearchInput
              aria-label="Поиск по всему справочнику"
              placeholder="Поиск по всему справочнику…"
              value={query}
              onValueChange={setQuery}
              shortcut
            />
          </div>}
          {compact && (
            <Select
              aria-label={
                director ? "Разделы для ведущего" : "Раздел справочника"
              }
              value={section}
              onChange={(event) => {
                setQuery("");
                window.location.hash = catalogSectionHref(
                  event.target.value as CatalogSectionId,
                );
              }}
            >
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {catalogSectionCount(item.id)}
                </option>
              ))}
            </Select>
          )}
          {!compact && (
            <nav
              className="catalog-tabs section-tabs"
              aria-label={
                director ? "Разделы для ведущего" : "Раздел справочника"
              }
            >
              {sections.map((item) => (
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
          )}
        </>
      )}
      {globalQuery && !detailOpen ? (
        <div className="catalog-global-results" onClickCapture={rememberList} aria-busy={query !== deferredQuery}>
          <div className="catalog-global-heading">
            <h2>Результаты поиска</h2>
            <p className="muted small" role="status">Найдено: {globalCount}</p>
          </div>
          {globalCount === 0 && (
            <EmptyState
              icon="search"
              title="Ничего не найдено"
              text="Попробуйте другой термин или более короткий запрос."
              action={<Button onClick={() => setQuery("")}>Сбросить поиск</Button>}
            />
          )}
          {globalCount > 0 && (
            <PaginatedResults
              key={globalQuery}
              items={globalResults}
              label="Результаты поиска"
              initialIndex={globalResults.findIndex(({ entry }) => entry.id === browsing.current.selectedId)}
            >
              {(pageItems) => globalGroups.map((group) => {
                const pageEntries = pageItems.filter((item) => item.section === group.section.id);
                return pageEntries.length > 0 ? (
                  <section className="catalog-global-group" key={group.section.id}>
                    <h3>
                      {group.section.title}
                      <span>{group.entries.length}</span>
                    </h3>
                    <div className="catalog-global-rows">
                      {pageEntries.map(({ entry }) => (
                        <a
                          key={`${group.section.id}-${entry.id}`}
                          className="catalog-global-row"
                          href={globalHref(group.section.id, entry)}
                          onClick={() => {
                            if (!compact) setQuery("");
                          }}
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
                ) : null;
              })}
            </PaginatedResults>
          )}
        </div>
      ) : (
        <>
          {director && !detailOpen && (
            <section
              className="director-filter-panel"
              aria-label="Фильтры каталога"
            >
              <DirectorFilters
                compact={compact}
                searchShortcut
                entries={entries}
                value={directorFilters}
                onChange={setDirectorFilters}
              />
              <p className="muted small" role="status">
                Найдено: {results.length} из {entries.length}
              </p>
            </section>
          )}
          <div
            className={`catalog-layout${
              section !== "glossary" && selected ? " has-detail" : ""
            }`}
          >
            {!detailOpen && (
              <section
                className="catalog-browser"
                aria-busy={directorFilters !== deferredDirectorFilters}
                aria-label="Каталог"
                onClickCapture={rememberList}
              >
                {groupSlug && (
                  <div className="catalog-global-heading">
                    <h2>{entries[0]?.eyebrow ?? "Группа существ"}</h2>
                    <a href={catalogSectionHref(section)}>Все существа <Icon name="arrow-right" size={16} /></a>
                  </div>
                )}
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
                      <div
                        className="catalog-rank-filter"
                        role="group"
                        aria-label="Эшелон"
                      >
                        <button
                          type="button"
                          aria-pressed={!echelon}
                          onClick={() => setEchelon("")}
                        >
                          Все
                        </button>
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            data-rank={n}
                            aria-label={`Эшелон ${n}`}
                            aria-pressed={echelon === String(n)}
                            onClick={() => setEchelon(String(n))}
                          >
                            {["", "I", "II", "III", "IV"][n]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {results.length === 0 && (
                  <EmptyState
                    icon="search"
                    title="Ничего не найдено"
                    text="Измените запрос или сбросьте фильтры."
                    action={
                      <Button
                        onClick={() => {
                          setQuery("");
                          setCategory("");
                          setEchelon("");
                          setDirectorFilters(emptyDirectorFilters);
                        }}
                      >
                        Сбросить фильтры
                      </Button>
                    }
                  />
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
                  <PaginatedResults
                    key={resultsKey}
                    items={results}
                    label="Каталог"
                    initialIndex={results.findIndex((entry) => entry.id === (id || browsing.current.selectedId))}
                  >
                    {(pageItems) => (
                      <ReferenceList
                        entries={pageItems}
                        selectedId={selected?.id}
                        artKind={artKind}
                        hrefFor={(entry) => catalogBrowserEntryHref(section, entry.id)}
                        metaFor={(entry) =>
                          app && entry.catalog && ownsCatalogEntry(app.character, entry.catalog)
                            ? <Chip tone="accent">Уже у героя</Chip>
                            : null
                        }
                      />
                    )}
                  </PaginatedResults>
                )}
              </section>
            )}
            {section !== "glossary" && (selected || !isList) && (
              <div
                id="catalog-reading"
                className="catalog-reading"
                tabIndex={-1}
              >
                {selected ? (
                  <CatalogDetail
                    entry={selected}
                    characterId={app?.character.id}
                  />
                ) : id ? (
                  <p className="library-empty">
                    Запись не найдена. Выберите другую в каталоге.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </>
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
      <CatalogEntryDetail
        key={entry.catalog.id}
        entry={entry.catalog}
        characterId={characterId}
      />
    );
  if (entry.classSlug)
    return (
      <article
        id="catalog-detail"
        className="catalog-detail catalog-detail-class"
      >
        <Suspense fallback={<p className="muted" role="status">Загрузка класса…</p>}>
          <ClassLandingView slug={entry.classSlug} embedded />
        </Suspense>
      </article>
    );
  return (
    <article
      id="catalog-detail"
      className={`catalog-detail${entry.perk ? " catalog-detail-perk sheet-perk-card" : ""}`}
      data-type={entry.perk?.type}
    >
      {entry.perk && <span className="eyebrow">{entry.eyebrow}</span>}
      {entry.perk ? (
        <>
          {entry.articleId ? (
            <RuleArticleReader
              key={entry.perk.id}
              articleId={entry.articleId}
              entityName={entry.perk.name}
            />
          ) : (
            <RuleText text={entry.perk.summary} />
          )}
          {entry.articleId && (
            <a className="catalog-source" href={`#/codex/${entry.articleId}`}>
              Открыть в Кодексе <Icon name="arrow-right" size={16} />
            </a>
          )}
        </>
      ) : entry.articleId ? (
        <>
          <RuleArticleReader
            key={entry.articleId}
            articleId={entry.articleId}
          />
          {!["statblock", "dynamic-terrain"].includes(
            entry.director?.recordType ?? "",
          ) && (
            <a className="catalog-source" href={`#/codex/${entry.articleId}`}>
              Открыть в Кодексе <Icon name="arrow-right" size={16} />
            </a>
          )}
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
  const keywords = entry.keywords
    .split(/[;,]/)
    .map((word) => word.trim())
    .filter(Boolean);
  const { flavor, body } = catalogTitleText(entry);
  const markdown = keywords.length
    ? body.replace(/^\*\*Ключевые слова:\*\*[^\n]*(?:\n|$)/gm, "")
    : body;
  const progression = catalogLevelSections(markdown);
  const levels =
    entry.category === "Сокровища с Уровнем" ? progression.levels : [];
  const [level, setLevel] = useState(levels[0]?.level ?? 1);
  const rank = catalogAccent(entry, levels.length ? level : undefined);
  return (
    <article
      id="catalog-detail"
      className="catalog-detail"
      data-rank={rank}
      data-catalog-kind={entry.kind}
    >
      <div className="catalog-detail-meta">
        <span className="eyebrow">
          {entry.category}
          {!rank && entry.echelon ? ` · Эшелон ${entry.echelon}` : ""}
        </span>
        <CatalogRank rank={rank} />
      </div>
      <h1>{entry.name}</h1>
      {flavor && (
        <div className="catalog-flavor">
          <RuleText text={flavor} />
        </div>
      )}
      {keywords.length > 0 && (
        <div className="catalog-keywords" aria-label="Ключевые слова">
          {keywords.map((keyword) => (
            <Chip key={keyword}>{keyword}</Chip>
          ))}
        </div>
      )}
      {entry.prerequisite && (
        <div className="catalog-prerequisite">
          <span className="eyebrow">Условие получения</span>
          <p>{entry.prerequisite}</p>
        </div>
      )}
      {levels.length ? (
        <>
          <RuleText text={progression.introduction} />
          <div
            className="catalog-level-tabs"
            role="group"
            aria-label="Уровень предмета"
          >
            {levels.map((stage) => (
              <button
                key={stage.level}
                type="button"
                data-rank={levelEchelon(stage.level)}
                aria-pressed={level === stage.level}
                onClick={() => setLevel(stage.level)}
              >
                {stage.level}-й уровень
              </button>
            ))}
          </div>
          {levels
            .filter((stage) => stage.level <= level)
            .map((stage) => (
              <section
                className="catalog-level-section"
                data-rank={levelEchelon(stage.level)}
                key={stage.level}
              >
                <h2>{stage.level}-й уровень</h2>
                <RuleText text={stage.text} />
              </section>
            ))}
        </>
      ) : (
        <RuleText text={markdown} />
      )}
      <footer className="catalog-detail-footer">
        <a className="catalog-source" href={sourceLink(entry)}>
          Открыть в Кодексе <Icon name="arrow-right" size={16} />
        </a>
        <Suspense fallback={null}>
          <CatalogAction key={`${characterId}-${entry.id}`} entry={entry} />
        </Suspense>
      </footer>
    </article>
  );
}
