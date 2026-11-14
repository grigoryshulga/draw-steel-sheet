import type { CompendiumAbility, OriginalFields } from '../types';
export type RuleEntityKind = 'ability' | 'feature' | 'ancestry' | 'career' | 'kit' | 'perk' | 'item' | 'project' | 'title' | 'monster' | 'retainer' | 'terrain' | 'monster-feature' | 'monster-lore' | 'monster-rule';
export interface DirectorMetadata {
  glossaryId?: string;
  section: 'rules' | 'monsters' | 'retainers' | 'terrain';
  groupSlug: string;
  recordType: string;
  sourcePath: string;
  sourceRevision: string;
  level?: number;
  ev?: string;
  role?: string;
  organization?: string;
  size?: string | number;
  keywords?: string[];
}
export interface RuleEntity extends OriginalFields {
  id: string; // namespaced stable identity; not derived anew from translated names
  kind: RuleEntityKind;
  name: string;
  markdown: string; // complete original rule block; never the lossy ability summary
  source: { articleId: string; path: string };
  ability?: CompendiumAbility; // structured projection when reliably mapped
  /** Составной комплект: полный текст остаётся в markdown, идентичность вариантов закреплена явно. */
  kitVariants?: { id: string; name: string; signatureAbilityId: string; damageType: string }[];
  grantedAbilityIds?: string[];
  director?: DirectorMetadata;
}
export type RuleBlock = { type: 'markdown'; text: string } | { type: 'entity'; ref: string };
export interface RuleArticle extends OriginalFields {
  id: string;
  title: string;
  chapter: string;
  group: string;
  path: string;
  blocks: RuleBlock[];
  director?: DirectorMetadata;
  related?: { id: string; title: string }[];
}
export interface RulePack {
  schemaVersion: 1;
  articles: RuleArticle[];
  entities: RuleEntity[];
}
/**
 * Запись индекса в манифесте: только метаданные навигации и заголовки.
 * Полный текст статьи живёт в отдельном ленивом артефакте поиска.
 */
export interface RuleIndexEntry {
  id: string;
  title: string;
  chapter: string;
  group: string;
  path: string;
  packId: string;
  headings: { id: string; title: string; level: number }[];
  /** Есть ли в статье хоть какой-то текст; заменяет проверку пустого searchText. */
  hasText: boolean;
  director?: Omit<DirectorMetadata, 'sourcePath' | 'sourceRevision'> & { originalName: string };
}
export interface RuleManifest {
  schemaVersion: 1;
  articles: RuleIndexEntry[];
  entities: Record<string, { packId: string; kind: RuleEntityKind }>;
  /** Дерево «Читать»: части книги из глав и обзорных статей. */
  parts: RuleReadingPart[];
  /** Секции Справочника: вторые точки входа к тем же статьям и сущностям. */
  reference: RuleReferenceSection[];
  /** Лендинги классов: агрегированная страница вместо 10 статей-уровней. */
  classLandings: RuleClassLanding[];
}
/** Раздел чтения внутри части: обзорные статьи вместо ушедшей в Справочник главы. */
export interface RuleReadingExtra {
  id: string;
  title: string;
  articleIds: string[];
}
export interface RuleReadingPart {
  id: string;
  title: string;
  /** Полные имена глав («08. Классы») в порядке чтения. */
  chapters: string[];
  extras: RuleReadingExtra[];
}
export interface RuleReferenceSection {
  id: string;
  title: string;
  kind: "classes" | "articles" | "catalog" | "glossary";
  /** Статьи-единицы секции (kind: "articles"). */
  items?: string[];
  /** Вид каталога потребителя (kind: "catalog"). */
  catalogKind?: string;
  /** Количество единиц для карточки секции. */
  count?: number;
}
export interface RuleClassLanding {
  classId: string;
  /** Английский слаг класса из id («class.fury» → «fury»). */
  slug: string;
  /** Русское имя класса — оно же группа статей главы 08. */
  name: string;
  /** Статьи-уровни в порядке уровней 1..N. */
  levelArticleIds: string[];
  featureIds: string[];
  abilityIds: string[];
}
/**
 * Ленивый поисковый корпус. `text` хранится в исходном регистре, чтобы
 * выдача показывала настоящий текст правила; нормализация выполняется при
 * поиске и не меняет длину строки, поэтому позиция совпадения годится для
 * вырезки фрагмента.
 */
export interface RuleSearchDocument {
  id: string;
  text: string;
}
export interface RuleSearchIndex {
  schemaVersion: 1;
  articles: RuleSearchDocument[];
}
