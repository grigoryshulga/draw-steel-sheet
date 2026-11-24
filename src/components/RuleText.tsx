import { RuleMarkdown } from "./rules/RuleMarkdown";

/**
 * Чтение правила из унаследованного Markdown.
 *
 * Разметка и плагины живут в `RuleMarkdown`, чтобы канонические статьи и
 * сущности правил использовали тот же рендер без циклических зависимостей.
 * `RuleText` остаётся публичной точкой входа для существующих потребителей.
 */
export function RuleText({
  text,
  articleId,
  sourceLocale,
  sharedAbilityCards = false,
}: {
  text: string;
  sourceLocale?: "ru" | "en";
  articleId?: string;
  sharedAbilityCards?: boolean;
}) {
  return <RuleMarkdown text={text} sourceLocale={sourceLocale} articleId={articleId} sharedAbilityCards={sharedAbilityCards} />;
}
