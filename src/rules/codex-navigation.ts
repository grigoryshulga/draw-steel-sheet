import { searchText } from "../lib/codex";
import { ruleIndex } from "./repository";
import type { RuleIndexEntry } from "./schema";

/**
 * Навигационный индекс Кодекса поверх манифеста правил.
 *
 * Сам манифест читает репозиторий (`src/rules/repository.ts`): здесь остаётся
 * только то, что нужно для ссылок и оглавления — ID, название, глава, группа,
 * путь, заголовки и признак наличия текста. Проза статьи в навигацию не
 * попадает: её отдаёт `loadRuleArticle` отдельным ленивым пакетом.
 */
export type CodexArticle = RuleIndexEntry;
export const codexIndex: readonly CodexArticle[] = ruleIndex;

/** Ссылка на статью по её точному названию; иначе — общий каталог Кодекса. */
export function codexLink(title: string): string {
  const key = searchText(title);
  const article = codexIndex.find(
    (entry) => searchText(entry.title) === key,
  );
  return article ? `#/codex/${article.id}` : "#/codex";
}
