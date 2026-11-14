import { searchText } from "../lib/codex";
import { ruleIndex, ruleReading } from "./repository";
import type { RuleClassLanding, RuleIndexEntry, RuleReadingPart, RuleReferenceSection } from "./schema";

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
/** Book reading excludes creature and terrain sheets, which belong in Reference. */
export const bookIndex: readonly CodexArticle[] = ruleIndex.filter(entry => !entry.director?.glossaryId && !["statblock", "dynamic-terrain"].includes(entry.director?.recordType ?? ""));

/** Части чтения «Читать» из манифеста. */
export const readingParts: readonly RuleReadingPart[] = ruleReading.parts;

/** Display order is editorial; stored chapter names and article URLs stay stable. */
export function bookChapterNumber(chapter: string): number | undefined {
  const index = readingParts.flatMap(part => part.chapters).indexOf(chapter);
  return index >= 0 ? index + 1 : undefined;
}

/** Секции Справочника из манифеста. */
export const referenceSections: readonly RuleReferenceSection[] =
  ruleReading.reference;

/** Лендинги классов из манифеста. */
export const classLandings: readonly RuleClassLanding[] =
  ruleReading.classLandings;

/** Куда ведёт ссылка на статью-уровень класса: лендинг + якорь уровня. */
export interface ClassLandingTarget {
  slug: string;
  name: string;
  level: number;
}

const landingBySlug = new Map(classLandings.map((landing) => [landing.slug, landing] as const));
const landingByArticle = new Map<string, ClassLandingTarget>();
for (const landing of classLandings) {
  landing.levelArticleIds.forEach((articleId, index) => {
    landingByArticle.set(articleId, {
      slug: landing.slug,
      name: landing.name,
      level: index + 1,
    });
  });
}

export function classLandingBySlug(slug: string): RuleClassLanding | undefined {
  return landingBySlug.get(slug);
}

/** Статья-уровень класса открывается якорем на лендинге класса. */
export function classLandingForArticle(articleId: string): ClassLandingTarget | undefined {
  return landingByArticle.get(articleId);
}

export function classLandingHref(slug: string, level?: number): string {
  return `#/reference/class/${slug}${level ? `#level-${level}` : ""}`;
}

/**
 * Каноническая ссылка на материал правил: статья или якорь лендинга класса.
 * Все точки входа (поиск, закладки, списки) ходят через этот помощник, чтобы
 * ссылки на классы не расходились с редиректами старых адресов.
 */
export function codexArticleHref(articleId: string): string {
  const record = ruleIndex.find(entry => entry.id === articleId);
  if (record?.director && ["statblock", "dynamic-terrain"].includes(record.director.recordType)) return `#/catalog/${record.director.section}/${articleId}`;
  if (record?.director?.glossaryId) return `#/catalog/glossary#term-${record.director.glossaryId}`;
  const landing = classLandingForArticle(articleId);
  return landing ? classLandingHref(landing.slug, landing.level) : `#/codex/${articleId}`;
}

/** Ссылка на статью по её точному названию; иначе — общий каталог Кодекса. */
export function codexLink(title: string): string {
  const key = searchText(title);
  const article = codexIndex.find(
    (entry) => searchText(entry.title) === key,
  );
  return article ? codexArticleHref(article.id) : "#/codex";
}
