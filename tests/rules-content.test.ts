import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES = path.join(ROOT, "content/rules");
const GENERATED = path.join(ROOT, "src/generated/rules");
const IMPORT = path.join(ROOT, "scripts/content/import-legacy.mjs");
const BUILD = path.join(ROOT, "scripts/content/build-rules.mjs");

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walkJson(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkJson(full);
      return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
    });
}

function relativeFiles(directory: string) {
  return walkJson(directory).map((file) =>
    path.relative(directory, file).replaceAll(path.sep, "/"),
  );
}

function hashTree(directory: string) {
  return new Map(
    walkJson(directory).map((file) => [
      path.relative(directory, file).replaceAll(path.sep, "/"),
      createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    ]),
  );
}

const legacyCodex = readJson(path.join(ROOT, "src/data/codex.generated.json")) as any[];
const legacyIndex = readJson(
  path.join(ROOT, "src/data/codex-index.generated.json"),
) as any[];
const legacyAbilities = readJson(
  path.join(ROOT, "src/data/abilities.generated.json"),
) as any[];
const legacyClassFeatures = readJson(
  path.join(ROOT, "src/data/class-features.generated.json"),
) as any[];
const manifest = readJson(path.join(GENERATED, "manifest.json"));
const searchIndex = readJson(path.join(GENERATED, "search.json"));
const report = readJson(path.join(RULES, "migration-report.json"));

const canonicalArticles = walkJson(path.join(RULES, "articles"))
  .map(readJson)
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const canonicalEntities = walkJson(path.join(RULES, "entities"))
  .map(readJson)
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const entityById = new Map(
  canonicalEntities.map((entity) => [entity.id, entity]),
);
const legacyArticleById = new Map(
  legacyCodex.map((article) => [article.id, article]),
);
const legacyIndexById = new Map(
  legacyIndex.map((article) => [article.id, article]),
);
const packs = new Map(
  walkJson(path.join(GENERATED, "packs")).map((file) => [
    path.basename(file, ".json"),
    readJson(file),
  ]),
);

