import { useArticleLanguage, ArticleLanguageScope, useArticleLocale, useLocale } from "../../i18n/locale";
import { ArticleLanguageSwitch } from "../LanguageSwitch";
import { useEffect, useState } from "react";
import {
  loadRuleArticle,
  type LoadedRuleArticle,
} from "../../rules/repository";
import { Button } from "../ui";
import { RuleEntityView } from "./RuleEntity";
import { RuleArticleContent } from "./RuleArticle";
import { ReadingSkeleton } from "./ReadingSkeleton";
import { useReadingHistory } from "./useReadingHistory";
import { codexIndex } from "../../rules/codex-navigation";
import { kitVariantEntity } from "../../rules/kit-variants";

/** Общий ленивый просмотр статьи для справочника и создания героя. */
export function RuleArticleReader({
  articleId,
  entityName,
}: {
  articleId: string;
  entityName?: string;
}) {
  const { t } = useLocale();
  const [result, setResult] = useState<{
    id: string;
    data?: LoadedRuleArticle;
    error?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  useReadingHistory(result?.id === articleId && result.data ? articleId : undefined);
  useEffect(() => {
    let active = true;
    setResult(undefined);
    loadRuleArticle(articleId).then(
      (data) => {
        if (active) setResult({ id: articleId, data });
      },
      (error: unknown) => {
        if (active) {
          console.error("Не удалось загрузить правила", { articleId, error });
          const title = codexIndex.find((entry) => entry.id === articleId)?.title;
          setResult({
            id: articleId,
            error: `Не удалось загрузить ${title ? `«${title}»` : "правила"}. Проверьте соединение и повторите попытку.`,
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [articleId, attempt]);
  if (!result || result.id !== articleId)
    return <ReadingSkeleton />;
  if (result.error)
    return (
      <div role="alert">
        <p>{t(result.error, "Could not load this rule. Check your connection and try again.")}</p>
        <Button onClick={() => setAttempt((n) => n + 1)}>{t("Повторить", "Retry")}</Button>
      </div>
    );
  const entity =
    entityName && result.data
      ? Object.values(result.data.entities).find((entry) => entry.name === entityName)
        ?? Object.values(result.data.entities).flatMap((entry) => kitVariantEntity(entry, entityName) ?? [])[0]
      : undefined;
  return result.data ? <ReaderContent data={result.data} entity={entity} /> : null;
}

export function ReaderContent({ data, entity }: { data: LoadedRuleArticle; entity?: import("../../rules/schema").RuleEntity }) {
  const inherited = useArticleLocale();
  const available = Boolean(entity ? entity.englishEdition : data.article.englishEdition) || Boolean((entity ? entity.originalDescription : data.article.originalDescription)?.trim()) ||
    (!entity && Object.values(data.entities).some((item) => item.originalDescription?.trim()));
  const { language, setLanguage } = useArticleLanguage(entity?.id ?? data.article.id, available);
  const languageSwitch = available && inherited === null
    ? <ArticleLanguageSwitch language={language} setLanguage={setLanguage} />
    : undefined;
  const hasStatblockHeading = data.article.director?.recordType === "statblock";
  return <ArticleLanguageScope language={language}>
    <div className="rule-reader" lang={language}>
      {entity ? <RuleEntityView entity={entity} entities={data.entities} withAnchor={false} headingActions={languageSwitch} /> : <>
        {!hasStatblockHeading && <header className="rule-reader-heading">
          <h2>{language === "en" ? data.article.englishEdition?.title || data.article.originalName || data.article.title : data.article.title}</h2>
          {languageSwitch}
        </header>}
        <RuleArticleContent article={data.article} entities={data.entities} headingActions={hasStatblockHeading ? languageSwitch : undefined} />
      </>}
    </div>
  </ArticleLanguageScope>;
}
