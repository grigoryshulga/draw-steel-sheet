import { describe, expect, it, vi } from "vitest";
import {
  RuleDataError,
  createRuleRepository,
  resolveRuleIndexEntry,
} from "../src/rules/repository-core";
import type {
  RuleArticle,
  RuleEntity,
  RuleIndexEntry,
  RuleManifest,
  RulePack,
  RuleSearchIndex,
} from "../src/rules/schema";

function article(
  id: string,
  packId: string,
  chapter = "01. Введение",
  group = "",
  blocks: RuleArticle["blocks"] = [{ type: "markdown", text: `# ${id}` }],
): RuleArticle {
  return {
    id,
    title: `Статья ${id}`,
    chapter,
    group,
    path: `${chapter}/${id}.md`,
    blocks,
  };
}

function indexEntry(
  source: RuleArticle,
  packId: string,
  hasText = true,
): RuleIndexEntry {
  return {
    id: source.id,
    title: source.title,
    chapter: source.chapter,
    group: source.group,
    path: source.path,
    packId,
    headings: [{ id: source.id, title: source.title, level: 1 }],
    hasText,
  };
}

function entity(id: string, kind: RuleEntity["kind"]): RuleEntity {
  return {
    id,
    kind,
    name: id,
    markdown: `**${id}**`,
    source: { articleId: "a1", path: "a1.md" },
    legacyIds: [],
  };
}

const coreEntity = entity("ability:strike", "ability");
const expandedEntity = entity("item:shield", "item");

const coreArticle = article("a1", "core", "01. Введение", "", [
  { type: "markdown", text: "Введение" },
  { type: "entity", ref: "ability:strike" },
  { type: "entity", ref: "item:shield" },
]);
const secondCoreArticle = article("a2", "core", "01. Введение", "Основы");
const emptyCoreArticle = article("a3", "core", "02. Основы", "", []);

const manifest: RuleManifest = {
  schemaVersion: 1,
  articles: [
    indexEntry(coreArticle, "core"),
    indexEntry(secondCoreArticle, "core"),
    indexEntry(emptyCoreArticle, "core", false),
  ],
  entities: {
    "ability:strike": { packId: "core", kind: "ability" },
    "item:shield": { packId: "expanded", kind: "item" },
  },
};

const searchIndex: RuleSearchIndex = {
  schemaVersion: 1,
  articles: [
    { id: "a1", text: "Статья a1 Введение" },
    { id: "a2", text: "Статья a2 Основы" },
    { id: "a3", text: "" },
  ],
};

function packs(): Record<string, RulePack> {
  return {
    core: {
      schemaVersion: 1,
      articles: [coreArticle, secondCoreArticle, emptyCoreArticle],
      entities: [coreEntity],
    },
    expanded: {
      schemaVersion: 1,
      articles: [],
      entities: [expandedEntity],
    },
  };
}

function repository() {
  const data = packs();
  const loadPack = vi.fn((packId: string) => Promise.resolve(data[packId]));
  const loadSearchIndex = vi.fn(() => Promise.resolve(searchIndex));
  return {
    repo: createRuleRepository({ manifest, loadPack, loadSearchIndex }),
    loadPack,
    loadSearchIndex,
  };
}

