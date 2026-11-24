import { englishClassBasics } from "../rules/english-class-basics";
import { localizeGameMessage } from "../i18n/game-messages";
import { useLocale, useArticleLanguage, ArticleLanguageScope, useArticleLocale } from "../i18n/locale";
import { readerLabel } from "../components/rules/reader-labels";
import { ArticleLanguageSwitch } from "../components/LanguageSwitch";
import { Icon } from "../components/Icons";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { CharacteristicGlyph } from "../components/CharacteristicGlyph";
import { CardDetailModal } from "../components/CardDetailModal";
import { RuleArticleContent } from "../components/rules/RuleArticle";
import { RuleEntityView } from "../components/rules/RuleEntity";
import { RuleMarkdown } from "../components/rules/RuleMarkdown";
import { Button, Chip } from "../components/ui";
import { actionLabel, kindLabel } from "../data/actions";
import { classPreset } from "../data/classes";
import { artFor, artworkCredit } from "../lib/art";
import { CHARACTERISTICS } from "../lib/rule-display";
import { useCodexBookmarks } from "../lib/codex-bookmarks";
import { useLibraryLocation } from "../lib/library-location";
import {
  classLandings,
  classLandingBySlug,
} from "../rules/codex-navigation";
import {
  loadRuleArticle,
  loadRuleEntity,
} from "../rules/repository";
import type { RuleArticle, RuleEntity } from "../rules/schema";
import type { CharacteristicKey } from "../types";
import "./CodexView.css";
import "./ClassLandingView.css";

interface LandingLevel {
  level: number;
  article: RuleArticle;
  entities: Record<string, RuleEntity>;
}

type LandingState =
  | { status: "loading" }
  | {
      status: "ready";
      classEntity: RuleEntity;
      levels: LandingLevel[];
    }
  | { status: "error"; message: string };

const CLASS_HEROES: Record<string, { file: string; focus: string }> = {
  censor: { file: "censor", focus: "50% 14%" },
  conduit: { file: "conduit", focus: "50% 14%" },
  elementalist: { file: "elementalist", focus: "50% 14%" },
  fury: { file: "khorva", focus: "50% 30%" },
  null: { file: "null", focus: "50% 14%" },
  shadow: { file: "gwillyth", focus: "50% 18%" },
  summoner: { file: "summoner", focus: "50% 18%" },
  tactician: { file: "tactician", focus: "50% 14%" },
  talent: { file: "talent", focus: "50% 26%" },
  troubadour: { file: "troubadour", focus: "50% 26%" },
};

/** Сводка класса — первый раздел сущности; остальное живёт в уровнях. */
function classSummary(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) =>
    /^####\s+Сводка\s*$/.test(line.trim()),
  );
  if (start === -1) return "";
  let end = start + 1;
  while (end < lines.length && !/^#{1,4}\s+/.test(lines[end].trim())) {
    end += 1;
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка загрузки.";
}

/** Раздел из адреса #level-N; без якоря открываются «Основы». */
function levelFromAnchor(anchor: string): number {
  const match = /^level-(\d+)$/.exec(anchor);
  return match ? Number(match[1]) : 0;
}

/** Секция «Основы» сущности класса — запасной вариант для блока «Основы». */
function classBasics(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) =>
    /^####\s+Основы\s*$/.test(line.trim()),
  );
  if (start === -1) return "";
  let end = start + 1;
  while (end < lines.length && !/^#{1,4}\s+/.test(lines[end].trim())) {
    end += 1;
  }
  return lines.slice(start, end).join("\n").trim();
}

/** Секция «Основы» статьи 1-го уровня: там же таблица развития. */
function levelArticleBasics(article: RuleArticle): string {
  const block = article.blocks.find(
    (item) =>
      item.type === "markdown" && /^##\s+Основы\s*$/m.test(item.text),
  );
  if (!block || block.type !== "markdown") return "";
  const lines = block.text.split("\n");
  const start = lines.findIndex((line) =>
    /^##\s+Основы\s*$/.test(line.trim()),
  );
  if (start === -1) return "";
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s+/.test(lines[end].trim())) {
    end += 1;
  }
  return lines.slice(start, end).join("\n").trim();
}

