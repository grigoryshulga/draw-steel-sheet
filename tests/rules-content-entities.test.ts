import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { applyEnglishIds } from "../scripts/content/english-ids.mjs";
import { decorateKit, maps } from "../scripts/content/lib/originals.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES = path.join(ROOT, "content/rules");
const SOURCE = path.join(ROOT, "src/data");
const MIGRATE = path.join(ROOT, "scripts/content/migrate-entities.mjs");
const IMPORT = path.join(ROOT, "scripts/content/import-legacy.mjs");
const IDENTITY = path.join(ROOT, "scripts/content/lib/consumer-identity.json");

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

function hashTree(directory: string) {
  return new Map(
    walkJson(directory).map((file) => [
      path.relative(directory, file).replaceAll(path.sep, "/"),
      createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    ]),
  );
}

function render(article: any, entityById: Map<string, any>) {
  return article.blocks
    .map((block: any) =>
      block.type === "markdown"
        ? block.text
        : (entityById.get(block.ref)?.markdown ?? ""),
    )
    .join("");
}

/** Хэш только статей и сущностей: отчёт зависит от окружения. */
function contentHash(contentDir: string) {
  const hash = new Map<string, string>();
  for (const part of ["articles", "entities"]) {
    for (const [file, digest] of hashTree(path.join(contentDir, part))) {
      hash.set(`${part}/${file}`, digest);
    }
  }
  return hash;
}

function entityFileById(contentDir: string, id: string) {
  for (const file of walkJson(path.join(contentDir, "entities"))) {
    if (readJson(file).id === id) return file;
  }
  throw new Error(`Не найден файл сущности ${id}`);
}

const legacyCodex = readJson(path.join(SOURCE, "codex.generated.json")) as any[];
const legacyKits = readJson(path.join(SOURCE, "kits.generated.json")) as any[];
const legacyLibrary = readJson(
  path.join(SOURCE, "library-articles.generated.json"),
) as any[];
const legacyBuilder = readJson(path.join(SOURCE, "builder.generated.json"));
const report = readJson(path.join(RULES, "migration-report.json"));

const articles = walkJson(path.join(RULES, "articles"))
  .map(readJson)
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const entities = walkJson(path.join(RULES, "entities"))
  .map(readJson)
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const entityById = new Map(entities.map((entity) => [entity.id, entity]));
const articleById = new Map(articles.map((article) => [article.id, article]));
const legacyArticleById = new Map(
  legacyCodex.map((article) => [article.id, article]),
);
const legacyLibraryById = new Map(
  legacyLibrary.map((article) => [article.id, article]),
);

const KIND_NAMES = [
  "ancestry",
  "class",
  "career",
  "culture",
  "complication",
  "item",
  "kit",
  "project",
  "title",
];
const NEW_ENTITY_IDS = entities.filter((entity) =>
  KIND_NAMES.includes(entity.kind),
);

