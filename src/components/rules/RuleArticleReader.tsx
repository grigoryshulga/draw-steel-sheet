import { useEffect, useState } from "react";
import {
  loadRuleArticle,
  type LoadedRuleArticle,
} from "../../rules/repository";
import { artForArticle } from "../../lib/art";
import { Button } from "../ui";
import { RuleEntityView } from "./RuleEntity";
import { RuleArticleContent } from "./RuleArticle";
import { ReadingSkeleton } from "./ReadingSkeleton";
import { useReadingHistory } from "./useReadingHistory";

/** Общий ленивый просмотр статьи для справочника и создания героя. */
export function RuleArticleReader({
  articleId,
  entityName,
}: {
  articleId: string;
  entityName?: string;
}) {
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
        if (active)
          setResult({
            id: articleId,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить правила.",
          });
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
        <p>{result.error}</p>
        <Button onClick={() => setAttempt((n) => n + 1)}>Повторить</Button>
      </div>
    );
  const entity =
    entityName && result.data
      ? Object.values(result.data.entities).find(
          (entry) => entry.name === entityName,
        )
      : undefined;
  if (entity) return <RuleEntityView entity={entity} withAnchor={false} />;
  return result.data ? (
    <RuleArticleContent
      article={result.data.article}
      entities={result.data.entities}
      art={artForArticle(articleId)}
    />
  ) : null;
}
