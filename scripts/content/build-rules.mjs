#!/usr/bin/env node
/**
 * Детерминированная сборка доставки правил.
 *
 * Читает ТОЛЬКО каноническое дерево `content/rules/**` (статьи + сущности) и
 * пишет `src/generated/rules/manifest.json`, ленивый поисковый корпус
 * `src/generated/rules/search.json` и пакеты
 * `src/generated/rules/packs/<packId>.json`. Устаревшие generated JSON не
 * читаются и не изменяются.
 */
import { readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  RULE_KINDS,
  compareStrings,
  headingId,
  jsonText,
  normalizeSearchText,
  packIdForArticle,
  readJson,
  walkJson,
  writeJsonText,
} from "./lib/common.mjs";
import { decorateRulesPack } from "./lib/originals.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const KIND_SET = new Set(RULE_KINDS);

function parseArgs(argv) {
  const options = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--root" || arg === "--content" || arg === "--out") {
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
  console.log(`Использование: node scripts/content/build-rules.mjs [опции]

Опции:
  --root <dir>     корень репозитория
  --content <dir>  каноническое дерево (по умолчанию content/rules)
  --out <dir>      каталог доставки (по умолчанию src/generated/rules)
  --check          сравнить с уже собранными файлами, ничего не писать`);
}

function fail(message) {
  throw new Error(`Ошибка канонических правил: ${message}`);
}

function assertString(value, label) {
  if (typeof value !== "string") fail(`${label}: ожидалась строка`);
}

function validateArticle(article, file) {
  assertString(article?.id, `${file}: id`);
  assertString(article.title, `${file}: title`);
  assertString(article.chapter, `${file}: chapter`);
  assertString(article.group, `${file}: group`);
  assertString(article.path, `${file}: path`);
  if (!Array.isArray(article.blocks)) fail(`${file}: blocks должен быть массивом`);
  article.blocks.forEach((block, index) => {
    if (block?.type === "markdown") {
      assertString(block.text, `${file}: blocks[${index}].text`);
      return;
    }
    if (block?.type === "entity") {
      assertString(block.ref, `${file}: blocks[${index}].ref`);
      return;
    }
    fail(`${file}: blocks[${index}] имеет неизвестный тип`);
  });
}

function validateEntity(entity, file) {
  assertString(entity?.id, `${file}: id`);
  if (!KIND_SET.has(entity.kind)) fail(`${file}: неизвестный kind ${entity.kind}`);
  assertString(entity.name, `${file}: name`);
  assertString(entity.markdown, `${file}: markdown`);
  if (!entity.markdown.trim()) fail(`${file}: пустой markdown`);
  if (!entity.source || typeof entity.source !== "object") {
    fail(`${file}: source обязателен`);
  }
  assertString(entity.source.articleId, `${file}: source.articleId`);
  assertString(entity.source.path, `${file}: source.path`);
  if (!Array.isArray(entity.legacyIds)) {
    fail(`${file}: legacyIds должен быть массивом`);
  }
  entity.legacyIds.forEach((legacyId, index) =>
    assertString(legacyId, `${file}: legacyIds[${index}]`),
  );
  if (entity.ability !== undefined && typeof entity.ability !== "object") {
    fail(`${file}: ability должен быть объектом`);
  }
}

function renderArticle(article, entities) {
  return article.blocks
    .map((block) =>
      block.type === "markdown"
        ? block.text
        : entities.get(block.ref)?.markdown ?? "",
    )
    .join("");
}

