#!/usr/bin/env node
/**
 * Инкрементальная миграция оставшихся видов сущностей из канонического дерева.
 *
 * Команда читает уже собранные `content/rules/articles/**` и
 * `content/rules/entities/**`, добавляет сущности комплектов, сокровищ,
 * проектов, титулов, видов происхождений, классов, карьер, культур и нюансов
 * и заменяет соответствующие участки статей ссылками. Уже извлечённые
 * способности и особенности не трогаются: обычный комплект занимает только
 * текст до первой ссылки на способность, составной комплект 0924 — всю статью
 * с вложенными карточками, вид происхождения — только вступление до первой
 * ссылки на черту. Класс-сущность не подменяет блоки статьи: это агрегат для
 * конструктора.
 *
 * Миграция идемпотентна: если статья уже ссылается на нужную сущность, файл не
 * перезаписывается. Отредактированный вручную Markdown сущности сохраняется;
 * при расхождении с текущим текстом статьи команда останавливается, а не
 * угадывает идентичность. Полный текст статей восстанавливается до и после
 * миграции побайтово.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RULE_KINDS,
  chapterSlug,
  compareStrings,
  keyName,
  parseAbilityBlocks,
  parseHeadings,
  readJson,
  safeFileStem,
  walkJson,
  writeJson,
} from "./lib/common.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const STAGE_TWO_KINDS = new Set([
  "ancestry",
  "item",
  "kit",
  "project",
  "title",
]);

const STAGE_THREE_KINDS = new Set([
  "class",
  "career",
  "culture",
  "complication",
]);

/** Виды, для которых миграция ищет уже существующие сущности по статье и имени. */
const MIGRATED_KINDS = new Set([
  ...STAGE_TWO_KINDS,
  ...STAGE_THREE_KINDS,
  "feature",
]);

const ITEM_GROUPS = {
  Артефакты: "artifacts",
  Безделушки: "trinkets",
  Расходуемые: "consumables",
  "Сокровища с Уровнем": "leveled-treasures",
};

const GROUP_BY_KIND = {
  ancestry: "ancestry-species",
  class: "classes",
  career: "careers",
  culture: "culture-environment",
  complication: "complications",
  kit: "kits",
  project: "downtime-projects",
  title: "titles",
};

const CULTURE_ARTICLES = {
  "0502": "culture-environment",
  "0503": "culture-organization",
  "0504": "culture-upbringing",
};

const SUMMONER_CLASS = "Призыватель";

export const STAGE_TWO_NOTES = [
  "Stage two: комплекты (включая составной «Буревестник» 0924), сокровища, проекты, титулы и виды происхождений выделены в сущности из текущего канонического дерева.",
  "Новые технические имена и каталоги — английские; исходные русские названия и пути сохранены в name, source.path и Markdown.",
  "Идентификаторы сокровищ и титулов основаны на статье-источнике и порядке записи, поэтому переименование отображаемого названия не меняет ID.",
  "Вложенные структурированные блоки внутри сокровищ, проектов и титулов остаются частью этих сущностей: схема не поддерживает вложенные сущности.",
  "Stage three: классы, карьеры, культуры и нюансы — сущности конструктора; статьи читаются через них, кроме классов-агрегатов.",
  "Класс-сущность — агрегат статьи 1-го уровня: сводка, основы и особенности под заголовками `#### Сводка`, `#### Основы`, `#### Особенности 1-го уровня`. Она не подменяет блоки статьи, чтобы не терять ссылки на особенности и способности; проекция собирает поле features из раздела «Особенности 1-го уровня».",
  "Каталог `culture-environment` / `culture-organization` / `culture-upbringing` повторяет аспекты культуры из статей 0502–0504.",
  "Известность и богатство карьеры берутся только из явных строк `**Известность**` и `**Богатство**` в статье; отсутствие строки означает 0 (как в прежнем конструкторе). Отдельной обзорной таблицы глав 06 в канонических статьях нет.",
];

