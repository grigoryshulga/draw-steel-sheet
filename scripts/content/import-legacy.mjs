#!/usr/bin/env node
/**
 * Явная миграция закоммиченных устаревших наборов в каноническое дерево.
 *
 * Читает только `src/data/*.generated.json` (внешний vault не нужен) и пишет
 * `content/rules/articles/**` и `content/rules/entities/**`. Повторный запуск
 * без `--replace` останавливается, чтобы не перезаписать ручную правку.
 *
 * Извлечение точное:
 * - способность получает полный исходный цитатный блок, а не сводку;
 * - классовая/происхожденческая особенность — ровно тот заголовок/абзац,
 *   чей текст совпал с legacy-описанием;
 * - составные особенности (внутри есть извлечённая способность) сохраняются
 *   в статье как последовательность ссылок, а в отчёт попадают как composite;
 * - синтетические строки таблиц, не имеющие собственного блока, остаются
 *   прозой статьи и честно перечисляются как unmapped;
 * - второй и третий этапы добавляют комплекты, сокровища, проекты, титулы,
 *   виды происхождений, классы, карьеры, культуры и нюансы из уже собранного
 *   дерева (`migrate-entities.mjs`), поэтому свежий импорт сразу даёт то же
 *   каноническое дерево, что и инкрементальная миграция.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RULE_KINDS,
  chapterSlug,
  compareStrings,
  findDatasetConsumers,
  keyName,
  normalizeName,
  parseAbilityBlocks,
  parseHeadings,
  parseTraitRegions,
  readJson,
  safeFileStem,
  slugify,
  walkJson,
  writeJson,
} from "./lib/common.mjs";
import {
  buildStageTwoReport,
  extractStageTwo,
  STAGE_TWO_NOTES,
} from "./migrate-entities.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const LEGACY_FILES = {
  codex: "codex.generated.json",
  codexIndex: "codex-index.generated.json",
  abilities: "abilities.generated.json",
  classFeatures: "class-features.generated.json",
  ancestryFeatures: "ancestry-features.generated.json",
  perks: "perks.generated.json",
  kits: "kits.generated.json",
  library: "library-articles.generated.json",
  builder: "builder.generated.json",
  levelUp: "level-up.generated.json",
};

const PERK_ARTICLES = {
  crafting: "1002",
  exploration: "1003",
  interpersonal: "1004",
  intrigue: "1005",
  lore: "1006",
  supernatural: "1007",
};

function parseArgs(argv) {
  const options = { replace: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--replace") options.replace = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--root" || arg === "--source" || arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error(`Не указано значение для ${arg}`);
      options[arg.slice(2)] = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Неизвестный аргумент: ${arg}`);
    }
  }
  return options;
}

function usage() {
  console.log(`Использование: node scripts/content/import-legacy.mjs [опции]

Опции:
  --source <dir>  каталог устаревших generated JSON (по умолчанию src/data)
  --out <dir>     каталог канонических правил (по умолчанию content/rules)
  --root <dir>    корень репозитория для поиска потребителей и значений по умолчанию
  --replace       перезаписать существующие канонические файлы
  --dry-run       проверить и показать отчёт, ничего не писать`);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label}: ожидался массив`);
  return value;
}

function loadLegacy(sourceDir) {
  const data = {};
  for (const [key, file] of Object.entries(LEGACY_FILES)) {
    const full = path.join(sourceDir, file);
    try {
      data[key] = readJson(full);
    } catch (error) {
      throw new Error(`Не удалось прочитать ${full}: ${error.message}`);
    }
  }
  data.codex = requireArray(data.codex, LEGACY_FILES.codex);
  data.abilities = requireArray(data.abilities, LEGACY_FILES.abilities);
  data.classFeatures = requireArray(
    data.classFeatures,
    LEGACY_FILES.classFeatures,
  );
  data.ancestryFeatures = requireArray(
    data.ancestryFeatures,
    LEGACY_FILES.ancestryFeatures,
  );
  data.perks = requireArray(data.perks?.perks, `${LEGACY_FILES.perks}.perks`);
  return data;
}

function normalizeCompendiumAbility(ability) {
  const preferred =
    ability.preferredCharacteristic &&
    ability.rollCharacteristics?.includes(ability.preferredCharacteristic)
      ? ability.preferredCharacteristic
      : (ability.rollCharacteristics?.[0] ?? "");
  return { ...ability, preferredCharacteristic: preferred };
}

function abilityGroup(ability) {
  if (ability.sourceKind === "class") {
    return `class-${slugify(ability.className)}`;
  }
  if (ability.sourceKind === "kit") {
    return `kit-${slugify(ability.className.replace(/^Комплект:\s*/, ""))}`;
  }
  return "basics";
}

function classFeatureGroup(feature) {
  return `class-${slugify(feature.className)}`;
}

function ancestryFeatureGroup(feature) {
  return `ancestry-${slugify(feature.ancestryName)}`;
}

function perkGroup(perk) {
  return `perk-${slugify(perk.type)}`;
}

function classArticleIds(codex, className, level) {
  return codex
    .filter(
      (article) =>
        article.chapter?.startsWith("08.") && article.group === className,
    )
    .filter((article) => {
      const match = /^(\d+)-й\s+Уровень/i.exec(article.title ?? "");
      return Boolean(match && Number(match[1]) === level);
    })
    .map((article) => article.id);
}

function kitArticleIds(codex, className) {
  const kit = className.replace(/^Комплект:\s*/, "");
  return codex
    .filter(
      (article) =>
        article.chapter?.startsWith("09.") &&
        article.group === "Список Комплектов" &&
        article.title === kit,
    )
    .map((article) => article.id);
}

function basicArticleIds(codex) {
  return codex
    .filter((article) => article.chapter?.startsWith("13."))
    .map((article) => article.id);
}

function expectedAbilityArticleIds(codex, ability) {
  if (ability.sourceKind === "class") {
    return classArticleIds(codex, ability.className, ability.level);
  }
  if (ability.sourceKind === "kit") {
    return kitArticleIds(codex, ability.className);
  }
  return basicArticleIds(codex);
}

function regionKey(articleId, start) {
  return `${articleId}:${start}`;
}

function articleBlocks(article, regions) {
  const blocks = [];
  let cursor = 0;
  for (const region of regions) {
    if (region.start < cursor) {
      throw new Error(
        `Пересечение блоков статьи ${article.id}: ${region.start} < ${cursor}`,
      );
    }
    if (region.start > cursor) {
      blocks.push({
        type: "markdown",
        text: article.markdown.slice(cursor, region.start),
      });
    }
    blocks.push({ type: "entity", ref: region.id });
    cursor = region.end;
  }
  if (cursor < article.markdown.length) {
    blocks.push({
      type: "markdown",
      text: article.markdown.slice(cursor),
    });
  }
  if (article.markdown.length === 0) return [];
  if (blocks.length === 0) {
    return [{ type: "markdown", text: article.markdown }];
  }
  return blocks;
}

function render(article, entities) {
  return article.blocks
    .map((block) =>
      block.type === "markdown"
        ? block.text
        : entities.get(block.ref)?.entity.markdown ?? "",
    )
    .join("");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const root = path.resolve(options.root ?? REPO_ROOT);
  const sourceDir = path.resolve(options.source ?? path.join(root, "src/data"));
  const outDir = path.resolve(options.out ?? path.join(root, "content/rules"));

  const legacy = loadLegacy(sourceDir);
  const codex = [...legacy.codex].sort((a, b) => compareStrings(a.id, b.id));
  const articleById = new Map();
  for (const article of codex) {
    if (articleById.has(article.id)) {
      throw new Error(`Повторяющийся ID статьи: ${article.id}`);
    }
    articleById.set(article.id, article);
  }

  const headingsByArticle = new Map();
  const abilityBlocksByArticle = new Map();
  for (const article of codex) {
    headingsByArticle.set(article.id, parseHeadings(article.markdown));
    abilityBlocksByArticle.set(article.id, parseAbilityBlocks(article.markdown));
  }

  const entities = new Map(); // id -> { entity, group }
  const regions = []; // { articleId, start, end, id, kind, headingLineLength?, originalEnd? }
  const blockEntity = new Map(); // "articleId:start" -> entity id
  const featureMappings = [];

  function addEntity(entity, group) {
    if (!RULE_KINDS.includes(entity.kind)) {
      throw new Error(`Неизвестный вид сущности: ${entity.kind}`);
    }
    if (entities.has(entity.id)) {
      throw new Error(`Повторяющийся ID сущности: ${entity.id}`);
    }
    entities.set(entity.id, { entity, group });
  }

  function addLegacyId(entityId, legacyId) {
    const entry = entities.get(entityId);
    if (!entry) throw new Error(`Нет сущности ${entityId} для ${legacyId}`);
    if (!entry.entity.legacyIds.includes(legacyId)) {
      entry.entity.legacyIds.push(legacyId);
    }
  }

  // ---------- способности ----------
  const abilityStats = {
    total: legacy.abilities.length,
    mapped: 0,
    unmapped: [],
    ambiguous: [],
  };

  for (const ability of legacy.abilities) {
    const expected = new Set(expectedAbilityArticleIds(codex, ability));
    const candidates = [];
    for (const articleId of expected) {
      for (const block of abilityBlocksByArticle.get(articleId) ?? []) {
        if (keyName(block.name) === keyName(ability.name)) {
          candidates.push({ block, articleId });
        }
      }
    }
    if (candidates.length !== 1) {
      const target = candidates.length > 1 ? "ambiguous" : "unmapped";
      abilityStats[target].push({
        id: ability.id,
        name: ability.name,
        className: ability.className,
        level: ability.level,
        expectedArticles: [...expected].sort(compareStrings),
        candidates: candidates.map((item) => item.articleId),
      });
      continue;
    }
    const [{ block, articleId }] = candidates;
    const article = articleById.get(articleId);
    const entity = {
      id: `ability.${ability.id}`,
      kind: "ability",
      name: block.name,
      markdown: block.markdown,
      source: { articleId, path: article.path },
      legacyIds: [ability.id],
      ability: normalizeCompendiumAbility(ability),
    };
    addEntity(entity, abilityGroup(ability));
    blockEntity.set(regionKey(articleId, block.start), entity.id);
    regions.push({
      articleId,
      start: block.start,
      end: block.end,
      id: entity.id,
      kind: "ability",
    });
    abilityStats.mapped += 1;
  }

  // ---------- классовыe особенности ----------
  const classFeatureStats = {
    total: legacy.classFeatures.length,
    heading: 0,
    composite: 0,
    abilityBlock: 0,
    unmapped: [],
    ambiguous: [],
  };
  const featureRegions = new Map();

  for (const feature of legacy.classFeatures) {
    const article = articleById.get(feature.articleId);
    if (!article) {
      classFeatureStats.unmapped.push({
        id: feature.id,
        name: feature.name,
        articleId: feature.articleId,
        reason: "article-not-found",
      });
      continue;
    }
    const description = (feature.description ?? "").trim();
    const articleBlocksList = abilityBlocksByArticle.get(article.id) ?? [];
    const abilityMatches = articleBlocksList.filter(
      (block) =>
        block.body === description &&
        blockEntity.has(regionKey(article.id, block.start)),
    );
    const headingMatches = (headingsByArticle.get(article.id) ?? [])
      .filter(
        (heading) =>
          heading.level >= 4 &&
          !heading.caption &&
          keyName(heading.name) === keyName(feature.name),
      )
      .map((heading) => ({
        heading,
        body: article.markdown
          .slice(heading.start + heading.line.length, heading.end)
          .replace(/^\n/, "")
          .trim(),
      }))
      .filter((item) => item.body === description);

    if (abilityMatches.length === 1 && headingMatches.length === 0) {
      const block = abilityMatches[0];
      const entityId = blockEntity.get(regionKey(article.id, block.start));
      addLegacyId(entityId, feature.id);
      featureMappings.push({
        id: feature.id,
        name: feature.name,
        articleId: article.id,
        entityId,
        type: "ability-block",
      });
      classFeatureStats.abilityBlock += 1;
      continue;
    }
    if (abilityMatches.length + headingMatches.length > 1) {
      classFeatureStats.ambiguous.push({
        id: feature.id,
        name: feature.name,
        articleId: article.id,
        abilityBlocks: abilityMatches.map((block) => block.start),
        headings: headingMatches.map((item) => item.heading.start),
      });
      continue;
    }
    if (headingMatches.length === 1) {
      const { heading } = headingMatches[0];
      const key = `${article.id}:${heading.start}:${heading.end}`;
      let entityId = featureRegions.get(key);
      if (entityId) {
        addLegacyId(entityId, feature.id);
      } else {
        entityId = `feature.${feature.id}`;
        addEntity(
          {
            id: entityId,
            kind: "feature",
            name: heading.name,
            markdown: article.markdown.slice(heading.start, heading.end),
            source: { articleId: article.id, path: article.path },
            legacyIds: [feature.id],
          },
          classFeatureGroup(feature),
        );
        const region = {
          articleId: article.id,
          start: heading.start,
          end: heading.end,
          originalEnd: heading.end,
          headingLineLength: heading.line.length,
          id: entityId,
          kind: "feature",
          composite: false,
        };
        featureRegions.set(key, entityId);
        regions.push(region);
      }
      const region = regions.find(
        (item) =>
          item.articleId === article.id &&
          item.start === heading.start &&
          item.kind === "feature",
      );
      featureMappings.push({
        id: feature.id,
        name: feature.name,
        articleId: article.id,
        entityId,
        type: "heading",
        region,
      });
      continue;
    }
    classFeatureStats.unmapped.push({
      id: feature.id,
      name: feature.name,
      articleId: article.id,
      parentId: feature.parentId ?? null,
      reason:
        feature.parentId && !description.includes("\n")
          ? "synthetic-table-row"
          : "no-exact-heading-or-ability-block",
    });
  }

  // ---------- особенности происхождений ----------
  const ancestryStats = {
    total: legacy.ancestryFeatures.length,
    mapped: 0,
    unmapped: [],
    ambiguous: [],
  };

  for (const feature of legacy.ancestryFeatures) {
    const article = articleById.get(feature.articleId);
    if (!article) {
      ancestryStats.unmapped.push({
        id: feature.id,
        name: feature.name,
        articleId: feature.articleId,
        reason: "article-not-found",
      });
      continue;
    }
    const description = (feature.description ?? "").trim();
    let region;
    if (feature.kind === "signature") {
      const matches = (headingsByArticle.get(article.id) ?? [])
        .filter((heading) => heading.level >= 4 && !heading.caption)
        .map((heading) => {
          const match =
            /^знаковая\s+черта\s*:?\s*(.+)$/i.exec(heading.name) ?? null;
          if (!match || keyName(match[1]) !== keyName(feature.name)) return null;
          const body = article.markdown
            .slice(heading.start + heading.line.length, heading.end)
            .replace(/^\n/, "")
            .trim();
          return body === description
            ? { heading, name: normalizeName(match[1]) }
            : null;
        })
        .filter(Boolean);
      if (matches.length === 1) {
        region = {
          start: matches[0].heading.start,
          end: matches[0].heading.end,
          name: matches[0].name,
        };
      }
      if (matches.length > 1) {
        ancestryStats.ambiguous.push({
          id: feature.id,
          name: feature.name,
          articleId: article.id,
          headings: matches.map((item) => item.heading.start),
        });
        continue;
      }
    } else {
      const matches = parseTraitRegions(article.markdown).filter(
        (trait) =>
          keyName(trait.name) === keyName(feature.name) &&
          trait.body === description,
      );
      if (matches.length === 1) {
        region = {
          start: matches[0].start,
          end: matches[0].end,
          name: matches[0].name,
        };
      }
      if (matches.length > 1) {
        ancestryStats.ambiguous.push({
          id: feature.id,
          name: feature.name,
          articleId: article.id,
          traits: matches.map((trait) => trait.start),
        });
        continue;
      }
    }
    if (!region) {
      ancestryStats.unmapped.push({
        id: feature.id,
        name: feature.name,
        articleId: article.id,
        reason: "no-exact-heading-or-trait",
      });
      continue;
    }
    const entityId = `feature.${feature.id}`;
    addEntity(
      {
        id: entityId,
        kind: "feature",
        name: region.name,
        markdown: article.markdown.slice(region.start, region.end),
        source: { articleId: article.id, path: article.path },
        legacyIds: [feature.id],
      },
      ancestryFeatureGroup(feature),
    );
    regions.push({
      articleId: article.id,
      start: region.start,
      end: region.end,
      originalEnd: region.end,
      id: entityId,
      kind: "feature",
      composite: false,
    });
    ancestryStats.mapped += 1;
  }

  // ---------- перки ----------
  const perkStats = {
    total: legacy.perks.length,
    mapped: 0,
    lossyLegacyProjection: [],
    unmapped: [],
    ambiguous: [],
  };

  for (const perk of legacy.perks) {
    const articleId = PERK_ARTICLES[perk.type];
    const article = articleById.get(articleId);
    if (!article) {
      perkStats.unmapped.push({
        id: perk.id,
        name: perk.name,
        type: perk.type,
        reason: "article-not-found",
      });
      continue;
    }
    const matches = (headingsByArticle.get(article.id) ?? []).filter(
      (heading) =>
        heading.level === 4 &&
        !heading.caption &&
        keyName(heading.name) === keyName(perk.name),
    );
    if (matches.length !== 1) {
      const target = matches.length > 1 ? "ambiguous" : "unmapped";
      perkStats[target].push({
        id: perk.id,
        name: perk.name,
        type: perk.type,
        articleId: article.id,
      });
      continue;
    }
    const heading = matches[0];
    const body = article.markdown
      .slice(heading.start + heading.line.length, heading.end)
      .replace(/^\n/, "")
      .trim();
    if (body !== (perk.description ?? "").trim()) {
      perkStats.lossyLegacyProjection.push({
        id: perk.id,
        name: perk.name,
        articleId: article.id,
        note: "legacy description is a plain-text projection; canonical markdown keeps the full block",
      });
    }
    const entityId = `perk.${perk.id}`;
    addEntity(
      {
        id: entityId,
        kind: "perk",
        name: heading.name,
        markdown: article.markdown.slice(heading.start, heading.end),
        source: { articleId: article.id, path: article.path },
        legacyIds: [perk.id],
      },
      perkGroup(perk),
    );
    regions.push({
      articleId: article.id,
      start: heading.start,
      end: heading.end,
      originalEnd: heading.end,
      headingLineLength: heading.line.length,
      id: entityId,
      kind: "feature",
      composite: false,
    });
    perkStats.mapped += 1;
  }

  // ---------- составные особенности: обрезаем по первой извлечённой способности ----------
  for (const region of regions) {
    if (region.kind !== "feature" || region.headingLineLength === undefined) {
      continue;
    }
    const article = articleById.get(region.articleId);
    const contained = regions
      .filter(
        (candidate) =>
          candidate.articleId === region.articleId &&
          candidate.kind === "ability" &&
          candidate.start >= region.start &&
          candidate.end <= (region.originalEnd ?? region.end),
      )
      .sort((a, b) => a.start - b.start);
    if (contained.length === 0) continue;
    const first = contained[0].start;
    if (first <= region.start) {
      throw new Error(
        `Невозможно разрезать особенность ${region.id}: способность начинается раньше заголовка`,
      );
    }
    region.composite = true;
    region.end = Math.min(region.end, first);
    const entity = entities.get(region.id)?.entity;
    if (!entity) throw new Error(`Нет сущности ${region.id}`);
    entity.markdown = article.markdown.slice(region.start, region.end);
  }

  for (const mapping of featureMappings) {
    if (mapping.type === "ability-block") continue;
    if (mapping.region?.composite) {
      mapping.type = "composite";
      classFeatureStats.composite += 1;
    } else {
      classFeatureStats.heading += 1;
    }
  }

  // ---------- проверки целостности ----------
  const legacyIdOwners = new Map();
  for (const { entity } of entities.values()) {
    for (const legacyId of entity.legacyIds) {
      const owner = legacyIdOwners.get(legacyId);
      if (owner && owner !== entity.id) {
        throw new Error(
          `Legacy ID ${legacyId} принадлежит и ${owner}, и ${entity.id}`,
        );
      }
      legacyIdOwners.set(legacyId, entity.id);
    }
  }

  for (const region of regions) {
    const article = articleById.get(region.articleId);
    const entity = entities.get(region.id)?.entity;
    if (!entity) throw new Error(`Ссылка на неизвестную сущность ${region.id}`);
    const expected = article.markdown.slice(region.start, region.end);
    if (entity.markdown !== expected) {
      throw new Error(
        `Текст сущности ${region.id} не совпадает с диапазоном статьи ${article.id}`,
      );
    }
  }

  const regionsByArticle = new Map();
  for (const region of regions) {
    if (region.end <= region.start) {
      throw new Error(`Пустой диапазон сущности ${region.id}`);
    }
    const list = regionsByArticle.get(region.articleId) ?? [];
    list.push(region);
    regionsByArticle.set(region.articleId, list);
  }

  const canonicalArticles = [];
  for (const article of codex) {
    const list = (regionsByArticle.get(article.id) ?? []).sort(
      (a, b) => a.start - b.start || a.end - b.end,
    );
    const blocks = articleBlocks(article, list);
    const canonical = {
      id: article.id,
      title: article.title,
      chapter: article.chapter,
      group: article.group,
      path: article.path,
      blocks,
    };
    if (render(canonical, entities) !== article.markdown) {
      throw new Error(`Статья ${article.id} не восстанавливается без потерь`);
    }
    canonicalArticles.push(canonical);
  }

  // ---------- второй этап: комплекты, сокровища, проекты, титулы, виды ----------
  const stageTwoResult = extractStageTwo({
    articles: canonicalArticles,
    entities,
    legacy: {
      kits: legacy.kits,
      library: legacy.library,
      builder: legacy.builder,
      classFeatures: legacy.classFeatures,
    },
  });
  canonicalArticles.splice(0, canonicalArticles.length, ...stageTwoResult.articles);

  // ---------- отчёт ----------
  const entityCounts = {};
  for (const kind of RULE_KINDS) entityCounts[kind] = 0;
  for (const { entity } of entities.values()) {
    entityCounts[entity.kind] += 1;
  }

  const unmappedAbilityLikeBlocks = [];
  for (const article of codex) {
    for (const block of abilityBlocksByArticle.get(article.id) ?? []) {
      if (!block.structured) continue;
      if (blockEntity.has(regionKey(article.id, block.start))) continue;
      unmappedAbilityLikeBlocks.push({
        articleId: article.id,
        name: block.name,
        reason: "outside-legacy-ability-dataset-or-embedded-in-feature",
      });
    }
  }

  const remainingConsumers = findDatasetConsumers(
    root,
    Object.values(LEGACY_FILES),
  );

  const stageTwoReport = buildStageTwoReport({
    articles: canonicalArticles,
    entities,
    legacy: {
      kits: legacy.kits,
      library: legacy.library,
      builder: legacy.builder,
      classFeatures: legacy.classFeatures,
    },
  });

  const report = {
    schemaVersion: 1,
    generatedBy: "scripts/content/import-legacy.mjs",
    sourceDirectory: path
      .relative(root, sourceDir)
      .replaceAll(path.sep, "/") || ".",
    sourceFiles: Object.values(LEGACY_FILES).sort(compareStrings),
    counts: {
      articles: canonicalArticles.length,
      entities: entityCounts,
      legacy: {
        abilities: legacy.abilities.length,
        classFeatures: legacy.classFeatures.length,
        ancestryFeatures: legacy.ancestryFeatures.length,
        perks: legacy.perks.length,
        kits: Array.isArray(legacy.kits) ? legacy.kits.length : null,
        libraryArticles: Array.isArray(legacy.library)
          ? legacy.library.length
          : null,
      },
    },
    coverage: {
      abilities: {
        mapped: abilityStats.mapped,
        total: abilityStats.total,
      },
      classFeatures: {
        mapped:
          classFeatureStats.heading +
          classFeatureStats.composite +
          classFeatureStats.abilityBlock,
        total: classFeatureStats.total,
        heading: classFeatureStats.heading,
        composite: classFeatureStats.composite,
        abilityBlock: classFeatureStats.abilityBlock,
        unmapped: classFeatureStats.unmapped.length,
      },
      ancestryFeatures: {
        mapped: ancestryStats.mapped,
        total: ancestryStats.total,
      },
      perks: {
        mapped: perkStats.mapped,
        total: perkStats.total,
        lossyLegacyProjection: perkStats.lossyLegacyProjection.length,
      },
      ...stageTwoReport.coverage,
    },
    compositeFeatures: featureMappings
      .filter((mapping) => mapping.type === "composite")
      .map((mapping) => ({
        id: mapping.id,
        name: mapping.name,
        articleId: mapping.articleId,
        entityId: mapping.entityId,
      }))
      .sort((a, b) => compareStrings(a.id, b.id)),
    unmapped: {
      abilities: abilityStats.unmapped,
      classFeatures: classFeatureStats.unmapped,
      ancestryFeatures: ancestryStats.unmapped,
      perks: perkStats.unmapped,
      abilityLikeBlocks: unmappedAbilityLikeBlocks,
    },
    ambiguous: {
      abilities: abilityStats.ambiguous,
      classFeatures: classFeatureStats.ambiguous,
      ancestryFeatures: ancestryStats.ambiguous,
      perks: perkStats.ambiguous,
    },
    deferred: stageTwoReport.deferred,
    gaps: stageTwoReport.gaps,
    fieldEncoding: stageTwoReport.stageThree.fieldEncoding,
    stageTwo: stageTwoReport,
    stageThree: stageTwoReport.stageThree,
    remainingConsumers,
    notes: [
      "Legacy ability IDs не переписаны: они сохранены в legacyIds и в прежних сохранениях.",
      "Способности хранят полный исходный Markdown; ability — только структурированная проекция.",
      "Синтетические строки таблиц (30 class features) остаются прозой статьи и перечислены в unmapped.",
      "Старые generated JSON не удалены: они остаются входными данными для ещё не мигрировавших потребителей.",
      "Повторный импорт без --replace не перезаписывает канонические файлы.",
      ...STAGE_TWO_NOTES,
    ],
  };
  report.unmapped.classFeatures.sort((a, b) => compareStrings(a.id, b.id));
  report.ambiguous.classFeatures.sort((a, b) => compareStrings(a.id, b.id));

  // ---------- запись ----------
  const planned = new Map(); // file -> value
  for (const article of canonicalArticles) {
    const file = path.join(
      outDir,
      "articles",
      chapterSlug(article.chapter),
      `${safeFileStem(article.id)}.json`,
    );
    planned.set(file, article);
  }
  for (const { entity, group } of entities.values()) {
    const file = path.join(
      outDir,
      "entities",
      entity.kind,
      group,
      `${safeFileStem(entity.id)}.json`,
    );
    if (planned.has(file)) {
      throw new Error(`Коллизия пути канонического файла: ${file}`);
    }
    planned.set(file, entity);
  }

  const existing = [
    ...walkJson(path.join(outDir, "articles")),
    ...walkJson(path.join(outDir, "entities")),
  ];
  if (existing.length > 0 && !options.replace && !options.dryRun) {
    throw new Error(
      `В ${path.relative(root, outDir)} уже есть ${existing.length} канонических файлов. ` +
        "Чтобы осознанно перезаписать их, запустите с --replace.",
    );
  }

  const staleFiles = existing
    .filter((file) => !planned.has(file))
    .map((file) => path.relative(outDir, file).replaceAll(path.sep, "/"))
    .sort(compareStrings);

  if (!options.dryRun) {
    for (const [file, value] of [...planned.entries()].sort((a, b) =>
      compareStrings(a[0], b[0]),
    )) {
      writeJson(file, value);
    }
    writeJson(path.join(outDir, "migration-report.json"), {
      ...report,
      staleFiles,
    });
  }

  console.log("=== import-legacy ===");
  console.log(`Статей:                 ${canonicalArticles.length}`);
  console.log(
    `Сущностей:              ${Object.values(entityCounts).reduce((sum, value) => sum + value, 0)} ` +
      JSON.stringify(entityCounts),
  );
  console.log(
    `Способности:            ${abilityStats.mapped}/${abilityStats.total}`,
  );
  console.log(
    `Классовые особенности:  ${classFeatureStats.heading + classFeatureStats.composite + classFeatureStats.abilityBlock}/${classFeatureStats.total} ` +
      `(heading ${classFeatureStats.heading}, composite ${classFeatureStats.composite}, ability ${classFeatureStats.abilityBlock})`,
  );
  console.log(
    `Происхождения:          ${ancestryStats.mapped}/${ancestryStats.total}`,
  );
  console.log(`Перки:                  ${perkStats.mapped}/${perkStats.total}`);
  console.log(
    `Второй этап:            kits ${stageTwoReport.coverage.kits.mapped}/${stageTwoReport.coverage.kits.total}, ` +
      `items ${stageTwoReport.coverage.items.mapped}/${stageTwoReport.coverage.items.total}, ` +
      `projects ${stageTwoReport.coverage.projects.mapped}/${stageTwoReport.coverage.projects.total}, ` +
      `titles ${stageTwoReport.coverage.titles.mapped}/${stageTwoReport.coverage.titles.total}, ` +
      `ancestries ${stageTwoReport.coverage.ancestrySpecies.mapped}/${stageTwoReport.coverage.ancestrySpecies.total}`,
  );
  console.log(
    `Третий этап:            classes ${stageTwoReport.coverage.classes.mapped}/${stageTwoReport.coverage.classes.total}, ` +
      `careers ${stageTwoReport.coverage.careers.mapped}/${stageTwoReport.coverage.careers.total}, ` +
      `cultures ${stageTwoReport.coverage.cultures.mapped}/${stageTwoReport.coverage.cultures.total}, ` +
      `complications ${stageTwoReport.coverage.complications.mapped}/${stageTwoReport.coverage.complications.total}, ` +
      `summoner features ${stageTwoReport.coverage.summonerFeatures.mapped}/${stageTwoReport.coverage.summonerFeatures.total}`,
  );
  console.log(
    `Не мигрировано:         class features ${classFeatureStats.unmapped.length}, ability-like blocks ${unmappedAbilityLikeBlocks.length}`,
  );
  if (staleFiles.length > 0 && !options.dryRun) {
    console.log(
      `Устаревшие файлы:       ${staleFiles.length} (не удалены, перечислены в migration-report.json)`,
    );
  }
  if (options.dryRun) console.log("Режим --dry-run: файлы не записаны.");
  else console.log(`Каталог:                ${path.relative(root, outDir)}`);
}

main();
