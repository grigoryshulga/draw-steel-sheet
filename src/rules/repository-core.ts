import type {
  RuleArticle,
  RuleEntity,
  RuleIndexEntry,
  RuleManifest,
  RulePack,
  RuleSearchIndex,
} from "./schema";

export type RuleDataErrorCode =
  | "unknown-article"
  | "unknown-entity"
  | "pack-not-found"
  | "pack-failed"
  | "invalid-pack"
  | "search-failed"
  | "invalid-search-index";

/** Ошибка данных правил: код позволяет интерфейсу отличить «нет статьи» от сбоя загрузки. */
export class RuleDataError extends Error {
  readonly code: RuleDataErrorCode;
  readonly ruleId?: string;
  readonly packId?: string;
  readonly reason?: unknown;

  constructor(
    code: RuleDataErrorCode,
    message: string,
    details: { ruleId?: string; packId?: string; reason?: unknown } = {},
  ) {
    super(message);
    this.name = "RuleDataError";
    this.code = code;
    this.ruleId = details.ruleId;
    this.packId = details.packId;
    this.reason = details.reason;
  }
}

export type RulePackLoader = (packId: string) => Promise<RulePack>;
export type RuleSearchLoader = () => Promise<RuleSearchIndex>;

export interface RuleRepositoryOptions {
  manifest: RuleManifest;
  loadPack: RulePackLoader;
  /** Загружает полный поисковый корпус; вызывается только при первом поиске. */
  loadSearchIndex: RuleSearchLoader;
}

export interface LoadedRuleArticle {
  article: RuleArticle;
  entities: Record<string, RuleEntity>;
}

export interface RuleRepository {
  readonly ruleIndex: readonly RuleIndexEntry[];
  loadRuleArticle(id: string): Promise<LoadedRuleArticle>;
  loadRuleEntity(id: string): Promise<RuleEntity>;
  loadRuleSearchIndex(): Promise<RuleSearchIndex>;
}

export interface RuleLocationLike {
  articleId: string;
  chapter: string;
  group: string;
}

function validatePack(packId: string, pack: RulePack): RulePack {
  if (
    !pack ||
    pack.schemaVersion !== 1 ||
    !Array.isArray(pack.articles) ||
    !Array.isArray(pack.entities)
  ) {
    throw new RuleDataError(
      "invalid-pack",
      `Пакет правил «${packId}» имеет неподдерживаемый формат.`,
      { packId },
    );
  }
  return pack;
}

/**
 * Проверяет, что ленивый корпус покрывает индекс ровно один раз: иначе поиск
 * молча терял бы статьи или показывал чужие идентификаторы.
 */
function validateSearchIndex(
  manifest: RuleManifest,
  index: RuleSearchIndex,
): RuleSearchIndex {
  const invalid = (reason: unknown) =>
    new RuleDataError(
      "invalid-search-index",
      "Поисковый индекс правил имеет неподдерживаемый формат.",
      { reason },
    );
  if (
    !index ||
    index.schemaVersion !== 1 ||
    !Array.isArray(index.articles)
  ) {
    throw invalid("schema");
  }
  const known = new Set(manifest.articles.map((entry) => entry.id));
  const seen = new Set<string>();
  for (const document of index.articles) {
    if (
      !document ||
      typeof document.id !== "string" ||
      typeof document.text !== "string"
    ) {
      throw invalid("document");
    }
    if (seen.has(document.id)) {
      throw invalid(`duplicate ${document.id}`);
    }
    if (!known.has(document.id)) {
      throw invalid(`unknown ${document.id}`);
    }
    seen.add(document.id);
  }
  const missing = manifest.articles.filter((entry) => !seen.has(entry.id));
  if (missing.length > 0) {
    throw invalid(`missing ${missing[0].id}`);
  }
  return index;
}

/**
 * Создаёт репозиторий поверх индекса, ленивых пакетов и ленивого поискового
 * корпуса. Загрузчики внедряются, чтобы поведение кеша и повторов проверялось
 * без сборки данных.
 */