/** Убирает флейвор из начала статьи уровня: он уже есть в шапке класса. */
function stripLeadingFlavor(
  article: RuleArticle,
  flavor: string,
): RuleArticle {
  const needle = flavor.trim();
  const [first, ...rest] = article.blocks;
  if (!needle || !first || first.type !== "markdown") return article;
  const text = first.text;
  if (!text.trimStart().startsWith(needle)) return article;
  return {
    ...article,
    blocks: [
      {
        ...first,
        text: text.slice(text.indexOf(needle) + needle.length).replace(/^\s+/, ""),
      },
      ...rest,
    ],
  };
}

/** Убирает markdown-секцию с указанным заголовком. */
function withoutMarkdownSection(text: string, heading: RegExp): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => heading.test(line.trim()));
  if (start === -1) return text;
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s+/.test(lines[end].trim())) {
    end += 1;
  }
  return [...lines.slice(0, start), ...lines.slice(end)]
    .join("\n")
    .trim();
}

/** 1-й уровень без флейвора и «Основ»: они ушли в шапку и блок «Основы». */
function prepareLevelOne(article: RuleArticle, flavor: string): RuleArticle {
  const withoutFlavor = stripLeadingFlavor(article, flavor);
  return {
    ...withoutFlavor,
    blocks: withoutFlavor.blocks.map((block) =>
      block.type === "markdown"
        ? {
            ...block,
            text: withoutMarkdownSection(block.text, /^##\s+Основы\s*$/),
          }
        : block,
    ),
  };
}

function basicsSets(markdown: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) =>
    /^\*\*(?:Начальные характеристики|Starting Characteristics):\*\*/.test(line.trim()),
  );
  if (start === -1) return [];
  const sets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const value = line.trim();
    if (/^-\s+[−–-]?\d/.test(value)) {
      sets.push(value.replace(/^-\s+/, ""));
      continue;
    }
    if (sets.length > 0 && /^\*\*[^*]+:\*\*/.test(value)) break;
  }
  return sets;
}

