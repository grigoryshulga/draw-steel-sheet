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
 * динамическим импортом при первом поиске. Пакеты правил тоже ленивы: glob
 * создаёт только загрузчики, JSON-файлы приходят отдельными чанками.
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

const repository: RuleRepository = createRuleRepository({
  manifest,
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
export const loadRuleArticle = (id: string): Promise<LoadedRuleArticle> =>
  repository.loadRuleArticle(id);
export const loadRuleEntity = repository.loadRuleEntity;
export const loadRuleSearchIndex = repository.loadRuleSearchIndex;