function parseArgs(argv) {
  const options = { check: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--root" || arg === "--content" || arg === "--source") {
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
  console.log(`Использование: node scripts/content/migrate-entities.mjs [опции]

Опции:
  --root <dir>     корень репозитория
  --content <dir>  каноническое дерево (по умолчанию content/rules)
  --source <dir>   устаревшие generated JSON (по умолчанию src/data)
  --dry-run        показать план, ничего не писать
  --check          завершиться с ошибкой, если нужны изменения`);
}

function loadLegacy(sourceDir) {
  const read = (file) => readJson(path.join(sourceDir, file));
  return {
    kits: read("kits.generated.json"),
    library: read("library-articles.generated.json"),
    builder: read("builder.generated.json"),
    classFeatures: read("class-features.generated.json"),
  };
}

function entityEntryMap(entityFiles, contentDir) {
  const entities = new Map();
  for (const file of entityFiles) {
    const entity = readJson(file);
    const group = path.basename(path.dirname(file));
    entities.set(entity.id, { entity, group });
  }
  return entities;
}

function entityList(entities) {
  return [...entities.values()].map((entry) => entry.entity);
}

function entityByIdOf(entities) {
  const map = new Map();
  for (const entry of entities.values()) map.set(entry.entity.id, entry.entity);
  return map;
}

function renderArticle(article, entityById) {
  return article.blocks
    .map((block) =>
      block.type === "markdown"
        ? block.text
        : (entityById.get(block.ref)?.markdown ?? ""),
    )
    .join("");
}

function articleFile(contentDir, article) {
  return path.join(
    contentDir,
    "articles",
    chapterSlug(article.chapter),
    `${safeFileStem(article.id)}.json`,
  );
}

function entityFile(contentDir, entity, group) {
  return path.join(
    contentDir,
    "entities",
    entity.kind,
    group,
    `${safeFileStem(entity.id)}.json`,
  );
}

function appendNotes(notes, additions) {
  const result = Array.isArray(notes) ? [...notes] : [];
  for (const note of additions) {
    if (!result.includes(note)) result.push(note);
  }
  return result;
}

function sectionEnd(text, nextStart) {
  if (nextStart === undefined) return text.length;
  const before = text.slice(0, nextStart);
  const separator = /\n+---[ \t]*\n?[ \t]*$/.exec(before);
  return separator ? separator.index : nextStart;
}

function stageTwoEntityIds(article, entityById, kind) {
  return article.blocks
    .filter(
      (block) =>
        block.type === "entity" &&
        entityById.get(block.ref)?.kind === kind,
    )
    .map((block) => block.ref);
}

/**
 * Разбирает статью 1-го уровня класса на поля конструктора.
 *
 * Сводка — первый абзац до «## Основы». Основы — текст между «## Основы» и
 * «## Особенности 1-го уровня» без таблицы развития (она остаётся в статье).
 * Особенности — всё после соответствующего заголовка, включая подразделы.
 */
function classArticleSections(text) {
  const basicsMatch = /^##\s+Основы[ \t]*$/m.exec(text);
  const featuresMatch = /^##\s+Особенности 1-го уровня[ \t]*$/m.exec(text);
  if (
    !basicsMatch ||
    !featuresMatch ||
    basicsMatch.index > featuresMatch.index
  ) {
    return { summary: "", basics: "", features: "" };
  }
  const summary = text.slice(0, basicsMatch.index).split(/\n\s*\n/)[0].trim();
  let basics = text.slice(
    basicsMatch.index + basicsMatch[0].length,
    featuresMatch.index,
  );
  const table = /^######\s+Таблица развития/m.exec(basics);
  if (table) basics = basics.slice(0, table.index);
  basics = basics.replace(/\n*---[ \t]*$/m, "").trim();
  const features = text
    .slice(featuresMatch.index + featuresMatch[0].length)
    .replace(/^\n+/, "")
    .trim();
  return { summary, basics, features };
}

/**
 * Сдвигает заголовки особенностей на уровень вниз, чтобы они стали детьми
 * `#### Особенности 1-го уровня`. Подписи таблиц (`######`) не трогаются.
 */
function shiftFeatureHeadings(text) {
  return text.replace(/^(#{4,5})(\s+)/gm, (_, hashes, space) =>
    `${"#".repeat(hashes.length + 1)}${space}`,
  );
}

/** Markdown класса-агрегата: структурные разделы конструктора. */
function classEntityMarkdown(text) {
  const sections = classArticleSections(text);
  const features = shiftFeatureHeadings(sections.features);
  const section = (title, body) => (body ? `${title}\n\n${body}` : title);
  return [
    section("#### Сводка", sections.summary),
    section("#### Основы", sections.basics),
    section("#### Особенности 1-го уровня", features),
  ].join("\n\n");
}

/** Полный текст статьи для агрегата класса: проза и особенности, без способностей. */
function classAggregateSource(article, entityById) {
  return article.blocks
    .map((block) => {
      if (block.type === "markdown") return block.text;
      const entity = entityById.get(block.ref);
      return entity?.kind === "feature" ? entity.markdown : "";
    })
    .join("");
}

/**
 * Добавляет сущности второго и третьего этапов к уже разобранному дереву.
 *
 * `articles` — массив статей, `entities` — Map `id -> { entity, group }` (та же
 * форма, что использует импорт). Возвращённые статьи — новые объекты; карта
 * сущностей дополняется на месте.
 */
export function extractStageTwo({ articles, entities, legacy }) {
  if (!Array.isArray(legacy?.kits)) throw new Error("Нет данных комплектов");
  if (!Array.isArray(legacy?.library)) throw new Error("Нет данных library");
  if (!Array.isArray(legacy?.builder?.ancestries)) {
    throw new Error("Нет данных происхождений");
  }
  if (!Array.isArray(legacy?.classFeatures)) {
    throw new Error("Нет данных классовых особенностей");
  }

  const entityById = entityByIdOf(entities);
  const beforeText = new Map(
    articles.map((article) => [article.id, renderArticle(article, entityById)]),
  );
  const nextArticles = articles.map((article) => ({
    ...article,
    blocks: article.blocks.map((block) => ({ ...block })),
  }));
  const articleById = new Map(
    nextArticles.map((article) => [article.id, article]),
  );
  const changedArticleIds = new Set();
  const addedEntityIds = [];
  const deferred = [];

  const existingBySource = new Map();
  for (const entry of entities.values()) {
    const entity = entry.entity;
    if (!MIGRATED_KINDS.has(entity.kind)) continue;
    const key = `${entity.kind}\u0000${entity.source.articleId}\u0000${keyName(
      entity.name,
    )}`;
    const list = existingBySource.get(key) ?? [];
    list.push(entity);
    existingBySource.set(key, list);
  }

  function addEntity(entity, group) {
    if (!RULE_KINDS.includes(entity.kind)) {
      throw new Error(`Неизвестный вид сущности: ${entity.kind}`);
    }
    if (entities.has(entity.id)) {
      throw new Error(`Повторяющийся ID сущности: ${entity.id}`);
    }
    entities.set(entity.id, { entity, group });
    entityById.set(entity.id, entity);
    addedEntityIds.push(entity.id);
    const key = `${entity.kind}\u0000${entity.source.articleId}\u0000${keyName(
      entity.name,
    )}`;
    const list = existingBySource.get(key) ?? [];
    list.push(entity);
    existingBySource.set(key, list);
  }

  function findExisting(kind, articleId, name) {
    const key = `${kind}\u0000${articleId}\u0000${keyName(name)}`;
    const list = existingBySource.get(key) ?? [];
    if (list.length > 1) {
      throw new Error(
        `Несколько сущностей ${kind} с именем «${name}» в статье ${articleId}`,
      );
    }
    return list[0] ?? null;
  }

  function ensureEntity({
    id,
    kind,
    group,
    name,
    markdown,
    article,
    legacyIds,
  }) {
    const existing = findExisting(kind, article.id, name);
    if (existing) {
      if (existing.markdown !== markdown) {
        throw new Error(
          `Сущность ${existing.id} уже отредактирована и не совпадает с текстом статьи ${article.id}. ` +
            "Миграция не перезаписывает авторский текст; согласуйте статью и сущность вручную.",
        );
      }
      return existing.id;
    }
    const byId = entityById.get(id);
    if (byId) {
      if (
        byId.kind !== kind ||
        byId.source.articleId !== article.id ||
        byId.markdown !== markdown
      ) {
        throw new Error(
          `ID ${id} уже занят другой сущностью; автоматический перенос небезопасен.`,
        );
      }
      return byId.id;
    }
    addEntity(
      {
        id,
        kind,
        name,
        markdown,
        source: { articleId: article.id, path: article.path },
        legacyIds: [...legacyIds],
      },
      group,
    );
    return id;
  }

  function markChanged(article) {
    changedArticleIds.add(article.id);
  }

  // ---------- комплекты ----------
  const kitArticles = nextArticles.filter(
    (article) => article.chapter?.startsWith("09.") && article.group === "Список Комплектов",
  );
  const kitArticleByName = new Map();
  for (const article of kitArticles) {
    const key = keyName(article.title);
    const list = kitArticleByName.get(key) ?? [];
    list.push(article);
    kitArticleByName.set(key, list);
  }

  for (const kit of legacy.kits) {
    const matches = kitArticleByName.get(keyName(kit.name)) ?? [];
    if (matches.length !== 1) {
      deferred.push({
        kind: "kit",
        articleId: matches[0]?.id ?? null,
        legacyId: kit.id,
        name: kit.name,
        reason:
          matches.length === 0
            ? "article-not-found"
            : "ambiguous-article-by-name",
      });
      continue;
    }
    const article = matches[0];
    if (stageTwoEntityIds(article, entityById, "kit").length > 0) continue;
    const firstEntity = article.blocks.findIndex(
      (block) => block.type === "entity",
    );
    const restIsAbilities =
      firstEntity >= 0 &&
      article.blocks
        .slice(firstEntity + 1)
        .every(
          (block) =>
            block.type === "entity" &&
            entityById.get(block.ref)?.kind === "ability",
        );
    const ordinaryKit =
      firstEntity >= 0 &&
      restIsAbilities &&
      article.blocks
        .slice(0, firstEntity)
        .every((block) => block.type === "markdown");
    if (ordinaryKit) {
      const markdown = article.blocks
        .slice(0, firstEntity)
        .map((block) => block.text)
        .join("");
      const id = ensureEntity({
        id: `kit.${kit.id}`,
        kind: "kit",
        group: GROUP_BY_KIND.kit,
        name: article.title,
        markdown,
        article,
        legacyIds: [kit.id],
      });
      article.blocks.splice(0, firstEntity, { type: "entity", ref: id });
      markChanged(article);
      continue;
    }

    // Составной комплект (0924 «Буревестник»): проза и карточки способностей
    // чередуются. Полный текст с уже вложенными карточками сохраняется в
    // сущности, а статья ссылается на неё одним блоком — это не переставляет
    // правила и не теряет Markdown.
    if (firstEntity < 0) {
      deferred.push({
        kind: "kit",
        articleId: article.id,
        legacyId: kit.id,
        name: kit.name,
        reason: "no-entity-blocks-to-anchor-kit-text",
      });
      continue;
    }
    const markdown = renderArticle(article, entityById);
    const id = ensureEntity({
      id: `kit.${kit.id}`,
      kind: "kit",
      group: GROUP_BY_KIND.kit,
      name: article.title,
      markdown,
      article,
      legacyIds: [kit.id],
    });
    article.blocks = [{ type: "entity", ref: id }];
    markChanged(article);
  }

  // ---------- виды происхождений ----------
  for (const ancestry of legacy.builder.ancestries) {
    const article = articleById.get(ancestry.articleId);
    if (!article) {
      deferred.push({
        kind: "ancestry",
        articleId: ancestry.articleId,
        name: ancestry.name,
        reason: "article-not-found",
      });
      continue;
    }
    if (stageTwoEntityIds(article, entityById, "ancestry").length > 0) continue;
    let split = 0;
    while (article.blocks[split]?.type === "markdown") split += 1;
    if (split === 0) {
      deferred.push({
        kind: "ancestry",
        articleId: article.id,
        name: ancestry.name,
        reason: "no-leading-markdown-before-traits",
      });
      continue;
    }
    const markdown = article.blocks
      .slice(0, split)
      .map((block) => block.text)
      .join("");
    const id = ensureEntity({
      id: `ancestry.${article.id}`,
      kind: "ancestry",
      group: GROUP_BY_KIND.ancestry,
      name: article.title,
      markdown,
      article,
      legacyIds: [],
    });
    article.blocks.splice(0, split, { type: "entity", ref: id });
    markChanged(article);
  }

  // ---------- проекты отдыха ----------
  for (const libraryArticle of legacy.library) {
    if (!libraryArticle.chapter?.startsWith("16.")) continue;
    const article = articleById.get(libraryArticle.id);
    if (!article) {
      deferred.push({
        kind: "project",
        articleId: libraryArticle.id,
        name: libraryArticle.title,
        reason: "article-not-found",
      });
      continue;
    }
    if (stageTwoEntityIds(article, entityById, "project").length > 0) continue;
    if (!article.blocks.every((block) => block.type === "markdown")) {
      deferred.push({
        kind: "project",
        articleId: article.id,
        name: article.title,
        reason: "mixed-blocks-prevent-whole-project-entity",
      });
      continue;
    }
    const markdown = article.blocks.map((block) => block.text).join("");
    const id = ensureEntity({
      id: `project.${libraryArticle.id}`,
      kind: "project",
      group: GROUP_BY_KIND.project,
      name: article.title,
      markdown,
      article,
      legacyIds: [libraryArticle.id],
    });
    article.blocks = [{ type: "entity", ref: id }];
    markChanged(article);
  }

  // ---------- сокровища и титулы ----------
  for (const libraryArticle of legacy.library) {
    const isItem = libraryArticle.chapter?.startsWith("18.");
    const isTitle = libraryArticle.chapter?.startsWith("19.");
    if (!isItem && !isTitle) continue;
    const kind = isItem ? "item" : "title";
    const group = isItem ? ITEM_GROUPS[libraryArticle.group] : GROUP_BY_KIND.title;
    if (!group) {
      deferred.push({
        kind,
        articleId: libraryArticle.id,
        name: libraryArticle.title,
        reason: `unsupported-group:${libraryArticle.group}`,
      });
      continue;
    }
    const article = articleById.get(libraryArticle.id);
    if (!article) {
      deferred.push({
        kind,
        articleId: libraryArticle.id,
        name: libraryArticle.title,
        reason: "article-not-found",
      });
      continue;
    }
    const existingRefs = stageTwoEntityIds(article, entityById, kind);
    if (existingRefs.length > 0) {
      const markdown = article.blocks
        .filter((block) => block.type === "markdown")
        .map((block) => block.text)
        .join("");
      if (
        parseHeadings(markdown).some((heading) => heading.level === 4)
      ) {
        throw new Error(
          `Статья ${article.id} мигрирована частично: остались заголовки вне сущностей ${kind}.`,
        );
      }
      continue;
    }
    if (article.blocks.length !== 1 || article.blocks[0].type !== "markdown") {
      deferred.push({
        kind,
        articleId: article.id,
        name: article.title,
        reason: "expected-single-markdown-block",
      });
      continue;
    }
    const text = article.blocks[0].text;
    const headings = parseHeadings(text).filter(
      (heading) => heading.level === 4,
    );
    if (headings.length === 0) {
      deferred.push({
        kind,
        articleId: article.id,
        name: article.title,
        reason: "no-level-four-entries",
      });
      continue;
    }
    const blocks = [];
    let cursor = 0;
    headings.forEach((heading, index) => {
      if (heading.start < cursor) {
        throw new Error(`Пересечение заголовков в статье ${article.id}`);
      }
      const end = sectionEnd(text, headings[index + 1]?.start);
      if (heading.start > cursor) {
        blocks.push({ type: "markdown", text: text.slice(cursor, heading.start) });
      }
      const markdown = text.slice(heading.start, end);
      const id = ensureEntity({
        id: `${kind}.${article.id}.${String(index + 1).padStart(2, "0")}`,
        kind,
        group,
        name: heading.name,
        markdown,
        article,
        legacyIds: [],
      });
      blocks.push({ type: "entity", ref: id });
      cursor = end;
    });
    if (cursor < text.length) {
      blocks.push({ type: "markdown", text: text.slice(cursor) });
    }
    article.blocks = blocks;
    markChanged(article);
  }

  // ---------- особенности Призывателя ----------
  // В текущем каноническом дереве статьи 0821–0830 пусты (и в legacy
  // class-features нет ни одной строки Призывателя), поэтому здесь нет
  // выдуманного текста. Извлечение общее: если статьи получат содержимое,
  // особенности появятся автоматически.
  const summonerArticles = nextArticles.filter(
    (article) =>
      article.chapter?.startsWith("08.") && article.group === SUMMONER_CLASS,
  );
  for (const article of summonerArticles) {
    const existing = stageTwoEntityIds(article, entityById, "feature");
    if (existing.length > 0) continue;
    if (!article.blocks.every((block) => block.type === "markdown")) {
      deferred.push({
        kind: "feature",
        articleId: article.id,
        name: article.title,
        reason: "summoner-article-has-mixed-blocks",
      });
      continue;
    }
    const text = article.blocks.map((block) => block.text).join("");
    if (!text.trim()) continue;
    const headings = parseHeadings(text).filter(
      (heading) => heading.level >= 4 && !heading.caption,
    );
    if (headings.length === 0) continue;
    const blocks = [];
    let cursor = 0;
    headings.forEach((heading, index) => {
      if (heading.start < cursor) {
        throw new Error(`Пересечение заголовков в статье ${article.id}`);
      }
      if (heading.start > cursor) {
        blocks.push({
          type: "markdown",
          text: text.slice(cursor, heading.start),
        });
      }
      const markdown = text.slice(heading.start, heading.end);
      const legacyMatches = legacy.classFeatures.filter(
        (feature) =>
          feature.className === SUMMONER_CLASS &&
          feature.articleId === article.id &&
          keyName(feature.name) === keyName(heading.name),
      );
      const id = ensureEntity({
        id: `feature.prizyvatel.${article.id}.${String(index + 1).padStart(
          2,
          "0",
        )}`,
        kind: "feature",
        group: "class-prizyvatel",
        name: heading.name,
        markdown,
        article,
        legacyIds: legacyMatches.map((feature) => feature.id),
      });
      blocks.push({ type: "entity", ref: id });
      cursor = heading.end;
    });
    if (cursor < text.length) {
      blocks.push({ type: "markdown", text: text.slice(cursor) });
    }
    article.blocks = blocks;
    markChanged(article);
  }

  // ---------- классы ----------
  // Класс — агрегат статьи 1-го уровня для конструктора. Он НЕ подменяет
  // блоки статьи: иначе исчезли бы ссылки на особенности и способности.
  for (const classEntry of legacy.builder.classes) {
    const article = articleById.get(classEntry.articleId);
    if (!article) {
      deferred.push({
        kind: "class",
        articleId: classEntry.articleId,
        name: classEntry.name,
        reason: "article-not-found",
      });
      continue;
    }
    const source = classAggregateSource(article, entityById);
    const markdown = classEntityMarkdown(source);
    ensureEntity({
      id: `class.${article.id}`,
      kind: "class",
      group: GROUP_BY_KIND.class,
      name: classEntry.name,
      markdown,
      article,
      legacyIds: [],
    });
  }

  // ---------- карьеры ----------
  for (const career of legacy.builder.careers) {
    const article = articleById.get(career.articleId);
    if (!article) {
      deferred.push({
        kind: "career",
        articleId: career.articleId,
        name: career.name,
        reason: "article-not-found",
      });
      continue;
    }
    if (stageTwoEntityIds(article, entityById, "career").length > 0) continue;
    if (!article.blocks.every((block) => block.type === "markdown")) {
      deferred.push({
        kind: "career",
        articleId: article.id,
        name: career.name,
        reason: "career-article-has-mixed-blocks",
      });
      continue;
    }
    const markdown = article.blocks.map((block) => block.text).join("");
    if (!markdown.trim()) {
      deferred.push({
        kind: "career",
        articleId: article.id,
        name: career.name,
        reason: "empty-source-article",
      });
      continue;
    }
    const id = ensureEntity({
      id: `career.${article.id}`,
      kind: "career",
      group: GROUP_BY_KIND.career,
      name: article.title,
      markdown,
      article,
      legacyIds: [],
    });
    article.blocks = [{ type: "entity", ref: id }];
    markChanged(article);
  }

  // ---------- культуры ----------
  for (const [articleId, group] of Object.entries(CULTURE_ARTICLES)) {
    const article = articleById.get(articleId);
    if (!article) {
      deferred.push({
        kind: "culture",
        articleId,
        reason: "article-not-found",
      });
      continue;
    }
    const existing = stageTwoEntityIds(article, entityById, "culture");
    if (existing.length > 0) {
      const leftover = article.blocks
        .filter((block) => block.type === "markdown")
        .map((block) => block.text)
        .join("");
      if (parseHeadings(leftover).some((heading) => heading.level === 4)) {
        throw new Error(
          `Статья ${article.id} мигрирована частично: остались заголовки вне сущностей culture.`,
        );
      }
      continue;
    }
    if (article.blocks.length !== 1 || article.blocks[0].type !== "markdown") {
      deferred.push({
        kind: "culture",
        articleId: article.id,
        name: article.title,
        reason: "expected-single-markdown-block",
      });
      continue;
    }
    const text = article.blocks[0].text;
    const headings = parseHeadings(text).filter(
      (heading) => heading.level === 4 && !heading.caption,
    );
    if (headings.length === 0) {
      deferred.push({
        kind: "culture",
        articleId: article.id,
        name: article.title,
        reason: "no-level-four-entries",
      });
      continue;
    }
    const blocks = [];
    let cursor = 0;
    headings.forEach((heading, index) => {
      if (heading.start < cursor) {
        throw new Error(`Пересечение заголовков в статье ${article.id}`);
      }
      const end = sectionEnd(text, headings[index + 1]?.start);
      if (heading.start > cursor) {
        blocks.push({
          type: "markdown",
          text: text.slice(cursor, heading.start),
        });
      }
      const markdown = text.slice(heading.start, end);
      const id = ensureEntity({
        id: `culture.${article.id}.${String(index + 1).padStart(2, "0")}`,
        kind: "culture",
        group,
        name: heading.name,
        markdown,
        article,
        legacyIds: [],
      });
      blocks.push({ type: "entity", ref: id });
      cursor = end;
    });
    if (cursor < text.length) {
      blocks.push({ type: "markdown", text: text.slice(cursor) });
    }
    article.blocks = blocks;
    markChanged(article);
  }

  // ---------- нюансы ----------
  const complicationArticles = nextArticles.filter(
    (article) =>
      article.chapter?.startsWith("11.") &&
      /^Нюансы\s+\d/.test(article.title),
  );
  for (const article of complicationArticles) {
    const existing = stageTwoEntityIds(article, entityById, "complication");
    if (existing.length > 0) {
      const leftover = article.blocks
        .filter((block) => block.type === "markdown")
        .map((block) => block.text)
        .join("");
      if (parseHeadings(leftover).some((heading) => heading.level === 4)) {
        throw new Error(
          `Статья ${article.id} мигрирована частично: остались заголовки вне сущностей complication.`,
        );
      }
      continue;
    }
    if (article.blocks.length !== 1 || article.blocks[0].type !== "markdown") {
      deferred.push({
        kind: "complication",
        articleId: article.id,
        name: article.title,
        reason: "expected-single-markdown-block",
      });
      continue;
    }
    const text = article.blocks[0].text;
    const headings = parseHeadings(text).filter(
      (heading) => heading.level === 4 && !heading.caption,
    );
    if (headings.length === 0) {
      deferred.push({
        kind: "complication",
        articleId: article.id,
        name: article.title,
        reason: "no-level-four-entries",
      });
      continue;
    }
    const blocks = [];
    let cursor = 0;
    headings.forEach((heading, index) => {
      if (heading.start < cursor) {
        throw new Error(`Пересечение заголовков в статье ${article.id}`);
      }
      const end = sectionEnd(text, headings[index + 1]?.start);
      if (heading.start > cursor) {
        blocks.push({
          type: "markdown",
          text: text.slice(cursor, heading.start),
        });
      }
      const markdown = text.slice(heading.start, end);
      const id = ensureEntity({
        id: `complication.${article.id}.${String(index + 1).padStart(2, "0")}`,
        kind: "complication",
        group: GROUP_BY_KIND.complication,
        name: heading.name,
        markdown,
        article,
        legacyIds: [],
      });
      blocks.push({ type: "entity", ref: id });
      cursor = end;
    });
    if (cursor < text.length) {
      blocks.push({ type: "markdown", text: text.slice(cursor) });
    }
    article.blocks = blocks;
    markChanged(article);
  }

  // ---------- проверки целостности ----------
  const afterEntityById = entityByIdOf(entities);
  for (const article of nextArticles) {
    const before = beforeText.get(article.id);
    const after = renderArticle(article, afterEntityById);
    if (before !== after) {
      throw new Error(
        `Статья ${article.id} не восстанавливается без потерь после миграции.`,
      );
    }
    for (const block of article.blocks) {
      if (block.type === "entity" && !afterEntityById.has(block.ref)) {
        throw new Error(`Статья ${article.id} ссылается на ${block.ref}`);
      }
    }
  }

  const legacyOwners = new Map();
  for (const entity of entityList(entities)) {
    for (const legacyId of entity.legacyIds) {
      const owner = legacyOwners.get(legacyId);
      if (owner && owner !== entity.id) {
        throw new Error(
          `Legacy ID ${legacyId} принадлежит и ${owner}, и ${entity.id}`,
        );
      }
      legacyOwners.set(legacyId, entity.id);
    }
  }

  return {
    articles: nextArticles,
    entities,
    addedEntityIds,
    changedArticleIds: [...changedArticleIds].sort(compareStrings),
    deferred,
  };
}

/** Отчёт по третьему этапу: сущности конструктора и комплект 0924. */
function buildStageThreeReport({ articles, entities, legacy }) {
  const list = entityList(entities);
  const ofKind = (kind) =>
    list
      .filter((entity) => entity.kind === kind)
      .sort((a, b) => compareStrings(a.id, b.id));
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const entityById = entityByIdOf(entities);

  const classes = ofKind("class");
  const careers = ofKind("career");
  const cultures = ofKind("culture");
  const complications = ofKind("complication");
  const summonerFeatures = ofKind("feature").filter((entity) =>
    entity.id.startsWith("feature.prizyvatel."),
  );
  const summonerArticles = articles.filter(
    (article) =>
      article.chapter?.startsWith("08.") && article.group === SUMMONER_CLASS,
  );
  const summonerLegacy = legacy.classFeatures.filter(
    (feature) => feature.className === SUMMONER_CLASS,
  );
  const summonerHeadingTotal = summonerArticles.reduce(
    (sum, article) =>
      sum +
      parseHeadings(renderArticle(article, entityById)).filter(
        (heading) => heading.level >= 4 && !heading.caption,
      ).length,
    0,
  );
  const emptyClassMarkdown = classEntityMarkdown("");

  const classMappings = legacy.builder.classes
    .map((entry) => {
      const entity = classes.find(
        (candidate) => candidate.source.articleId === entry.articleId,
      );
      return {
        articleId: entry.articleId,
        entityId: entity?.id ?? null,
        name: entry.name,
        hasText: Boolean(entity && entity.markdown !== emptyClassMarkdown),
      };
    })
    .sort((a, b) => compareStrings(a.articleId, b.articleId));

  const careerMappings = legacy.builder.careers
    .map((entry) => ({
      articleId: entry.articleId,
      entityId:
        careers.find(
          (candidate) => candidate.source.articleId === entry.articleId,
        )?.id ?? null,
      name: entry.name,
    }))
    .sort((a, b) => compareStrings(a.articleId, b.articleId));

  const cultureMappings = cultures
    .map((entity) => ({
      articleId: entity.source.articleId,
      aspect:
        Object.entries(CULTURE_ARTICLES).find(
          ([articleId]) => articleId === entity.source.articleId,
        )?.[1] ?? "unknown",
      entityId: entity.id,
      name: entity.name,
    }))
    .sort(
      (a, b) =>
        compareStrings(a.articleId, b.articleId) ||
        compareStrings(a.entityId, b.entityId),
    );

  const complicationMappings = complications
    .map((entity) => ({
      articleId: entity.source.articleId,
      entityId: entity.id,
      name: entity.name,
    }))
    .sort((a, b) => compareStrings(a.entityId, b.entityId));

  const cultureTotals = {
    environment: legacy.builder.cultures.environment?.length ?? 0,
    organization: legacy.builder.cultures.organization?.length ?? 0,
    upbringing: legacy.builder.cultures.upbringing?.length ?? 0,
  };
  const cultureTotal = Object.values(cultureTotals).reduce(
    (sum, value) => sum + value,
    0,
  );

  const deferred = [];
  for (const mapping of classMappings) {
    if (mapping.entityId) continue;
    const article = articleById.get(mapping.articleId);
    if (!article) {
      deferred.push({
        kind: "class",
        articleId: mapping.articleId,
        name: mapping.name,
        reason: "article-not-found",
      });
    }
  }
  for (const mapping of careerMappings) {
    if (mapping.entityId) continue;
    deferred.push({
      kind: "career",
      articleId: mapping.articleId,
      name: mapping.name,
      reason: articleById.has(mapping.articleId)
        ? "career-not-migrated"
        : "article-not-found",
    });
  }
  const expectedPerCultureArticle = {
    "0502": cultureTotals.environment,
    "0503": cultureTotals.organization,
    "0504": cultureTotals.upbringing,
  };
  for (const [articleId, expected] of Object.entries(
    expectedPerCultureArticle,
  )) {
    const actual = cultureMappings.filter(
      (mapping) => mapping.articleId === articleId,
    ).length;
    if (actual !== expected) {
      deferred.push({
        kind: "culture",
        articleId,
        expected,
        actual,
        reason: "culture-count-mismatch",
      });
    }
  }
  for (const article of articles.filter(
    (candidate) =>
      candidate.chapter?.startsWith("11.") &&
      /^Нюансы\s+\d/.test(candidate.title),
  )) {
    const expected = parseHeadings(renderArticle(article, entityById)).filter(
      (heading) => heading.level === 4 && !heading.caption,
    ).length;
    const actual = complicationMappings.filter(
      (mapping) => mapping.articleId === article.id,
    ).length;
    if (actual !== expected) {
      deferred.push({
        kind: "complication",
        articleId: article.id,
        expected,
        actual,
        reason: "complication-count-mismatch",
      });
    }
  }

  const gaps = [];
  if (summonerFeatures.length === 0) {
    gaps.push({
      kind: "feature",
      className: SUMMONER_CLASS,
      articleIds: summonerArticles.map((article) => article.id),
      reason:
        "source-articles-empty; legacy class-features has no Призыватель rows, so no feature text can be extracted without inventing rules",
    });
  }
  gaps.push({
    kind: "career",
    reason:
      "no chapter-06 overview table in canonical articles; renown and wealth are read only from explicit **Известность**/**Богатство** lines, missing values mean 0",
  });

  return {
    generatedBy: "scripts/content/migrate-entities.mjs",
    fieldEncoding: {
      class: [
        "#### Сводка — первый абзац статьи 1-го уровня (summary)",
        "#### Основы — текст до «## Особенности 1-го уровня» без таблицы развития (basics)",
        "#### Особенности 1-го уровня — особенности статьи; исходные #### стали #####, вложенные ##### стали ###### (features, featureChoices, subclasses)",
      ],
      career: [
        "Весь Markdown статьи 0601–0618: выгоды до первого '---', затем таблица d6 инцидентов",
        "**Известность** и **Богатство** — явные строки статьи; отсутствие строки означает 0",
      ],
      culture: [
        "#### <Название> — ровно секция аспекта из статей 0502/0503/0504",
      ],
      complication: [
        "#### <Номер>. <Название> — ровно секция нюанса из статей 1103–1106",
      ],
      kit0924: [
        "Полный Markdown статьи 0924 с вложенными карточками способностей (> **...**); статьи ссылаются на сущность одним блоком",
      ],
      summonerFeature: [
        "####/##### <Название> — секция статьи уровня Призывателя; сейчас не создаются, потому что статьи 0821–0830 пусты",
      ],
    },
    coverage: {
      classes: {
        mapped: classes.length,
        total: legacy.builder.classes.length,
        withText: classes.filter(
          (entity) => entity.markdown !== emptyClassMarkdown,
        ).length,
      },
      careers: {
        mapped: careers.length,
        total: legacy.builder.careers.length,
      },
      cultures: {
        mapped: cultures.length,
        total: cultureTotal,
        ...cultureTotals,
      },
      complications: {
        mapped: complications.length,
        total: legacy.builder.complications.length,
        sourceArticles: new Set(
          complications.map((entity) => entity.source.articleId),
        ).size,
      },
      summonerFeatures: {
        mapped: summonerFeatures.length,
        total: Math.max(summonerLegacy.length, summonerHeadingTotal),
        sourceArticles: summonerArticles.length,
      },
      kits0924: {
        mapped: ofKind("kit").filter(
          (entity) => entity.source.articleId === "0924",
        ).length,
        total: 1,
      },
    },
    mappings: {
      classes: classMappings,
      careers: careerMappings,
      cultures: cultureMappings,
      complications: complicationMappings,
      summonerFeatures: summonerFeatures.map((entity) => ({
        articleId: entity.source.articleId,
        entityId: entity.id,
        name: entity.name,
        legacyIds: [...entity.legacyIds].sort(compareStrings),
      })),
      kit0924: ofKind("kit")
        .filter((entity) => entity.source.articleId === "0924")
        .flatMap((entity) =>
          entity.legacyIds.map((legacyId) => ({
            legacyId,
            entityId: entity.id,
            articleId: entity.source.articleId,
          })),
        )
        .sort((a, b) => compareStrings(a.legacyId, b.legacyId)),
    },
    gaps,
    deferred: deferred.sort(
      (a, b) =>
        compareStrings(a.kind, b.kind) ||
        compareStrings(a.articleId ?? "", b.articleId ?? "") ||
        compareStrings(a.reason, b.reason),
    ),
  };
}

/**
 * Отчёт по второму и третьему этапам. Строится по итоговому дереву, поэтому
 * одинаков для первичного импорта и повторного запуска.
 */
export function buildStageTwoReport({ articles, entities, legacy }) {
  const list = entityList(entities);
  const byKind = new Map();
  for (const entity of list) {
    const group = byKind.get(entity.kind) ?? [];
    group.push(entity);
    byKind.set(entity.kind, group);
  }
  const ofKind = (kind) =>
    [...(byKind.get(kind) ?? [])].sort((a, b) => compareStrings(a.id, b.id));

  const articleById = new Map(articles.map((article) => [article.id, article]));
  const entityById = entityByIdOf(entities);
  const render = (article) => renderArticle(article, entityById);

  const libraryById = new Map(legacy.library.map((article) => [article.id, article]));
  const projectArticles = legacy.library.filter((article) =>
    article.chapter?.startsWith("16."),
  );
  const itemArticles = legacy.library.filter((article) =>
    article.chapter?.startsWith("18."),
  );
  const titleArticles = legacy.library.filter((article) =>
    article.chapter?.startsWith("19."),
  );

  const countLevelFour = (article) =>
    article
      ? parseHeadings(render(article)).filter((heading) => heading.level === 4)
          .length
      : 0;

  const kits = ofKind("kit");
  const kitLegacyIds = new Set(
    kits.flatMap((entity) => entity.legacyIds),
  );
  const kitMappings = kits
    .flatMap((entity) =>
      entity.legacyIds.map((legacyId) => ({
        legacyId,
        entityId: entity.id,
        articleId: entity.source.articleId,
      })),
    )
    .sort((a, b) => compareStrings(a.legacyId, b.legacyId));
  const kitDeferred = [];
  for (const kit of legacy.kits) {
    if (kitLegacyIds.has(kit.id)) continue;
    const article = articles.find(
      (candidate) =>
        candidate.chapter?.startsWith("09.") &&
        keyName(candidate.title) === keyName(kit.name),
    );
    kitDeferred.push({
      kind: "kit",
      articleId: article?.id ?? null,
      legacyId: kit.id,
      name: kit.name,
      reason: article
        ? "composite-kit-interleaves-markdown-and-ability-blocks; a single entity would reorder rule text"
        : "article-not-found",
    });
  }

  const projects = ofKind("project");
  const projectMappings = projects
    .flatMap((entity) =>
      entity.legacyIds.map((legacyId) => ({
        legacyId,
        entityId: entity.id,
        articleId: entity.source.articleId,
      })),
    )
    .sort((a, b) => compareStrings(a.legacyId, b.legacyId));

  const itemsByArticle = new Map();
  for (const entity of ofKind("item")) {
    const list = itemsByArticle.get(entity.source.articleId) ?? [];
    list.push(entity.id);
    itemsByArticle.set(entity.source.articleId, list);
  }
  const titleByArticle = new Map();
  for (const entity of ofKind("title")) {
    const list = titleByArticle.get(entity.source.articleId) ?? [];
    list.push(entity.id);
    titleByArticle.set(entity.source.articleId, list);
  }

  const collectionMappings = (kind, sourceArticles, byArticle) =>
    sourceArticles
      .filter((entry) => libraryById.has(entry.id))
      .map((entry) => ({
        legacyCollectionId: entry.id,
        articleId: entry.id,
        entityIds: [...(byArticle.get(entry.id) ?? [])].sort(compareStrings),
      }))
      .sort((a, b) => compareStrings(a.articleId, b.articleId));

  const ancestries = ofKind("ancestry");
  const ancestryMappings = ancestries
    .map((entity) => ({
      articleId: entity.source.articleId,
      entityId: entity.id,
      name: entity.name,
    }))
    .sort((a, b) => compareStrings(a.articleId, b.articleId));

  const targetStageThree = buildStageThreeReport({
    articles,
    entities,
    legacy,
  });

  const unsupportedNested = [];
  const inlinedAbilityBlocks = [];
  for (const entity of list) {
    if (!["kit", "item", "project", "title"].includes(entity.kind)) continue;
    for (const block of parseAbilityBlocks(entity.markdown)) {
      if (!block.structured) continue;
      if (entity.kind === "kit" && entity.source.articleId === "0924") {
        inlinedAbilityBlocks.push({
          articleId: entity.source.articleId,
          entityId: entity.id,
          name: block.name,
          reason: "ability-card-inlined-into-composite-kit-markdown",
        });
        continue;
      }
      unsupportedNested.push({
        articleId: entity.source.articleId,
        entityId: entity.id,
        entityKind: entity.kind,
        name: block.name,
        reason:
          "nested-structured-block-inside-entity; RuleEntity has no nested entity blocks",
      });
    }
  }
  unsupportedNested.sort(
    (a, b) =>
      compareStrings(a.articleId, b.articleId) ||
      compareStrings(a.name, b.name) ||
      compareStrings(a.entityId, b.entityId),
  );
  inlinedAbilityBlocks.sort(
    (a, b) =>
      compareStrings(a.articleId, b.articleId) ||
      compareStrings(a.name, b.name) ||
      compareStrings(a.entityId, b.entityId),
  );

  const kitTotal = legacy.kits.length;
  const itemTotal = itemArticles.reduce(
    (sum, entry) => sum + countLevelFour(articleById.get(entry.id)),
    0,
  );
  const titleTotal = titleArticles.reduce(
    (sum, entry) => sum + countLevelFour(articleById.get(entry.id)),
    0,
  );

  return {
    generatedBy: "scripts/content/migrate-entities.mjs",
    coverage: {
      kits: {
        mapped: kits.length,
        total: kitTotal,
        unmapped: kitDeferred.length,
      },
      items: {
        mapped: ofKind("item").length,
        total: itemTotal,
        sourceArticles: collectionMappings("item", itemArticles, itemsByArticle)
          .length,
      },
      projects: {
        mapped: projects.length,
        total: projectArticles.length,
      },
      titles: {
        mapped: ofKind("title").length,
        total: titleTotal,
        sourceArticles: collectionMappings(
          "title",
          titleArticles,
          titleByArticle,
        ).length,
      },
      ancestrySpecies: {
        mapped: ancestries.length,
        total: legacy.builder.ancestries.length,
      },
      ...targetStageThree.coverage,
    },
    mappings: {
      kits: kitMappings,
      projects: projectMappings,
      items: collectionMappings("item", itemArticles, itemsByArticle),
      titles: collectionMappings("title", titleArticles, titleByArticle),
      ancestrySpecies: ancestryMappings,
      ...targetStageThree.mappings,
    },
    unsupportedNested,
    inlinedAbilityBlocks,
    gaps: targetStageThree.gaps,
    stageThree: targetStageThree,
    deferred: [...kitDeferred, ...targetStageThree.deferred].sort(
      (a, b) =>
        compareStrings(a.kind, b.kind) ||
        compareStrings(a.articleId ?? "", b.articleId ?? "") ||
        compareStrings(a.legacyId ?? "", b.legacyId ?? ""),
    ),
    notes: STAGE_TWO_NOTES,
  };
}

function mergeReport({ base, stageTwo, articles, entities }) {
  const entityCounts = {};
  for (const kind of RULE_KINDS) entityCounts[kind] = 0;
  for (const entry of entities.values()) entityCounts[entry.entity.kind] += 1;
  const report = base ? structuredClone(base) : { schemaVersion: 1 };
  report.counts = {
    ...(report.counts ?? {}),
    articles: articles.length,
    entities: entityCounts,
  };
  report.coverage = {
    ...(report.coverage ?? {}),
    kits: stageTwo.coverage.kits,
    items: stageTwo.coverage.items,
    projects: stageTwo.coverage.projects,
    titles: stageTwo.coverage.titles,
    ancestrySpecies: stageTwo.coverage.ancestrySpecies,
    classes: stageTwo.coverage.classes,
    careers: stageTwo.coverage.careers,
    cultures: stageTwo.coverage.cultures,
    complications: stageTwo.coverage.complications,
    summonerFeatures: stageTwo.coverage.summonerFeatures,
  };
  report.deferred = stageTwo.deferred;
  report.gaps = stageTwo.gaps;
  report.fieldEncoding = stageTwo.stageThree.fieldEncoding;
  report.stageTwo = stageTwo;
  report.stageThree = stageTwo.stageThree;
  report.notes = appendNotes(report.notes, stageTwo.notes);
  return report;
}

function loadCanonical(contentDir) {
  const articles = walkJson(path.join(contentDir, "articles"))
    .map(readJson)
    .sort((a, b) => compareStrings(a.id, b.id));
  const entities = entityEntryMap(
    walkJson(path.join(contentDir, "entities")),
    contentDir,
  );
  return { articles, entities };
}

function reportPath(contentDir) {
  return path.join(contentDir, "migration-report.json");
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
  const sourceDir = path.resolve(options.source ?? path.join(root, "src/data"));

  const legacy = loadLegacy(sourceDir);
  const { articles, entities } = loadCanonical(contentDir);
  if (articles.length === 0) {
    throw new Error(`В ${path.relative(root, contentDir)} нет статей`);
  }

  const result = extractStageTwo({ articles, entities, legacy });
  const stageTwo = buildStageTwoReport({
    articles: result.articles,
    entities: result.entities,
    legacy,
  });

  if (options.check) {
    const changes = [
      ...result.changedArticleIds.map((id) => `article ${id}`),
      ...result.addedEntityIds.map((id) => `entity ${id}`),
    ].sort(compareStrings);
    if (changes.length > 0) {
      console.error("Нужна миграция сущностей:");
      for (const change of changes) console.error(`  ${change}`);
      process.exitCode = 1;
    } else {
      console.log("Миграция сущностей актуальна.");
    }
    return;
  }

  if (!options.dryRun) {
    for (const articleId of result.changedArticleIds) {
      const article = result.articles.find((item) => item.id === articleId);
      writeJson(articleFile(contentDir, article), article);
    }
    for (const entityId of result.addedEntityIds) {
      const entry = result.entities.get(entityId);
      writeJson(
        entityFile(contentDir, entry.entity, entry.group),
        entry.entity,
      );
    }
    const base = existsSync(reportPath(contentDir))
      ? readJson(reportPath(contentDir))
      : null;
    writeJson(
      reportPath(contentDir),
      mergeReport({
        base,
        stageTwo,
        articles: result.articles,
        entities: result.entities,
      }),
    );
  }

  console.log("=== migrate-entities ===");
  console.log(
    `Комплекты:        ${stageTwo.coverage.kits.mapped}/${stageTwo.coverage.kits.total}`,
  );
  console.log(
    `Сокровища:        ${stageTwo.coverage.items.mapped}/${stageTwo.coverage.items.total}`,
  );
  console.log(
    `Проекты:          ${stageTwo.coverage.projects.mapped}/${stageTwo.coverage.projects.total}`,
  );
  console.log(
    `Титулы:           ${stageTwo.coverage.titles.mapped}/${stageTwo.coverage.titles.total}`,
  );
  console.log(
    `Виды:             ${stageTwo.coverage.ancestrySpecies.mapped}/${stageTwo.coverage.ancestrySpecies.total}`,
  );
  console.log(
    `Классы:           ${stageTwo.coverage.classes.mapped}/${stageTwo.coverage.classes.total} (с текстом ${stageTwo.coverage.classes.withText})`,
  );
  console.log(
    `Карьеры:          ${stageTwo.coverage.careers.mapped}/${stageTwo.coverage.careers.total}`,
  );
  console.log(
    `Культуры:         ${stageTwo.coverage.cultures.mapped}/${stageTwo.coverage.cultures.total}`,
  );
  console.log(
    `Нюансы:           ${stageTwo.coverage.complications.mapped}/${stageTwo.coverage.complications.total}`,
  );
  console.log(
    `Особенности Призывателя: ${stageTwo.coverage.summonerFeatures.mapped}/${stageTwo.coverage.summonerFeatures.total}`,
  );
  console.log(
    `Вложенные блоки:  ${stageTwo.unsupportedNested.length} (остаются внутри сущностей)`,
  );
  if (stageTwo.inlinedAbilityBlocks.length > 0) {
    console.log(
      `Вложено в комплект 0924: ${stageTwo.inlinedAbilityBlocks.length} карточек способностей`,
    );
  }
  console.log(
    `Изменено статей:  ${result.changedArticleIds.length}, добавлено сущностей: ${result.addedEntityIds.length}`,
  );
  if (options.dryRun) console.log("Режим --dry-run: файлы не записаны.");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
