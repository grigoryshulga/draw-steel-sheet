import { Icon } from "../components/Icons";
import { useMediaQuery } from "../lib/hooks";
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { LibraryHeader } from "../components/LibraryHeader";
import { READING_CATALOG } from "../rules/consumer-reading";
import { catalogLink, readCodexLocation } from "../lib/codex";
import { useCodexBookmarks } from "../lib/codex-bookmarks";
import { Button, EmptyState } from "../components/ui";
import { SearchInput } from "../components/ui/SearchInput";
import { PaginatedResults } from "../components/ui/PaginatedResults";
import { ReadingSkeleton } from "../components/rules/ReadingSkeleton";
import { useReadingHistory } from "../components/rules/useReadingHistory";
import "./CodexView.css";
import {
  classLandings,
  codexArticleRedirect,
  classLandingHref,
  codexArticleHref,
  readingParts,
  bookChapterNumber,
  bookIndex as ruleIndex,
} from "../rules/codex-navigation";
import {
  loadRuleArticle,
  loadRuleSearchIndex,
  resolveRuleIndexEntry,
  ruleIndex as completeRuleIndex,
} from "../rules/repository";
import type { RuleArticle, RuleEntity, RuleIndexEntry, RuleSearchIndex } from "../rules/schema";
import {
  createRuleSearcher,
  createSearchSequencer,
  normalizeSearchText,
  type RuleSearchOptions,
} from "../rules/search";
import { RuleArticleContent } from "../components/rules/RuleArticle";
import { ArticleLanguageScope, useArticleLanguage, useLocale } from "../i18n/locale";
import { ArticleLanguageSwitch } from "../components/LanguageSwitch";
import { englishArticleHeadings } from "../components/rules/reader-headings";
import { readerLabel } from "../components/rules/reader-labels";
import { loadEnglishArticleTitles } from "../rules/repository";

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