export function createRuleRepository({
  manifest,
  loadPack,
  loadSearchIndex,
}: RuleRepositoryOptions): RuleRepository {
  const entriesById = new Map(
    manifest.articles.map((entry) => [entry.id, entry] as const),
  );
  const packPromises = new Map<string, Promise<RulePack>>();
  const articlePromises = new Map<string, Promise<LoadedRuleArticle>>();
  const entitiesById = new Map<string, RuleEntity>();
  let searchPromise: Promise<RuleSearchIndex> | null = null;

  const ruleIndex: readonly RuleIndexEntry[] = Object.freeze([
    ...manifest.articles,
  ]);

  function loadPackOnce(packId: string): Promise<RulePack> {
    const cached = packPromises.get(packId);
    if (cached) return cached;
    let pending: Promise<RulePack>;
    try {
      pending = Promise.resolve(loadPack(packId)).then((pack) =>
        validatePack(packId, pack),
      );
    } catch (error) {
      pending = Promise.reject(error);
    }
    const tracked = pending.catch((error: unknown) => {
      // Неудачная загрузка не кешируется: следующий запрос должен её повторить.
      packPromises.delete(packId);
      if (error instanceof RuleDataError) throw error;
      throw new RuleDataError(
        "pack-failed",
        `Не удалось загрузить пакет правил «${packId}».`,
        { packId, reason: error },
      );
    });
    packPromises.set(packId, tracked);
    return tracked;
  }

  async function fetchArticle(id: string): Promise<LoadedRuleArticle> {
    const entry = entriesById.get(id);
    if (!entry) {
      throw new RuleDataError(
        "unknown-article",
        `Статья правил «${id}» не найдена.`,
        { ruleId: id },
      );
    }
    const pack = await loadPackOnce(entry.packId);
    const article = pack.articles.find((candidate) => candidate.id === id);
    if (!article) {
      throw new RuleDataError(
        "unknown-article",
        `Статья «${id}» отсутствует в пакете «${entry.packId}».`,
        { ruleId: id, packId: entry.packId },
      );
    }
    const entities: Record<string, RuleEntity> = {};
    for (const entity of pack.entities) {
      entities[entity.id] = entity;
      entitiesById.set(entity.id, entity);
    }
    const missingByPack = new Map<string, Set<string>>();
    for (const block of article.blocks) {
      if (block.type !== "entity" || entities[block.ref]) continue;
      const target = manifest.entities[block.ref];
      if (!target || target.packId === entry.packId) continue;
      let ids = missingByPack.get(target.packId);
      if (!ids) {
        ids = new Set<string>();
        missingByPack.set(target.packId, ids);
      }
      ids.add(block.ref);
    }
    if (missingByPack.size > 0) {
      const related = await Promise.all(
        [...missingByPack].map(async ([packId, ids]) => ({
          ids,
          pack: await loadPackOnce(packId),
        })),
      );
      for (const { ids, pack: relatedPack } of related) {
        for (const entity of relatedPack.entities) {
          if (!ids.has(entity.id)) continue;
          entities[entity.id] = entity;
          entitiesById.set(entity.id, entity);
        }
      }
    }
    return { article, entities };
  }

  function loadRuleArticle(id: string): Promise<LoadedRuleArticle> {
    const cached = articlePromises.get(id);
    if (cached) return cached;
    const tracked = fetchArticle(id).catch((error: unknown) => {
      articlePromises.delete(id);
      throw error;
    });
    articlePromises.set(id, tracked);
    return tracked;
  }

  async function loadRuleEntity(id: string): Promise<RuleEntity> {
    const cached = entitiesById.get(id);
    if (cached) return cached;
    const target = manifest.entities[id];
    if (!target) {
      throw new RuleDataError(
        "unknown-entity",
        `Сущность правил «${id}» не найдена.`,
        { ruleId: id },
      );
    }
    const pack = await loadPackOnce(target.packId);
    const entity = pack.entities.find((candidate) => candidate.id === id);
    if (!entity) {
      throw new RuleDataError(
        "unknown-entity",
        `Сущность «${id}» отсутствует в пакете «${target.packId}».`,
        { ruleId: id, packId: target.packId },
      );
    }
    entitiesById.set(id, entity);
    return entity;
  }

  function loadRuleSearchIndex(): Promise<RuleSearchIndex> {
    if (searchPromise) return searchPromise;
    let pending: Promise<RuleSearchIndex>;
    try {
      pending = Promise.resolve(loadSearchIndex()).then((index) =>
        validateSearchIndex(manifest, index),
      );
    } catch (error) {
      pending = Promise.reject(error);
    }
    const tracked = pending.catch((error: unknown) => {
      // Сбой поиска не кешируется: повторная попытка должна снова сходить за данными.
      if (searchPromise === tracked) searchPromise = null;
      if (error instanceof RuleDataError) throw error;
      throw new RuleDataError(
        "search-failed",
        "Не удалось загрузить поисковый индекс правил.",
        { reason: error },
      );
    });
    searchPromise = tracked;
    return tracked;
  }

  return {
    ruleIndex,
    loadRuleArticle,
    loadRuleEntity,
    loadRuleSearchIndex,
  };
}

/**
 * Старые ссылки на главу или раздел открывают первую непустую статью,
 * а ссылка на статью имеет приоритет. Совместимо с прежним resolveCodexArticle.
 */
export function resolveRuleIndexEntry(
  index: readonly RuleIndexEntry[],
  location: RuleLocationLike,
): RuleIndexEntry | undefined {
  if (location.articleId) {
    return index.find((entry) => entry.id === location.articleId);
  }
  if (!location.chapter) return undefined;
  const entries = index.filter(
    (entry) =>
      entry.chapter === location.chapter &&
      (!location.group || entry.group === location.group),
  );
  return entries.find((entry) => entry.hasText) ?? entries[0];
}