function basicsSkills(markdown: string): string {
  const label = /^\*\*(?:Навыки|Skills):\*\*/m.exec(markdown);
  if (!label) return "";
  return markdown.slice(label.index + label[0].length)
    .split(/\n(?:\*\*[^*\n]+:\*\*|#{1,6}\s)/, 1)[0].trim();
}

/** Только таблица развития, без её заголовка. */
function developmentTable(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) =>
    /^#{2,6}\s+(?:Таблица развития|.+ Advancement)/i.test(line.trim()),
  );
  if (start === -1) return "";
  let end = start + 1;
  while (end < lines.length && !/^#{1,6}\s+/.test(lines[end].trim())) {
    end += 1;
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

interface DevelopmentTableData {
  headers: string[];
  rows: { level: string; cells: string[][] }[];
}

function splitTableCell(value: string): string[] {
  const cleaned = value
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
  if (!cleaned || cleaned === "—" || cleaned === "-") return [];
  return cleaned
    .split(/\s*,\s*/)
    .map((item) => item.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

function parseDevelopmentTable(markdown: string): DevelopmentTableData | null {
  const rows = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (rows.length < 3) return null;
  const cellsOf = (line: string) =>
    line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim().replace(/<br\s*\/?>/gi, " "));
  const headers = cellsOf(rows[0]);
  const body = rows
    .slice(1)
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
    .map((line) => {
      const cells = cellsOf(line);
      return {
        level: cells[0].replace(/[^\d]/g, "") || cells[0],
        cells: cells.slice(1).map(splitTableCell),
      };
    });
  return headers.length > 1 && body.length > 0 ? { headers, rows: body } : null;
}

function DevelopmentTable({ data }: { data: DevelopmentTableData }) {
  const columnCount = Math.max(1, data.headers.length - 1);
  return (
    <div
      className="class-development"
      style={{ "--dev-cols": columnCount } as CSSProperties}
    >
      <div className="class-development-head" aria-hidden="true">
        <span />
        <div className="class-development-cells">
          {data.headers.slice(1).map((header) => (
            <span key={header} className="class-development-head-label">
              {header}
            </span>
          ))}
        </div>
      </div>
      {data.rows.map((row) => (
        <div className="class-development-row" key={row.level}>
          <span className="class-development-level">{row.level}</span>
          <div className="class-development-cells">
            {Array.from({ length: columnCount }, (_, index) => {
              const items = row.cells[index] ?? [];
              return (
                <div className="class-development-cell" key={index}>
                  <span className="class-development-label">
                    {data.headers[index + 1]}
                  </span>
                  {items.length > 0 ? (
                    <div className="class-development-chips">
                      {items.map((item, itemIndex) => (
                        <span key={`${item}-${itemIndex}`}>{item}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="class-development-empty">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Наглядная страница «Основы»: стартовые значения, потенциал, ресурс и таблица. */
export function ClassBasics({
  name,
  basics,
  articleId,
  edition,
}: {
  edition?: ReturnType<typeof englishClassBasics>;
  name: string;
  basics: string;
  articleId: string;
}) {
  const language = edition ? "en" : "ru";
  const label = (ru: string, en: string) => edition ? en : ru;
  const preset = classPreset(name);
  if (!preset) return <RuleMarkdown sourceLocale={language} text={basics} articleId={articleId} />;

  const sets = basicsSets(basics);
  const skills = basicsSkills(basics);
  const tableMarkdown = developmentTable(basics);
  const table = tableMarkdown ? parseDevelopmentTable(tableMarkdown) : null;
  const potency = CHARACTERISTICS.find(
    (characteristic) => characteristic.key === preset.potency,
  );

  return (
    <div className="class-basics">
      <div className="class-basics-grid">
        <section className="class-basics-card">
          <h3>{label("Стартовые характеристики", "Starting Characteristics")}</h3>
          <div className="class-basics-chars">
            {Object.entries(preset.starting).map(([key, value]) => {
              const characteristic = CHARACTERISTICS.find(
                (item) => item.key === key,
              );
              return (
                <span
                  className="class-basics-char"
                  key={key}
                  title={edition ? key : characteristic?.label}
                >
                  <CharacteristicGlyph language={language}
                    characteristic={key as CharacteristicKey}
                  />
                  <strong>+{value}</strong>
                </span>
              );
            })}
          </div>
          {sets.length > 0 && (
            <>
              <span className="class-basics-label">
                {label("Остальные — один из наборов", "Choose one array for your other scores")}
              </span>
              <div className="class-basics-set-list">
                {sets.map((set, index) => (
                  <span key={index}>{set}</span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="class-basics-card">
          <h3>{label("Потенциал", "Potency")}</h3>
          <dl className="class-basics-potency">
            <div>
              <dt>{label("Слабый", "Weak")}</dt>
              <dd title={edition ? preset.potency : potency?.label}>
                <CharacteristicGlyph language={language} characteristic={preset.potency} /> − 2
              </dd>
            </div>
            <div>
              <dt>{label("Средний", "Average")}</dt>
              <dd title={edition ? preset.potency : potency?.label}>
                <CharacteristicGlyph language={language} characteristic={preset.potency} /> − 1
              </dd>
            </div>
            <div>
              <dt>{label("Сильный", "Strong")}</dt>
              <dd title={edition ? preset.potency : potency?.label}>
                <CharacteristicGlyph language={language} characteristic={preset.potency} />
              </dd>
            </div>
          </dl>
        </section>

        <section className="class-basics-card">
          <h3>{label("Выносливость", "Stamina")}</h3>
          <div className="class-basics-stats">
            <div>
              <strong>{edition?.stamina ?? preset.staminaBase}</strong>
              <span>{label("на 1-м уровне", "at 1st level")}</span>
            </div>
            <div>
              <strong>+{edition?.growth ?? preset.staminaPerLevel}</strong>
              <span>{label("за уровень", "per level")}</span>
            </div>
            <div>
              <strong>{edition?.recoveries ?? preset.recoveries}</strong>
              <span>{label("Восстановлений", "Recoveries")}</span>
            </div>
          </div>
        </section>

        <section className="class-basics-card">
          <h3>{label("Ресурс", "Resource")}</h3>
          <p className="class-basics-resource">{localizeGameMessage(preset.resource, language)}</p>
          <p className="muted small">{label("Героический ресурс класса", "Heroic resource")}</p>
        </section>
      </div>

      {skills && (
        <section className="class-basics-card class-basics-skills">
          <h3>{label("Навыки", "Skills")}</h3>
          <RuleMarkdown sourceLocale={language} text={skills} articleId={articleId} />
        </section>
      )}

      {table ? (
        <section className="class-basics-card class-basics-table">
          <h3>{label("Таблица развития", "Advancement Table")}</h3>
          <DevelopmentTable data={table} />
        </section>
      ) : (
        tableMarkdown && (
          <section className="class-basics-card class-basics-table">
            <h3>{label("Таблица развития", "Advancement Table")}</h3>
            <RuleMarkdown sourceLocale={language} text={tableMarkdown} articleId={articleId} />
          </section>
        )
      )}
    </div>
  );
}

/**
 * Страница класса в Справочнике: сводка, особенности, способности и все
 * десять уровней одной лентой. Статьи «N-й Уровень» остаются каноническими —
 * сюда ведут их ссылки, а секции получают якоря level-1 … level-10.
 */
export function ClassLandingView({
  slug,
  embedded = false,
  creation = false,
}: {
  slug: string;
  embedded?: boolean;
  creation?: boolean;
}) {
  const landing = useMemo(() => classLandingBySlug(slug), [slug]);
  const { t } = useLocale();
  const [state, setState] = useState<LandingState>({ status: "loading" });
  const available = state.status === "ready" && Boolean(state.classEntity.originalDescription?.trim() || state.levels.some((item) => item.article.originalDescription?.trim() || Object.values(item.entities).some((entity) => entity.originalDescription?.trim())));
  const inherited = useArticleLocale();
  const { language, setLanguage } = useArticleLanguage(`class:${slug}`, available);
  const articleText = (ru: string, en: string) => language === "en" ? en : ru;
  const [attempt, setAttempt] = useState(0);
  const [openedAbility, setOpenedAbility] = useState<RuleEntity | null>(null);
  const { bookmarks, toggleBookmark } = useCodexBookmarks();
  const segments = useLibraryLocation();
  const anchor = creation ? "level-1" : decodeURIComponent(segments[3]?.split("#")[1] ?? "");
  const [selectedStep, setSelectedStep] = useState(() =>
    levelFromAnchor(anchor),
  );

  useEffect(() => {
    setSelectedStep(levelFromAnchor(anchor));
  }, [slug, anchor]);

  useEffect(() => {
    setOpenedAbility(null);
  }, [slug]);

  useEffect(() => {
    if (!landing) return;
    let active = true;
    setState({ status: "loading" });
    (async () => {
      const [classEntity, levelArticles] = await Promise.all([
        loadRuleEntity(landing.classId),
        Promise.all(
          landing.levelArticleIds.map((id) => loadRuleArticle(id)),
        ),
      ]);
      if (!active) return;
      setState({
        status: "ready",
        classEntity,
        levels: levelArticles.map((data, index) => ({
          level: index + 1,
          article: data.article,
          entities: data.entities,
        })),
      });
    })().catch((error: unknown) => {
      if (active)
        setState({ status: "error", message: errorMessage(error) });
    });
    return () => {
      active = false;
    };
  }, [landing, attempt]);

  useEffect(() => {
    if (embedded || state.status !== "ready") return;
    const target = anchor
      ? document.getElementById(anchor)
      : document.getElementById("class-landing");
    target?.scrollIntoView({ block: "start" });
  }, [state, anchor, embedded]);

  const index = classLandings.findIndex((c) => c.slug === slug);
  const summary =
    state.status === "ready"
      ? classSummary(state.classEntity.markdown)
      : "";
  const levelOne =
    state.status === "ready"
      ? state.levels.find((item) => item.level === 1)?.article
      : undefined;
  const basics =
    state.status === "ready"
      ? (levelOne ? levelArticleBasics(levelOne) : "") ||
        classBasics(state.classEntity.markdown)
      : "";
  const edition = useMemo(
    () => language === "en" && state.status === "ready"
      ? englishClassBasics(state.classEntity.originalDescription ?? "")
      : undefined,
    [language, state],
  );
  const prev = index > 0 ? classLandings[index - 1] : undefined;
  const next =
    index >= 0 && index < classLandings.length - 1
      ? classLandings[index + 1]
      : undefined;

  if (!landing)
    return (
      <div className="class-landing">
        <nav className="reference-breadcrumb" aria-label={t("Хлебные крошки", "Breadcrumbs")}>
          <a href="#/reference/">{t("Справочник", "Reference")}</a>
          <span aria-hidden="true">/</span>
          <a href="#/catalog/classes">{t("Классы", "Classes")}</a>
        </nav>
        <div className="codex-results-heading">
          <div>
            <h2>{t("Класс не найден", "Class not found")}</h2>
            <p className="muted">
              {t("Такого класса нет.", "This class does not exist.")} <a href="#/catalog/classes">{t("Список классов", "Class list")}</a>.
            </p>
          </div>
        </div>
      </div>
    );

  const art = artFor("class", landing.name);
  const bookmarked = bookmarks.includes(landing.classId);

  return (
    <ArticleLanguageScope language={language}>
    <div
      className={`class-landing${embedded ? " class-landing-embedded" : " codex-layout"}`}
      id="class-landing"
      lang={language}
    >
      <div className="codex-main">
        {!embedded && (
          <nav className="reference-breadcrumb" aria-label={t("Хлебные крошки", "Breadcrumbs")}>
            <a href="#/reference/">{t("Справочник", "Reference")}</a>
            <span aria-hidden="true">/</span>
            <a href="#/catalog/classes">{t("Классы", "Classes")}</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{readerLabel(landing.name, language)}</span>
          </nav>
        )}
        <div className="class-hero">
          <img
            src={`/art/classes/heroes/${CLASS_HEROES[slug]?.file ?? slug}.png`}
            alt={`${t("Арт класса", "Class artwork")}: ${readerLabel(landing.name, language)}`}
            loading="lazy"
            decoding="async"
            style={{
              objectPosition: CLASS_HEROES[slug]?.focus ?? "50% 25%",
            }}
          />
          {available && inherited === null && <div className="rule-reader-language"><ArticleLanguageSwitch language={language} setLanguage={setLanguage} /></div>}
          <div className="class-hero-text">
            {!embedded && <p className="eyebrow">{articleText("Класс", "Class")}</p>}
            <h1>{language === "en" && state.status === "ready" ? state.classEntity.originalName || landing.name : landing.name}</h1>
            {language === "ru" && state.status === "ready" && state.classEntity.originalName && (
              <p className="codex-original-title">
                {state.classEntity.originalName}
              </p>
            )}
          </div>
          {!embedded && (
            <Button
              className="class-hero-bookmark"
              icon="bookmark"
              iconOnly
              aria-label={bookmarked ? t("Удалить закладку", "Remove bookmark") : t("Добавить закладку", "Add bookmark")}
              size="sm"
              variant={bookmarked ? "soft" : "ghost"}
              aria-pressed={bookmarked}
              onClick={() => toggleBookmark(landing.classId)}
            >
              {bookmarked ? t("В закладках", "Bookmarked") : t("В закладки", "Bookmark")}
            </Button>
          )}
          {language === "ru" && summary && (
            <div className="class-hero-summary">
              <p>{summary}</p>
            </div>
          )}
          <span className="class-hero-credit">
            {art?.origin === "official"
              ? "© MCDM Productions, LLC"
              : art && artworkCredit(art, language)}
          </span>
        </div>
        <div className="class-landing-body">
        {state.status === "loading" && (
          <div className="codex-state" role="status" aria-live="polite">
            <span className="codex-state-spinner" aria-hidden="true" />
            <p>{t("Загружаем класс…", "Loading class…")}</p>
          </div>
        )}
        {state.status === "error" && (
          <div className="codex-state codex-state-error" role="alert">
            <h2>{t("Не удалось загрузить класс", "Could not load class")}</h2>
            <p>
              {t("Проверьте подключение и попробуйте снова. Если ошибка повторяется, откройте другой класс.", "Check your connection and try again, or open another class.")}
            </p>
            <p className="muted small">{state.message}</p>
            <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
              {t("Повторить", "Retry")}
            </Button>
          </div>
        )}
        {state.status === "ready" && (
          <>
            <nav className="class-level-picker" aria-label={articleText("Раздел класса", "Class section")}>
              <button
                type="button"
                aria-pressed={selectedStep === 0}
                onClick={() => setSelectedStep(0)}
              >
                {articleText("Основы", "Basics")}
              </button>
              {state.levels.map((item) => (
                <button
                  key={item.level}
                  type="button"
                  aria-pressed={selectedStep === item.level}
                  onClick={() => setSelectedStep(item.level)}
                >
                  {item.level}
                </button>
              ))}
            </nav>
            {selectedStep === 0 ? (
              <section
                className="class-landing-level"
                aria-label={articleText("Основы класса", "Class basics")}
              >
                {edition ? <>
                  <RuleMarkdown sourceLocale="en" text={edition.introduction} articleId={landing.classId} />
                  <ClassBasics name={landing.name} basics={edition.basics} edition={edition} articleId={landing.classId} />
                  {edition.afterword && <RuleMarkdown sourceLocale="en" text={edition.afterword} articleId={landing.classId} />}
                </> : language === "en" && state.classEntity.originalDescription ? <RuleMarkdown sourceLocale="en" text={state.classEntity.originalDescription} articleId={landing.classId} /> : basics ? (
                  <ClassBasics
                    name={landing.name}
                    basics={basics}
                    articleId={landing.classId}
                  />
                ) : (
                  <p className="muted">{articleText("Раздел «Основы» пока не заполнен.", "Class basics are unavailable.")}</p>
                )}
              </section>
            ) : (
              state.levels
                .filter((item) => item.level === selectedStep)
                .map((item) => {
                  const article =
                    item.level === 1
                      ? prepareLevelOne(item.article, summary)
                      : item.article;
                  return (
                    <section
                      key={item.level}
                      id={`level-${item.level}`}
                      className="class-landing-level"
                    >
                      <h2>{language === "en" ? article.originalName || article.title : article.title}</h2>
                      <RuleArticleContent
                        article={article}
                        entities={item.entities}
                        headingOffset={1}
                        onOpenEntity={(entity) => {
                          if (entity.ability) setOpenedAbility(entity);
                        }}
                      />
                    </section>
                  );
                })
            )}
          </>
        )}
        {!embedded && (
          <footer className="codex-paging">
            {prev && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openClass(prev.slug)}
                icon="arrow-left"
                iconOnly
                aria-label={`${t("Предыдущий класс", "Previous class")}: ${readerLabel(prev.name, language)}`}
              >
                <Icon name="arrow-left" size={16} /> {readerLabel(prev.name, language)}
              </Button>
            )}
            {next && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openClass(next.slug)}
                icon="chevron-right"
                iconOnly
                aria-label={`${t("Следующий класс", "Next class")}: ${readerLabel(next.name, language)}`}
              >
                {readerLabel(next.name, language)} <Icon name="arrow-right" size={16} />
              </Button>
            )}
          </footer>
        )}
        </div>
      </div>
      {!embedded && state.status === "ready" && (
        <nav className="codex-toc" aria-label={articleText("Оглавление класса", "Class contents")}>
          <span className="eyebrow">{articleText("На странице", "On this page")}</span>
          <a
            href={`#/reference/class/${slug}`}
            aria-current={selectedStep === 0 ? "location" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setSelectedStep(0);
            }}
          >
            {articleText("Основы", "Basics")}
          </a>
          <span className="codex-toc-caption">{articleText("Уровни", "Levels")}</span>
          {state.levels.map((item) => (
            <a
              key={item.level}
              href={`#/reference/class/${slug}#level-${item.level}`}
              aria-current={
                selectedStep === item.level ? "location" : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                setSelectedStep(item.level);
              }}
            >
              {articleText(`${item.level}-й уровень`, `Level ${item.level}`)}
            </a>
          ))}
        </nav>
      )}
      {openedAbility && (
        <ClassAbilityModal
          entity={openedAbility}
          onClose={() => setOpenedAbility(null)}
        />
      )}
    </div>
    </ArticleLanguageScope>
  );
}

function ClassAbilityModal({
  entity,
  onClose,
}: {
  entity: RuleEntity;
  onClose: () => void;
}) {
  const language = useArticleLocale();
  const ability = entity.ability;
  if (!ability) return null;
  return (
    <CardDetailModal
      open
      onClose={onClose}
      autoHeight
      title={language === "en" ? entity.originalName || entity.name : entity.name}
      meta={
        <Chip>
          {language === "en" ? ability.kind.replaceAll("-", " ") : kindLabel(ability.kind)} · {language === "en" ? ability.actionType.replaceAll("-", " ") : actionLabel(ability.actionType)}
        </Chip>
      }
    >
      <div className="class-ability-detail">
        <RuleEntityView entity={entity} withAnchor={false} />
      </div>
    </CardDetailModal>
  );
}

function openClass(slug: string) {
  window.location.hash = `#/reference/class/${slug}`;
}