describe("rules repository", () => {
  it("exposes the manifest index for search and navigation", () => {
    const { repo } = repository();
    expect(repo.ruleIndex).toHaveLength(3);
    expect(repo.ruleIndex.map((entry) => entry.id)).toEqual(["a1", "a2", "a3"]);
    // Манифест не содержит прозы: только метаданные и признак текста.
    expect(repo.ruleIndex.map((entry) => entry.hasText)).toEqual([
      true,
      true,
      false,
    ]);
    expect("searchText" in repo.ruleIndex[0]).toBe(false);
  });

  it("loads an article together with entities referenced from other packs", async () => {
    const { repo, loadPack } = repository();
    const result = await repo.loadRuleArticle("a1");
    expect(result.article.id).toBe("a1");
    expect(result.article.blocks).toHaveLength(3);
    expect(result.entities["ability:strike"]).toBe(coreEntity);
    expect(result.entities["item:shield"]).toBe(expandedEntity);
    expect(loadPack).toHaveBeenCalledWith("core");
    expect(loadPack).toHaveBeenCalledWith("expanded");
  });

  it("deduplicates concurrent article and pack requests", async () => {
    const data = packs();
    let resolveCore: (pack: RulePack) => void = () => undefined;
    const loadPack = vi.fn((packId: string) => {
      if (packId === "core") {
        return new Promise<RulePack>((resolve) => {
          resolveCore = resolve;
        });
      }
      return Promise.resolve(data[packId]);
    });
    const repo = createRuleRepository({ manifest, loadPack });
    const first = repo.loadRuleArticle("a1");
    const second = repo.loadRuleArticle("a1");
    const other = repo.loadRuleArticle("a2");
    expect(loadPack).toHaveBeenCalledTimes(1);
    resolveCore(data.core);
    const results = await Promise.all([first, second, other]);
    expect(results.map((result) => result.article.id)).toEqual(["a1", "a1", "a2"]);
    expect(loadPack).toHaveBeenCalledTimes(2);
  });

  it("caches successful loads between sequential requests", async () => {
    const { repo, loadPack } = repository();
    await repo.loadRuleArticle("a1");
    await repo.loadRuleArticle("a2");
    await repo.loadRuleEntity("ability:strike");
    expect(loadPack).toHaveBeenCalledTimes(2);
    expect(loadPack).toHaveBeenCalledWith("core");
    expect(loadPack).toHaveBeenCalledWith("expanded");
  });

  it("retries a failed pack load instead of caching the failure", async () => {
    const data = packs();
    let attempts = 0;
    const loadPack = vi.fn((packId: string) => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error("network down"));
      return Promise.resolve(data[packId]);
    });
    const repo = createRuleRepository({ manifest, loadPack });
    await expect(repo.loadRuleArticle("a1")).rejects.toMatchObject({
      name: "RuleDataError",
      code: "pack-failed",
    });
    await expect(repo.loadRuleArticle("a1")).resolves.toMatchObject({
      article: { id: "a1" },
    });
    // Повтор основного пакета плюс связанный пакет сущности статьи.
    expect(loadPack.mock.calls.filter(([packId]) => packId === "core")).toHaveLength(2);
    expect(loadPack).toHaveBeenCalledTimes(3);
  });

  it("shares one failed concurrent pack request and allows a later retry", async () => {
    const data = packs();
    let rejectCore: (error: Error) => void = () => undefined;
    let attempts = 0;
    const loadPack = vi.fn((packId: string) => {
      if (packId !== "core") return Promise.resolve(data[packId]);
      attempts += 1;
      if (attempts === 1) {
        return new Promise<RulePack>((_resolve, reject) => {
          rejectCore = reject;
        });
      }
      return Promise.resolve(data.core);
    });
    const repo = createRuleRepository({ manifest, loadPack });
    const first = repo.loadRuleArticle("a1");
    const second = repo.loadRuleArticle("a2");
    rejectCore(new Error("timeout"));
    await expect(first).rejects.toBeInstanceOf(RuleDataError);
    await expect(second).rejects.toBeInstanceOf(RuleDataError);
    expect(loadPack).toHaveBeenCalledTimes(1);
    await expect(repo.loadRuleArticle("a1")).resolves.toMatchObject({
      article: { id: "a1" },
    });
    expect(loadPack.mock.calls.filter(([packId]) => packId === "core")).toHaveLength(2);
    expect(loadPack).toHaveBeenCalledTimes(3);
  });

  it("keeps a structured pack-not-found error and allows another attempt", async () => {
    const loadPack = vi.fn(() =>
      Promise.reject(
        new RuleDataError("pack-not-found", "Пакет не найден.", {
          packId: "core",
        }),
      ),
    );
    const repo = createRuleRepository({ manifest, loadPack });
    await expect(repo.loadRuleArticle("a1")).rejects.toMatchObject({
      code: "pack-not-found",
      packId: "core",
    });
    await expect(repo.loadRuleArticle("a1")).rejects.toMatchObject({
      code: "pack-not-found",
    });
    expect(loadPack).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown article and entity ids with useful errors", async () => {
    const { repo, loadPack } = repository();
    await expect(repo.loadRuleArticle("missing")).rejects.toMatchObject({
      code: "unknown-article",
      ruleId: "missing",
      message: expect.stringContaining("missing"),
    });
    await expect(repo.loadRuleEntity("missing")).rejects.toMatchObject({
      code: "unknown-entity",
      ruleId: "missing",
    });
    expect(loadPack).not.toHaveBeenCalled();
  });

  it("loads a single entity from its manifest pack", async () => {
    const { repo } = repository();
    await expect(repo.loadRuleEntity("item:shield")).resolves.toBe(
      expandedEntity,
    );
    await expect(repo.loadRuleEntity("ability:strike")).resolves.toBe(
      coreEntity,
    );
  });

  it("rejects packs with an unsupported schema without caching them", async () => {
    const loadPack = vi.fn(() =>
      Promise.resolve({
        schemaVersion: 2,
        articles: [],
        entities: [],
      } as unknown as RulePack),
    );
    const repo = createRuleRepository({ manifest, loadPack });
    await expect(repo.loadRuleArticle("a1")).rejects.toMatchObject({
      code: "invalid-pack",
    });
    await expect(repo.loadRuleArticle("a1")).rejects.toMatchObject({
      code: "invalid-pack",
    });
    expect(loadPack).toHaveBeenCalledTimes(2);
  });
});

