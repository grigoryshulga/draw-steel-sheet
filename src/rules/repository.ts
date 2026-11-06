import manifestJson from "../generated/rules/manifest.json";
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
const manifest = manifestJson as RuleManifest;
const packLoaders = import.meta.glob<RulePack>(
  "../generated/rules/packs/*.json",
  { import: "default" },
);
const packLoadersById = new Map<string, () => Promise<RulePack>>();
for (const [file, loader] of Object.entries(packLoaders)) {
  const name = /\/([^/]+)\.json$/.exec(file)?.[1];
  if (name) packLoadersById.set(name, loader);
}

// URLs are small; article prose is fetched as JSON only when opened. no-inline
// prevents short articles from becoming data URLs inside the navigation bundle.
const articleUrls = import.meta.glob<string>("../generated/rules/articles/*.json", {
  query: "?url&no-inline", import: "default", eager: true,
});

const repository: RuleRepository = createRuleRepository({
  manifest,
  loadArticlePack: async (id) => {
    const url = articleUrls[`../generated/rules/articles/${id}.json`];
    if (!url) throw new RuleDataError("unknown-article", `Статья «${id}» не найдена.`, { ruleId: id });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as RulePack;
  },
  loadPack: (packId) => {
    const loader = packLoadersById.get(packId);
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
