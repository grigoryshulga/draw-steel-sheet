import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { LibraryHeader } from "../components/LibraryHeader";
import { CATALOG } from "../data/library";
import { CatalogAction } from "../components/CatalogAction";
import { catalogLink, readCodexLocation } from "../lib/codex";
import { Button, TextInput } from "../components/ui";
import "./CodexView.css";
import { ArtworkFigure } from "../components/Artwork";
import { artForArticle } from "../lib/art";
import {
  loadRuleArticle,
  loadRuleSearchIndex,
  resolveRuleIndexEntry,
  ruleIndex,
} from "../rules/repository";
import type { RuleArticle, RuleEntity, RuleSearchIndex } from "../rules/schema";
import {
  createRuleSearcher,
  createSearchSequencer,
  normalizeSearchText,
  type RuleSearchOptions,
} from "../rules/search";
import { RuleArticleContent } from "../components/rules/RuleArticle";
import { RuleMarkdown } from "../components/rules/RuleMarkdown";

const chapterCatalog = (chapter: string) =>
  chapter.startsWith("18.")
    ? "treasure"
    : chapter.startsWith("19.")
      ? "title"
      : chapter.startsWith("16.")
        ? "project"
        : "";
const chapters = [...new Set(ruleIndex.map((article) => article.chapter))];

interface LoadedArticle {
  article: RuleArticle;
  entities: Record<string, RuleEntity>;
}

type ArticleContent =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entryId: string; data: LoadedArticle }
  | { status: "error"; entryId: string; message: string };

