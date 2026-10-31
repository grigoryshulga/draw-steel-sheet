import type { CompendiumAbility } from '../types';
export type RuleEntityKind = 'ability' | 'feature' | 'ancestry' | 'kit' | 'perk' | 'item' | 'project' | 'title';
export interface RuleEntity {
  id: string; // namespaced stable identity; not derived anew from translated names
  kind: RuleEntityKind;
  name: string;
  markdown: string; // complete original rule block; never the lossy ability summary
  source: { articleId: string; path: string };
  legacyIds: string[];
  ability?: CompendiumAbility; // structured projection when reliably mapped
}
export type RuleBlock = { type: 'markdown'; text: string } | { type: 'entity'; ref: string };
export interface RuleArticle {
  id: string;
  title: string;
  chapter: string;
  group: string;
  path: string;
  blocks: RuleBlock[];
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
}
export interface RuleManifest {
  schemaVersion: 1;
  articles: RuleIndexEntry[];
  entities: Record<string, { packId: string; kind: RuleEntityKind }>;
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