describe("rule search corpus", () => {
  it("stays unloaded while browsing articles and loads on first search", async () => {
    const { repo, loadPack, loadSearchIndex } = repository();
    const loaded = await repo.loadRuleArticle("a1");
    expect(loaded.article.id).toBe("a1");
    expect(loadPack).toHaveBeenCalled();
    expect(loadSearchIndex).not.toHaveBeenCalled();

    await expect(repo.loadRuleSearchIndex()).resolves.toBe(searchIndex);
    expect(loadSearchIndex).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent corpus requests and caches the result", async () => {
    let resolveIndex: (index: RuleSearchIndex) => void = () => undefined;
    const loadSearchIndex = vi.fn(
      () =>
        new Promise<RuleSearchIndex>((resolve) => {
          resolveIndex = resolve;
        }),
    );
    const repo = createRuleRepository({
      manifest,
      loadPack: () => Promise.resolve(packs().core),
      loadSearchIndex,
    });
    const first = repo.loadRuleSearchIndex();
    const second = repo.loadRuleSearchIndex();
    expect(loadSearchIndex).toHaveBeenCalledTimes(1);
    resolveIndex(searchIndex);
    await expect(first).resolves.toBe(searchIndex);
    await expect(second).resolves.toBe(searchIndex);
    await expect(repo.loadRuleSearchIndex()).resolves.toBe(searchIndex);
    expect(loadSearchIndex).toHaveBeenCalledTimes(1);
  });

  it("retries a failed corpus load instead of caching the failure", async () => {
    let attempts = 0;
    const loadSearchIndex = vi.fn(() => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve(searchIndex);
    });
    const repo = createRuleRepository({
      manifest,
      loadPack: () => Promise.resolve(packs().core),
      loadSearchIndex,
    });
    await expect(repo.loadRuleSearchIndex()).rejects.toMatchObject({
      name: "RuleDataError",
      code: "search-failed",
    });
    await expect(repo.loadRuleSearchIndex()).resolves.toBe(searchIndex);
    expect(attempts).toBe(2);
  });

  it("rejects an incomplete or foreign corpus without caching it", async () => {
    const incomplete = {
      schemaVersion: 1,
      articles: [{ id: "a1", text: "Статья a1" }],
    } as RuleSearchIndex;
    const loadSearchIndex = vi
      .fn()
      .mockResolvedValueOnce(incomplete)
      .mockResolvedValueOnce(searchIndex);
    const repo = createRuleRepository({
      manifest,
      loadPack: () => Promise.resolve(packs().core),
      loadSearchIndex,
    });
    await expect(repo.loadRuleSearchIndex()).rejects.toMatchObject({
      name: "RuleDataError",
      code: "invalid-search-index",
      message: expect.stringContaining("формат"),
    });
    await expect(repo.loadRuleSearchIndex()).resolves.toBe(searchIndex);
    expect(loadSearchIndex).toHaveBeenCalledTimes(2);

    const foreign = {
      schemaVersion: 1,
      articles: [...searchIndex.articles, { id: "ghost", text: "x" }],
    } as RuleSearchIndex;
    const rejecting = createRuleRepository({
      manifest,
      loadPack: () => Promise.resolve(packs().core),
      loadSearchIndex: () => Promise.resolve(foreign),
    });
    await expect(rejecting.loadRuleSearchIndex()).rejects.toMatchObject({
      code: "invalid-search-index",
    });
  });
});

describe("rules index navigation", () => {
  const index = manifest.articles;

  it("prefers an explicit article link", () => {
    expect(
      resolveRuleIndexEntry(index, {
        articleId: "a2",
        chapter: "01. Введение",
        group: "",
      })?.id,
    ).toBe("a2");
  });

  it("opens the first non-empty article of a chapter or group", () => {
    expect(
      resolveRuleIndexEntry(index, {
        articleId: "",
        chapter: "02. Основы",
        group: "",
      })?.id,
    ).toBe("a3");
    expect(
      resolveRuleIndexEntry(index, {
        articleId: "",
        chapter: "01. Введение",
        group: "Основы",
      })?.id,
    ).toBe("a2");
  });

  it("returns undefined for the catalog and unknown routes", () => {
    expect(
      resolveRuleIndexEntry(index, { articleId: "", chapter: "", group: "" }),
    ).toBeUndefined();
    expect(
      resolveRuleIndexEntry(index, {
        articleId: "missing",
        chapter: "",
        group: "",
      }),
    ).toBeUndefined();
    expect(
      resolveRuleIndexEntry(index, {
        articleId: "",
        chapter: "01. Введение",
        group: "Неизвестный",
      }),
    ).toBeUndefined();
  });
});