function readBookmarks(): string[] {
  try {
    const value = JSON.parse(
      localStorage.getItem("ds-codex-bookmarks") || "[]",
    );
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function headingLabel(title: string): string {
  return title.replace(/\*\*/g, "").trim();
}

function isEmptyArticle(article: RuleArticle): boolean {
  return article.blocks.every(
    (block) => block.type === "markdown" && !block.text.trim(),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка загрузки.";
}

export function CodexView() {
  const [location, setLocation] = useState(readCodexLocation);
  const [query, setQuery] = useState("");
  const needle = normalizeSearchText(useDeferredValue(query));

  const [bookmarks, setBookmarks] = useState(readBookmarks);
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [content, setContent] = useState<ArticleContent>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  // Полный поисковый корпус приходит отдельным чанком только при первом поиске.
  const [searchCorpus, setSearchCorpus] = useState<RuleSearchIndex | null>(
    null,
  );
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [searchFailure, setSearchFailure] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const sequencer = useRef(createSearchSequencer());
  const searcher = useMemo(
    () => (searchCorpus ? createRuleSearcher(ruleIndex, searchCorpus) : null),
    [searchCorpus],
  );
  const entry = useMemo(
    () => resolveRuleIndexEntry(ruleIndex, location),
    [location],
  );
  const entryId = entry?.id ?? "";
  const missingArticle = Boolean(location.articleId) && !entry;
  const chapter = entry?.chapter || location.chapter;
  const group = entry?.group || location.group;
  const siblings = entry
    ? ruleIndex.filter(
        (item) => item.chapter === entry.chapter && item.group === entry.group,
      )
    : [];
  const position = entry
    ? siblings.findIndex((item) => item.id === entry.id)
    : -1;
  const headings = entry?.headings ?? [];
  const loaded =
    content.status === "ready" && content.entryId === entryId
      ? content.data
      : undefined;
  const failure =
    content.status === "error" && content.entryId === entryId
      ? content
      : undefined;
  const loading = Boolean(entry) && !loaded && !failure;

  const browse = (c = "", g = "") => {
    setQuery("");
    setOnlyBookmarks(false);
    window.location.hash = catalogLink(c, g);
  };
  useEffect(() => {
    if (!needle || searchCorpus) return;
    const token = sequencer.current.begin();
    let active = true;
    setSearchStatus("loading");
    setSearchFailure("");
    loadRuleSearchIndex().then(
      (index) => {
        // Поздний ответ на прежний запрос не должен перезаписать новый.
        if (!active || !sequencer.current.isCurrent(token)) return;
        setSearchCorpus(index);
        setSearchStatus("ready");
      },
      (error: unknown) => {
        if (!active || !sequencer.current.isCurrent(token)) return;
        setSearchFailure(errorMessage(error));
        setSearchStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, [needle, searchCorpus, searchAttempt]);

  const searchMatches = useMemo(
    () =>
      searcher && needle
        ? searcher.search(needle, {
            chapter: chapter || undefined,
            group: group || undefined,
            bookmarks,
            onlyBookmarks,
          } satisfies RuleSearchOptions)
        : [],
    [searcher, needle, chapter, group, bookmarks, onlyBookmarks],
  );
  const bookmarkEntries = useMemo(
    () =>
      onlyBookmarks
        ? ruleIndex.filter((article) => bookmarks.includes(article.id))
        : [],
    [onlyBookmarks, bookmarks],
  );
  const resultEntries = needle
    ? searchMatches.map((match) => match.entry)
    : bookmarkEntries;
  const excerptById = useMemo(
    () =>
      new Map(searchMatches.map((match) => [match.entry.id, match.excerpt])),
    [searchMatches],
  );
  // Пока корпус не загружен, список не должен выглядеть как «ничего не найдено».
  const searchPending =
    Boolean(needle) && !searcher && searchStatus !== "error";
  const searchFailed =
    Boolean(needle) && !searcher && searchStatus === "error";

  useEffect(() => {
    if (!entryId) {
      setContent({ status: "idle" });
      return;
    }
    let active = true;
    setContent({ status: "loading" });
    loadRuleArticle(entryId).then(
      (data) => {
        if (active) setContent({ status: "ready", entryId, data });
      },
      (error: unknown) => {
        if (active)
          setContent({
            status: "error",
            entryId,
            message: errorMessage(error),
          });
      },
    );
    return () => {
      // Поздний ответ для покинутой статьи не должен перезаписать новую.
      active = false;
    };
  }, [entryId, attempt]);

  useEffect(() => {
    if (entryId === "0102") window.location.replace("#/glossary/");
  }, [entryId]);
  useEffect(() => {
    const change = () => setLocation(readCodexLocation());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const target = location.heading
      ? document.getElementById(location.heading)
      : document.getElementById(entry ? "codex-article" : "codex-catalog");
    target?.scrollIntoView({ block: "start" });
  }, [location, entry, loaded]);
  const toggleBookmark = (id: string) =>
    setBookmarks((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      try {
        localStorage.setItem("ds-codex-bookmarks", JSON.stringify(next));
      } catch {
        /* storage can be unavailable */
      }
      return next;
    });
  const open = (id: string) => {
    window.location.hash = `/codex/${id}`;
  };

  return (
    <div className="codex-view">
      <LibraryHeader
        current="codex"
        description="Правила Draw Steel — от первого героя до последней битвы."
      />
      <div className="codex-layout">
        <aside className="codex-nav" aria-label="Разделы Кодекса">
          <TextInput
            type="search"
            aria-label="Поиск по всему Кодексу"
            placeholder="Найти правило…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (entry) window.location.hash = catalogLink();
            }}
          />
          <div className="codex-nav-tabs">
            <Button
              size="sm"
              variant={!onlyBookmarks ? "soft" : "ghost"}
              onClick={() => browse()}
            >
              Все главы
            </Button>
            <Button
              size="sm"
              variant={onlyBookmarks ? "soft" : "ghost"}
              onClick={() => {
                setOnlyBookmarks(true);
                setQuery("");
                window.location.hash = catalogLink();
              }}
            >
              Закладки {bookmarks.length || ""}
            </Button>
          </div>
          <nav aria-label="Оглавление">
            <a
              className={!chapter && !entry ? "is-active" : ""}
              href={catalogLink()}
              onClick={() => browse()}
            >
              Оглавление
            </a>
            {chapters.map((c) => (
              <details key={c} open={chapter === c || undefined}>
                <summary>{c.replace(/^\d+\.\s*/, "")}</summary>
                <div className="codex-tree-children">
                  <a
                    href={
                      chapterCatalog(c)
                        ? `#/catalog/${chapterCatalog(c)}`
                        : catalogLink(c)
                    }
                    onClick={() => {
                      if (!chapterCatalog(c)) browse(c);
                    }}
                    className={
                      chapter === c && !group && !entry ? "is-active" : ""
                    }
                  >
                    {chapterCatalog(c) ? "Открыть каталог" : "Читать главу"}
                  </a>
                  {[
                    ...new Set(
                      ruleIndex
                        .filter((article) => article.chapter === c)
                        .map((article) => article.group),
                    ),
                  ].map((g) => {
                    const entries = ruleIndex.filter(
                      (article) =>
                        article.chapter === c && article.group === g,
                    );
                    const links = entries.map((article) => (
                      <a
                        key={article.id}
                        href={
                          article.id === "0102"
                            ? "#/glossary/"
                            : `#/codex/${article.id}`
                        }
                        aria-current={entry?.id === article.id ? "page" : undefined}
                      >
                        {article.title}
                      </a>
                    ));
                    return g ? (
                      <details
                        key={g}
                        open={(chapter === c && group === g) || undefined}
                      >
                        <summary>{g}</summary>
                        <div className="codex-tree-children">
                          <a
                            href={catalogLink(c, g)}
                            onClick={() => browse(c, g)}
                            className={
                              chapter === c && group === g && !entry
                                ? "is-active"
                                : ""
                            }
                          >
                            Читать: {g}
                          </a>
                          {links}
                        </div>
                      </details>
                    ) : (
                      <div key="articles">{links}</div>
                    );
                  })}
                </div>
              </details>
            ))}
          </nav>
          <a
            className="codex-source muted small"
            href="https://github.com/grigoryshulga/drawsteel-ru"
            target="_blank"
            rel="noreferrer"
          >
            Исходный перевод ↗
          </a>
        </aside>
        <div className="codex-main">
          {entry ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  browse();
                }}
              >
                ← К оглавлению
              </Button>
              <article id="codex-article" className="codex-article">
                <nav className="codex-breadcrumb" aria-label="Путь статьи">
                  <a href={catalogLink()} onClick={() => browse()}>
                    Оглавление
                  </a>
                  <span>/</span>
                  <a
                    href={catalogLink(chapter)}
                    onClick={() => browse(chapter)}
                  >
                    {chapter.replace(/^\d+\.\s*/, "")}
                  </a>
                  {group && (
                    <>
                      <span>/</span>
                      <a
                        href={catalogLink(chapter, group)}
                        onClick={() => browse(chapter, group)}
                      >
                        {group}
                      </a>
                    </>
                  )}
                </nav>
                <header className="codex-article-head">
                  <div>
                    <h1>{entry.title}</h1>
                    {loaded?.article.originalName && (
                      <p className="codex-original-title">
                        {loaded.article.originalName}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={bookmarks.includes(entry.id) ? "soft" : "ghost"}
                    aria-pressed={bookmarks.includes(entry.id)}
                    onClick={() => toggleBookmark(entry.id)}
                  >
                    {bookmarks.includes(entry.id)
                      ? "В закладках"
                      : "В закладки"}
                  </Button>
                </header>
                {chapter === "08. Классы" && siblings.length > 1 && (
                  <nav
                    className="codex-level-switcher"
                    aria-label="Уровень класса"
                  >
                    <span className="eyebrow">Уровень</span>
                    {siblings.map((sibling) => (
                      <a
                        key={sibling.id}
                        href={`#/codex/${sibling.id}`}
                        aria-current={
                          sibling.id === entry.id ? "page" : undefined
                        }
                        title={sibling.title}
                      >
                        {sibling.title.match(/^(\d+)-й/)?.[1] || sibling.title}
                      </a>
                    ))}
                  </nav>
                )}
                {headings.length > 0 && (
                  <details className="codex-inline-toc">
                    <summary>В этой статье · {headings.length}</summary>
                    {headings.map((heading, i) => (
                      <a
                        key={`${heading.id}-${i}`}
                        href={`#/codex/${entry.id}/${encodeURIComponent(heading.id)}`}
                      >
                        {headingLabel(heading.title)}
                      </a>
                    ))}
                  </details>
                )}
                {CATALOG.filter(
                  (catalogEntry) =>
                    catalogEntry.articleId === entry.id &&
                    catalogEntry.kind === "project",
                ).map((catalogEntry) => (
                  <CatalogAction key={catalogEntry.id} entry={catalogEntry} />
                ))}
                <ArtworkFigure
                  key={entry.id}
                  art={artForArticle(entry.id)}
                  className="codex-article-art"
                />
                {loading && (
                  <div className="codex-state" role="status" aria-live="polite">
                    <span className="codex-state-spinner" aria-hidden="true" />
                    <p>Загружаем статью…</p>
                  </div>
                )}
                {failure && (
                  <div className="codex-state codex-state-error" role="alert">
                    <h2>Не удалось загрузить статью</h2>
                    <p>
                      Проверьте подключение и попробуйте снова. Если ошибка
                      повторяется, откройте другую статью Кодекса.
                    </p>
                    <p className="muted small">{failure.message}</p>
                    <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
                      Повторить
                    </Button>
                  </div>
                )}
                {loaded &&
                  (isEmptyArticle(loaded.article) ? (
                    <p className="muted">
                      Эта статья пока не заполнена в исходном переводе.
                    </p>
                  ) : (
                    <RuleArticleContent
                      article={loaded.article}
                      entities={loaded.entities}
                    />
                  ))}
                {loaded?.article.originalDescription && (
                  <details className="codex-original">
                    <summary>Оригинал (English)</summary>
                    <div className="codex-original-text">
                      <RuleMarkdown
                        text={loaded.article.originalDescription}
                        articleId={loaded.article.id}
                      />
                    </div>
                  </details>
                )}
                <footer className="codex-paging">
                  {position > 0 && (
                    <Button
                      size="sm"
                      onClick={() => open(siblings[position - 1].id)}
                    >
                      ← {siblings[position - 1].title}
                    </Button>
                  )}
                  {position < siblings.length - 1 && (
                    <Button
                      size="sm"
                      onClick={() => open(siblings[position + 1].id)}
                    >
                      {siblings[position + 1].title} →
                    </Button>
                  )}
                </footer>
              </article>
            </>
          ) : missingArticle ? (
            <div className="codex-state codex-state-missing" role="alert">
              <h2>Статья не найдена</h2>
              <p>
                Возможно, ссылка устарела или содержит опечатку. Вернитесь к
                оглавлению и выберите статью заново.
              </p>
              <Button size="sm" onClick={() => browse()}>
                К оглавлению
              </Button>
            </div>
          ) : (
            <>
              <div id="codex-catalog" className="codex-results-heading">
                <div>
                  <span className="eyebrow">
                    {needle
                      ? "По всему Кодексу"
                      : onlyBookmarks
                        ? "Ваша библиотека"
                        : "Библиотека правил"}
                  </span>
                  <h2>
                    {needle
                      ? "Результаты поиска"
                      : onlyBookmarks
                        ? "Закладки"
                        : group ||
                          chapter.replace(/^\d+\.\s*/, "") ||
                          "Оглавление"}
                  </h2>
                  <p className="muted">
                    {needle || onlyBookmarks
                      ? searchPending
                        ? "Ищем по всему Кодексу…"
                        : `Найдено статей: ${resultEntries.length}`
                      : !chapter
                        ? `${chapters.length} глав · ${ruleIndex.length} статей. Выберите главу, чтобы начать чтение.`
                        : group
                          ? "Правила и развитие — в порядке чтения."
                          : "Выберите раздел или статью этой главы."}
                  </p>
                </div>
                {chapter && (
                  <a
                    href={catalogLink(group ? chapter : "")}
                    onClick={() => browse(group ? chapter : "")}
                  >
                    ← {group ? "К главе" : "Оглавление"}
                  </a>
                )}
              </div>
              {searchPending && (
                <div className="codex-state" role="status" aria-live="polite">
                  <span className="codex-state-spinner" aria-hidden="true" />
                  <p>Загружаем полный текст правил для поиска…</p>
                </div>
              )}
              {searchFailed && (
                <div
                  className="codex-state codex-state-error codex-state-search"
                  role="alert"
                >
                  <h2>Не удалось загрузить поиск</h2>
                  <p>
                    Браузер не получил поисковый индекс. Проверьте подключение
                    и попробуйте снова — чтение статей работает без него.
                  </p>
                  <p className="muted small">{searchFailure}</p>
                  <Button
                    size="sm"
                    onClick={() => setSearchAttempt((n) => n + 1)}
                  >
                    Повторить поиск
                  </Button>
                </div>
              )}
              {!searchPending && !searchFailed && resultEntries.length === 0 && (
                <div className="codex-empty">
                  <h3>
                    {onlyBookmarks
                      ? "Здесь будут ваши закладки"
                      : "Ничего не найдено"}
                  </h3>
                  <p>
                    {" "}
                    {onlyBookmarks
                      ? "Откройте статью и нажмите «В закладки»."
                      : "Попробуйте другое название или более короткий запрос."}
                  </p>
                </div>
              )}
              {!needle && !onlyBookmarks && (
                <div className="codex-collections">
                  {chapters.map((name, i) => {
                    const entries = ruleIndex.filter(
                      (article) => article.chapter === name,
                    );
                    const sections = [
                      ...new Set(
                        entries.map((article) => article.group).filter(Boolean),
                      ),
                    ];
                    return (
                      <section className="codex-collection" key={name}>
                        <span className="eyebrow">
                          Глава {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3>
                          <a
                            href={
                              chapterCatalog(name)
                                ? `#/catalog/${chapterCatalog(name)}`
                                : catalogLink(name)
                            }
                          >
                            {name.replace(/^\d+\.\s*/, "")}
                          </a>
                        </h3>
                        {sections.length && !chapterCatalog(name) ? (
                          <nav
                            className="codex-section-links"
                            aria-label={name}
                          >
                            {sections.map((section) => (
                              <a
                                key={section}
                                href={catalogLink(name, section)}
                              >
                                {section}
                              </a>
                            ))}
                          </nav>
                        ) : (
                          <p>
                            {entries
                              .slice(0, 3)
                              .map((article) => article.title)
                              .join(" · ")}
                          </p>
                        )}
                        <a
                          className="codex-collection-footer"
                          href={
                            chapterCatalog(name)
                              ? `#/catalog/${chapterCatalog(name)}`
                              : catalogLink(name)
                          }
                        >
                          {chapterCatalog(name)
                            ? "Открыть каталог"
                            : "Читать главу"}{" "}
                          <span aria-hidden="true">→</span>
                        </a>
                      </section>
                    );
                  })}
                </div>
              )}
              <div className="codex-results">
                {(needle || onlyBookmarks ? resultEntries : []).map(
                  (article) => {
                    const excerpt = excerptById.get(article.id) ?? "";
                    return (
                      <a
                        className="codex-result"
                        key={article.id}
                        href={
                          article.id === "0102"
                            ? "#/glossary/"
                            : `#/codex/${article.id}`
                        }
                      >
                        <span className="eyebrow">
                          {article.chapter}
                          {article.group && ` / ${article.group}`}
                        </span>
                        <h3>{article.title}</h3>
                        {needle && <p>{excerpt}…</p>}
                      </a>
                    );
                  },
                )}
              </div>
            </>
          )}
        </div>
        {entry && headings.length > 0 && (
          <nav className="codex-toc" aria-label="В этой статье">
            <span className="eyebrow">В этой статье</span>
            {headings.map((heading, i) => (
              <a
                key={`${heading.id}-${i}`}
                style={{ paddingLeft: heading.level > 2 ? 12 : 0 }}
                aria-current={
                  location.heading === heading.id ? "location" : undefined
                }
                href={`#/codex/${entry.id}/${encodeURIComponent(heading.id)}`}
              >
                {headingLabel(heading.title)}
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