describe("canonical rules content", () => {
  it("publishes the frozen manifest and lazy packs from the canonical tree", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.articles).toHaveLength(canonicalArticles.length);
    expect(Object.keys(manifest.entities)).toHaveLength(
      canonicalEntities.length,
    );
    expect(manifest.articles.map((entry: any) => entry.id).sort()).toEqual(
      canonicalArticles.map((article) => article.id).sort(),
    );
    expect(canonicalArticles.map((article) => article.id).sort()).toEqual(
      legacyCodex.map((article) => article.id).sort(),
    );

    for (const entry of manifest.articles) {
      expect(packs.has(entry.packId), entry.id).toBe(true);
      expect(typeof entry.hasText, entry.id).toBe("boolean");
      expect("searchText" in entry, entry.id).toBe(false);
      const pack = packs.get(entry.packId);
      expect(pack.schemaVersion).toBe(1);
      expect(pack.articles.some((article: any) => article.id === entry.id)).toBe(
        true,
      );
    }
    for (const [id, target] of Object.entries(manifest.entities) as any[]) {
      expect(entityById.has(id), id).toBe(true);
      expect(target.kind).toBe(entityById.get(id).kind);
      expect(packs.has(target.packId), id).toBe(true);
      expect(
        packs
          .get(target.packId)
          .entities.some((entity: any) => entity.id === id),
        id,
      ).toBe(true);
    }
  });

  it("reconstructs every legacy article without losing Markdown, tables or links", () => {
    const mismatches: string[] = [];
    for (const article of canonicalArticles) {
      const rendered = article.blocks
        .map((block: any) =>
          block.type === "markdown"
            ? block.text
            : (entityById.get(block.ref)?.markdown ?? ""),
        )
        .join("");
      const legacy = legacyArticleById.get(article.id);
      if (!legacy || rendered !== legacy.markdown) mismatches.push(article.id);
    }
    expect(mismatches).toEqual([]);
  });

  it("keeps existing heading IDs and article routes", () => {
    const mismatches: any[] = [];
    for (const entry of manifest.articles) {
      const legacy = legacyIndexById.get(entry.id);
      const actual = entry.headings.map((heading: any) => ({
        id: heading.id,
        title: heading.title,
      }));
      const expected = (legacy?.headings ?? []).map((heading: any) => ({
        id: heading.id,
        title: heading.title,
      }));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push({ articleId: entry.id });
      }
    }
    expect(mismatches).toEqual([]);

    const links = canonicalArticles.flatMap((article) =>
      article.blocks
        .filter((block: any) => block.type === "markdown")
        .map((block: any) => block.text)
        .join("")
        .match(/#\/codex\/[0-9A-Za-z-]+/g) ?? [],
    );
    expect(links.length).toBeGreaterThan(0);
  });

  it("stores every mapped ability as the full Markdown block plus a structured projection", () => {
    const byLegacy = new Map<string, any>();
    for (const entity of canonicalEntities) {
      for (const legacyId of entity.legacyIds) byLegacy.set(legacyId, entity);
    }
    const problems: any[] = [];
    for (const ability of legacyAbilities) {
      const entity = byLegacy.get(ability.id);
      if (!entity) {
        problems.push({ ability: ability.id, reason: "missing" });
        continue;
      }
      if (entity.kind !== "ability") {
        problems.push({ ability: ability.id, reason: "kind" });
      }
      if (entity.ability?.id !== ability.id) {
        problems.push({ ability: ability.id, reason: "projection" });
      }
      if (!entity.markdown.includes("**")) {
        problems.push({ ability: ability.id, reason: "markdown" });
      }
      if (!entity.markdown.includes(ability.name)) {
        // Заголовок мог отличаться регистром, но имя обязано присутствовать.
        const lower = entity.markdown.toLocaleLowerCase("ru");
        if (!lower.includes(ability.name.toLocaleLowerCase("ru"))) {
          problems.push({ ability: ability.id, reason: "name" });
        }
      }
    }
    expect(problems).toEqual([]);

    const abilities = canonicalEntities.filter(
      (entity) => entity.kind === "ability",
    );
    expect(abilities).toHaveLength(512);
    expect(
      abilities.filter((entity) => entity.legacyIds.length > 1).length,
    ).toBe(52);
    expect(
      abilities.some((entity) => entity.markdown.includes("📏")),
    ).toBe(true);
    expect(
      abilities.some((entity) => entity.markdown.includes("#/codex/")),
    ).toBe(true);
    expect(
      abilities.every((entity) => {
        const characteristics = entity.ability?.rollCharacteristics ?? [];
        return characteristics.length === 0
          ? entity.ability?.preferredCharacteristic === ""
          : characteristics.includes(entity.ability.preferredCharacteristic);
      }),
    ).toBe(true);
  });

  it("keeps IDs stable, unique and every reference resolved", () => {
    const ids = new Set<string>();
    const legacyIds = new Map<string, string>();
    const duplicates: string[] = [];
    const legacyDuplicates: any[] = [];
    for (const entity of canonicalEntities) {
      if (ids.has(entity.id)) duplicates.push(entity.id);
      ids.add(entity.id);
      for (const legacyId of entity.legacyIds) {
        if (legacyIds.has(legacyId)) {
          legacyDuplicates.push({
            legacyId,
            first: legacyIds.get(legacyId),
            second: entity.id,
          });
        }
        legacyIds.set(legacyId, entity.id);
      }
    }
    expect(duplicates).toEqual([]);
    expect(legacyDuplicates).toEqual([]);

    const unresolved: any[] = [];
    for (const article of canonicalArticles) {
      for (const block of article.blocks) {
        if (block.type !== "entity") continue;
        if (!entityById.has(block.ref)) {
          unresolved.push({ article: article.id, ref: block.ref });
          continue;
        }
        const entity = entityById.get(block.ref);
        const source = legacyArticleById.get(entity.source.articleId);
        if (!source || source.path !== entity.source.path) {
          unresolved.push({ article: article.id, ref: block.ref, source: true });
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("keeps full-text search equal to the reconstructed article, including entity text", () => {
    const mismatches: string[] = [];
    for (const article of canonicalArticles) {
      const rendered = article.blocks
        .map((block: any) =>
          block.type === "markdown"
            ? block.text
            : (entityById.get(block.ref)?.markdown ?? ""),
        )
        .join("");
      const expected = `${article.title} ${article.group} ${rendered}`
        .toLocaleLowerCase("ru")
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ")
        .trim();
      const document = searchIndex.articles.find(
        (candidate: any) => candidate.id === article.id,
      );
      const actual = document?.text
        ?.toLocaleLowerCase("ru")
        .replace(/ё/g, "е");
      if (actual !== expected) mismatches.push(article.id);
    }
    expect(mismatches).toEqual([]);
  });

  it("keeps the whole search corpus out of the eagerly loaded manifest", () => {
    expect(searchIndex.schemaVersion).toBe(1);
    expect(searchIndex.articles.map((document: any) => document.id)).toEqual(
      manifest.articles.map((entry: any) => entry.id),
    );

    const manifestText = fs.readFileSync(
      path.join(GENERATED, "manifest.json"),
      "utf8",
    );
    const searchText = fs.readFileSync(
      path.join(GENERATED, "search.json"),
      "utf8",
    );
    // Манифест — только навигация: корпус обязан быть заметно больше него.
    expect(manifestText.length).toBeLessThan(searchText.length);

    // Проза статьи не должна встречаться в манифесте ни в каком регистре.
    const prose = canonicalArticles
      .filter((article) => article.blocks.some((b: any) => b.type === "markdown"))
      .map((article) => {
        const markdown = article.blocks
          .filter((block: any) => block.type === "markdown")
          .map((block: any) => block.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        return markdown.slice(0, 120);
      })
      .filter((text) => text.length >= 80);
    expect(prose.length).toBeGreaterThan(0);
    for (const text of prose) {
      expect(manifestText.toLowerCase()).not.toContain(
        text.toLowerCase(),
      );
    }
  });

  it("keeps composite feature descriptions exactly reconstructible from article blocks", () => {
    const articleById = new Map(
      canonicalArticles.map((article) => [article.id, article]),
    );
    const legacyFeatureById = new Map(
      legacyClassFeatures.map((feature) => [feature.id, feature]),
    );
    const problems: any[] = [];
    for (const composite of report.compositeFeatures) {
      const article = articleById.get(composite.articleId);
      const legacy = legacyFeatureById.get(composite.id);
      if (!article || !legacy) {
        problems.push({ id: composite.id, reason: "missing" });
        continue;
      }
      const start = article.blocks.findIndex(
        (block: any) =>
          block.type === "entity" && block.ref === composite.entityId,
      );
      if (start < 0) {
        problems.push({ id: composite.id, reason: "block" });
        continue;
      }
      let text = entityById
        .get(composite.entityId)
        .markdown.replace(/^#{4,6}\s+.*\n?/, "");
      for (let index = start + 1; index < article.blocks.length; index += 1) {
        const block = article.blocks[index];
        if (index > start && block.type === "entity") {
          if (entityById.get(block.ref)?.kind === "feature") break;
          text += entityById.get(block.ref)?.markdown ?? "";
          continue;
        }
        if (block.type !== "markdown") {
          text += entityById.get(block.ref)?.markdown ?? "";
          continue;
        }
        const nextHeading = /^#{4,6}\s+/m.exec(block.text);
        if (nextHeading) {
          text += block.text.slice(0, nextHeading.index);
          break;
        }
        text += block.text;
      }
      if (text.trim() !== legacy.description.trim()) {
        problems.push({ id: composite.id, reason: "content" });
      }
    }
    expect(problems).toEqual([]);

    const abilityBlockFeatures = canonicalEntities.filter(
      (entity) => entity.kind === "ability" && entity.legacyIds.length > 1,
    );
    const abilityProblems: any[] = [];
    for (const entity of abilityBlockFeatures) {
      for (const legacyId of entity.legacyIds.slice(1)) {
        const legacy = legacyFeatureById.get(legacyId);
        if (!legacy) continue;
        const body = entity.markdown
          .split("\n")
          .slice(1)
          .map((line: string) => line.replace(/^>\s?/, ""))
          .join("\n")
          .trim();
        if (body !== legacy.description.trim()) {
          abilityProblems.push({ id: legacyId });
        }
      }
    }
    expect(abilityProblems).toEqual([]);
  });

  it("emits an honest, actionable migration report", () => {
    expect(report.coverage.abilities).toEqual({ mapped: 512, total: 512 });
    expect(report.coverage.classFeatures).toMatchObject({
      mapped: 815,
      total: 845,
      unmapped: 30,
      abilityBlock: 52,
      composite: 185,
    });
    expect(report.coverage.ancestryFeatures).toEqual({
      mapped: 97,
      total: 97,
    });
    expect(report.coverage.perks).toMatchObject({ mapped: 47, total: 47 });
    expect(report.ambiguous).toEqual({
      abilities: [],
      classFeatures: [],
      ancestryFeatures: [],
      perks: [],
    });
    expect(report.unmapped.abilities).toEqual([]);
    expect(report.unmapped.ancestryFeatures).toEqual([]);
    expect(report.unmapped.perks).toEqual([]);
    expect(report.unmapped.classFeatures).toHaveLength(30);
    expect(
      report.unmapped.classFeatures.every(
        (feature: any) => feature.reason === "synthetic-table-row",
      ),
    ).toBe(true);
    expect(report.deferred).toEqual([]);
    // Этап 2: каталоги больше не читают старые датасеты — их в инвентаре нет.
    expect(
      report.remainingConsumers.some(
        (consumer: any) => consumer.path === "src/data/compendium.ts",
      ),
    ).toBe(false);
    expect(
      report.remainingConsumers.some(
        (consumer: any) => consumer.path === "src/data/library.ts",
      ),
    ).toBe(false);
    expect(report.notes.join(" ")).toContain("не удалены");
    expect(legacyClassFeatures.length).toBe(845);

    const mappedLegacyIds = new Set(
      canonicalEntities.flatMap((entity) => entity.legacyIds),
    );
    const unmappedClassIds = new Set(
      report.unmapped.classFeatures.map((feature: any) => feature.id),
    );
    const lost: string[] = [];
    for (const feature of legacyClassFeatures) {
      if (
        !mappedLegacyIds.has(feature.id) &&
        !unmappedClassIds.has(feature.id)
      ) {
        lost.push(feature.id);
      }
    }
    expect(lost).toEqual([]);
  });
});

describe("content commands", () => {
  it(
    "is deterministic and accepts an authoring edit",
    () => {
      const first = fs.mkdtempSync(path.join(os.tmpdir(), "rules-build-a-"));
      const second = fs.mkdtempSync(path.join(os.tmpdir(), "rules-build-b-"));
      execFileSync(process.execPath, [BUILD, "--out", first], {
        cwd: ROOT,
        stdio: "pipe",
      });
      execFileSync(process.execPath, [BUILD, "--out", second], {
        cwd: ROOT,
        stdio: "pipe",
      });
      expect(hashTree(first)).toEqual(hashTree(second));
      expect(relativeFiles(first)).toEqual(relativeFiles(second));

      execFileSync(process.execPath, [BUILD, "--check"], {
        cwd: ROOT,
        stdio: "pipe",
      });

      const authored = fs.mkdtempSync(path.join(os.tmpdir(), "rules-edit-"));
      fs.cpSync(RULES, path.join(authored, "content/rules"), {
        recursive: true,
      });
      const articleFile = path.join(
        authored,
        "content/rules/articles/08-klassy/0802.json",
      );
      const article = readJson(articleFile);
      article.title = "Проверка правки";
      fs.writeFileSync(articleFile, `${JSON.stringify(article, null, 2)}\n`);

      const entityFile = path.join(
        authored,
        "content/rules/entities/ability/class-neistovyy/ability.neistovyy-linii-sily-baa1fcb51a.json",
      );
      const entity = readJson(entityFile);
      entity.markdown = `${entity.markdown}\n\n> Правка автора.`;
      fs.writeFileSync(entityFile, `${JSON.stringify(entity, null, 2)}\n`);

      const generated = path.join(authored, "generated");
      execFileSync(
        process.execPath,
        [BUILD, "--root", authored, "--out", generated],
        { cwd: ROOT, stdio: "pipe" },
      );
      const editedManifest = readJson(path.join(generated, "manifest.json"));
      expect(
        editedManifest.articles.find((entry: any) => entry.id === "0802").title,
      ).toBe("Проверка правки");
      const editedPack = readJson(
        path.join(generated, "packs/chapter-08-neistovyy.json"),
      );
      expect(
        editedPack.entities.find((item: any) => item.id === entity.id).markdown,
      ).toContain("Правка автора.");
      const editedSearch = readJson(path.join(generated, "search.json"));
      expect(
        editedSearch.articles.find((entry: any) => entry.id === "0801").text,
      ).toContain("Правка автора.");
    },
    60_000,
  );

  it(
    "refuses to overwrite curated content unless --replace is explicit",
    () => {
      const out = fs.mkdtempSync(path.join(os.tmpdir(), "rules-import-"));
      const noise = path.join(out, "articles/99-noise/old.json");
      fs.mkdirSync(path.dirname(noise), { recursive: true });
      fs.writeFileSync(noise, "{}\n");

      let failure: any;
      try {
        execFileSync(
          process.execPath,
          [IMPORT, "--source", path.join(ROOT, "src/data"), "--out", out],
          { cwd: ROOT, stdio: "pipe" },
        );
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeTruthy();
      expect(String(failure.stderr)).toContain("--replace");
      expect(fs.readFileSync(noise, "utf8")).toBe("{}\n");

      execFileSync(
        process.execPath,
        [
          IMPORT,
          "--source",
          path.join(ROOT, "src/data"),
          "--out",
          out,
          "--replace",
        ],
        { cwd: ROOT, stdio: "pipe" },
      );
      const firstHash = hashTree(out);
      expect(firstHash.size).toBeGreaterThan(1000);
      const rewrittenReport = readJson(
        path.join(out, "migration-report.json"),
      );
      expect(rewrittenReport.coverage.abilities.mapped).toBe(512);
      expect(rewrittenReport.staleFiles).toContain(
        "articles/99-noise/old.json",
      );

      execFileSync(
        process.execPath,
        [
          IMPORT,
          "--source",
          path.join(ROOT, "src/data"),
          "--out",
          out,
          "--replace",
        ],
        { cwd: ROOT, stdio: "pipe" },
      );
      expect(hashTree(out)).toEqual(firstHash);
    },
    60_000,
  );
});
