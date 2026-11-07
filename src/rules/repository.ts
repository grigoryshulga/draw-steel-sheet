import navigationJson from "../generated/rules/navigation.json";
import { headingId } from "../lib/codex";
import type { RuleManifest, RulePack, RuleSearchIndex } from "./schema";
import {
  RuleDataError,
  createRuleRepository,
  type LoadedRuleArticle,
  type RuleRepository,
} from "./repository-core";

export {
  createRuleRepository,
  resolveRuleIndexEntry,
  RuleDataError,
  type LoadedRuleArticle,
  type RuleDataErrorCode,
  type RulePackLoader,
  type RuleRepository,
  type RuleSearchLoader,
} from "./repository-core";

/**
 * Манифест содержит только навигацию: метаданные, заголовки и карту
 * «сущность → пакет». Полная проза правил вынесена в `search.json` и грузится
 * динамическим импортом при первом поиске. Статьи читаются отдельными JSON
 * по URL сборки; пакеты глав остаются ленивым источником отдельных сущностей.
 */
const manifest = {
  ...navigationJson,
  articles: navigationJson.articles.map(entry => ({
    ...entry,
    headings: entry.headings.map(heading => ({ ...heading, id: headingId(heading.title) })),
  })),
} as RuleManifest;
const repository: RuleRepository = createRuleRepository({
  manifest,
  loadArticlePack: async (id) => {
    // Hundreds of source-preserving IDs make even the URL directory substantial.
    // Load it only when reading an article, separately from navigation and filters.
    const { articleUrls } = await import("./article-assets");
    const url = articleUrls[`../generated/rules/articles/${id}.json`];
    if (!url) throw new RuleDataError("unknown-article", `Статья «${id}» не найдена.`, { ruleId: id });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as RulePack;
  },
  loadPack: async (packId) => {
    const { packLoaders } = await import("./pack-assets");
    const loader = packLoaders[`../generated/rules/packs/${packId}.json`];
    if (!loader) {
      return Promise.reject(
        new RuleDataError(
          "pack-not-found",
          `Пакет правил «${packId}» не найден в сборке.`,
          { packId },
        ),
      );
    }
    return loader();
  },
  // Отдельный чанк: браузер запрашивает его только при первом поиске.
  loadSearchIndex: () =>
    import("../generated/rules/search.json").then(
      (module) => module.default as RuleSearchIndex,
    ),
});

export const ruleIndex = repository.ruleIndex;
/** Части чтения, секции Справочника и лендинги классов из манифеста. */
export const ruleReading = {
  parts: manifest.parts,
  reference: manifest.reference,
  classLandings: manifest.classLandings,
};
export const loadRuleArticle = (id: string): Promise<LoadedRuleArticle> =>
  repository.loadRuleArticle(id);
export const loadRuleEntity = repository.loadRuleEntity;
export const loadRuleSearchIndex = repository.loadRuleSearchIndex;
