import { useState, type ReactNode } from "react";
import type { CatalogEntry } from "../../data/library";
import { useLocale, useArticleLanguage, ArticleLanguageScope, useArticleLocale } from "../../i18n/locale";
import { ArticleLanguageSwitch } from "../LanguageSwitch";
import { RuleText } from "../RuleText";
import { Chip } from "../ui";
import { readerLabel } from "./reader-labels";
import "../../views/LibraryView.css";
import {
  catalogAccent,
  catalogEditionText,
  catalogLevelSections,
} from "../../lib/catalog-presentation";
import { echelon as levelEchelon } from "../../lib/progression";
import { CatalogRank } from "./CatalogRank";
import { TreasureKind } from "./TreasureKind";

export function CatalogEntryCard({
  entry,
  id,
  footer,
}: {
  entry: CatalogEntry;
  id?: string;
  footer?: ReactNode;
}) {
  const { locale, t } = useLocale();
  const inherited = useArticleLocale();
  const available = Boolean(entry.originalDescription?.trim());
  const { language, setLanguage } = useArticleLanguage(entry.id, available);
  const english = language === "en" && available;
  const articleLabel = (ru: string, en: string) => english ? en : ru;
  const { flavor, prerequisite, body } = catalogEditionText(entry, language);
  const keywordLine = english ? /^\*\*Keywords:\*\*[^\n]*/m : /^\*\*Ключевые слова:\*\*[^\n]*/m;
  const keywordText = english ? body.match(keywordLine)?.[0].replace("**Keywords:**", "") ?? "" : entry.keywords;
  const keywords = keywordText.split(/[;,]/).map(word => word.trim()).filter(Boolean);
  const markdown = keywords.length ? body.replace(keywordLine, "").trim() : body;
  const progression = catalogLevelSections(markdown, language);
  const ruleText = (text: string) => <RuleText sourceLocale={language} text={text} articleId={entry.articleId} />;
  const levels =
    entry.category === "Сокровища с Уровнем" ? progression.levels : [];
  const [level, setLevel] = useState(levels[0]?.level ?? 1);
  const rank = catalogAccent(entry, levels.length ? level : undefined);
  return (
    <ArticleLanguageScope language={language}>
    <article
      id={id}
      className="catalog-detail"
      lang={language}
      data-rank={rank}
      data-catalog-kind={entry.kind}
    >
      <div className="catalog-detail-meta">
        <span className="eyebrow">
          {readerLabel(entry.category, language)}
          {!rank && entry.echelon ? ` · ${articleLabel("Эшелон", "Echelon")} ${entry.echelon}` : ""}
        </span>
        <CatalogRank rank={rank} />
        <TreasureKind entry={entry} />
        {available && inherited === null && <div className="rule-reader-language"><ArticleLanguageSwitch language={language} setLanguage={setLanguage} /></div>}
      </div>
      <h1>{english ? entry.originalName || entry.name : entry.name}</h1>
      {!available && locale === "en" && <p className="muted" role="note">{t("Оригинал недоступен", "English original unavailable")}</p>}
      {flavor && (
        <div className="catalog-flavor">
          {ruleText(flavor)}
        </div>
      )}
      {keywords.length > 0 && (
        <div className="catalog-keywords" aria-label={articleLabel("Ключевые слова", "Keywords")}>
          {keywords.map((keyword) => (
            <Chip key={keyword}>{keyword}</Chip>
          ))}
        </div>
      )}
      {prerequisite && (
        <div className="catalog-prerequisite">
          <span className="eyebrow">{articleLabel("Условие получения", "Prerequisite")}</span>
          {ruleText(prerequisite)}
        </div>
      )}
      {levels.length ? (
        <>
          {ruleText(progression.introduction)}
          <div
            className="catalog-level-tabs"
            role="group"
            aria-label={articleLabel("Уровень предмета", "Item level")}
          >
            {levels.map((stage) => (
              <button
                key={stage.level}
                type="button"
                data-rank={levelEchelon(stage.level)}
                aria-pressed={level === stage.level}
                onClick={() => setLevel(stage.level)}
              >
                {articleLabel(`${stage.level}-й уровень`, `Level ${stage.level}`)}
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
                <h2>{articleLabel(`${stage.level}-й уровень`, `Level ${stage.level}`)}</h2>
                {ruleText(stage.text)}
              </section>
            ))}
        </>
      ) : (
        ruleText(markdown)
      )}
      {footer}
    </article>
    </ArticleLanguageScope>
  );
}