/** Точно повторяет `codex-index.generated.json`, включая хвостовые пробелы. */
function manifestHeadings(text) {
  const headings = [];
  for (const match of text.matchAll(/^(#{1,6})\s+(.+)$/gm)) {
    headings.push({
      id: headingId(match[2]),
      title: match[2],
      level: match[1].length,
    });
  }
  return headings;
}

export function buildRules({
  root = REPO_ROOT,
  contentDir = path.join(root, "content/rules"),
  outDir = path.join(root, "src/generated/rules"),
  check = false,
} = {}) {
  const articleFiles = walkJson(path.join(contentDir, "articles"));
  const entityFiles = walkJson(path.join(contentDir, "entities"));
  if (articleFiles.length === 0) {
    fail(`в ${path.relative(root, contentDir)} нет статей`);
  }

  const articles = [];
  const articleById = new Map();
  for (const file of articleFiles) {
    let article;
    try {
      article = readJson(file);
    } catch (error) {
      fail(`${path.relative(root, file)}: ${error.message}`);
    }
    validateArticle(article, path.relative(root, file));
    if (articleById.has(article.id)) {
      fail(`повторяющийся ID статьи ${article.id}`);
    }
    articleById.set(article.id, article);
    articles.push(article);
  }

  const entities = [];
  const entityById = new Map();
  for (const file of entityFiles) {
    let entity;
    try {
      entity = readJson(file);
    } catch (error) {
      fail(`${path.relative(root, file)}: ${error.message}`);
    }
    validateEntity(entity, path.relative(root, file));
    if (entityById.has(entity.id)) {
      fail(`повторяющийся ID сущности ${entity.id}`);
    }
    const sourceArticle = articleById.get(entity.source.articleId);
    if (!sourceArticle) {
      fail(
        `${path.relative(root, file)}: source.articleId ${entity.source.articleId} не существует`,
      );
    }
    if (sourceArticle.path !== entity.source.path) {
      fail(
        `${path.relative(root, file)}: source.path не совпадает со статьёй ${sourceArticle.id}`,
      );
    }
    entityById.set(entity.id, entity);
    entities.push(entity);
  }

  const referenced = new Set();
  for (const article of articles) {
    for (const block of article.blocks) {
      if (block.type !== "entity") continue;
      referenced.add(block.ref);
      if (!entityById.has(block.ref)) {
        fail(`статья ${article.id} ссылается на неизвестную сущность ${block.ref}`);
      }
    }
  }

  const legacyIdOwners = new Map();
  for (const entity of entities) {
    for (const legacyId of entity.legacyIds) {
      const owner = legacyIdOwners.get(legacyId);
      if (owner && owner !== entity.id) {
        fail(`legacy ID ${legacyId} принадлежит и ${owner}, и ${entity.id}`);
      }
      legacyIdOwners.set(legacyId, entity.id);
    }
  }

  const unreferenced = entities
    .filter((entity) => !referenced.has(entity.id))
    .map((entity) => entity.id)
    .sort(compareStrings);

  const articlePack = new Map();
  for (const article of articles) {
    articlePack.set(article.id, packIdForArticle(article));
  }

  const packArticles = new Map();
  const packEntities = new Map();
  const manifestArticles = [];
  const searchArticles = [];

  for (const article of [...articles].sort((a, b) => compareStrings(a.id, b.id))) {
    const packId = articlePack.get(article.id);
    const rendered = renderArticle(article, entityById);
    const headings = manifestHeadings(rendered);
    // Текст в исходном регистре: из него строятся фрагменты выдачи. Манифест
    // содержит только навигацию, поэтому полная проза не грузится при чтении.
    const searchSource = `${article.title} ${article.group} ${rendered}`
      .replace(/\s+/g, " ")
      .trim();
    const entry = {
      id: article.id,
      title: article.title,
      chapter: article.chapter,
      group: article.group,
      path: article.path,
      packId,
      headings,
      hasText: normalizeSearchText(searchSource).length > 0,
    };
    manifestArticles.push(entry);
    searchArticles.push({ id: article.id, text: searchSource });
    const list = packArticles.get(packId) ?? [];
    list.push(article);
    packArticles.set(packId, list);
  }

  for (const entity of [...entities].sort((a, b) => compareStrings(a.id, b.id))) {
    const packId = articlePack.get(entity.source.articleId);
    const list = packEntities.get(packId) ?? [];
    list.push(entity);
    packEntities.set(packId, list);
  }

  const packIds = [...new Set([...packArticles.keys(), ...packEntities.keys()])].sort(
    compareStrings,
  );
  const packs = new Map();
  for (const packId of packIds) {
    packs.set(packId, {
      schemaVersion: 1,
      articles: [...(packArticles.get(packId) ?? [])].sort((a, b) =>
        compareStrings(a.id, b.id),
      ),
      entities: [...(packEntities.get(packId) ?? [])].sort((a, b) =>
        compareStrings(a.id, b.id),
      ),
    });
  }

  for (const pack of packs.values()) decorateRulesPack(pack);

  const manifestEntityMap = {};
  for (const entity of [...entities].sort((a, b) => compareStrings(a.id, b.id))) {
    manifestEntityMap[entity.id] = {
      packId: articlePack.get(entity.source.articleId),
      kind: entity.kind,
    };
  }

  const manifest = {
    schemaVersion: 1,
    articles: manifestArticles,
    entities: manifestEntityMap,
  };

  const searchIndex = {
    schemaVersion: 1,
    articles: searchArticles,
  };

  const expected = new Map();
  expected.set(path.join(outDir, "manifest.json"), jsonText(manifest));
  expected.set(path.join(outDir, "search.json"), jsonText(searchIndex));
  for (const [packId, pack] of [...packs.entries()].sort((a, b) =>
    compareStrings(a[0], b[0]),
  )) {
    expected.set(path.join(outDir, "packs", `${packId}.json`), jsonText(pack));
  }

  const differences = [];
  if (check) {
    const actualFiles = walkJson(outDir);
    const actual = new Set(actualFiles);
    for (const [file, text] of expected) {
      if (!actual.has(file)) {
        differences.push(`отсутствует ${path.relative(root, file)}`);
        continue;
      }
      let current = "";
      try {
        current = readFileSync(file, "utf8");
      } catch {
        current = "";
      }
      if (current !== text) {
        differences.push(`отличается ${path.relative(root, file)}`);
      }
    }
    for (const file of actualFiles) {
      if (!expected.has(file)) {
        differences.push(`лишний ${path.relative(root, file)}`);
      }
    }
    differences.sort(compareStrings);
  } else {
    for (const [file, text] of expected) {
      const directory = path.dirname(file);
      if (file.includes(`${path.sep}packs${path.sep}`)) {
        try {
          for (const entry of readdirSync(directory)) {
            const full = path.join(directory, entry);
            if (entry.endsWith(".json") && !expected.has(full)) {
              rmSync(full, { force: true });
            }
          }
        } catch {
          /* каталога ещё нет — writeJson создаст его */
        }
      }
      writeJsonText(file, text);
    }
  }

  const stats = {
    articles: articles.length,
    entities: entities.length,
    packs: packs.size,
    unreferenced,
    bytes: [...expected.values()].reduce(
      (sum, text) => sum + Buffer.byteLength(text, "utf8"),
      0,
    ),
    searchBytes: Buffer.byteLength(
      expected.get(path.join(outDir, "search.json")),
      "utf8",
    ),
  };

  return {
    manifest,
    packs,
    stats,
    expected,
    differences,
    ok: differences.length === 0,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const root = path.resolve(options.root ?? REPO_ROOT);
  const contentDir = path.resolve(
    options.content ?? path.join(root, "content/rules"),
  );
  const outDir = path.resolve(
    options.out ?? path.join(root, "src/generated/rules"),
  );
  const result = buildRules({
    root,
    contentDir,
    outDir,
    check: options.check,
  });
  console.log("=== build-rules ===");
  console.log(`Статей:       ${result.stats.articles}`);
  console.log(`Сущностей:    ${result.stats.entities}`);
  console.log(`Пакетов:      ${result.stats.packs}`);
  console.log(`Размер:       ${(result.stats.bytes / 1024).toFixed(1)} КБ`);
  console.log(
    `Поиск:        ${(result.stats.searchBytes / 1024).toFixed(1)} КБ (лениво)`,
  );
  if (result.stats.unreferenced.length > 0) {
    console.log(
      `Без ссылок:   ${result.stats.unreferenced.length} (${result.stats.unreferenced
        .slice(0, 5)
        .join(", ")}${result.stats.unreferenced.length > 5 ? "…" : ""})`,
    );
  }
  if (options.check) {
    if (result.ok) {
      console.log("Проверка:     собранные файлы совпадают с каноническими.");
    } else {
      console.log(`Расхождения: ${result.differences.length}`);
      for (const difference of result.differences.slice(0, 20)) {
        console.log(`  - ${difference}`);
      }
      if (result.differences.length > 20) {
        console.log(`  … ещё ${result.differences.length - 20}`);
      }
      process.exitCode = 1;
    }
  } else {
    console.log(`Каталог:      ${path.relative(root, outDir)}`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
