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
import { artFor, artForArticle, type ArtKind } from "../lib/art";
import { AppContext } from "../state/AppContext";
import { ownsCatalogEntry } from "../lib/catalog-character";
import { useLibraryLocation } from "../lib/library-location";
import { CatalogAction } from "../components/CatalogAction";
import { RuleText } from "../components/RuleText";
import { Chip, Select, TextInput, Button } from "../components/ui";
import { RuleArticleContent } from "../components/rules/RuleArticle";
import { RuleMarkdown } from "../components/rules/RuleMarkdown";
import { ClassLandingView } from "./ClassLandingView";
import {
  loadRuleArticle,
  type LoadedRuleArticle,
} from "../rules/repository";
import "./CodexView.css";
import "./LibraryView.css";
import "./ReferenceView.css";

type ArticleState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; articleId: string; data: LoadedRuleArticle }
  | { status: "error"; articleId: string; message: string };

/** Портреты для разделов, которые читаются как карточки-сущности. */
const ART_KIND_BY_SECTION: Partial<Record<CatalogSectionId, ArtKind>> = {
  classes: "class",
  ancestries: "ancestry",
  careers: "career",
  kits: "kit",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка загрузки.";
}

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
  const [article, setArticle] = useState<ArticleState>({ status: "idle" });
  const app = useContext(AppContext);

  const entries = catalogSectionEntries(section);
  const selected =
    entries.find((entry) => entry.id === id) ?? (!id ? entries[0] : undefined);
  const categories = [...new Set(entries.map((entry) => entry.eyebrow))];
  const hasEchelon = entries.some((entry) => entry.echelon);
  const results = entries.filter(
    (entry) =>
      (!category || entry.eyebrow === category) &&
      (!echelon || String(entry.echelon) === echelon) &&
      matchesLibraryQuery(query, entry.search),
  );

  useEffect(() => {
    setQuery("");
    setCategory("");
    setEchelon("");
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
  useEffect(() => {
    const articleId = selected?.articleId;
    if (!articleId || selected?.perk) {
      setArticle({ status: "idle" });
      return;
    }
    let active = true;
    setArticle({ status: "loading" });
    loadRuleArticle(articleId).then(
      (data) => {
        if (active) setArticle({ status: "ready", articleId, data });
      },
      (error: unknown) => {
        if (active)
          setArticle({ status: "error", articleId, message: errorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [selected?.articleId, section]);

  const categoryLabel =
    section === "perks" ? "Все типы" : "Все категории";
  const artKind = ART_KIND_BY_SECTION[section];
  const glossaryGroups = useMemo(() => {
    if (section !== "glossary") return [];
    const groups = new Map<string, CatalogBrowserEntry[]>();
    for (const entry of results) {
      const bucket = groups.get(entry.eyebrow);
      if (bucket) bucket.push(entry);
      else groups.set(entry.eyebrow, [entry]);
    }
    return [...groups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "ru"),
    );
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
              <div className="catalog-cards">
                {results.map((entry) => {
                  const art = artKind
                    ? artFor(artKind, entry.name)
                    : undefined;
                  return (
                    <a
                      key={entry.id}
                      className={`catalog-card${art ? " has-art" : ""}`}
                      href={catalogBrowserEntryHref(section, entry.id)}
                      aria-current={
                        entry.id === selected?.id ? "page" : undefined
                      }
                    >
                      {art && (
                        <span className="catalog-card-art" aria-hidden="true">
                          <img
                            src={art.thumbnailSrc ?? art.src}
                            alt=""
                            width={art.width}
                            height={art.height}
                            loading="lazy"
                            decoding="async"
                          />
                        </span>
                      )}
                      <span className="catalog-card-body">
                        {(entry.eyebrow || entry.echelon) && (
                          <span className="eyebrow">
                            {entry.eyebrow}
                            {entry.eyebrow && entry.echelon ? " · " : ""}
                            {entry.echelon ? `Эшелон ${entry.echelon}` : ""}
                          </span>
                        )}
                        <h2>{entry.name}</h2>
                        {entry.summary && <p>{entry.summary}</p>}
                        {app &&
                          entry.catalog &&
                          ownsCatalogEntry(app.character, entry.catalog) && (
                            <Chip tone="accent">Уже у героя</Chip>
                          )}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
          {section !== "glossary" &&
            (selected ? (
              <CatalogDetail
                entry={selected}
                article={article}
                characterId={app?.character.id}
              />
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
  article,
  characterId,
}: {
  entry: CatalogBrowserEntry;
  article: ArticleState;
  characterId?: string;
}) {
  if (entry.catalog)
    return (
      <CatalogEntryDetail entry={entry.catalog} characterId={characterId} />
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
    <article id="catalog-detail" className="catalog-detail">
      {entry.perk && <span className="eyebrow">{entry.eyebrow}</span>}
      {entry.perk ? (
        <>
          <h1>{entry.perk.name}</h1>
          <RuleText text={entry.perk.summary} />
          {entry.articleId && (
            <a className="catalog-source" href={`#/codex/${entry.articleId}`}>
              Открыть в Кодексе →
            </a>
          )}
        </>
      ) : article.status === "loading" ? (
        <div className="codex-state" role="status" aria-live="polite">
          <span className="codex-state-spinner" aria-hidden="true" />
          <p>Загружаем статью…</p>
        </div>
      ) : article.status === "error" && article.articleId === entry.articleId ? (
        <div className="codex-state codex-state-error" role="alert">
          <h2>Не удалось загрузить статью</h2>
          <p className="muted small">{article.message}</p>
        </div>
      ) : article.status === "ready" && article.articleId === entry.articleId ? (
        <>
          <RuleArticleContent
            article={article.data.article}
            entities={article.data.entities}
            art={entry.articleId ? artForArticle(entry.articleId) : undefined}
          />
          {entry.articleId && (
            <a className="catalog-source" href={`#/codex/${entry.articleId}`}>
              Открыть в Кодексе →
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
  return (
    <article id="catalog-detail" className="catalog-detail">
      <span className="eyebrow">
        {entry.category}
        {entry.echelon ? ` · Эшелон ${entry.echelon}` : ""}
      </span>
      <h1>{entry.name}</h1>
      {entry.prerequisite && (
        <div className="catalog-prerequisite">
          <span className="eyebrow">Условие получения</span>
          <p>{entry.prerequisite}</p>
        </div>
      )}
      <CatalogAction key={`${characterId}-${entry.id}`} entry={entry} />
      <RuleText text={entry.markdown} />
      <a className="catalog-source" href={sourceLink(entry)}>
        Открыть в Кодексе →
      </a>
    </article>
  );
}
