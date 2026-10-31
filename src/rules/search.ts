import type { RuleIndexEntry, RuleSearchIndex } from "./schema";

/** Нижний регистр для русской письменности и «ё» → «е»: общий контракт поиска. */
function foldCase(text: string): string {
  return text.toLocaleLowerCase("ru").replace(/ё/g, "е");
}

/**
 * Нормализует поисковый запрос и заголовки: регистр, «ё» и лишние пробелы.
 * Для текста корпуса используется `foldCase`: он не меняет длину строки,
 * поэтому найденная позиция остаётся пригодной для вырезки исходного текста.
 */
export function normalizeSearchText(text: string): string {
  return foldCase(text).replace(/\s+/g, " ").trim();
}

export interface RuleSearchOptions {
  chapter?: string;
  group?: string;
  bookmarks?: readonly string[];
  onlyBookmarks?: boolean;
}

export interface RuleSearchMatch {
  entry: RuleIndexEntry;
  score: number;
  excerpt: string;
}

export interface RuleSearcher {
  search(query: string, options?: RuleSearchOptions): RuleSearchMatch[];
}

const EXCERPT_BEFORE = 55;
const EXCERPT_LENGTH = 200;

interface SearchDocumentState {
  entry: RuleIndexEntry;
  /** Текст в исходном регистре: из него строится фрагмент выдачи. */
  text: string;
  /** Текст без регистра и «ё»: по нему ищется совпадение. */
  folded: string;
  title: string;
  group: string;
}

/**
 * Собирает поисковик поверх уже загруженного манифеста и ленивого корпуса.
 * Корпус содержит только статьи из манифеста; повторные документы
 * игнорируются, чтобы одна статья не попадала в выдачу дважды.
 */
export function createRuleSearcher(
  index: readonly RuleIndexEntry[],
  searchIndex: RuleSearchIndex,
): RuleSearcher {
  const entryById = new Map(index.map((entry) => [entry.id, entry] as const));
  const seen = new Set<string>();
  const documents: SearchDocumentState[] = [];
  for (const document of searchIndex.articles) {
    if (seen.has(document.id)) continue;
    const entry = entryById.get(document.id);
    if (!entry) continue;
    seen.add(document.id);
    documents.push({
      entry,
      text: document.text,
      folded: foldCase(document.text),
      title: normalizeSearchText(entry.title),
      group: normalizeSearchText(entry.group),
    });
  }
  // Порядок выдачи без запроса повторяет порядок манифеста.
  const documentsById = new Map(
    documents.map((document) => [document.entry.id, document] as const),
  );
  const ordered = index.flatMap((entry) => {
    const document = documentsById.get(entry.id);
    return document ? [document] : [];
  });

  function relevance(document: SearchDocumentState, needle: string): number {
    return (
      (document.title === needle
        ? 10
        : document.title.includes(needle)
          ? 5
          : 0) + (document.group.includes(needle) ? 2 : 0)
    );
  }

  function excerpt(document: SearchDocumentState, needle: string): string {
    const firstWord = needle.split(" ")[0] ?? "";
    const match = firstWord ? document.folded.indexOf(firstWord) : -1;
    const start = Math.max(0, match - EXCERPT_BEFORE);
    const text = document.text
      .slice(start, start + EXCERPT_LENGTH)
      .replace(/\s+/g, " ")
      .replace(/[#*>_`|]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    return start > 0 ? `…${text}` : text;
  }

  function search(
    query: string,
    options: RuleSearchOptions = {},
  ): RuleSearchMatch[] {
    const needle = normalizeSearchText(query);
    if (!needle) return [];
    const words = needle.split(" ").filter(Boolean);
    const bookmarkSet = options.bookmarks
      ? new Set(options.bookmarks)
      : undefined;
    const matches: RuleSearchMatch[] = [];
    for (const document of ordered) {
      const { entry } = document;
      if (options.chapter && entry.chapter !== options.chapter) continue;
      if (options.group && entry.group !== options.group) continue;
      if (options.onlyBookmarks && !bookmarkSet?.has(entry.id)) continue;
      if (!words.every((word) => document.folded.includes(word))) continue;
      matches.push({
        entry,
        score: relevance(document, needle),
        excerpt: excerpt(document, needle),
      });
    }
    return matches.sort((a, b) => b.score - a.score);
  }

  return { search };
}

export interface SearchSequencer {
  /** Начинает новую попытку и возвращает её токен. */
  begin(): number;
  /** Только последняя попытка считается актуальной. */
  isCurrent(token: number): boolean;
}

/**
 * Защита от устаревших ответов: поздний ответ на прежний запрос не должен
 * перезаписать более новый. Используется представлением Кодекса.
 */
export function createSearchSequencer(): SearchSequencer {
  let current = 0;
  return {
    begin() {
      current += 1;
      return current;
    },
    isCurrent(token: number) {
      return token === current;
    },
  };
}
