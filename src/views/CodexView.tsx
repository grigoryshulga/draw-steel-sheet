import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { LibraryHeader } from "../components/LibraryHeader";
import { READING_CATALOG } from "../rules/consumer-reading";
import { catalogLink, readCodexLocation } from "../lib/codex";
import { useCodexBookmarks } from "../lib/codex-bookmarks";
import { Button, TextInput } from "../components/ui";
import "./CodexView.css";
import { artForArticle } from "../lib/art";
import {
  classLandings,
  classLandingForArticle,
  classLandingHref,
  codexArticleHref,
  readingParts,
} from "../rules/codex-navigation";
import {
  loadRuleArticle,
  loadRuleSearchIndex,
  resolveRuleIndexEntry,
  ruleIndex,
} from "../rules/repository";
import type { RuleArticle, RuleEntity, RuleIndexEntry, RuleSearchIndex } from "../rules/schema";
import {
  createRuleSearcher,
  createSearchSequencer,
  normalizeSearchText,
  type RuleSearchOptions,
} from "../rules/search";
import { RuleArticleContent } from "../components/rules/RuleArticle";
import { RuleMarkdown } from "../components/rules/RuleMarkdown";

const ArticleCatalogActions = lazy(() =>
  import("../components/ArticleCatalogActions").then((module) => ({
    default: module.ArticleCatalogActions,
  })),
);

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Карточка результата поиска или закладки: статья либо лендинг класса. */
type ResultEntry = Pick<RuleIndexEntry, "id" | "title" | "chapter"> & {
  group?: string;
};

function articleTitle(articleId: string): string {
  return ruleIndex.find((entry) => entry.id === articleId)?.title ?? articleId;
}

interface LoadedArticle {
  article: RuleArticle;
  entities: Record<string, RuleEntity>;
}

