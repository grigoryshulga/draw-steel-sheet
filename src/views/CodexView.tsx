import { useDeferredValue, useEffect, useMemo, useState } from "react";
import raw from "../data/codex.generated.json";
import {
  catalogLink,
  headingId,
  readCodexLocation,
  searchText,
  type RuleArticle,
} from "../lib/codex";
import { RuleText } from "../components/RuleText";
import { Button, TextInput } from "../components/ui";
import { Icon } from "../components/Icons";
import "./CodexView.css";
import { ArtworkFigure } from "../components/Artwork";
import { artForArticle } from "../lib/art";

const articles: RuleArticle[] = raw;
const chapters = [...new Set(articles.map((a) => a.chapter))];
const searchable = articles.map((a) =>
  searchText(`${a.title} ${a.group} ${a.markdown}`),
);

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

export function CodexView() {
  const [location, setLocation] = useState(readCodexLocation);
  const [query, setQuery] = useState("");
  const needle = searchText(useDeferredValue(query).trim());

  const [bookmarks, setBookmarks] = useState(readBookmarks);
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const article = articles.find((a) => a.id === location.articleId);
  const chapter = article?.chapter || location.chapter;
  const group = article?.group || location.group;
  const siblings = articles.filter(
    (a) => a.chapter === chapter && a.group === group,
  );
  const position = article ? siblings.indexOf(article) : -1;
  const headings = [
    ...(article?.markdown || "").matchAll(/^(#{1,6})\s+(.+)$/gm),
  ].map((m) => ({
    title: m[2].replace(/\*\*/g, ""),
    id: headingId(m[2]),
    level: m[1].length,
  }));
  const groups = [
    ...new Set(
      articles
        .filter((a) => a.chapter === chapter)
        .map((a) => a.group)
        .filter(Boolean),
    ),
  ];
  const browse = (c = "", g = "") => {
    setQuery("");
    setOnlyBookmarks(false);
    window.location.hash = catalogLink(c, g);
  };
  const results = useMemo(
    () =>
      articles
        .filter(
          (a, i) =>
            (needle || onlyBookmarks || !chapter || a.chapter === chapter) &&
            (needle || onlyBookmarks || !group || a.group === group) &&
            (!onlyBookmarks || bookmarks.includes(a.id)) &&
            (!needle ||
              needle
                .split(/\s+/)
                .every((word) => searchable[i].includes(word))),
        )
        .sort((a, b) => {
          if (!needle) return 0;
          const relevance = (article: RuleArticle) => {
            const title = searchText(article.title);
            return (
              (title === needle ? 10 : title.includes(needle) ? 5 : 0) +
              (searchText(article.group).includes(needle) ? 2 : 0)
            );
          };
          return relevance(b) - relevance(a);
        }),
    [chapter, group, onlyBookmarks, bookmarks, needle],
  );

  useEffect(() => {
    const change = () => setLocation(readCodexLocation());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const target = location.heading
      ? document.getElementById(location.heading)
      : document.getElementById(article ? "codex-article" : "codex-catalog");
    target?.scrollIntoView({ block: "start" });
  }, [location, article]);
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
      <header className="page-head">
        <div>
          <h1 className="page-title">
            <Icon name="book" size={26} />
            Кодекс знаний
          </h1>
          <p className="muted">
            Правила Draw Steel — от первого героя до последней битвы.
          </p>
        </div>
      </header>
      <div className="codex-layout">
        <aside className="codex-nav" aria-label="Разделы Кодекса">
          <TextInput
            type="search"
            aria-label="Поиск по всему Кодексу"
            placeholder="Найти правило…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (article) window.location.hash = catalogLink();
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
              className={!chapter && !article ? "is-active" : ""}
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
                    href={catalogLink(c)}
                    onClick={() => browse(c)}
                    className={
                      chapter === c && !group && !article ? "is-active" : ""
                    }
                  >
                    Обзор главы
                  </a>
                  {[
                    ...new Set(
                      articles
                        .filter((a) => a.chapter === c)
                        .map((a) => a.group),
                    ),
                  ].map((g) => {
                    const entries = articles.filter(
                      (a) => a.chapter === c && a.group === g,
                    );
                    const links = entries.map((a) => (
                      <a
                        key={a.id}
                        href={`#/codex/${a.id}`}
                        aria-current={article?.id === a.id ? "page" : undefined}
                      >
                        {a.title}
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
                              chapter === c && group === g && !article
                                ? "is-active"
                                : ""
                            }
                          >
                            Обзор: {g}
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
          {article ? (
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
                  <h1>{article.title}</h1>
                  <Button
                    size="sm"
                    variant={bookmarks.includes(article.id) ? "soft" : "ghost"}
                    aria-pressed={bookmarks.includes(article.id)}
                    onClick={() => toggleBookmark(article.id)}
                  >
                    {bookmarks.includes(article.id)
                      ? "В закладках"
                      : "В закладки"}
                  </Button>
                </header>
                {headings.length > 0 && (
                  <details className="codex-inline-toc">
                    <summary>В этой статье · {headings.length}</summary>
                    {headings.map((h, i) => (
                      <a
                        key={i}
                        href={`#/codex/${article.id}/${encodeURIComponent(h.id)}`}
                      >
                        {h.title}
                      </a>
                    ))}
                  </details>
                )}
                <ArtworkFigure
                  art={artForArticle(article.id)}
                  className="codex-article-art"
                />
                {!article.markdown.trim() ? (
                  <p className="muted">
                    Эта статья пока не заполнена в исходном переводе.
                  </p>
                ) : (
                  <RuleText text={article.markdown} />
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
                      ? `Найдено статей: ${results.length}`
                      : !chapter
                        ? `${chapters.length} глав · ${articles.length} статей. Выберите главу, чтобы начать чтение.`
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
              {results.length === 0 && (
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
              {!needle &&
                !onlyBookmarks &&
                (!chapter || (!group && groups.length > 0)) && (
                  <div className="codex-collections">
                    {(!chapter ? chapters : groups).map((name, i) => {
                      const entries = articles.filter((a) =>
                        !chapter
                          ? a.chapter === name
                          : a.chapter === chapter && a.group === name,
                      );
                      const art = artForArticle(entries[0].id);
                      return (
                        <a
                          className="codex-collection"
                          key={name}
                          href={
                            !chapter
                              ? catalogLink(name)
                              : catalogLink(chapter, name)
                          }
                        >
                          <span className="eyebrow">
                            {!chapter
                              ? `Глава ${String(i + 1).padStart(2, "0")}`
                              : chapter.includes("Классы")
                                ? "Класс героя"
                                : "Раздел"}
                          </span>
                          {art && (
                            <img
                              src={art.thumbnailSrc ?? art.src}
                              alt=""
                              loading="lazy"
                            />
                          )}
                          <h3>{name.replace(/^\d+\.\s*/, "")}</h3>
                          <p>
                            {entries
                              .slice(0, 3)
                              .map((a) => a.title)
                              .join(" · ")}
                          </p>
                          <span className="codex-collection-footer">
                            Статей: {entries.length}
                            <span aria-hidden="true">↗</span>
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              <div className="codex-results">
                {results
                  .filter(
                    (a) =>
                      needle ||
                      onlyBookmarks ||
                      (chapter && (group || !a.group)),
                  )
                  .map((a) => {
                    const art = artForArticle(a.id);
                    const normalized = searchText(a.markdown);
                    const match = needle
                      ? normalized.indexOf(needle.split(/\s+/)[0])
                      : -1;
                    const start = Math.max(0, match - 55);
                    const excerpt = a.markdown
                      .slice(start, start + 200)
                      .replace(/[#*>_`|]/g, "")
                      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
                    return (
                      <a
                        className={`codex-result ${art ? "with-art" : ""}`}
                        key={a.id}
                        href={`#/codex/${a.id}`}
                      >
                        {art && (
                          <span
                            className="artwork codex-result-art"
                            aria-hidden="true"
                          >
                            <img
                              src={art.thumbnailSrc ?? art.src}
                              width={art.width}
                              height={art.height}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                        )}
                        <span className="eyebrow">
                          {a.chapter}
                          {a.group && ` / ${a.group}`}
                        </span>
                        <h3>{a.title}</h3>
                        {needle && (
                          <p>
                            {start > 0 && "…"}
                            {excerpt}…
                          </p>
                        )}
                      </a>
                    );
                  })}
              </div>
            </>
          )}
        </div>
        {article && headings.length > 0 && (
          <nav className="codex-toc" aria-label="В этой статье">
            <span className="eyebrow">В этой статье</span>
            {headings.map((h, i) => (
              <a
                key={`${h.id}-${i}`}
                style={{ paddingLeft: h.level > 2 ? 12 : 0 }}
                aria-current={
                  location.heading === h.id ? "location" : undefined
                }
                href={`#/codex/${article.id}/${encodeURIComponent(h.id)}`}
              >
                {h.title.replace(/\*\*/g, "")}
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