describe("stage two canonical entity kinds", () => {
  it("records exact coverage and legacy identities without inventing IDs", () => {
    expect(report.counts.entities).toEqual({
      ability: 512,
      feature: 860,
      ancestry: 14,
      class: 10,
      career: 18,
      culture: 13,
      complication: 100,
      kit: 22,
      perk: 47,
      item: 100,
      project: 19,
      title: 59,
    });
    expect(report.stageTwo.coverage).toEqual({
      kits: { mapped: 22, total: 22, unmapped: 0 },
      items: { mapped: 100, total: 100, sourceArticles: 13 },
      projects: { mapped: 19, total: 19 },
      titles: { mapped: 59, total: 59, sourceArticles: 4 },
      ancestrySpecies: { mapped: 14, total: 14 },
      classes: { mapped: 10, total: 10, withText: 9 },
      careers: { mapped: 18, total: 18 },
      cultures: {
        mapped: 13,
        total: 13,
        environment: 5,
        organization: 2,
        upbringing: 6,
      },
      complications: { mapped: 100, total: 100, sourceArticles: 4 },
      summonerFeatures: { mapped: 0, total: 0, sourceArticles: 10 },
      kits0924: { mapped: 1, total: 1 },
    });

    const kitOriginalIds = new Set(
      entities
        .filter((entity) => entity.kind === "kit")
        .map((entity) => entity.originalId),
    );
    const kitLegacyIds = legacyKits
      .filter((kit) =>
        kitOriginalIds.has(decorateKit({ legacyId: kit.id }).originalId),
      )
      .map((kit) => kit.id)
      .sort();
    expect(kitLegacyIds).toHaveLength(22);
    expect(kitLegacyIds).toEqual(legacyKits.map((kit) => kit.id).sort());

    const projects = entities.filter((entity) => entity.kind === "project");
    expect(projects.map((entity) => entity.source.articleId).sort()).toEqual(
      legacyLibrary
        .filter((article) => article.chapter.startsWith("16."))
        .map((article) => article.id)
        .sort(),
    );
    // Каждый проект ссылается на английский исходник своей статьи.
    expect(
      projects.every((project) => {
        const original = maps.catalog[project.source.articleId];
        const originalId =
          typeof original === "string" ? original : original?.originalId;
        return originalId === project.originalId;
      }),
    ).toBe(true);

    const itemMappingIds = report.stageTwo.mappings.items.flatMap(
      (mapping: any) => mapping.entityIds,
    );
    expect(itemMappingIds).toHaveLength(100);
    expect(new Set(itemMappingIds).size).toBe(100);
    const titleMappingIds = report.stageTwo.mappings.titles.flatMap(
      (mapping: any) => mapping.entityIds,
    );
    expect(titleMappingIds).toHaveLength(59);
    expect(new Set(titleMappingIds).size).toBe(59);

    expect(
      report.stageTwo.mappings.ancestrySpecies.map(
        (mapping: any) => mapping.articleId,
      ),
    ).toEqual(
      legacyBuilder.ancestries.map((entry: any) => entry.articleId).sort(),
    );
  });

  it("keeps every new entity referenced once by its own source article", () => {
    const references = new Map<string, string[]>();
    for (const article of articles) {
      for (const block of article.blocks) {
        if (block.type !== "entity") continue;
        const list = references.get(block.ref) ?? [];
        list.push(article.id);
        references.set(block.ref, list);
      }
    }

    const problems: any[] = [];
    for (const entity of NEW_ENTITY_IDS) {
      const source = articleById.get(entity.source.articleId);
      if (!source) {
        problems.push({ entity: entity.id, reason: "missing-source-article" });
        continue;
      }
      if (source.path !== entity.source.path) {
        problems.push({ entity: entity.id, reason: "source-path" });
      }
      const refs = references.get(entity.id) ?? [];
      // Класс — агрегат статьи для конструктора, а не блок статьи: он не
      // подменяет ссылки на особенности и способности.
      if (
        entity.kind !== "class" &&
        (refs.length !== 1 || refs[0] !== entity.source.articleId)
      ) {
        problems.push({ entity: entity.id, reason: "references", refs });
      }
      if (!entity.markdown.trim()) {
        problems.push({ entity: entity.id, reason: "empty-markdown" });
      }
    }
    expect(problems).toEqual([]);
  });

  it("reconstructs every article losslessly and compares with legacy Markdown", () => {
    const mismatches: string[] = [];
    for (const article of articles) {
      const legacy = legacyArticleById.get(article.id);
      const rendered = render(article, entityById);
      if (!legacy || rendered !== legacy.markdown) mismatches.push(article.id);
    }
    expect(mismatches).toEqual([]);
  });

  it("keeps kits as pre-ability rules and preserves their ability references", () => {
    const problems: any[] = [];
    for (const kit of entities.filter((entity) => entity.kind === "kit")) {
      const article = articleById.get(kit.source.articleId);
      if (!article) {
        problems.push({ kit: kit.id, reason: "article" });
        continue;
      }
      const kitIndex = article.blocks.findIndex(
        (block: any) => block.type === "entity" && block.ref === kit.id,
      );
      if (kitIndex !== 0) {
        problems.push({ kit: kit.id, reason: "not-first-block" });
        continue;
      }
      if (kit.source.articleId === "0924") {
        // Составной комплект: способности вложены в Markdown, статья — один
        // ссылочный блок, чтобы не переставлять прозу и карточки.
        if (article.blocks.length !== 1) {
          problems.push({ kit: kit.id, reason: "composite-blocks" });
        }
        if (!kit.markdown.includes("> **")) {
          problems.push({ kit: kit.id, reason: "missing-inlined-abilities" });
        }
        if (!kit.originalId) {
          problems.push({ kit: kit.id, reason: "original-id" });
        }
        continue;
      }
      const tail = article.blocks.slice(kitIndex + 1);
      if (
        tail.length === 0 ||
        !tail.every(
          (block: any) =>
            block.type === "entity" &&
            entityById.get(block.ref)?.kind === "ability",
        )
      ) {
        problems.push({ kit: kit.id, reason: "ability-refs" });
      }
      if (kit.markdown.includes("> **")) {
        problems.push({ kit: kit.id, reason: "contains-ability-block" });
      }
      if (!kit.originalId) {
        problems.push({ kit: kit.id, reason: "original-id" });
      }
    }
    expect(problems).toEqual([]);
  });

  it("extracts each item and title heading with its exact Markdown", () => {
    const problems: any[] = [];
    const expectedKinds = [
      { chapter: "18.", kind: "item" },
      { chapter: "19.", kind: "title" },
    ];
    for (const { chapter, kind } of expectedKinds) {
      const sourceArticles = legacyLibrary.filter((article) =>
        article.chapter.startsWith(chapter),
      );
      for (const source of sourceArticles) {
        const article = articleById.get(source.id);
        const rendered = render(article, entityById);
        const headings = [...rendered.matchAll(/^####\s+(.+)$/gm)].map(
          (match) => match[1].trim(),
        );
        const migrated = article.blocks
          .filter(
            (block: any) =>
              block.type === "entity" &&
              entityById.get(block.ref)?.kind === kind,
          )
          .map((block: any) => entityById.get(block.ref));
        if (migrated.length !== headings.length) {
          problems.push({
            article: source.id,
            reason: "count",
            headings: headings.length,
            entities: migrated.length,
          });
          continue;
        }
        migrated.forEach((entity: any, index: number) => {
          const heading = headings[index];
          if (!entity.markdown.startsWith(`#### ${heading}`)) {
            problems.push({ entity: entity.id, reason: "heading", heading });
          }
          if (!entity.source.path) {
            problems.push({ entity: entity.id, reason: "source" });
          }
        });
      }
    }
    expect(problems).toEqual([]);
  });

  it("maps projects to whole legacy library articles and ancestries to species intros", () => {
    const projectProblems: any[] = [];
    for (const project of entities.filter(
      (entity) => entity.kind === "project",
    )) {
      const library = legacyLibraryById.get(project.source.articleId);
      if (!library || project.markdown !== library.markdown) {
        projectProblems.push(project.id);
      }
    }
    expect(projectProblems).toEqual([]);

    const ancestryProblems: any[] = [];
    for (const ancestry of legacyBuilder.ancestries) {
      const matches = entities.filter(
        (entity) =>
          entity.kind === "ancestry" &&
          entity.source.articleId === ancestry.articleId,
      );
      if (matches.length !== 1) {
        ancestryProblems.push({ articleId: ancestry.articleId, matches: matches.length });
        continue;
      }
      const entity = matches[0];
      if (!entity.markdown.includes(String(ancestry.summary).trim())) {
        ancestryProblems.push({ articleId: ancestry.articleId, reason: "summary" });
      }
      const article = articleById.get(ancestry.articleId);
      const featureRefs = article.blocks.filter(
        (block: any) =>
          block.type === "entity" &&
          entityById.get(block.ref)?.kind === "feature",
      );
      if (featureRefs.length === 0) {
        ancestryProblems.push({ articleId: ancestry.articleId, reason: "traits" });
      }
    }
    expect(ancestryProblems).toEqual([]);
  });

  it("reports nested structured blocks instead of pretending they are separate entities", () => {
    const nested = report.stageTwo.unsupportedNested;
    expect(nested).toHaveLength(13);
    expect(nested.every((entry: any) => entry.entityId)).toBe(true);
    const names = nested.map((entry: any) => entry.name);
    expect(names).toContain("Поле Галлюцинации");
    expect(names).toContain("Драконье Пламя");
    expect(names).toContain("Выходи Играть");
    for (const entry of nested) {
      const entity = entityById.get(entry.entityId);
      expect(entity?.markdown).toContain(entry.name);
      expect(["item", "project", "title", "kit"]).toContain(entity.kind);
    }

    expect(report.stageTwo.deferred).toEqual([]);
    expect(report.stageTwo.inlinedAbilityBlocks).toHaveLength(5);
    expect(
      report.stageTwo.inlinedAbilityBlocks.every(
        (entry: any) => entry.articleId === "0924",
      ),
    ).toBe(true);
  });

  it("uses only meaningful English names for new technical identifiers", () => {
    const cyrillic = /[А-Яа-яЁё]/;
    const groups = new Set<string>();
    const entityFiles = walkJson(path.join(RULES, "entities"));
    const fileById = new Map(
      entityFiles.map((file) => [readJson(file).id, file]),
    );
    for (const entity of NEW_ENTITY_IDS) {
      const prefix = entity.kind === "item" ? "treasure" : entity.kind;
      expect(entity.id).toMatch(
        /^(ancestry|class|career|culture|complication|treasure|kit|project|title)\.[a-z0-9.-]+$/,
      );
      expect(entity.id.startsWith(`${prefix}.`), entity.id).toBe(true);
      expect(entity.id).not.toMatch(cyrillic);
      expect(entity.name).not.toBe("");
      const file = fileById.get(entity.id);
      expect(file, entity.id).toBeTruthy();
      const group = path.basename(path.dirname(file as string));
      groups.add(`${entity.kind}/${group}`);
      expect(group).toMatch(/^[a-z][a-z-]*$/);
    }
    expect([...groups].sort()).toEqual([
      "ancestry/ancestry-species",
      "career/careers",
      "class/classes",
      "complication/complications",
      "culture/culture-environment",
      "culture/culture-organization",
      "culture/culture-upbringing",
      "item/artifacts",
      "item/consumables",
      "item/leveled-treasures",
      "item/trinkets",
      "kit/kits",
      "project/downtime-projects",
      "title/titles",
    ]);
  });

  it("builds class aggregates with structural summary, basics and features", () => {
    const classes = entities.filter((entity) => entity.kind === "class");
    expect(classes).toHaveLength(legacyBuilder.classes.length);
    expect(classes.map((entity) => entity.name).sort()).toEqual(
      legacyBuilder.classes.map((entry: any) => entry.name).sort(),
    );

    const problems: any[] = [];
    for (const entry of legacyBuilder.classes) {
      const matches = classes.filter(
        (entity) => entity.source.articleId === entry.articleId,
      );
      if (matches.length !== 1) {
        problems.push({ articleId: entry.articleId, matches: matches.length });
        continue;
      }
      const entity = matches[0];
      if (!entity.markdown.startsWith("#### Сводка")) {
        problems.push({ entity: entity.id, reason: "summary-heading" });
      }
      if (!entity.markdown.includes("\n\n#### Основы\n")) {
        problems.push({ entity: entity.id, reason: "basics-heading" });
      }
      if (
        !entity.markdown.includes(
          "\n\n#### Особенности 1-го уровня",
        )
      ) {
        problems.push({ entity: entity.id, reason: "features-heading" });
      }
      const article = articleById.get(entry.articleId);
      if (!article || article.path !== entity.source.path) {
        problems.push({ entity: entity.id, reason: "source" });
      }
      if (entry.articleId === "0821") {
        if (entity.markdown !== "#### Сводка\n\n#### Основы\n\n#### Особенности 1-го уровня") {
          problems.push({ entity: entity.id, reason: "empty-summoner" });
        }
        continue;
      }
      if (!entity.markdown.includes(entry.summary)) {
        problems.push({ entity: entity.id, reason: "summary-text" });
      }
      if (!entity.markdown.includes("**Начальные характеристики:**")) {
        problems.push({ entity: entity.id, reason: "basics-text" });
      }
      const featureHeadingCount =
        entity.markdown.match(/^##### /gm)?.length ?? 0;
      if (featureHeadingCount === 0) {
        problems.push({ entity: entity.id, reason: "feature-structure" });
      }
      if (
        entry.featureChoices.some(
          (choice: any) => !entity.markdown.includes(`##### ${choice.name}`),
        )
      ) {
        problems.push({ entity: entity.id, reason: "feature-choices" });
      }
      if (
        entry.subclasses
          .filter((subclass: any) => subclass.text)
          .some(
            (subclass: any) =>
              !entity.markdown.includes(`**${subclass.name}`),
          )
      ) {
        problems.push({ entity: entity.id, reason: "subclasses" });
      }
    }
    expect(problems).toEqual([]);
  });

  it("extracts careers with benefits, renown/wealth and six d6 incidents", () => {
    const careers = entities.filter((entity) => entity.kind === "career");
    expect(careers).toHaveLength(legacyBuilder.careers.length);
    const problems: any[] = [];
    for (const entry of legacyBuilder.careers) {
      const matches = careers.filter(
        (entity) => entity.source.articleId === entry.articleId,
      );
      if (matches.length !== 1) {
        problems.push({ articleId: entry.articleId, matches: matches.length });
        continue;
      }
      const entity = matches[0];
      if (entity.name !== entry.name) {
        problems.push({ entity: entity.id, reason: "name" });
      }
      if (!entity.markdown.includes(entry.benefits)) {
        problems.push({ entity: entity.id, reason: "benefits" });
      }
      if (!entity.markdown.includes("| **d6** |")) {
        problems.push({ entity: entity.id, reason: "incident-table" });
      }
      const incidents = [
        ...entity.markdown.matchAll(/^\|\s*\d+\s*\|\s*(.+?)\s*\|\s*$/gm),
      ];
      if (incidents.length !== 6) {
        problems.push({
          entity: entity.id,
          reason: "incidents",
          count: incidents.length,
        });
      }
      const renown = Number(
        entity.markdown.match(/\*\*Известность\*\*:?\s*:?\s*\+?(\d+)/)?.[1] ??
          0,
      );
      const wealth = Number(
        entity.markdown.match(/\*\*Богатство\*\*:?\s*:?\s*\+?(\d+)/)?.[1] ??
          0,
      );
      if (renown !== entry.renown || wealth !== entry.wealth) {
        problems.push({
          entity: entity.id,
          reason: "renown-wealth",
          renown,
          wealth,
        });
      }
      const article = articleById.get(entry.articleId);
      if (
        article?.blocks.length !== 1 ||
        article.blocks[0].type !== "entity" ||
        article.blocks[0].ref !== entity.id
      ) {
        problems.push({ entity: entity.id, reason: "article-ref" });
      }
    }
    expect(problems).toEqual([]);
  });

  it("extracts culture aspects and all one hundred complications by ordinal", () => {
    const cultures = entities.filter((entity) => entity.kind === "culture");
    expect(cultures).toHaveLength(13);
    const cultureProblems: any[] = [];
    for (const aspect of ["environment", "organization", "upbringing"] as const) {
      const expected = legacyBuilder.cultures[aspect];
      const articleId =
        aspect === "environment"
          ? "0502"
          : aspect === "organization"
            ? "0503"
            : "0504";
      const actual = cultures
        .filter((entity) => entity.source.articleId === articleId)
        .map((entity) => entity.name);
      if (actual.length !== expected.length) {
        cultureProblems.push({ aspect, actual: actual.length });
      }
      for (const entry of expected) {
        const matches = cultures.filter(
          (entity) =>
            entity.source.articleId === articleId &&
            entity.name === entry.name,
        );
        if (matches.length !== 1) {
          cultureProblems.push({ aspect, name: entry.name });
          continue;
        }
        if (!matches[0].markdown.startsWith(`#### ${entry.name}`)) {
          cultureProblems.push({ name: entry.name, reason: "heading" });
        }
        if (!matches[0].markdown.includes(entry.text)) {
          cultureProblems.push({ name: entry.name, reason: "text" });
        }
      }
    }
    expect(cultureProblems).toEqual([]);

    const complications = entities.filter(
      (entity) => entity.kind === "complication",
    );
    expect(complications).toHaveLength(
      legacyBuilder.complications.length,
    );
    expect(complications.map((entity) => entity.name).sort()).toEqual(
      legacyBuilder.complications.map((entry: any) => entry.name).sort(),
    );
    const complicationProblems: any[] = [];
    for (const entry of legacyBuilder.complications) {
      const matches = complications.filter(
        (entity) =>
          entity.source.articleId === entry.articleId &&
          entity.name === entry.name,
      );
      if (matches.length !== 1) {
        complicationProblems.push({
          articleId: entry.articleId,
          name: entry.name,
        });
        continue;
      }
      if (!matches[0].markdown.startsWith(`#### ${entry.name}`)) {
        complicationProblems.push({ name: entry.name, reason: "heading" });
      }
      if (!matches[0].markdown.includes(entry.text)) {
        complicationProblems.push({ name: entry.name, reason: "text" });
      }
    }
    expect(complicationProblems).toEqual([]);
    for (const articleId of ["1103", "1104", "1105", "1106"]) {
      const article = articleById.get(articleId);
      expect(
        article.blocks.filter(
          (block: any) =>
            block.type === "entity" &&
            entityById.get(block.ref)?.kind === "complication",
        ),
      ).toHaveLength(25);
    }
  });

  it("documents the empty Summoner source instead of inventing features", () => {
    const gap = report.gaps.find(
      (entry: any) =>
        entry.kind === "feature" && entry.className === "Призыватель",
    );
    expect(gap).toBeTruthy();
    expect(gap.reason).toContain("source-articles-empty");
    expect(
      entities.filter((entity) =>
        entity.id.startsWith("feature.prizyvatel."),
      ),
    ).toHaveLength(0);
    expect(report.coverage.summonerFeatures).toEqual({
      mapped: 0,
      total: 0,
      sourceArticles: 10,
    });
    const summoner = entities.find(
      (entity) => entity.kind === "class" && entity.name === "Призыватель",
    );
    expect(summoner?.markdown).toBe(
      "#### Сводка\n\n#### Основы\n\n#### Особенности 1-го уровня",
    );
  });
});

describe("stage two migration commands", () => {
  it(
    "is idempotent and preserves curated entity edits and article references",
    () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "rules-stage-two-"));
      const content = path.join(root, "content/rules");
      fs.cpSync(RULES, content, { recursive: true });
      const identityPath = path.join(root, "consumer-identity.json");
      fs.copyFileSync(IDENTITY, identityPath);
      const applyEnglish = () =>
        applyEnglishIds({ contentDir: content, identityPath });

      // Полный конвейер: свежий импорт устаревших наборов, затем английские
      // идентификаторы. Статьи и сущности обязаны совпасть с закоммиченным
      // каноническим деревом построчно.
      execFileSync(
        process.execPath,
        [IMPORT, "--source", SOURCE, "--out", content, "--replace"],
        { cwd: ROOT, stdio: "pipe" },
      );
      applyEnglish();
      const committed = contentHash(RULES);
      expect(contentHash(content)).toEqual(committed);

      execFileSync(
        process.execPath,
        [IMPORT, "--source", SOURCE, "--out", content, "--replace"],
        { cwd: ROOT, stdio: "pipe" },
      );
      applyEnglish();
      expect(contentHash(content)).toEqual(committed);

      const kitFile = entityFileById(content, "kit.rapid-fire");
      const kit = readJson(kitFile);
      kit.markdown += "\n\n> Авторская правка комплекта.";
      fs.writeFileSync(kitFile, `${JSON.stringify(kit, null, 2)}\n`);

      const abilityFile = entityFileById(
        content,
        "feature.ability.fury.level-1.lines-of-force",
      );
      const ability = readJson(abilityFile);
      ability.markdown += "\n\n> Не трогать.";
      fs.writeFileSync(abilityFile, `${JSON.stringify(ability, null, 2)}\n`);

      applyEnglish();
      expect(readJson(kitFile).markdown).toContain("Авторская правка комплекта.");
      expect(readJson(abilityFile).markdown).toContain("Не трогать.");
      expect(
        readJson(path.join(content, "articles/09-komplekty/0903.json")).blocks[0]
          .ref,
      ).toBe(kit.id);
    },
    60_000,
  );

  it(
    "refuses to guess when a source article and an edited entity disagree",
    () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "rules-conflict-"));
      fs.cpSync(RULES, path.join(root, "content/rules"), { recursive: true });
      const content = path.join(root, "content/rules");

      const kitFile = path.join(
        content,
        "entities/kit/kits/kit.kit-d79a75b7ea5c.json",
      );
      const kit = readJson(kitFile);
      kit.markdown += "\n\n> Расхождение.";
      fs.writeFileSync(kitFile, `${JSON.stringify(kit, null, 2)}\n`);

      const articleFile = path.join(content, "articles/09-komplekty/0903.json");
      const article = readJson(articleFile);
      article.blocks = [
        { type: "markdown", text: `${kit.markdown.split("\n\n> Расхождение.")[0]}\n` },
        article.blocks[1],
      ];
      fs.writeFileSync(articleFile, `${JSON.stringify(article, null, 2)}\n`);

      let failure: any;
      try {
        execFileSync(
          process.execPath,
          [MIGRATE, "--content", content, "--source", SOURCE],
          { cwd: ROOT, stdio: "pipe" },
        );
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeTruthy();
      expect(String(failure.stderr)).toContain("уже отредактирована");
    },
    30_000,
  );

  it(
    "produces the same stage two tree from a fresh legacy import",
    () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "rules-import-stage-two-"));
      const out = path.join(root, "content/rules");
      const identityPath = path.join(root, "consumer-identity.json");
      fs.copyFileSync(IDENTITY, identityPath);
      execFileSync(
        process.execPath,
        [IMPORT, "--source", SOURCE, "--out", out, "--replace"],
        { cwd: ROOT, stdio: "pipe" },
      );
      const first = hashTree(out);
      execFileSync(
        process.execPath,
        [IMPORT, "--source", SOURCE, "--out", out, "--replace"],
        { cwd: ROOT, stdio: "pipe" },
      );
      expect(hashTree(out)).toEqual(first);

      const importedReport = readJson(path.join(out, "migration-report.json"));
      expect(importedReport.stageTwo.coverage).toEqual(
        report.stageTwo.coverage,
      );
      expect(importedReport.deferred).toEqual(report.deferred);

      // Английские идентификаторы применяются к свежему импорту тем же
      // декоратором, что и к закоммиченному дереву.
      applyEnglishIds({ contentDir: out, identityPath });

      const importedArticles = walkJson(path.join(out, "articles"))
        .map(readJson)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const importedEntities = walkJson(path.join(out, "entities")).map(readJson);
      expect(importedEntities).toHaveLength(entities.length);
      const importedById = new Map(
        importedEntities.map((entity) => [entity.id, entity]),
      );

      const identityProblems: string[] = [];
      for (const entity of entities) {
        const imported = importedById.get(entity.id);
        if (
          !imported ||
          imported.kind !== entity.kind ||
          imported.originalId !== entity.originalId ||
          imported.originalName !== entity.originalName ||
          imported.markdown !== entity.markdown
        ) {
          identityProblems.push(entity.id);
        }
      }
      expect(identityProblems).toEqual([]);

      const mismatches: string[] = [];
      for (const article of importedArticles) {
        const legacy = legacyArticleById.get(article.id);
        const committed = articleById.get(article.id);
        if (
          !legacy ||
          render(article, importedById) !== legacy.markdown ||
          !committed ||
          JSON.stringify(article.blocks) !== JSON.stringify(committed.blocks)
        ) {
          mismatches.push(article.id);
        }
      }
      expect(mismatches).toEqual([]);
    },
    60_000,
  );
});
