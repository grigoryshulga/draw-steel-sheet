import { useDeferredValue, useEffect, useMemo, useState } from "react";
import raw from "../data/codex.generated.json";
import {
  CODEX_INDEX,
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
  const [chapter, setChapter] = useState("");
  const [group, setGroup] = useState("");
  const [bookmarks, setBookmarks] = useState(readBookmarks);
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const article = articles.find((a) => a.id === location.articleId);
  const position = article ? articles.indexOf(article) : -1;
  const headings =
    CODEX_INDEX.find((a) => a.id === article?.id)?.headings ?? [];
  const groups = chapter
    ? [
        ...new Set(
          articles
            .filter((a) => a.chapter === chapter)
            .map((a) => a.group)
            .filter(Boolean),
        ),
      ]
    : [];
  const results = useMemo(
    () =>
      articles
        .filter(
          (a, i) =>
            (!chapter || a.chapter === chapter) &&
            (!group || a.group === group) &&
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
      : document.getElementById("codex-article");
    target?.scrollIntoView({ block: "start" });
  }, [location]);
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
            Кодекс правил
          </h1>
        </div>
      </header>
      <div className="codex-layout">
        <aside className="codex-nav" aria-label="Разделы Кодекса">
          <TextInput
            type="search"
            aria-label="Поиск по всему Кодексу"
            placeholder="Найти правило…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="codex-nav-tabs">
            <Button
              size="sm"
              variant={!onlyBookmarks ? "soft" : "ghost"}
              onClick={() => setOnlyBookmarks(false)}
            >
              Все главы
            </Button>
            <Button
              size="sm"
              variant={onlyBookmarks ? "soft" : "ghost"}
              onClick={() => setOnlyBookmarks(true)}
            >
              Закладки {bookmarks.length || ""}
            </Button>
          </div>
          <nav>
            <button
              className={!chapter ? "is-active" : ""}
              onClick={() => {
                setChapter("");
                setGroup("");
              }}
            >
              Весь Кодекс
            </button>
            {chapters.map((c) => (
              <button
                className={chapter === c ? "is-active" : ""}
                key={c}
                onClick={() => {
                  setChapter(c);
                  setGroup("");
                }}
              >
                {c}
              </button>
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
                  window.location.hash = "/codex";
                }}
              >
                ← К оглавлению
              </Button>
              <article id="codex-article" className="codex-article">
                <div className="codex-breadcrumb">
                  {article.chapter}
                  {article.group && ` / ${article.group}`}
                </div>
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
                      onClick={() => open(articles[position - 1].id)}
                    >
                      ← {articles[position - 1].title}
                    </Button>
                  )}
                  {position < articles.length - 1 && (
                    <Button
                      size="sm"
                      onClick={() => open(articles[position + 1].id)}
                    >
                      {articles[position + 1].title} →
                    </Button>
                  )}
                </footer>
              </article>
            </>
          ) : (
            <>
              <div className="codex-results-heading">
                <h2>
                  {needle
                    ? "Результаты поиска"
                    : chapter || (onlyBookmarks ? "Закладки" : "Оглавление")}
                </h2>
              </div>
              {results.length === 0 && (
                <p className="muted">Ничего не найдено.</p>
              )}
              {groups.length > 0 && (
                <div className="codex-groups" aria-label="Разделы главы">
                  <Button
                    size="sm"
                    variant={!group ? "soft" : "ghost"}
                    onClick={() => setGroup("")}
                  >
                    Вся глава
                  </Button>
                  {groups.map((g) => (
                    <Button
                      key={g}
                      size="sm"
                      variant={group === g ? "soft" : "ghost"}
                      onClick={() => setGroup(g)}
                    >
                      {g}
                    </Button>
                  ))}
                </div>
              )}
              <div className="codex-results">
                {results.map((a) => {
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
