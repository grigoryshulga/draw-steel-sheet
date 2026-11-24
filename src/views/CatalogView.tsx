import { loadEnglishReference } from "../rules/consumer-english-reference";
import { useLocalizedData } from "../i18n/use-localized-data";
import { localizedCatalogEntries } from "../components/rules/catalog-language";
import { isDirectorSection } from "../navigation";
import { useMediaQuery } from "../lib/hooks";
import { CatalogEntryCard } from "../components/rules/CatalogEntryCard";
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
  type RefObject,
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
import { GlossaryDefinition } from "../components/rules/GlossaryDefinition";
import type { GlossaryEntry } from "../rules/consumer-data";
import { ReferenceList } from "../components/rules/ReferenceList";
const RuleArticleReader = lazy(() => import("../components/rules/RuleArticleReader").then(module => ({ default: module.RuleArticleReader })));
import { DirectorFilters } from "../components/rules/DirectorFilters";
import {
  emptyDirectorFilters,
  matchesDirectorFilters,
} from "../lib/director-catalog";
import "./CodexView.css";
import "./LibraryView.css";
import "./ReferenceView.css";
import { useLocale, useArticleLanguage, ArticleLanguageScope, useArticleLocale } from "../i18n/locale";
import { ArticleLanguageSwitch } from "../components/LanguageSwitch";
import { sectionTitle } from "../components/rules/reader-labels";

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
export function CatalogView({ embedded }: {
  embedded?: { navigate: (href: string) => void; scrollRoot: RefObject<HTMLElement | null> };
} = {}) {
  const { t, locale } = useLocale();
  const english = useLocalizedData(locale, loadEnglishReference);
  const segments = useLibraryLocation();
  const route = resolveCatalogRoute(segments);
  const { section } = route;
  const id = embedded ? route.id.split("#")[0] : route.id;
  const director = isDirectorSection(section);
  const sections = useMemo(() => CATALOG_SECTIONS.filter(
    (item) => isDirectorSection(item.id) === director,
  ), [director]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [echelon, setEchelon] = useState("");
  const [directorFilters, setDirectorFilters] = useState(emptyDirectorFilters);
  const deferredQuery = useDeferredValue(query);
  const deferredDirectorFilters = useDeferredValue(directorFilters);
  const app = useContext(AppContext);
  const narrowViewport = useMediaQuery("(max-width: 850px)");
  const compact = !!embedded || narrowViewport;
  const catalog = useRef<HTMLDivElement>(null);
  const scrollRoot = embedded?.scrollRoot;
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
      scrollY: scrollRoot?.current?.scrollTop ?? window.scrollY,
      selectedId: anchor.hash.split("/").slice(3).join("/"),
    };
  };

  const entries = useMemo(
    () => localizedCatalogEntries(catalogSectionEntries(section), locale, english).filter(
      (entry) => !groupSlug || entry.director?.groupSlug === groupSlug,
    ),
    [section, groupSlug, locale, english],
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
          ...(catalog.current?.querySelectorAll<HTMLAnchorElement>(
            ".catalog-browser a, .catalog-global-results a",
          ) ?? []),
        ].find((a) => a.hash.endsWith(saved.selectedId));
        link?.focus({ preventScroll: true });
        (scrollRoot?.current ?? window).scrollTo(0, saved.scrollY);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!isList) {
      const target = catalog.current?.querySelector<HTMLElement>(
        compact ? "#catalog-reading" : "#catalog-detail",
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start" });
    }
  }, [id, section, compact, scrollRoot]);
  useEffect(() => {
    if (compact && isList && browsing.current.section === section) return;
    setQuery("");
    setCategory("");
    setEchelon("");
    setDirectorFilters(emptyDirectorFilters);
  }, [section, locale]);
  const glossaryFragment = (segments[2] ?? "").split("#")[1] ?? "";
  useEffect(() => {
    if (section !== "glossary" || !glossaryFragment) return;
    catalog.current
      ?.querySelector(`#${CSS.escape(decodeURIComponent(glossaryFragment))}`)
      ?.scrollIntoView({ block: "center" });
  }, [section, glossaryFragment]);
  const categoryLabel = section === "perks" ? t("Все типы", "All types") : t("Все категории", "All categories");
  const artKind = ART_KIND_BY_SECTION[section];
  const glossaryGroups = useMemo(() => {
    if (section !== "glossary") return [];
    const groups = new Map<string, CatalogBrowserEntry[]>();
    for (const entry of results) {
      const bucket = groups.get(entry.eyebrow);
      if (bucket) bucket.push(entry);
      else groups.set(entry.eyebrow, [entry]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], locale));
  }, [section, results, locale]);
  const globalQuery = director ? "" : deferredQuery.trim();
  const globalGroups = useMemo(() => {
    if (!globalQuery) return [];
    const matchesQuery = createLibraryMatcher(globalQuery);
    return [...sections].sort((a, b) =>
      Number(b.id === "glossary") - Number(a.id === "glossary"),
    )
      .map((catalogSection) => ({
        section: catalogSection,
        entries: localizedCatalogEntries(catalogSectionEntries(catalogSection.id), locale, english).filter((entry) =>
          matchesQuery(entry.search),
        ),
      }))
      .filter((group) => group.entries.length > 0);
  }, [globalQuery, sections, locale, english]);
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
    <div className="library-view" ref={catalog}>
      {detailOpen ? (
        <div className="catalog-reading-bar">
          <a
            className="btn btn-icon"
            aria-label={t("К списку", "Back to list")}
            title={t("К списку", "Back to list")}
            href={
              browsing.current.selectedId
                ? `${catalogSectionHref(browsing.current.section)}${browsing.current.listId ? `/${encodeURIComponent(browsing.current.listId)}` : ""}`
                : catalogSectionHref(section)
            }
          >
            <Icon name="arrow-left" />
          </a>
          <span className="muted small">
            {sectionTitle(section, CATALOG_SECTIONS.find((item) => item.id === section)?.title ?? "", locale)}
          </span>
        </div>
      ) : (
        <>
          {!director && <div className="catalog-global-search">
            <SearchInput
              aria-label={t("Поиск по всему справочнику", "Search the reference")}
              placeholder={t("Поиск по всему справочнику…", "Search the reference…")}
              value={query}
              onValueChange={setQuery}
              shortcut={!embedded}
            />
          </div>}
          {compact && (
            <Select
              aria-label={
                director ? t("Разделы для ведущего", "Director sections") : t("Раздел справочника", "Reference section")
              }
              value={section}
              onChange={(event) => {
                setQuery("");
                const href = catalogSectionHref(event.target.value as CatalogSectionId);
                if (embedded) embedded.navigate(href);
                else window.location.hash = href;
              }}
            >
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {sectionTitle(item.id, item.title, locale)} · {catalogSectionCount(item.id)}
                </option>
              ))}
            </Select>
          )}
          {!compact && (
            <nav
              className="catalog-tabs section-tabs"
              aria-label={
                director ? t("Разделы для ведущего", "Director sections") : t("Раздел справочника", "Reference section")
              }
            >
              {sections.map((item) => (
                <a
                  key={item.id}
                  href={catalogSectionHref(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                  onClick={() => setQuery("")}
                >
                  {sectionTitle(item.id, item.title, locale)} <span>{catalogSectionCount(item.id)}</span>
                </a>
              ))}
            </nav>
          )}
        </>
      )}
      {globalQuery && !detailOpen ? (
        <div className="catalog-global-results" onClickCapture={rememberList} aria-busy={query !== deferredQuery}>
          <div className="catalog-global-heading">
            <h2>{t("Результаты поиска", "Search results")}</h2>
            <p className="muted small" role="status">{t("Найдено", "Found")}: {globalCount}</p>
          </div>
          {globalCount === 0 && (
            <EmptyState
              icon="search"
              title={t("Ничего не найдено", "Nothing found")}
              text={t("Попробуйте другой термин или более короткий запрос.", "Try another term or a shorter search.")}
              action={<Button onClick={() => setQuery("")}>{t("Сбросить поиск", "Clear search")}</Button>}
            />
          )}
          {globalCount > 0 && (
            <PaginatedResults
              key={globalQuery}
              items={globalResults}
              label={t("Результаты поиска", "Search results")}
              initialIndex={globalResults.findIndex(({ entry }) => entry.id === browsing.current.selectedId)}
            >
              {(pageItems) => globalGroups.map((group) => {
                const pageEntries = pageItems.filter((item) => item.section === group.section.id);
                return pageEntries.length > 0 ? (
                  <section className="catalog-global-group" key={group.section.id}>
                    <h3>
                      {sectionTitle(group.section.id, group.section.title, locale)}
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
                          <span className="catalog-global-name">{locale === "en" ? entry.originalName || entry.name : entry.name}</span>
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
              aria-label={t("Фильтры каталога", "Catalog filters")}
            >
              <DirectorFilters
                compact={compact}
                searchShortcut={!embedded}
                entries={entries}
                value={directorFilters}
                onChange={setDirectorFilters}
              />
              <p className="muted small" role="status">
                {t("Найдено", "Found")}: {results.length} {t("из", "of")} {entries.length}
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
                aria-label={t("Каталог", "Catalog")}
                onClickCapture={rememberList}
              >
                {groupSlug && (
                  <div className="catalog-global-heading">
                    <h2>{entries[0]?.eyebrow ?? t("Группа существ", "Creature group")}</h2>
                    <a href={catalogSectionHref(section)}>{t("Все существа", "All creatures")} <Icon name="arrow-right" size={16} /></a>
                  </div>
                )}
                {(section === "glossary" ||
                  categories.length > 1 ||
                  hasEchelon) && (
                  <div className="catalog-filters">
                    {section === "glossary" ? (
                      <nav
                        className="glossary-alphabet catalog-glossary-alphabet"
                        aria-label={t("Алфавит", "Alphabet")}
                      >
                        <button
                          type="button"
                          aria-pressed={!category}
                          onClick={() => setCategory("")}
                        >
                          {t("Все", "All")}
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
                        aria-label={t("Эшелон", "Echelon")}
                      >
                        <button
                          type="button"
                          aria-pressed={!echelon}
                          onClick={() => setEchelon("")}
                        >
                          {t("Все", "All")}
                        </button>
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            data-rank={n}
                            aria-label={`${t("Эшелон", "Echelon")} ${n}`}
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
                    title={t("Ничего не найдено", "Nothing found")}
                    text={t("Измените запрос или сбросьте фильтры.", "Change your search or clear filters.")}
                    action={
                      <Button
                        onClick={() => {
                          setQuery("");
                          setCategory("");
                          setEchelon("");
                          setDirectorFilters(emptyDirectorFilters);
                        }}
                      >
                        {t("Сбросить фильтры", "Clear filters")}
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
                          entry.glossary && <CatalogGlossaryEntry key={entry.id} entry={entry.glossary} selected={entry.id === id} />
                        ))}
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <PaginatedResults
                    key={resultsKey}
                    items={results}
                    label={t("Каталог", "Catalog")}
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
                            ? <Chip tone="accent">{t("Уже у героя", "Already owned")}</Chip>
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
                  <Suspense fallback={<p role="status">{t("Загружаем правила…", "Loading rules…")}</p>}>
                  <CatalogDetail
                    entry={selected}
                    characterId={app?.character.id}
                  />
                  </Suspense>
                ) : id ? (
                  <p className="library-empty">
                    {t("Запись не найдена. Выберите другую в каталоге.", "Entry not found. Choose another from the catalog.")}
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
  const { t } = useLocale();
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
        <Suspense fallback={<p className="muted" role="status">{t("Загрузка класса…", "Loading class…")}</p>}>
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
              {t("Открыть в Кодексе", "Open in Codex")} <Icon name="arrow-right" size={16} />
            </a>
          )}
        </>
      ) : entry.articleId ? (
        <>
          <RuleArticleReader
            key={entry.id}
            articleId={entry.articleId}
            entityName={entry.entityName}
          />
          {!["statblock", "dynamic-terrain"].includes(
            entry.director?.recordType ?? "",
          ) && (
            <a className="catalog-source" href={`#/codex/${entry.articleId}`}>
              {t("Открыть в Кодексе", "Open in Codex")} <Icon name="arrow-right" size={16} />
            </a>
          )}
        </>
      ) : null}
    </article>
  );
}

export function CatalogEntryDetail({ entry, characterId }: { entry: CatalogEntry; characterId?: string }) {
  const { t } = useLocale();
  return <CatalogEntryCard id="catalog-detail" entry={entry} footer={
    <footer className="catalog-detail-footer">
      <a className="catalog-source" href={sourceLink(entry)}>
        {t("Открыть в Кодексе", "Open in Codex")} <Icon name="arrow-right" size={16} />
      </a>
      <Suspense fallback={null}><CatalogAction key={`${characterId}-${entry.id}`} entry={entry} /></Suspense>
    </footer>
  } />;
}

export function CatalogGlossaryEntry({ entry, selected }: { entry: GlossaryEntry; selected: boolean }) {
  const { locale } = useLocale();
  const inherited = useArticleLocale();
  const available = Boolean(entry.hasEnglishDefinition);
  const { language, setLanguage } = useArticleLanguage(entry.id, available);
  const displayed = selected ? language : locale;
  return <ArticleLanguageScope language={displayed}>
    <article className="catalog-glossary-entry" id={`term-${entry.id}`} lang={displayed}>
      {selected && available && inherited === null && <div className="rule-reader-language"><ArticleLanguageSwitch language={language} setLanguage={setLanguage} /></div>}
      <h4 className="catalog-glossary-term"><span>{displayed === "en" && entry.english ? entry.english : entry.name}</span>
        {displayed === "ru" && entry.english && <em>{entry.english}</em>}</h4>
      <GlossaryDefinition entry={entry} />
    </article>
  </ArticleLanguageScope>;
}