function isEmptyArticle(article: RuleArticle): boolean {
  return article.blocks.every(
    (block) => block.type === "markdown" && !block.text.trim(),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка загрузки.";
}

export function CodexView() {
  const { locale, t } = useLocale();
  const [englishTitles, setEnglishTitles] = useState<Record<string, string>>({});
  useEffect(() => { if (locale === "en") loadEnglishArticleTitles().then(setEnglishTitles).catch(() => {}); }, [locale]);
  const displayTitle = (id: string, fallback: string) => locale === "en" ? englishTitles[id] || fallback : fallback;
  const displayGroup = (name: string) => {
    const matching = ruleIndex.find(item => item.title === name && englishTitles[item.id]);
    return matching && locale === "en" ? englishTitles[matching.id] : readerLabel(name, locale);
  };
  const compact = useMediaQuery("(max-width: 850px)");
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [location, setLocation] = useState(readCodexLocation);
  const [query, setQuery] = useState("");
  const needle = normalizeSearchText(useDeferredValue(query));

  const { bookmarks, toggleBookmark } = useCodexBookmarks();
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [content, setContent] = useState<ArticleContent>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  // Полный поисковый корпус приходит отдельным чанком только при первом поиске.
  const [corpusState, setCorpusState] = useState<{ locale: "ru" | "en"; data: RuleSearchIndex }>();
  const searchCorpus = corpusState?.locale === locale ? corpusState.data : null;
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
    () => resolveRuleIndexEntry(completeRuleIndex, location),
    [location],
  );
  const entryId = entry?.id ?? "";
  const redirect = entry && codexArticleRedirect(entry);
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
  const russianHeadings = entry?.headings ?? [];
  const loaded =
    content.status === "ready" && content.entryId === entryId
      ? content.data
      : undefined;
  const articleEnglishAvailable = Boolean(loaded && (loaded.article.englishEdition || loaded.article.originalDescription?.trim() || Object.values(loaded.entities).some(entity => entity.originalDescription?.trim())));
  const { language: articleLanguage, setLanguage: setArticleLanguage } = useArticleLanguage(entryId, articleEnglishAvailable);
  const headings = articleLanguage === "en" && loaded ? englishArticleHeadings(loaded.article, loaded.entities) : russianHeadings;
  const failure =
    content.status === "error" && content.entryId === entryId
      ? content
      : undefined;
  const loading = Boolean(entry) && !loaded && !failure;
  const { recentIds, clearHistory } = useReadingHistory(loaded ? entryId : undefined);
  const recentEntries = recentIds.flatMap((id) => {
    const article = ruleIndex.find((item) => item.id === id);
    return article ? [article] : [];
  });

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
    loadRuleSearchIndex(locale).then(
      (index) => {
        // Поздний ответ на прежний запрос не должен перезаписать новый.
        if (!active || !sequencer.current.isCurrent(token)) return;
        setCorpusState({ locale, data: index });
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
  }, [needle, searchCorpus, searchAttempt, locale]);

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
    ? [...searchMatches.map((match) => match.entry), ...ruleIndex.filter((item) =>
        locale === "en" && englishTitles[item.id] && normalizeSearchText(englishTitles[item.id]).includes(needle)
        && (!chapter || item.chapter === chapter) && (!group || item.group === group)
        && (!onlyBookmarks || bookmarks.includes(item.id))
        && !searchMatches.some((match) => match.entry.id === item.id))]
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
    if (redirect) {
      window.location.replace(redirect);
      return;
    }
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
  }, [entryId, redirect, attempt]);
  useEffect(() => {
    const change = () => setLocation(readCodexLocation());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const target = location.heading
      ? document.getElementById(location.heading)
      : document.getElementById(entry ? "codex-article" : "codex-catalog");
    let parent = target?.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    target?.scrollIntoView({ block: "start" });
  }, [location, entry, loaded]);
  const open = (id: string) => {
    window.location.hash = codexArticleHref(id);
  };

  const creatureSheet = entry?.director?.recordType === 'statblock'
    && ['monsters', 'retainers'].includes(entry.director.section);
  const bookmarkAction = entry && <Button
    size="sm"
    icon="bookmark"
    iconOnly
    aria-label={bookmarks.includes(entry.id) ? t("Удалить закладку", "Remove bookmark") : t("Добавить закладку", "Add bookmark")}
    variant={bookmarks.includes(entry.id) ? "soft" : "ghost"}
    aria-pressed={bookmarks.includes(entry.id)}
    onClick={() => toggleBookmark(entry.id)}
  >{bookmarks.includes(entry.id) ? t("В закладках", "Bookmarked") : t("В закладки", "Bookmark")}</Button>;

  return (
    <ArticleLanguageScope language={articleLanguage}>
    <div className="codex-view">
      <LibraryHeader title={t("Книга правил", "Rulebook")} />
      <div className="codex-layout">
        <aside className="codex-nav" aria-label={t("Разделы Кодекса", "Codex sections")}>
          <SearchInput
            aria-label={t("Поиск по всему Кодексу", "Search the Codex")}
            placeholder={t("Найти правило…", "Find a rule…")}
            value={query}
            shortcut
            onValueChange={(value) => {
              setQuery(value);
              if (entry) window.location.hash = catalogLink();
            }}
          />
          <div className="codex-nav-tabs">
            <Button
              size="sm"
              variant={!onlyBookmarks ? "soft" : "ghost"}
              onClick={() => browse()}
            >
              {t("Все главы", "All chapters")}
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
              {t("Закладки", "Bookmarks")} {bookmarks.length || ""}
            </Button>
          </div>
          {compact && <Button size="sm" variant="ghost" aria-expanded={chaptersOpen} aria-controls="codex-chapter-tree" onClick={() => setChaptersOpen(!chaptersOpen)}>{chaptersOpen ? t("Свернуть главы", "Collapse chapters") : t("Все главы и разделы", "All chapters and sections")}</Button>}
          <nav id="codex-chapter-tree" aria-label={t("Оглавление", "Contents")} hidden={compact && !chaptersOpen} onClick={(event) => {
            if (!(event.target as HTMLElement).closest("a")) return;
            setChaptersOpen(false);
            window.setTimeout(() => document.querySelector<HTMLElement>(".codex-main")?.focus({ preventScroll: true }), 0);
          }}>
            <a
              className={!chapter && !entry ? "is-active" : ""}
              href={catalogLink()}
              onClick={() => browse()}
            >
              {t("Оглавление", "Contents")}
            </a>
            {readingParts.map((part, partIndex) => (
              <div className="codex-part" key={part.id}>
                <p className="codex-part-title">
                  <span className="codex-part-number" aria-hidden="true">
                    {ROMAN[partIndex] ?? partIndex + 1}
                  </span>
                  {readerLabel(part.title, locale)}
                </p>
                {part.chapters.map((c) => (
                  <details key={c} open={chapter === c} className="codex-tree-chapter">
                    <summary>{bookChapterNumber(c)}. {readerLabel(c.replace(/^\d+\.\s*/, ""), locale)}</summary>
                    <div className="codex-tree-children">
                      {[
                        ...new Set(
                          ruleIndex
                            .filter((article) => article.chapter === c)
                            .map((article) => article.group),
                        ),
                      ].map((g, _index, groups) => {
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
                            {displayTitle(article.id, article.title)}
                          </a>
                        ));
                        return g && groups.length > 1 ? (
                          <details
                            key={g}
                            open={chapter === c && group === g}
                          >
                            <summary>{displayGroup(g)}</summary>
                            <div className="codex-tree-children">
                              {links}
                            </div>
                          </details>
                        ) : (
                          links
                        );
                      })}
                    </div>
                  </details>
                ))}
                {part.extras.map((extra) => (
                  <details
                    key={extra.id}
                    open={extra.articleIds.includes(entryId)}
                  >
                    <summary>{readerLabel(extra.title, locale)}</summary>
                    <div className="codex-tree-children">
                      {extra.articleIds.map((id) => (
                        <a
                          key={id}
                          href={codexArticleHref(id)}
                          aria-current={entry?.id === id ? "page" : undefined}
                        >
                          {displayTitle(id, articleTitle(id))}
                        </a>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ))}
            <a className="codex-nav-reference" href="#/reference/">
              {t("Справочник: классы, каталоги, глоссарий", "Reference: classes, catalogs, glossary")} <Icon name="arrow-right" size={16} />
            </a>
          </nav>
          <a
            className="codex-source muted small"
            href="https://github.com/grigoryshulga/drawsteel-ru"
            target="_blank"
            rel="noreferrer"
          >
            {t("Исходный перевод", "Source translation")} ↗
          </a>
        </aside>
        <div className="codex-main" tabIndex={-1}>
          {entry ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon="arrow-left"
                iconOnly
                aria-label={t("К оглавлению", "Back to contents")}
                onClick={() => {
                  browse();
                }}
              >
                <Icon name="arrow-left" size={16} /> {t("К оглавлению", "Back to contents")}
              </Button>
              <article id="codex-article" className="codex-article" lang={articleLanguage}>
                <div className="codex-article-tools">
                  <nav className="codex-breadcrumb" aria-label={t("Путь статьи", "Article path")}>
                    <a href={catalogLink()} onClick={() => browse()}>
                      {t("Оглавление", "Contents")}
                    </a>
                    <span>/</span>
                    <a
                      href={catalogLink(chapter)}
                      onClick={() => browse(chapter)}
                    >
                      {readerLabel(chapter.replace(/^\d+\.\s*/, ""), articleLanguage)}
                    </a>
                    {group && (
                      <>
                        <span>/</span>
                        <a
                          href={catalogLink(chapter, group)}
                          onClick={() => browse(chapter, group)}
                        >
                          {displayGroup(group)}
                        </a>
                      </>
                    )}
                  </nav>
                  {articleEnglishAvailable && <ArticleLanguageSwitch language={articleLanguage} setLanguage={setArticleLanguage} />}
                  {loaded && !articleEnglishAvailable && locale === "en" && <span className="muted small" lang="en">Russian text only</span>}
                </div>
                {(!creatureSheet || !loaded) && <header className="codex-article-head">
                  <div>
                    <h1>{articleLanguage === "en" ? loaded?.article.englishEdition?.title || loaded?.article.originalName || englishTitles[entry.id] || entry.title : entry.title}</h1>
                    {articleLanguage === "ru" && loaded?.article.originalName && (
                      <p className="codex-original-title">
                        {loaded.article.originalName}
                      </p>
                    )}
                  </div>
                  {bookmarkAction}
                </header>}
                {headings.length > 0 && (
                  <section className="codex-inline-toc">
                    <h3>{articleLanguage === "en" ? "In this article" : "В этой статье"} · {headings.length}</h3>
                    {headings.map((heading, i) => (
                      <a
                        key={`${heading.id}-${i}`}
                        href={`#/codex/${entry.id}/${encodeURIComponent(heading.id)}`}
                      >
                        {heading.title.replace(/\*\*/g, "").trim()}
                      </a>
                    ))}
                  </section>
                )}
                {READING_CATALOG.some((item) => item.articleId === entry.id && item.kind === "project") && (
                  <Suspense fallback={null}>
                    <ArticleCatalogActions articleId={entry.id} />
                  </Suspense>
                )}
                {loading && (
                  <ReadingSkeleton label={t("Загружаем статью…", "Loading article…")} />
                )}
                {failure && (
                  <div className="codex-state codex-state-error" role="alert">
                    <h2>{t("Не удалось загрузить статью", "Could not load article")}</h2>
                    <p>
                      {t("Проверьте подключение и попробуйте снова. Если ошибка повторяется, откройте другую статью Кодекса.", "Check your connection and try again, or open another article.")}
                    </p>
                    <p className="muted small">{failure.message}</p>
                    <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
                      {t("Повторить", "Retry")}
                    </Button>
                  </div>
                )}
                {loaded &&
                  (isEmptyArticle(loaded.article) && !(articleLanguage === "en" && loaded.article.originalDescription) ? (
                    <p className="muted" role="status">
                      {t("Эта статья пока не заполнена в исходном переводе.", "This article is empty in the source translation.")}
                    </p>
                  ) : (
                    <RuleArticleContent
                      article={loaded.article}
                      entities={loaded.entities}
                      headingOffset={creatureSheet ? -1 : 0}
                      headingActions={creatureSheet ? bookmarkAction : undefined}
                    />
                  ))}
                {loaded && entry.id === "0701" && (
                  <section
                    className="codex-class-overview"
                    aria-labelledby="codex-class-overview-title"
                  >
                    <h2 id="codex-class-overview-title">{t("Десять классов", "Ten classes")}</h2>
                    <p className="muted">
                      {t("Полные описания с особенностями, способностями и всеми десятью уровнями — в Справочнике.", "Find full descriptions, features, abilities and all ten levels in the Reference.")}
                    </p>
                    <div className="codex-class-grid">
                      {classLandings.map((landing) => (
                        <a
                          className="codex-class-card"
                          key={landing.classId}
                          href={classLandingHref(landing.slug)}
                        >
                          <strong>{readerLabel(landing.name, articleLanguage)}</strong>
                          <span className="muted">
                            {landing.levelArticleIds.length} {t("уровней", "levels")}
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
                      icon="arrow-left"
                      iconOnly
                      aria-label={`${t("Предыдущая статья", "Previous article")}: ${displayTitle(siblings[position - 1].id, siblings[position - 1].title)}`}
                      onClick={() => open(siblings[position - 1].id)}
                    >
                      <Icon name="arrow-left" size={16} /> {displayTitle(siblings[position - 1].id, siblings[position - 1].title)}
                    </Button>
                  )}
                  {position < siblings.length - 1 && (
                    <Button
                      size="sm"
                      icon="chevron-right"
                      iconOnly
                      aria-label={`${t("Следующая статья", "Next article")}: ${displayTitle(siblings[position + 1].id, siblings[position + 1].title)}`}
                      onClick={() => open(siblings[position + 1].id)}
                    >
                      {displayTitle(siblings[position + 1].id, siblings[position + 1].title)} <Icon name="arrow-right" size={16} />
                    </Button>
                  )}
                </footer>
              </article>
            </>
          ) : missingArticle ? (
            <div className="codex-state codex-state-missing" role="alert">
              <h2>{t("Статья не найдена", "Article not found")}</h2>
              <p>
                {t("Возможно, ссылка устарела или содержит опечатку. Вернитесь к оглавлению и выберите статью заново.", "This link may be outdated or mistyped. Return to the contents and choose an article.")}
              </p>
              <Button size="sm" onClick={() => browse()}>
                {t("К оглавлению", "Back to contents")}
              </Button>
            </div>
          ) : (
            <>
              <div id="codex-catalog" className="codex-results-heading">
                <div>
                  <span className="eyebrow">
                    {needle
                      ? t("По всему Кодексу", "Across the Codex")
                      : onlyBookmarks
                        ? t("Ваша библиотека", "Your library")
                        : t("Библиотека правил", "Rules library")}
                  </span>
                  <h2>
                    {needle
                      ? t("Результаты поиска", "Search results")
                      : onlyBookmarks
                        ? t("Закладки", "Bookmarks")
                        : displayGroup(group) ||
                          readerLabel(chapter.replace(/^\d+\.\s*/, ""), locale) ||
                          t("Оглавление", "Contents")}
                  </h2>
                  {(needle || onlyBookmarks) && (
                    <p className="muted" role="status">
                      {searchPending
                        ? t("Ищем по всему Кодексу…", "Searching the Codex…")
                        : `${t("Найдено статей", "Articles found")}: ${resultEntries.length}`}
                    </p>
                  )}
                </div>
                {chapter && (
                  <a
                    href={catalogLink(group ? chapter : "")}
                    onClick={() => browse(group ? chapter : "")}
                  >
                    <Icon name="arrow-left" size={16} /> {group ? t("К главе", "Back to chapter") : t("Оглавление", "Contents")}
                  </a>
                )}
              </div>
              {searchPending && (
                <ReadingSkeleton label={t("Загружаем полный текст правил для поиска…", "Loading rules search…")} />
              )}
              {searchFailed && (
                <div
                  className="codex-state codex-state-error codex-state-search"
                  role="alert"
                >
                  <h2>{t("Не удалось загрузить поиск", "Could not load search")}</h2>
                  <p>
                    {t("Браузер не получил поисковый индекс. Проверьте подключение и попробуйте снова — чтение статей работает без него.", "The search index could not be loaded. Check your connection and try again; articles remain available.")}
                  </p>
                  <p className="muted small">{searchFailure}</p>
                  <Button
                    size="sm"
                    onClick={() => setSearchAttempt((n) => n + 1)}
                  >
                    {t("Повторить поиск", "Retry search")}
                  </Button>
                </div>
              )}
              {showEmptyState && (
                <EmptyState
                  icon={onlyBookmarks && !needle ? "bookmark" : "search"}
                  title={onlyBookmarks && !needle ? t("Здесь будут ваши закладки", "Your bookmarks will appear here") : t("Ничего не найдено", "Nothing found")}
                  text={onlyBookmarks && !needle ? t("Откройте статью и нажмите «В закладки».", "Open an article and select Bookmark.") : t("Попробуйте другое название или более короткий запрос.", "Try another title or a shorter search.")}
                  action={needle ? <Button onClick={() => setQuery("")}>{t("Сбросить поиск", "Clear search")}</Button> : undefined}
                />
              )}
              {!needle && !onlyBookmarks && (
                <>
                  {!chapter && recentEntries.length > 0 && (
                    <section className="codex-recent" aria-labelledby="codex-recent-title">
                      <header>
                        <h3 id="codex-recent-title">
                          <Icon name="history" size={18} aria-hidden="true" /> {t("Недавно открытые", "Recently opened")}
                        </h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="close"
                          iconOnly
                          aria-label={t("Очистить историю чтения", "Clear reading history")}
                          title={t("Очистить историю чтения", "Clear reading history")}
                          onClick={clearHistory}
                        />
                      </header>
                      <div className="codex-recent-grid">
                        {recentEntries.map((article) => (
                          <a key={article.id} href={codexArticleHref(article.id)}>
                            <span>
                              <strong>{displayTitle(article.id, article.title)}</strong>
                              <small>{readerLabel(article.chapter.replace(/^\d+\.\s*/, ""), locale)}</small>
                            </span>
                            <Icon name="arrow-right" size={16} aria-hidden="true" />
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                  <a className="codex-reference-banner" href="#/reference/">
                    <span>
                      <strong>{t("Справочник", "Reference")}</strong> — {t("классы, происхождения, карьеры, комплекты, перки, каталоги наград и глоссарий", "classes, ancestries, careers, kits, perks, rewards and glossary")}
                    </span>
                    <Icon name="arrow-right" size={16} />
                  </a>
                  {readingParts.map((part, partIndex) => (
                    <section
                      className="codex-part-collection"
                      key={part.id}
                    >
                      <div className="codex-part-head">
                        <span className="eyebrow">
                          {t("Часть", "Part")} {ROMAN[partIndex] ?? partIndex + 1}
                        </span>
                        <h2>{readerLabel(part.title, locale)}</h2>
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
                                {t("Глава", "Chapter")} {String(bookChapterNumber(name)).padStart(2, "0")}
                              </span>
                              <h3>
                                <a href={catalogLink(name)}>
                                  {readerLabel(name.replace(/^\d+\.\s*/, ""), locale)}
                                </a>
                              </h3>
                              {sections.length ? (
                                <nav
                                  className="codex-section-links"
                                  aria-label={name}
                                >
                                  {sections.slice(0, 3).map((section) => (
                                    <a
                                      key={displayGroup(section)}
                                      href={catalogLink(name, section)}
                                    >
                                      {displayGroup(section)}
                                    </a>
                                  ))}
                                </nav>
                              ) : (
                                <p>
                                  {entries
                                    .slice(0, 3)
                                    .map((article) => displayTitle(article.id, article.title))
                                    .join(" · ")}
                                </p>
                              )}
                            </section>
                          );
                        })}
                        {part.extras.map((extra) => (
                          <section className="codex-collection" key={extra.id}>
                            <span className="eyebrow">{t("Подборка", "Collection")}</span>
                            <h3>
                              <a href={codexArticleHref(extra.articleIds[0])}>
                                {readerLabel(extra.title, locale)}
                              </a>
                            </h3>
                            <p>
                              {extra.articleIds
                                .slice(0, 3)
                                .map((id) => displayTitle(id, articleTitle(id)))
                                .join(" · ")}
                            </p>
                          </section>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
              {(needle || onlyBookmarks) && resultEntries.length > 0 && !searchPending && (
                <PaginatedResults
                  key={JSON.stringify([needle, onlyBookmarks, chapter, group, bookmarks])}
                  items={resultEntries}
                  label={t("Статьи", "Articles")}
                >
                  {(pageItems) => (
                    <div className="codex-results">
                      {pageItems.map((article) => {
                        const excerpt = excerptById.get(article.id) ?? "";
                        return (
                          <a
                            className="codex-result"
                            key={article.id}
                            href={codexArticleHref(article.id)}
                          >
                            <span className="eyebrow">
                              {readerLabel(article.chapter, locale)}
                              {article.group && ` / ${displayGroup(article.group)}`}
                            </span>
                            <h3>{displayTitle(article.id, article.title)}</h3>
                            {needle && <p>{excerpt}…</p>}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </PaginatedResults>
              )}
            </>
          )}
        </div>
        {entry && headings.length > 0 && (
          <nav className="codex-toc" aria-label={articleLanguage === "en" ? "In this article" : "В этой статье"}>
            <span className="eyebrow">{articleLanguage === "en" ? "In this article" : "В этой статье"}</span>
            {headings.map((heading, i) => (
              <a
                key={`${heading.id}-${i}`}
                style={{ paddingLeft: heading.level > 2 ? 12 : 0 }}
                aria-current={
                  location.heading === heading.id ? "location" : undefined
                }
                href={`#/codex/${entry.id}/${encodeURIComponent(heading.id)}`}
              >
                {heading.title.replace(/\*\*/g, "").trim()}
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
    </ArticleLanguageScope>
  );
}