type ArticleContent =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entryId: string; data: LoadedArticle }
  | { status: "error"; entryId: string; message: string };

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

  const { bookmarks, toggleBookmark } = useCodexBookmarks();
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
  const bookmarkEntries = useMemo<ResultEntry[]>(
    () =>
      onlyBookmarks
        ? bookmarks.flatMap((id) => {
            const article = ruleIndex.find((a) => a.id === id);
            if (article) return [article];
            const landing = classLandings.find((l) => l.classId === id);
            return landing
              ? [{ id, title: landing.name, chapter: "Справочник · Классы" }]
              : [];
          })
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
  // Пустой список уместен только для поиска и закладок: в оглавлении
  // результатами считаются карточки глав, а не `resultEntries`.
  const showEmptyState =
    (Boolean(needle) || onlyBookmarks) &&
    !searchPending &&
    !searchFailed &&
    resultEntries.length === 0;

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

  // Статьи-уровни классов живут на лендинге класса: старые адреса — редирект.
  useEffect(() => {
    if (!entryId) return;
    const landing = classLandingForArticle(entryId);
    if (landing)
      window.location.replace(classLandingHref(landing.slug, landing.level));
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
  const open = (id: string) => {
    window.location.hash = codexArticleHref(id);
  };

  return (
    <div className="codex-view">
      <LibraryHeader title="Книга" />
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
            {readingParts.map((part, partIndex) => (
              <div className="codex-part" key={part.id}>
                <p className="codex-part-title">
                  <span className="codex-part-number" aria-hidden="true">
                    {ROMAN[partIndex] ?? partIndex + 1}
                  </span>
                  {part.title}
                </p>
                {part.chapters.map((c) => (
                  <details key={c} open={chapter === c || undefined}>
                    <summary>{c.replace(/^\d+\.\s*/, "")}</summary>
                    <div className="codex-tree-children">
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
                            href={codexArticleHref(article.id)}
                            aria-current={
                              entry?.id === article.id ? "page" : undefined
                            }
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
                {part.extras.map((extra) => (
                  <details
                    key={extra.id}
                    open={
                      extra.articleIds.includes(entry?.id ?? "") || undefined
                    }
                  >
                    <summary>{extra.title}</summary>
                    <div className="codex-tree-children">
                      {extra.articleIds.map((id) => (
                        <a
                          key={id}
                          href={codexArticleHref(id)}
                          aria-current={entry?.id === id ? "page" : undefined}
                        >
                          {articleTitle(id)}
                        </a>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ))}
            <a className="codex-nav-reference" href="#/reference/">
              Справочник: классы, каталоги, глоссарий →
            </a>
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
                {READING_CATALOG.some((item) => item.articleId === entry.id && item.kind === "project") && (
                  <Suspense fallback={null}>
                    <ArticleCatalogActions articleId={entry.id} />
                  </Suspense>
                )}
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
                      art={artForArticle(entry.id)}
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
                {loaded && entry.id === "0701" && (
                  <section
                    className="codex-class-overview"
                    aria-labelledby="codex-class-overview-title"
                  >
                    <h2 id="codex-class-overview-title">Десять классов</h2>
                    <p className="muted">
                      Полные описания с особенностями, способностями и всеми
                      десятью уровнями — в Справочнике.
                    </p>
                    <div className="codex-class-grid">
                      {classLandings.map((landing) => (
                        <a
                          className="codex-class-card"
                          key={landing.classId}
                          href={classLandingHref(landing.slug)}
                        >
                          <strong>{landing.name}</strong>
                          <span className="muted">
                            {landing.levelArticleIds.length} уровней
                          </span>
                        </a>
                      ))}
                    </div>
                  </section>
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
                  {(needle || onlyBookmarks) && (
                    <p className="muted">
                      {searchPending
                        ? "Ищем по всему Кодексу…"
                        : `Найдено статей: ${resultEntries.length}`}
                    </p>
                  )}
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
              {showEmptyState && (
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
                <>
                  <a className="codex-reference-banner" href="#/reference/">
                    <span>
                      <strong>Справочник</strong> — классы, происхождения,
                      карьеры, комплекты, перки, каталоги наград и глоссарий
                    </span>
                    <span aria-hidden="true">→</span>
                  </a>
                  {readingParts.map((part, partIndex) => (
                    <section
                      className="codex-part-collection"
                      key={part.id}
                    >
                      <div className="codex-part-head">
                        <span className="eyebrow">
                          Часть {ROMAN[partIndex] ?? partIndex + 1}
                        </span>
                        <h2>{part.title}</h2>
                      </div>
                      <div className="codex-collections">
                        {part.chapters.map((name) => {
                          const entries = ruleIndex.filter(
                            (article) => article.chapter === name,
                          );
                          const sections = [
                            ...new Set(
                              entries
                                .map((article) => article.group)
                                .filter(Boolean),
                            ),
                          ];
                          return (
                            <section className="codex-collection" key={name}>
                              <span className="eyebrow">
                                Глава {name.slice(0, 2)}
                              </span>
                              <h3>
                                <a href={catalogLink(name)}>
                                  {name.replace(/^\d+\.\s*/, "")}
                                </a>
                              </h3>
                              {sections.length ? (
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
                            </section>
                          );
                        })}
                        {part.extras.map((extra) => (
                          <section className="codex-collection" key={extra.id}>
                            <span className="eyebrow">Подборка</span>
                            <h3>
                              <a href={codexArticleHref(extra.articleIds[0])}>
                                {extra.title}
                              </a>
                            </h3>
                            <p>
                              {extra.articleIds
                                .slice(0, 3)
                                .map((id) => articleTitle(id))
                                .join(" · ")}
                            </p>
                            <a
                              className="codex-collection-footer"
                              href={codexArticleHref(extra.articleIds[0])}
                            >
                              Открыть <span aria-hidden="true">→</span>
                            </a>
                          </section>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
              <div className="codex-results">
                {(needle || onlyBookmarks ? resultEntries : []).map(
                  (article) => {
                    const excerpt = excerptById.get(article.id) ?? "";
                    return (
                      <a
                        className="codex-result"
                        key={article.id}
                        href={codexArticleHref(article.id)}
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
