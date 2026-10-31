#!/usr/bin/env node
/**
 * Детерминированная сборка проекций для старых потребителей канонических правил.
 *
 * Читает ТОЛЬКО каноническое дерево `content/rules/**` (статьи + сущности) и
 * явный файл сопоставления идентификаторов `scripts/content/lib/consumer-identity.json`.
 * Пишет раздельные проекции:
 *
 * - `src/generated/consumers/abilities.json` — карточки способностей для
 *   `src/data/compendium.ts` (строитель листа и сам лист);
 * - `src/generated/consumers/library.json` — каталог сокровищ/титулов/проектов
 *   и глоссарий для `src/data/library.ts`;
 * - `src/generated/consumers/kits.json` — комплекты (legacy-контракт
 *   `src/data/kits.generated.json`): краткое описание, снаряжение, бонусы и
 *   знаковая способность из Markdown сущности `kit` и связанной статьи;
 * - `src/generated/consumers/perks.json` — перки, типы перков карьер и
 *   ограничения классовых перков из статей глав 06/08/10;
 * - `src/generated/consumers/features.json` — особенности происхождений и
 *   классов из сущностей `feature`;
 * - `src/generated/consumers/level-up.json` — правила повышения уровня
 *   (`LevelUpRule`) из статей 08xx и карточек способностей;
 * - `src/generated/consumers/builder.json` — данные конструктора
 *   (`BUILDER_DATA` из `src/lib/character-builder.ts`): происхождения,
 *   культуры, карьеры, классы и нюансы из сущностей `ancestry`/`culture`/
 *   `career`/`class`/`complication` и связанных статей.
 *
 * Устаревшие `src/data/*.generated.json` здесь не читаются: они остаются только
 * для тестов паритета. Нормальная сборка не может молча откатиться на снапшот.
 *
 * `abilityOrder` в файле сопоставления закрепляет прежний порядок карточек: при
 * миграции он был однократно перенесён из старого снапшота, а дальнейшие сборки
 * читают только сам JSON. Новые способности добавляются в конец детерминированно;
 * новые записи каталога и глоссария требует `--update-identity` (явное действие).
 * Для новых наборов (`kits`, `perks`, `ancestryFeatures`, `classFeatures`,
 * `levelUp`, `builder`) сопоставление хранит порядок legacy-снапшотов: ID
 * записей уже закреплены в `entity.legacyIds` (а у записей конструктора —
 * канонический ID сущности), поэтому файл нужен прежде всего для порядка.
 * Составной комплект 0924 «Буревестник» теперь есть в каноне и проецируется
 * вместе с остальными.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  compareStrings,
  headingId,
  jsonText,
  readJson,
  walkJson,
  writeJsonText,
} from "./lib/common.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const CONSUMER_SCHEMA_VERSION = 1;

const DEFAULT_CONTENT = "content/rules";
const DEFAULT_OUT = "src/generated/consumers";
const DEFAULT_IDENTITY = "scripts/content/lib/consumer-identity.json";
const GLOSSARY_ARTICLE_ID = "0102";

/** Типы перков и статьи главы 10, из которых они происходят. */
export const PERK_TYPE_BY_ARTICLE = {
  "1002": "crafting",
  "1003": "exploration",
  "1004": "interpersonal",
  "1005": "intrigue",
  "1006": "lore",
  "1007": "supernatural",
};

const PERK_TYPE_LABELS = {
  crafting: "Ремесло",
  exploration: "Исследование",
  interpersonal: "Межличностные",
  intrigue: "Интрига",
  lore: "Знания",
  supernatural: "Сверхъестественное",
};

const PERK_TYPE_ORDER = Object.keys(PERK_TYPE_LABELS);

const KIT_EQUIPMENT = "Снаряжение";
const KIT_BONUSES = "Бонусы комплекта";
const KIT_SIGNATURE = "Знаковая способность";

/** Идентичность записей каталога, глоссария и новых наборов хранится явно. */
export const IDENTITY_NOTE =
  "Persisted consumer identity: keeps legacy catalogue/glossary/ability/kit/" +
  "perk/feature/level-up IDs and builder entity order stable across canonical " +
  "title edits. Do not regenerate names casually.";

function fail(message) {
  throw new Error(`Ошибка проекций потребителей: ${message}`);
}

function parseArgs(argv) {
  const options = { check: false, updateIdentity: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--update-identity") options.updateIdentity = true;
    else if (
      arg === "--root" ||
      arg === "--content" ||
      arg === "--out" ||
      arg === "--identity"
    ) {
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
  console.log(`Использование: node scripts/content/build-consumer-data.mjs [опции]

Опции:
  --root <dir>      корень репозитория
  --content <dir>   каноническое дерево (по умолчанию content/rules)
  --out <dir>       каталог проекций (по умолчанию src/generated/consumers)
  --identity <file> файл сопоставления ID (по умолчанию
                    scripts/content/lib/consumer-identity.json)
  --update-identity дополнить сопоставление новыми статьями/записями
  --check           сравнить с уже собранными файлами, ничего не писать`);
}

function assertString(value, label) {
  if (typeof value !== "string") fail(`${label}: ожидалась строка`);
}

function assertNonEmpty(value, label) {
  if (typeof value !== "string" || value === "") {
    fail(`${label}: ожидалась непустая строка`);
  }
}

/** Читает статьи и сущности; возвращает отсортированные списки и индекс сущностей. */
export function readCanonicalTree({ contentDir }) {
  const articleFiles = walkJson(path.join(contentDir, "articles"));
  if (articleFiles.length === 0) {
    fail(`в ${contentDir} нет статей`);
  }
  const articles = [];
  const articleById = new Map();
  for (const file of articleFiles) {
    let article;
    try {
      article = readJson(file);
    } catch (error) {
      fail(`${file}: ${error.message}`);
    }
    assertNonEmpty(article?.id, `${file}: id`);
    assertNonEmpty(article.title, `${file}: title`);
    assertNonEmpty(article.chapter, `${file}: chapter`);
    assertString(article.group ?? "", `${file}: group`);
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
    if (articleById.has(article.id)) {
      fail(`повторяющийся ID статьи ${article.id}`);
    }
    articleById.set(article.id, article);
    articles.push(article);
  }
  articles.sort((left, right) => compareStrings(left.id, right.id));

  const entities = [];
  const entityById = new Map();
  for (const file of walkJson(path.join(contentDir, "entities"))) {
    let entity;
    try {
      entity = readJson(file);
    } catch (error) {
      fail(`${file}: ${error.message}`);
    }
    assertNonEmpty(entity?.id, `${file}: id`);
    assertNonEmpty(entity.kind, `${file}: kind`);
    assertString(entity.markdown, `${file}: markdown`);
    if (entityById.has(entity.id)) {
      fail(`повторяющийся ID сущности ${entity.id}`);
    }
    entityById.set(entity.id, entity);
    entities.push(entity);
  }
  entities.sort((left, right) => compareStrings(left.id, right.id));
  return { articles, articleById, entities, entityById };
}

/** Полный Markdown статьи: текстовые блоки и сущности по ссылкам, без потерь. */
export function renderArticleMarkdown(article, entityById) {
  return article.blocks
    .map((block) => {
      if (block.type === "markdown") return block.text;
      const entity = entityById.get(block.ref);
      if (!entity) {
        fail(`статья ${article.id} ссылается на неизвестную сущность ${block.ref}`);
      }
      return entity.markdown;
    })
    .join("");
}

function catalogKindFor(chapter) {
  if (chapter.startsWith("18.")) return "treasure";
  if (chapter.startsWith("19.")) return "title";
  if (chapter.startsWith("16.")) return "project";
  return null;
}

function assertUniqueIds(ids, scope) {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`${scope}: повторяющийся ID ${id}`);
    seen.add(id);
  }
}

/**
 * Присваивает записям их прежние ID из явного сопоставления.
 *
 * Если заголовок переименован, ID остаётся прежним (позиция записи совпадает).
 * Перестановка, удаление или неоднозначное совпадение — ошибка, а не догадка.
 */
export function assignIdentityIds({ derived, expected, update = false, scope }) {
  if (!expected) {
    if (!update) {
      fail(
        `нет записи сопоставления для ${scope}; ` +
          "добавьте её через --update-identity",
      );
    }
    assertUniqueIds(derived, scope);
    return { ids: [...derived], next: [...derived], changed: true };
  }
  assertUniqueIds(expected, scope);
  if (expected.length === derived.length) {
    const derivedSet = new Set(derived);
    if (derivedSet.size !== derived.length) {
      fail(`${scope}: заголовки дают повторяющийся ID (неоднозначное сопоставление)`);
    }
    const expectedSet = new Set(expected);
    for (let index = 0; index < derived.length; index += 1) {
      if (derived[index] !== expected[index] && expectedSet.has(derived[index])) {
        fail(
          `${scope}: порядок записей изменился ` +
            `(«${derived[index]}» теперь на позиции ${index + 1}); ` +
            "исправьте сопоставление вручную",
        );
      }
    }
    return { ids: [...expected], next: [...expected], changed: false };
  }
  if (update && derived.length > expected.length) {
    const prefixMatches = expected.every((id, index) => derived[index] === id);
    if (!prefixMatches) {
      fail(
        `${scope}: нельзя дополнить сопоставление — существующий порядок изменился`,
      );
    }
    const next = [...expected, ...derived.slice(expected.length)];
    assertUniqueIds(next, scope);
    return { ids: next, next, changed: true };
  }
  fail(
    `${scope}: в сопоставлении ${expected.length} записей, в каноническом тексте ` +
      `${derived.length}; удаление или неоднозначное изменение требуют ручной правки`,
  );
}

function catalogPieces(article) {
  const kind = catalogKindFor(article.chapter);
  if (!kind) return null;
  const headings = [...article.markdown.matchAll(/^#### (.+)$/gm)];
  const pieces =
    kind === "project"
      ? [{ name: article.title, heading: "", markdown: article.markdown }]
      : headings.map((match, index) => ({
          name: match[1].replace(/\*\*/g, "").trim(),
          heading: headingId(match[1]),
          markdown: article.markdown
            .slice(match.index + match[0].length, headings[index + 1]?.index)
            .replace(/\n---\s*$/, "")
            .trim(),
        }));
  return { kind, pieces };
}

function plainSummary(markdown) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>`|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function field(markdown, label) {
  return (
    markdown
      .match(new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*)$`, "mi"))?.[1]
      .trim() || ""
  );
}

/**
 * Каталог сокровищ/титулов/проектов из реконструированного Markdown статей.
 * Старые ID берутся из явного сопоставления, а не выводятся из текущего имени.
 */
export function projectCatalog(
  articles,
  identityCatalog = {},
  { update = false } = {},
) {
  const entries = [];
  const nextIdentity = {};
  const changedArticles = [];
  for (const article of [...articles].sort((left, right) =>
    compareStrings(left.id, right.id),
  )) {
    const projected = catalogPieces(article);
    if (!projected) continue;
    const { kind, pieces } = projected;
    const derived = pieces.map((piece) =>
      piece.heading ? `${article.id}-${piece.heading}` : article.id,
    );
    const assignment = assignIdentityIds({
      derived,
      expected: identityCatalog[article.id],
      update,
      scope: `каталог статьи ${article.id}`,
    });
    nextIdentity[article.id] = assignment.next;
    if (assignment.changed) changedArticles.push(article.id);
    const ids = assignment.ids;
    assertUniqueIds(ids, `каталог статьи ${article.id}`);
    pieces.forEach((piece, index) => {
      entries.push({
        id: ids[index],
        kind,
        name: piece.name,
        category: article.group || "Титулы",
        echelon: Number(article.title.match(/(\d)-го Эшелона/i)?.[1]) || null,
        markdown: piece.markdown,
        summary: plainSummary(
          piece.markdown
            .split(/\n\s*\n/)
            .find((paragraph) => !/^\*\*[^*]+:\*\*/.test(paragraph) && !/^[#|]/.test(paragraph)) ||
            piece.markdown,
        ),
        articleId: article.id,
        heading: piece.heading,
        keywords: field(piece.markdown, "Ключевые слова"),
        prerequisite: field(piece.markdown, "Предварительное условие"),
        projectGoal: field(piece.markdown, "Цель проекта"),
        projectCharacteristic: field(
          piece.markdown,
          "Характеристика броска проекта",
        ),
      });
    });
  }
  assertUniqueIds(entries.map((entry) => entry.id), "каталог");
  return { entries, nextIdentity, changedArticles };
}

/** Термины глоссария из статьи 0102; ID тоже закреплены сопоставлением. */
export function projectGlossary(
  articles,
  identityGlossary,
  { update = false } = {},
) {
  const article = articles.find((entry) => entry.id === GLOSSARY_ARTICLE_ID);
  if (!article) fail(`статья глоссария ${GLOSSARY_ARTICLE_ID} не найдена`);
  const source = article.markdown;
  const terms = [
    ...source.matchAll(/^(?:\*\*([^*\n]+)\*\*|([^*\n:]+ \([^)]+\))):[ \t]*/gm),
  ];
  const derived = [];
  const entries = terms.map((match, index) => {
    const label = match[1] || match[2];
    const name = label.replace(/\s*\([^)]+\)\s*$/, "").trim();
    const id = headingId(name);
    derived.push(id);
    return {
      id,
      name,
      english: label.match(/\(([^)]+)\)\s*$/)?.[1] || "",
      markdown: source
        .slice(match.index + match[0].length, terms[index + 1]?.index)
        .trim(),
      letter: name[0].toLocaleUpperCase("ru"),
    };
  });
  const assignment = assignIdentityIds({
    derived,
    expected: identityGlossary,
    update,
    scope: "глоссарий",
  });
  const ids = assignment.ids;
  entries.forEach((entry, index) => {
    entry.id = ids[index];
  });
  entries.sort((left, right) => left.name.localeCompare(right.name, "ru"));
  return { entries, nextIdentity: assignment.next, changed: assignment.changed };
}

/** Карточки способностей из структурированных проекций канонических сущностей. */
export function projectAbilities(entities, abilityOrder = []) {
  const records = [];
  const seen = new Set();
  for (const entity of entities) {
    if (entity.kind !== "ability") {
      if (entity.ability !== undefined) {
        fail(
          `сущность ${entity.id} вида ${entity.kind} несёт структурированную способность; ` +
            "проекция способностей ожидает kind=ability",
        );
      }
      continue;
    }
    if (!entity.ability || typeof entity.ability !== "object") {
      fail(`сущность способности ${entity.id} без структурированной проекции`);
    }
    const id = entity.ability.id;
    assertString(id, `${entity.id}: ability.id`);
    if (seen.has(id)) fail(`повторяющийся ID способности ${id}`);
    seen.add(id);
    records.push(entity.ability);
  }
  assertUniqueIds(abilityOrder, "сопоставление способностей");
  const byId = new Map(records.map((record) => [record.id, record]));
  const ordered = [];
  const orderedIds = new Set();
  for (const id of abilityOrder) {
    const record = byId.get(id);
    if (!record) continue;
    ordered.push(record);
    orderedIds.add(id);
  }
  const unknown = records
    .map((record) => record.id)
    .filter((id) => !orderedIds.has(id))
    .sort(compareStrings);
  for (const id of unknown) ordered.push(byId.get(id));
  const stale = abilityOrder.filter((id) => !byId.has(id));
  return { abilities: ordered, unknown, stale };
}

/**
 * Присваивает порядок из явного сопоставления. Записи, которых ещё нет в
 * каноническом дереве, сохраняются в сопоставлении только для наборов с
 * отложенным контентом (`allowMissing`), чтобы новый комплект занял своё место.
 */
function applyIdentityOrder(
  records,
  identityIds,
  { scope, update = false, allowMissing = false, idOf = (record) => record.id },
) {
  const ids = records.map(idOf);
  assertUniqueIds(ids, scope);
  let expected = identityIds;
  if (expected === undefined) {
    if (!update) {
      fail(
        `нет записи сопоставления для ${scope}; ` +
          "добавьте её через --update-identity",
      );
    }
    expected = [];
  }
  if (!Array.isArray(expected)) fail(`${scope}: сопоставление должно быть массивом`);
  assertUniqueIds(expected, `${scope}: сопоставление`);
  const byId = new Map(records.map((record) => [idOf(record), record]));
  const known = expected.filter((id) => byId.has(id));
  const missing = expected.filter((id) => !byId.has(id));
  if (missing.length > 0 && !allowMissing) {
    fail(
      `${scope}: в сопоставлении ${missing.length} записей нет в каноническом ` +
        `дереве (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}); ` +
        "исправьте сопоставление вручную или через --update-identity",
    );
  }
  const expectedSet = new Set(expected);
  const unknown = records
    .filter((record) => !expectedSet.has(idOf(record)))
    .sort((left, right) => compareStrings(idOf(left), idOf(right)));
  const ordered = [...known.map((id) => byId.get(id)), ...unknown];
  const next = allowMissing
    ? [...expected, ...unknown.map(idOf)]
    : ordered.map(idOf);
  return {
    records: ordered,
    next,
    missing,
    unknown: unknown.map(idOf),
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Очистка Markdown комплектов; повторяет прежний `scripts/build-kits.mjs`. */
function cleanKitText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^>\s?/gm, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    // Канонические статьи используют обычные ссылки, а legacy-хранилище —
    // wiki-ссылки; для паритета оба вида оставляют только подпись.
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2")
    .replace(/`/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Разделы `##### Заголовок` внутри Markdown комплекта. */
function kitSections(markdown) {
  const result = new Map();
  const matches = [...markdown.matchAll(/^#####\s+(.+?)\s*$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    result.set(
      match[1].trim(),
      markdown.slice(
        match.index + match[0].length,
        matches[index + 1]?.index ?? markdown.length,
      ),
    );
  }
  return result;
}

function stripLeadingHeading(markdown) {
  return markdown.replace(/^#{1,6}[ \t]+.*(?:\n|$)/, "").trim();
}

/**
 * Текст перка без заголовка. Блок-цитата `> **Имя перка**` — это карточка
 * способности: прежний генератор превращал её в «Способность «Имя».».
 */
function cleanPerkBody(entity) {
  let text = stripLeadingHeading(entity.markdown).replace(/\r\n/g, "\n");
  const escaped = escapeRegExp(entity.name);
  text = text.replace(
    new RegExp(`^> \\*\\*(${escaped})\\*\\*[ \\t]*$`, "gmi"),
    "Способность «$1».",
  );
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^\[!example\]\s*(.+)$/gim, "Способность «$1».");
  text = text.replace(/^\[!tip\]\s*(.+)$/gim, "$1");
  text = text
    .split("\n")
    .filter((line) => !/^\s*\|/.test(line))
    .join("\n");
  text = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, value) =>
      value
        .split("|")
        .pop()
        .replace(/^\d+\.\s*/, ""),
    );
  text = text.replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/<\/?[^>]+>/g, "");
  text = text.replace(/\*\*|__/g, "");
  text = text.replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2");
  text = text.replace(/`/g, "");
  text = text.replace(/^---+\s*$/gm, "");
  text = text.replace(/[ \t]+$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/** Краткое описание перка; повторяет прежний `scripts/build-perks.mjs`. */
function makePerkSummary(description) {
  const generic =
    /^(У вас есть следующая способность\.?|Вы получаете один перк|В этом разделе|Способность «|Эффект:)/i;
  const lines = description
    .split("\n")
    .map((line) => line.replace(/^\s*[-•–]\s*/, "").trim())
    .filter(Boolean);
  let summary = lines.find((line) => !generic.test(line)) ?? "";
  if (summary.length > 210) {
    summary = `${summary.slice(0, 207).replace(/\s+\S*$/, "")}…`;
  }
  return summary;
}

/** Тип перка по фразе статьи: «Один перк группы интриги». */
function perkTypesFromPhrase(phrase) {
  const value = phrase.toLowerCase();
  const types = [];
  if (/ремесл|ремеслен/.test(value)) types.push("crafting");
  if (/исследован/.test(value)) types.push("exploration");
  if (/межличност/.test(value)) types.push("interpersonal");
  if (/интриг/.test(value)) types.push("intrigue");
  if (/знани/.test(value)) types.push("lore");
  if (/сверхъестеств/.test(value)) types.push("supernatural");
  return types;
}

function articleLevel(article) {
  return Number(article.title.match(/^(\d+)-й\s+Уровень/i)?.[1] ?? 0);
}

/**
 * Комплекты из сущностей `kit`. Поля повторяют legacy-контракт: снаряжение и
 * бонусы — из Markdown сущности, знаковая способность — из блока статьи, где
 * карточка способности вынесена в отдельную сущность.
 */
export function projectKits({
  entities,
  articles,
  entityById,
  identity,
  update = false,
}) {
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const kits = [];
  for (const entity of entities) {
    if (entity.kind !== "kit") continue;
    const id = entity.legacyIds?.[0];
    if (!id) fail(`комплект ${entity.id} без legacy-ID`);
    const parts = kitSections(entity.markdown);
    const bonuses = [];
    for (const line of (parts.get(KIT_BONUSES) ?? "").split("\n")) {
      const match = line.match(/^\*\*(.+?):\*\*\s*(.+?)\s*$/);
      if (!match) continue;
      bonuses.push({
        label: match[1].replace(/^Бонус к\s+/i, "").trim(),
        value: match[2].trim(),
      });
    }
    const signatureSection = parts.get(KIT_SIGNATURE) ?? "";
    const signatureCallout = signatureSection.match(/\[!example\]\s*(.+)/);
    let signatureAbility = signatureCallout ? signatureCallout[1].trim() : "";
    if (!signatureAbility) {
      // Составной комплект 0924 хранит карточки способностей прямо в Markdown
      // (без отдельных сущностей `ability`): имя берётся из заголовка
      // цитатного блока. Последний вариант комплекта побеждает — так же, как
      // legacy-разбор секций `#####`.
      const card = signatureSection.match(/^>\s*\*\*(.+?)\*\*\s*$/m);
      if (card) signatureAbility = card[1].trim();
    }
    if (!signatureAbility) {
      const article = articleById.get(entity.source?.articleId);
      const linked = article?.blocks.find(
        (block) =>
          block.type === "entity" && entityById.get(block.ref)?.kind === "ability",
      );
      if (linked) signatureAbility = entityById.get(linked.ref).name;
    }
    kits.push({
      id,
      name: entity.name,
      summary: cleanKitText(entity.markdown.split(/^#####/m)[0] ?? ""),
      equipment: cleanKitText(parts.get(KIT_EQUIPMENT) ?? "").replace(
        /\n+/g,
        " ",
      ),
      bonuses,
      signatureAbility,
    });
  }
  const order = applyIdentityOrder(kits, identity, {
    scope: "комплектов",
    update,
    allowMissing: true,
  });
  return {
    kits: order.records,
    nextIdentity: order.next,
    missing: order.missing,
    unknown: order.unknown,
  };
}

/**
 * Перки из сущностей `perk`; тип выводится из статьи главы 10. Типы перков
 * карьер и ограничения классовых перков читаются из Markdown статей 06xx/08xx.
 */
export function projectPerks({
  entities,
  articles,
  identity,
  update = false,
}) {
  const perks = [];
  for (const entity of entities) {
    if (entity.kind !== "perk") continue;
    const id = entity.legacyIds?.[0];
    if (!id) fail(`перк ${entity.id} без legacy-ID`);
    const type = PERK_TYPE_BY_ARTICLE[entity.source?.articleId];
    if (!type) {
      fail(
        `перк ${entity.id}: статья ${entity.source?.articleId} не задаёт тип перка`,
      );
    }
    perks.push({
      id,
      name: entity.name,
      type,
      summary: makePerkSummary(cleanPerkBody(entity)),
    });
  }
  perks.sort((left, right) => {
    const byType =
      PERK_TYPE_ORDER.indexOf(left.type) - PERK_TYPE_ORDER.indexOf(right.type);
    if (byType !== 0) return byType;
    return (
      left.name.localeCompare(right.name, "ru") || compareStrings(left.id, right.id)
    );
  });

  const careerPerkTypes = {};
  for (const article of articles) {
    if (article.chapter !== "06. Список Карьер") continue;
    const line = article.markdown
      .split("\n")
      .find((item) => /перк/i.test(item) && /один перк/i.test(item));
    if (!line) continue;
    const phrase = line.match(/Один перк(?: группы)?\s+([^(*\n]+)/i)?.[1] ?? "";
    const types = perkTypesFromPhrase(phrase);
    if (types.length === 1) careerPerkTypes[article.title] = types[0];
  }

  const classPerkRestrictions = {};
  for (const article of articles) {
    if (article.chapter !== "08. Классы") continue;
    const level = articleLevel(article);
    if (![2, 6, 10].includes(level)) continue;
    if (!article.group) continue;
    const heading = article.markdown.match(/^####\s+Перк\s*$/m);
    if (!heading) continue;
    const rest = article.markdown.slice(heading.index + heading[0].length);
    const nextHeading = rest.search(/^#{1,4}\s+/m);
    const body = (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).replace(
      /\n+/g,
      " ",
    );
    const types = perkTypesFromPhrase(body);
    if (types.length === 0) continue;
    classPerkRestrictions[article.group] ??= {};
    classPerkRestrictions[article.group][level] = types;
  }

  const order = applyIdentityOrder(perks, identity, {
    scope: "перков",
    update,
  });
  return {
    perks: order.records,
    careerPerkTypes,
    classPerkRestrictions,
    nextIdentity: order.next,
    missing: order.missing,
    unknown: order.unknown,
  };
}

/**
 * Убирает ведущий заголовок, сохраняя окружающие переводы строк. Нужен, когда
 * к собственному тексту особенности приклеивается продолжение статьи.
 */
function withoutLeadingHeading(markdown) {
  return markdown.replace(/^#{1,6}[ \t]+.*(?:\n|$)/, "");
}

/**
 * Продолжение статьи после сущности особенности до следующей особенности:
 * карточки способностей и markdown-разделители. Legacy-скелет классовых
 * особенностей вклеивал их в `description`, и канон хранит те же блоки.
 */
function featureSectionTail(entity, article, entityById) {
  if (!article) return "";
  const index = article.blocks.findIndex(
    (block) => block.type === "entity" && block.ref === entity.id,
  );
  if (index < 0) return "";
  let tail = "";
  for (let cursor = index + 1; cursor < article.blocks.length; cursor += 1) {
    const block = article.blocks[cursor];
    if (block.type === "entity") {
      const linked = entityById.get(block.ref);
      if (!linked) {
        fail(`статья ${article.id} ссылается на неизвестную сущность ${block.ref}`);
      }
      if (linked.kind === "feature") break;
      tail += linked.markdown;
      continue;
    }
    tail += block.text;
  }
  return tail;
}

/**
 * Особенности происхождений и классов из сущностей `feature`.
 * `ancestryName`/`className` и уровень берутся из статьи-источника.
 * Для классовых особенностей `description` включает карточки способностей,
 * на которые статья ссылается сразу после текста особенности: этого требует
 * legacy-контракт `class-features.generated.json`.
 */
export function projectFeatures({
  entities,
  articles,
  articleSources = [],
  identity = {},
  update = false,
}) {
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const sourceById = new Map(
    articleSources.map((article) => [article.id, article]),
  );
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const ancestryFeatures = [];
  const classFeatures = [];
  for (const entity of entities) {
    if (entity.kind !== "feature") continue;
    const id = entity.legacyIds?.[0];
    if (!id) fail(`особенность ${entity.id} без legacy-ID`);
    const article = articleById.get(entity.source?.articleId);
    if (!article) {
      fail(
        `особенность ${entity.id}: статья ${entity.source?.articleId} не найдена`,
      );
    }
    const description = stripLeadingHeading(entity.markdown);
    if (article.chapter.startsWith("04.")) {
      // Купленные черты записаны абзацем `**Название (N очко):** текст`;
      // legacy-описание начиналось сразу с текста, без повторения заголовка.
      const traitText = id.includes(".signature.")
        ? description
        : description.replace(
            /^\*\*[^*]+\s*\(\d+\s+очк[а-я]*\)\*\*:\s*/,
            "",
          );
      // Знаковые черты — секции «Знаковая Черта» статьи происхождения;
      // остальные записи — купленные черты за очки происхождения.
      const ancestryKind = /^####\s+[^\n]*знаков/i.test(entity.markdown)
        ? "signature"
        : "trait";
      ancestryFeatures.push({
        id,
        kind: "ancestry",
        ancestryKind,
        ancestryName: article.title,
        level: 1,
        name: entity.name,
        articleId: article.id,
        description: traitText,
      });
      continue;
    }
    if (!article.chapter.startsWith("08.")) {
      fail(
        `особенность ${entity.id}: неизвестная глава статьи ${article.id}`,
      );
    }
    if (!article.group) {
      fail(`особенность ${entity.id}: в статье ${article.id} нет класса`);
    }
    const level = articleLevel(article);
    if (!level) {
      fail(`особенность ${entity.id}: не удалось определить уровень статьи ${article.id}`);
    }
    const source = sourceById.get(article.id);
    const classDescription = `${withoutLeadingHeading(entity.markdown)}${featureSectionTail(
      entity,
      source,
      entityById,
    )}`.trim();
    classFeatures.push({
      id,
      kind: "class",
      className: article.group,
      level,
      name: entity.name,
      articleId: article.id,
      description: classDescription,
    });
  }

  const ancestry = applyIdentityOrder(ancestryFeatures, identity.ancestryFeatures, {
    scope: "особенностей происхождений",
    update,
  });
  const classes = applyIdentityOrder(classFeatures, identity.classFeatures, {
    scope: "особенностей классов",
    update,
  });
  return {
    features: [...ancestry.records, ...classes.records],
    nextIdentity: {
      ancestryFeatures: ancestry.next,
      classFeatures: classes.next,
    },
    missing: [...ancestry.missing, ...classes.missing],
    unknown: [...ancestry.unknown, ...classes.unknown],
  };
}

/** Очистка текста конструктора; повторяет прежний `scripts/build-builder.mjs`. */
function cleanBuilderText(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .trim();
}

/** Разделы `####`/`#####` в Markdown статьи или сущности класса. */
function builderSections(text, level = 4) {
  const matches = [
    ...text.matchAll(new RegExp(`^#{${level}} (.+)$`, "gm")),
  ];
  return matches.map((match, index) => ({
    name: cleanBuilderText(match[1]),
    text: text
      .slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length)
      .trim(),
  }));
}

/** Разделы класс-сущности (`#### Сводка`, `#### Основы`, ...). */
function builderClassSections(markdown) {
  const result = new Map();
  const matches = [...markdown.matchAll(/^#### (.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    result.set(
      matches[index][1].trim(),
      markdown.slice(
        matches[index].index + matches[index][0].length,
        matches[index + 1]?.index ?? markdown.length,
      ),
    );
  }
  return result;
}

/** Подклассы классов, у которых список задан общей таблицей, а не прозой. */
const BUILDER_CLASS_SUBCLASSES = {
  Талант: ["Хронопатия", "Телекинез", "Телепатия"],
  Элементалист: ["Земля", "Огонь", "Зелень", "Пустота"],
  Проводник: [
    "Созидание",
    "Смерть",
    "Судьба",
    "Знание",
    "Жизнь",
    "Любовь",
    "Природа",
    "Защита",
    "Буря",
    "Солнце",
    "Хитрость",
    "Война",
  ],
};

/** Особенности происхождения в порядке ссылок статьи. */
function articleFeatureEntities(article, entityById) {
  const seen = new Set();
  const features = [];
  for (const block of article?.blocks ?? []) {
    if (block.type !== "entity") continue;
    const entity = entityById.get(block.ref);
    if (entity?.kind !== "feature" || seen.has(entity.id)) continue;
    seen.add(entity.id);
    features.push(entity);
  }
  return features;
}

/** Знаковая черта из сущности `feature` (заголовок `#### Знаковая Черта`). */
function builderSignature(feature) {
  const heading = feature.markdown.match(/^####\s+(.+?)\s*$/m);
  if (!heading || !/знаков/i.test(heading[1])) return null;
  return `#### ${cleanBuilderText(heading[1])}\n${withoutLeadingHeading(
    feature.markdown,
  ).trim()}`;
}

/** Купленная черта `**Название (N очко):** текст`. */
function builderTrait(feature) {
  const match = feature.markdown.match(
    /^\*\*(.+?)\s*\((\d+)\s+очк[^)]*\)\*\*\s*:?/m,
  );
  if (!match) return null;
  return {
    name: match[1],
    cost: Number(match[2]),
    text: feature.markdown.slice(match[0].length).trim(),
  };
}

/**
 * Данные конструктора из сущностей `ancestry`, `culture`, `career`, `class`
 * и `complication`. Разбор полей портирован с `scripts/build-builder.mjs`,
 * но источник — канонические сущности и статьи, а не legacy-снапшоты.
 *
 * Сводка и основы класса берутся из класс-сущности; поток особенностей — из
 * статьи, потому что агрегат класса намеренно не дублирует карточки
 * способностей (они нужны контракту `BUILDER_DATA`).
 */
export function projectBuilder({
  entities,
  articles,
  entityById,
  identity = {},
  update = false,
}) {
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const sourceArticle = (entity) => {
    const article = articleById.get(entity.source?.articleId);
    if (!article) {
      fail(`сущность ${entity.id}: статья ${entity.source?.articleId} не найдена`);
    }
    return article;
  };

  const ancestries = [];
  for (const entity of entities) {
    if (entity.kind !== "ancestry") continue;
    const article = sourceArticle(entity);
    const markdown = renderArticleMarkdown(article, entityById);
    const features = articleFeatureEntities(article, entityById);
    const signatures = features
      .map(builderSignature)
      .filter((value) => value !== null);
    const traits = features.map(builderTrait).filter((value) => value !== null);
    const budget = Number(
      markdown.match(
        /(?:есть|имеете)\s+(\d+)\s+очк[ао]?\s+происхождения/i,
      )?.[1] || 3,
    );
    ancestries.push({
      id: entity.id,
      record: {
        name: entity.name,
        articleId: article.id,
        summary: cleanBuilderText(entity.markdown.split("\n\n")[0] ?? ""),
        signature: signatures.join("\n\n"),
        budget,
        traits,
      },
    });
  }

  const cultureGroups = {
    environment: "0502",
    organization: "0503",
    upbringing: "0504",
  };
  const cultures = {};
  const nextCultureIdentity = {};
  const cultureMissing = [];
  const cultureUnknown = [];
  for (const [group, articleId] of Object.entries(cultureGroups)) {
    const records = entities
      .filter(
        (entity) =>
          entity.kind === "culture" && entity.source?.articleId === articleId,
      )
      .map((entity) => ({
        id: entity.id,
        record: {
          name: entity.name,
          text: withoutLeadingHeading(entity.markdown).trim(),
          articleId,
        },
      }));
    const order = applyIdentityOrder(records, identity.cultures?.[group], {
      scope: `builder-культур (${group})`,
      update,
    });
    cultures[group] = order.records.map((entry) => entry.record);
    nextCultureIdentity[group] = order.next;
    cultureMissing.push(...order.missing);
    cultureUnknown.push(...order.unknown);
  }

  const careers = [];
  for (const entity of entities) {
    if (entity.kind !== "career") continue;
    const markdown = entity.markdown;
    careers.push({
      id: entity.id,
      record: {
        name: entity.name,
        articleId: entity.source.articleId,
        benefits: markdown.split("\n---")[0],
        renown: Number(
          markdown.match(/\*\*Известность\*\*:?\s*:?\s*\+?(\d+)/)?.[1] || 0,
        ),
        wealth: Number(
          markdown.match(/\*\*Богатство\*\*:?\s*:?\s*\+?(\d+)/)?.[1] || 0,
        ),
        incidents: [...markdown.matchAll(/^\|\s*\d+\s*\|\s*(.+?)\s*\|\s*$/gm)].map(
          (match) => cleanBuilderText(match[1]),
        ),
      },
    });
  }

  const classes = [];
  for (const entity of entities) {
    if (entity.kind !== "class") continue;
    const article = sourceArticle(entity);
    const markdown = renderArticleMarkdown(article, entityById);
    const sections = builderClassSections(entity.markdown);
    const summarySection = (sections.get("Сводка") ?? "").trim();
    const featureIndex = markdown.indexOf("## Особенности 1-го уровня");
    const features = featureIndex < 0 ? "" : markdown.slice(featureIndex);
    const featureSections = builderSections(features);
    const featureChoices = featureSections
      .filter((section) =>
        /^(Молитва|Оберег |Зачарование|Псионическая аугментация)/i.test(
          section.name,
        ),
      )
      .map((section) => ({
        name: section.name,
        text: section.text.split(/^##### /m)[0].trim(),
        options: builderSections(section.text, 5),
      }))
      .filter((section) => section.options.length > 0);
    let subclasses;
    if (BUILDER_CLASS_SUBCLASSES[entity.name]) {
      subclasses = BUILDER_CLASS_SUBCLASSES[entity.name].map((name) => ({
        name,
        text: "",
      }));
    } else {
      const first = featureSections[0]?.text ?? "";
      subclasses = [...first.matchAll(/^- \*\*(.+?):\*\*\s*(.+)$/gm)].map(
        (match) => ({
          name: cleanBuilderText(match[1]).replace(/\s*\([^)]*\)/g, ""),
          text: match[2],
        }),
      );
    }
    classes.push({
      id: entity.id,
      record: {
        name: entity.name,
        articleId: article.id,
        summary: cleanBuilderText(summarySection.split(/\n\s*\n/)[0] ?? ""),
        basics: (sections.get("Основы") ?? "").trim(),
        features,
        featureChoices,
        subclasses,
      },
    });
  }

  const complications = entities
    .filter((entity) => entity.kind === "complication")
    .map((entity) => ({
      id: entity.id,
      record: {
        name: entity.name,
        text: withoutLeadingHeading(entity.markdown).trim(),
        articleId: entity.source.articleId,
      },
    }));

  const ordered = (records, expected, scope) =>
    applyIdentityOrder(records, expected, { scope, update });
  const ancestry = ordered(
    ancestries,
    identity.ancestries,
    "builder-происхождений",
  );
  const career = ordered(careers, identity.careers, "builder-карьер");
  const klass = ordered(classes, identity.classes, "builder-классов");
  const complication = ordered(
    complications,
    identity.complications,
    "builder-нюансов",
  );

  return {
    data: {
      ancestries: ancestry.records.map((entry) => entry.record),
      cultures,
      careers: career.records.map((entry) => entry.record),
      classes: klass.records.map((entry) => entry.record),
      complications: complication.records.map((entry) => entry.record),
    },
    nextIdentity: {
      ancestries: ancestry.next,
      cultures: nextCultureIdentity,
      careers: career.next,
      classes: klass.next,
      complications: complication.next,
    },
    missing: [
      ...ancestry.missing,
      ...cultureMissing,
      ...career.missing,
      ...klass.missing,
      ...complication.missing,
    ],
    unknown: [
      ...ancestry.unknown,
      ...cultureUnknown,
      ...career.unknown,
      ...klass.unknown,
      ...complication.unknown,
    ],
  };
}

const LEVEL_UP_SUBCLASSES = {
  Неистовый: [
    ["Берсерк", "Берсерка"],
    ["Разоритель", "Разорителя"],
    ["Буревестник", "Буревестника"],
  ],
  Нуль: [
    ["Хронокинетик", "Хронокинетика"],
    ["Криокинетик", "Криокинетика"],
    ["Метакинетик", "Метакинетика"],
  ],
  Тактик: [
    ["Повстанец", "Повстанца"],
    ["Воевода", "Воеводы"],
    ["Авангард", "Авангарда"],
  ],
  Талант: [
    ["Хронопатия", "Хронопатии"],
    ["Телекинез", "Телекинеза"],
    ["Телепатия", "Телепатии"],
  ],
  Тень: [
    ["Коллегия Черного Пепла", "Черного Пепла"],
    ["Коллегия Едкой Алхимии", "Едкой Алхимии"],
    ["Коллегия Маски Арлекина", "Маски Арлекина"],
  ],
  Трубадур: [
    ["Автор", "Автора"],
    ["Дуэлянт", "Дуэлянта"],
    ["Виртуоз", "Виртуоза"],
  ],
  Цензор: [
    ["Экзорцист", "Экзорциста"],
    ["Оракул", "Оракула"],
    ["Идеал", "Идеала"],
  ],
};

const LEVEL_UP_CHARACTERISTICS = {
  Мощи: "might",
  Мощь: "might",
  Ловкости: "agility",
  Ловкость: "agility",
  Разума: "reason",
  Разум: "reason",
  Интуиции: "intuition",
  Интуиция: "intuition",
  Присутствия: "presence",
  Присутствие: "presence",
};

/**
 * Явные исключения уровня: выдачи и подклассные выборы, которые нельзя вывести
 * из стоимости ресурса или ключевых слов. Это механика, а не данные канона.
 */
const LEVEL_UP_EXCEPTIONS = {
  "Неистовый:2": {
    subclassGroups: {
      Берсерк: [
        "neistovyy-osobaya-dostavka-f71cbdccc0",
        "neistovyy-tarannyy-shar-5aecde78f8",
      ],
      Разоритель: [
        "neistovyy-smert-smert-61a8e0d162",
        "neistovyy-razrushitel-falang-5c4d3b0d58",
      ],
      Буревестник: [
        "neistovyy-vysshiy-hischnik-373d249741",
        "neistovyy-vnutrenniy-rev-04d333351c",
      ],
    },
  },
  "Элементалист:2": {
    grantItems: [
      {
        abilityIds: ["elementalist-mezhdu-nami-net-prostranstva-603bea008c"],
        subclasses: ["Пустота"],
      },
    ],
    choiceIds: [
      "elementalist-o-cvetok-pomogi-o-zemlya-zaschiti-d5889806f1",
      "elementalist-obyatiya-vulkana-3acba82839",
      "elementalist-perenesennyy-cherez-plamya-402569297d",
      "elementalist-podchinit-zelen-vnutri-69079b517c",
    ],
  },
  "Талант:8": {
    grantItems: [
      { abilityIds: ["talant-pole-levitacii-c51c097676"], subclasses: ["Телекинез"] },
      { abilityIds: ["talant-stazisnyy-schit-b4f19a14ce"], subclasses: ["Хронопатия"] },
    ],
    choiceIds: [
      "talant-omolozhenie-76cce55c24",
      "talant-predubezhdenie-b1aab277a4",
      "talant-stal-8f6e7fcb00",
      "talant-stiranie-pamyati-01c3ae771b",
    ],
  },
  "Тень:3": { grantIds: ["ten-vnimatelnoe-nablyudenie-0e1275c4b7"] },
  "Тень:4": { grantIds: ["ten-nochnoy-dozor-ae28536624"] },
  "Тень:8": {
    grantItems: [
      {
        abilityIds: ["ten-bomba-zamedlennogo-deystviya-3b731f7d34"],
        subclasses: ["Коллегия Едкой Алхимии"],
      },
    ],
  },
  "Трубадур:3": {
    grantItems: [
      {
        abilityIds: [
          "trubadur-zazhgi-etu-noch-7913c15e2d",
          "trubadur-neustannyy-geroy-091a644e8b",
        ],
        subclasses: ["Виртуоз"],
      },
    ],
  },
  "Трубадур:6": { grantIds: ["trubadur-v-luchah-prozhektora-e05dc6a432"] },
  "Трубадур:8": {
    grantItems: [
      {
        abilityIds: [
          "trubadur-lunnaya-sonata-07f21e5507",
          "trubadur-radikalnaya-fantaziya-e273b724c7",
        ],
        subclasses: ["Виртуоз"],
      },
    ],
  },
  "Элементалист:3": {
    grantItems: [
      {
        abilityIds: ["elementalist-zemlya-prinimaet-menya-ccc45de0e7"],
        subclasses: ["Земля"],
      },
      {
        abilityIds: ["elementalist-vspomni-rost-solnce-i-dozhd-d2229ae702"],
        subclasses: ["Зелень"],
      },
    ],
  },
  "Элементалист:6": { previousChoiceLevel: 5, choiceCost: 9 },
  "Элементалист:8": {
    grantItems: [
      {
        abilityIds: ["elementalist-prizyv-istochnika-zemli-c9679a42db"],
        subclasses: ["Земля"],
      },
    ],
  },
  "Элементалист:9": { previousChoiceLevel: 8, choiceCost: 11 },
};

function normalizeLevelUpText(text) {
  return text
    .toLocaleLowerCase("ru")
    .replace(/[её]/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function levelUpCharacteristicRules(markdown, level) {
  if (![4, 7, 10].includes(level)) return undefined;
  const section =
    markdown.match(/#### Увеличение характеристик\s*([\s\S]*?)(?=\n#### |$)/i)?.[1] ??
    "";
  if (!section) return undefined;
  if (/Каждая из ваших характеристик увеличивается на 1/i.test(section)) {
    return { increaseAll: { amount: 1, cap: level === 7 ? 4 : 5 } };
  }
  const cap = level === 4 ? 3 : 5;
  const pair = section.match(
    /показатели\s+([^\n.]+?)\s+и\s+([^\n.]+?)\s+каждый увеличивается до/i,
  );
  if (pair) {
    const left = LEVEL_UP_CHARACTERISTICS[pair[1].trim()];
    const right = LEVEL_UP_CHARACTERISTICS[pair[2].trim()];
    if (left && right) return { set: { [left]: cap, [right]: cap } };
  }
  const single = section.match(/показатель\s+([^\n.]+?)\s+увеличивается до/i);
  if (single) {
    const key = LEVEL_UP_CHARACTERISTICS[single[1].trim()];
    if (
      key &&
      /увеличить один из ваших показателей характеристик на 1/i.test(section)
    ) {
      return { set: { [key]: cap }, choice: { amount: 1, cap } };
    }
    if (key) return { set: { [key]: cap } };
  }
  return undefined;
}

function levelUpFeatures(article) {
  const lines = article.markdown.split("\n");
  const features = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^#### (.+)$/);
    if (!heading) continue;
    let end = index + 1;
    while (end < lines.length && !/^#{1,4} /.test(lines[end])) end += 1;
    features.push({
      id: `${article.id}-f${String(features.length + 1).padStart(2, "0")}`,
      name: heading[1].replace(/\*\*/g, ""),
      description: lines.slice(index + 1, end).join("\n").trim(),
    });
  }
  return features;
}

function levelUpAbilitySection(article) {
  const header = article.markdown.match(/^#### [^\n]*способность[^\n]*$/im);
  if (!header) return "";
  const rest = article.markdown.slice(header.index + header[0].length);
  const next = rest.search(/^#### /m);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

function levelUpGenericChoiceIds(article, matching, grantIds = []) {
  const section = levelUpAbilitySection(article);
  if (!/выберите одну героическую способность|выберите одну способность/i.test(section)) {
    return [];
  }
  const level = articleLevel(article);
  return matching
    .filter((ability) => ability.resourceCost === (level <= 6 ? 9 : 11))
    .filter((ability) =>
      normalizeLevelUpText(section).includes(normalizeLevelUpText(ability.name)),
    )
    .map((ability) => ability.id)
    .filter((id) => !grantIds.includes(id));
}

function levelUpAbilityGroups({ className, level, article, matching, exception }) {
  if (exception.choiceIds) {
    return exception.choiceIds.length
      ? [
          {
            id: `${article.id}-g01`,
            label: `Героическая способность ${level}-го уровня`,
            count: 1,
            abilityIds: exception.choiceIds,
          },
        ]
      : [];
  }
  const subclasses = LEVEL_UP_SUBCLASSES[className];
  const sections = article.markdown.split(/(?=^#{3,5} )/m);
  const groups = [];
  if (subclasses) {
    for (const [subclass, headerToken] of subclasses) {
      const section = sections.find(
        (part) =>
          normalizeLevelUpText(part.split("\n", 1)[0]).includes(
            normalizeLevelUpText(headerToken),
          ) &&
          /Выберите одну из следующих(?: героических)? способностей/.test(part),
      );
      if (!section) continue;
      const ids = matching
        .filter((ability) =>
          normalizeLevelUpText(section).includes(
            normalizeLevelUpText(ability.name),
          ),
        )
        .map((ability) => ability.id)
        .filter((id) => !(exception.grantIds ?? []).includes(id));
      if (ids.length) {
        groups.push({
          id: `${article.id}-g${String(groups.length + 1).padStart(2, "0")}`,
          label: `${subclass}: способность ${level}-го уровня`,
          count: 1,
          abilityIds: ids,
          subclasses: [subclass],
        });
      }
    }
    if (groups.length) return groups;
  }
  // Способности домена выбираются одним списком по выбранным доменам героя;
  // LevelUpAbilityGroup не выражает принадлежность варианта домену.
  if (/Способность домена \d+-го уровня/.test(article.markdown)) return groups;
  const section = levelUpAbilitySection(article);
  if (
    matching.length &&
    /выберите одну героическую способность|выберите одну способность/i.test(section)
  ) {
    const ids = matching
      .filter(
        (ability) =>
          normalizeLevelUpText(section).includes(
            normalizeLevelUpText(ability.name),
          ) && !(exception.grantIds ?? []).includes(ability.id),
      )
      .map((ability) => ability.id);
    if (ids.length) {
      groups.push({
        id: `${article.id}-g01`,
        label: `Героическая способность ${level}-го уровня`,
        count: 1,
        abilityIds: ids,
      });
    }
  }
  return groups;
}

/**
 * Правила повышения уровня из статей 08xx. Логика портирована с прежнего
 * `scripts/build-level-up.mjs`, но источник — канонические статьи и карточки
 * способностей, а не `src/data/*.generated.json`.
 */
export function projectLevelUp({
  articles,
  abilities,
  identity,
  update = false,
}) {
  const classArticles = articles.filter(
    (article) =>
      article.chapter === "08. Классы" &&
      article.group &&
      article.markdown.trim() &&
      articleLevel(article) >= 2 &&
      articleLevel(article) <= 10,
  );
  const classNames = [];
  for (const article of classArticles) {
    if (!classNames.includes(article.group)) classNames.push(article.group);
  }
  const articleFor = (className, level) => {
    const found = classArticles.filter(
      (article) => article.group === className && articleLevel(article) === level,
    );
    if (found.length > 1) {
      fail(`несколько статей ${className} ${level}-го уровня`);
    }
    return found[0];
  };

  const rules = [];
  for (const className of classNames) {
    for (let level = 2; level <= 10; level += 1) {
      const article = articleFor(className, level);
      if (!article) {
        fail(
          `нет статьи ${className} ${level}-го уровня; пустые статьи класса ` +
            "не дают правил повышения уровня",
        );
      }
      const matching = abilities.filter(
        (ability) =>
          ability.sourceKind === "class" &&
          ability.className === className &&
          ability.level === level,
      );
      const exception = LEVEL_UP_EXCEPTIONS[`${className}:${level}`] ?? {};
      const grantIds =
        exception.grantIds ??
        (exception.grantItems ?? []).flatMap((item) => item.abilityIds);
      const grants =
        exception.grantItems ??
        grantIds.map((id) => ({ abilityIds: [id] }));
      const abilityChoices = [];
      if (exception.subclassGroups) {
        for (const [subclass, abilityIds] of Object.entries(
          exception.subclassGroups,
        )) {
          abilityChoices.push({
            id: `${article.id}-g${String(abilityChoices.length + 1).padStart(2, "0")}`,
            label: `${subclass}: способность ${level}-го уровня`,
            count: 1,
            abilityIds,
            subclasses: [subclass],
          });
        }
      } else if (exception.previousChoiceLevel) {
        const previousArticle = articleFor(className, exception.previousChoiceLevel);
        if (!previousArticle) {
          fail(
            `нет статьи ${className} ${exception.previousChoiceLevel}-го уровня ` +
              "для предыдущего выбора",
          );
        }
        const previousMatching = abilities.filter(
          (ability) =>
            ability.sourceKind === "class" &&
            ability.className === className &&
            ability.level === exception.previousChoiceLevel,
        );
        const previousException =
          LEVEL_UP_EXCEPTIONS[
            `${className}:${exception.previousChoiceLevel}`
          ] ?? {};
        const previousGrantIds =
          previousException.grantIds ??
          (previousException.grantItems ?? []).flatMap(
            (item) => item.abilityIds,
          );
        const ids = [
          ...new Set([
            ...levelUpGenericChoiceIds(
              previousArticle,
              previousMatching,
              previousGrantIds,
            ),
            ...levelUpGenericChoiceIds(article, matching, grantIds),
          ]),
        ];
        abilityChoices.push({
          id: `${article.id}-g01`,
          label: `Способность за ${exception.choiceCost} эссенции`,
          count: 1,
          abilityIds: ids,
          allowedLevels: [exception.previousChoiceLevel, level],
        });
      } else {
        abilityChoices.push(
          ...levelUpAbilityGroups({
            className,
            level,
            article,
            matching,
            exception: { ...exception, grantIds },
          }),
        );
      }
      const skillCount = (
        article.markdown.match(/Вы получаете один навык по вашему выбору/gi) ?? []
      ).length;
      rules.push({
        className,
        level,
        articleId: article.id,
        title: article.title,
        features: levelUpFeatures(article),
        characteristics: levelUpCharacteristicRules(article.markdown, level),
        skillCount,
        abilityChoices,
        grantedAbilities: grants,
      });
    }
  }

  const order = applyIdentityOrder(rules, identity, {
    scope: "правил повышения уровня",
    update,
    idOf: (rule) => rule.articleId,
  });
  return {
    rules: order.records,
    nextIdentity: order.next,
    missing: order.missing,
    unknown: order.unknown,
  };
}

function readIdentity(file, { update = false } = {}) {
  try {
    return readJson(file);
  } catch (error) {
    if (update) {
      return {
        schemaVersion: CONSUMER_SCHEMA_VERSION,
        abilityOrder: [],
        catalog: {},
        glossary: undefined,
      };
    }
    fail(
      `не удалось прочитать сопоставление ${file}: ${error.message}; ` +
        "создайте его через --update-identity",
    );
  }
}

function sortedRecord(record) {
  const result = {};
  for (const key of Object.keys(record).sort(compareStrings)) {
    result[key] = record[key];
  }
  return result;
}

/**
 * Собирает обе проекции. Никаких устаревших снапшотов: только каноническое
 * дерево и явное сопоставление идентификаторов.
 */
export function buildConsumerData({
  root = REPO_ROOT,
  contentDir = path.join(root, DEFAULT_CONTENT),
  outDir = path.join(root, DEFAULT_OUT),
  identityPath = path.join(root, DEFAULT_IDENTITY),
  check = false,
  updateIdentity = false,
} = {}) {
  const { articles, entityById, entities } = readCanonicalTree({ contentDir });
  const identity = readIdentity(identityPath, { update: updateIdentity });
  const renderedArticles = articles.map((article) => ({
    id: article.id,
    title: article.title,
    chapter: article.chapter,
    group: article.group ?? "",
    markdown: renderArticleMarkdown(article, entityById),
  }));

  const catalog = projectCatalog(renderedArticles, identity.catalog ?? {}, {
    update: updateIdentity,
  });
  const glossary = projectGlossary(
    renderedArticles,
    identity.glossary,
    { update: updateIdentity },
  );
  const abilities = projectAbilities(entities, identity.abilityOrder ?? []);
  const kits = projectKits({
    entities,
    articles,
    entityById,
    identity: identity.kits,
    update: updateIdentity,
  });
  const perks = projectPerks({
    entities,
    articles: renderedArticles,
    identity: identity.perks,
    update: updateIdentity,
  });
  const features = projectFeatures({
    entities,
    articles: renderedArticles,
    articleSources: articles,
    identity,
    update: updateIdentity,
  });
  const levelUp = projectLevelUp({
    articles: renderedArticles,
    abilities: abilities.abilities,
    identity: identity.levelUp,
    update: updateIdentity,
  });
  const builder = projectBuilder({
    entities,
    articles,
    entityById,
    identity: identity.builder ?? {},
    update: updateIdentity,
  });

  const abilityProjection = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    abilities: abilities.abilities,
  };
  const libraryProjection = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    catalog: catalog.entries,
    glossary: glossary.entries,
  };
  const kitProjection = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    kits: kits.kits,
  };
  const perkProjection = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    perks: perks.perks,
    careerPerkTypes: perks.careerPerkTypes,
    classPerkRestrictions: perks.classPerkRestrictions,
  };
  const featureProjection = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    features: features.features,
  };
  const levelUpProjection = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    rules: levelUp.rules,
  };
  const builderProjection = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    ...builder.data,
  };

  const nextIdentity = {
    schemaVersion: CONSUMER_SCHEMA_VERSION,
    note: IDENTITY_NOTE,
    abilityOrder: [
      ...(identity.abilityOrder ?? []).filter((id) =>
        abilities.abilities.some((record) => record.id === id),
      ),
      ...abilities.unknown,
    ],
    catalog: sortedRecord(catalog.nextIdentity),
    glossary: glossary.nextIdentity,
    kits: kits.nextIdentity,
    perks: perks.nextIdentity,
    ancestryFeatures: features.nextIdentity.ancestryFeatures,
    classFeatures: features.nextIdentity.classFeatures,
    levelUp: levelUp.nextIdentity,
    builder: builder.nextIdentity,
  };

  const expected = new Map();
  expected.set(
    path.join(outDir, "abilities.json"),
    jsonText(abilityProjection),
  );
  expected.set(path.join(outDir, "library.json"), jsonText(libraryProjection));
  expected.set(path.join(outDir, "kits.json"), jsonText(kitProjection));
  expected.set(path.join(outDir, "perks.json"), jsonText(perkProjection));
  expected.set(
    path.join(outDir, "features.json"),
    jsonText(featureProjection),
  );
  expected.set(
    path.join(outDir, "level-up.json"),
    jsonText(levelUpProjection),
  );
  expected.set(
    path.join(outDir, "builder.json"),
    jsonText(builderProjection),
  );

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
    if (updateIdentity) {
      writeJsonText(identityPath, jsonText(nextIdentity));
    }
    for (const [file, text] of expected) writeJsonText(file, text);
  }

  const stats = {
    abilities: abilities.abilities.length,
    catalog: catalog.entries.length,
    glossary: glossary.entries.length,
    kits: kits.kits.length,
    perks: perks.perks.length,
    features: features.features.length,
    ancestryFeatures: features.features.filter(
      (feature) => feature.kind === "ancestry",
    ).length,
    classFeatures: features.features.filter(
      (feature) => feature.kind === "class",
    ).length,
    levelUpRules: levelUp.rules.length,
    builderAncestries: builder.data.ancestries.length,
    builderCultures: Object.values(builder.data.cultures).reduce(
      (sum, entries) => sum + entries.length,
      0,
    ),
    builderCareers: builder.data.careers.length,
    builderClasses: builder.data.classes.length,
    builderComplications: builder.data.complications.length,
    unknownAbilities: abilities.unknown,
    staleAbilities: abilities.stale,
    missingKits: kits.missing,
    unknownKits: kits.unknown,
    unknownPerks: perks.unknown,
    unknownFeatures: features.unknown,
    unknownLevelUp: levelUp.unknown,
    unknownBuilder: builder.unknown,
    changedArticles: catalog.changedArticles,
    glossaryChanged: glossary.changed,
    bytes: [...expected.values()].reduce(
      (sum, text) => sum + Buffer.byteLength(text, "utf8"),
      0,
    ),
  };

  return {
    abilityProjection,
    libraryProjection,
    kitProjection,
    perkProjection,
    featureProjection,
    levelUpProjection,
    builderProjection,
    nextIdentity,
    stats,
    expected,
    differences,
    ok: differences.length === 0 && !updateIdentity,
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
    options.content ?? path.join(root, DEFAULT_CONTENT),
  );
  const outDir = path.resolve(options.out ?? path.join(root, DEFAULT_OUT));
  const identityPath = path.resolve(
    options.identity ?? path.join(root, DEFAULT_IDENTITY),
  );
  const result = buildConsumerData({
    root,
    contentDir,
    outDir,
    identityPath,
    check: options.check,
    updateIdentity: options.updateIdentity,
  });
  console.log("=== build-consumer-data ===");
  console.log(`Способностей:  ${result.stats.abilities}`);
  console.log(`Каталог:       ${result.stats.catalog}`);
  console.log(`Глоссарий:     ${result.stats.glossary}`);
  console.log(`Комплекты:     ${result.stats.kits}`);
  console.log(`Перки:         ${result.stats.perks}`);
  console.log(
    `Особенности:   ${result.stats.features} ` +
      `(происхождения ${result.stats.ancestryFeatures}, классы ${result.stats.classFeatures})`,
  );
  console.log(`Повышение:     ${result.stats.levelUpRules} правил`);
  console.log(
    `Конструктор:   ${result.stats.builderAncestries} происхождений, ` +
      `${result.stats.builderCultures} культур, ` +
      `${result.stats.builderCareers} карьер, ` +
      `${result.stats.builderClasses} классов, ` +
      `${result.stats.builderComplications} нюансов`,
  );
  console.log(`Размер:        ${(result.stats.bytes / 1024).toFixed(1)} КБ`);
  if (result.stats.missingKits.length > 0) {
    console.log(
      `Отложенные комплекты: ${result.stats.missingKits.length} ` +
        `(${result.stats.missingKits.join(", ")}); появятся после миграции`,
    );
  }
  if (result.stats.unknownKits.length > 0) {
    console.log(
      `Новые комплекты вне сопоставления: ${result.stats.unknownKits.length} ` +
        `(${result.stats.unknownKits.slice(0, 5).join(", ")}); добавлены детерминированно`,
    );
  }
  if (result.stats.unknownPerks.length > 0) {
    console.log(
      `Новые перки вне сопоставления: ${result.stats.unknownPerks.length}`,
    );
  }
  if (result.stats.unknownFeatures.length > 0) {
    console.log(
      `Новые особенности вне сопоставления: ${result.stats.unknownFeatures.length}`,
    );
  }
  if (result.stats.unknownLevelUp.length > 0) {
    console.log(
      `Новые правила повышения вне сопоставления: ${result.stats.unknownLevelUp.length}`,
    );
  }
  if (result.stats.unknownBuilder.length > 0) {
    console.log(
      `Новые записи конструктора вне сопоставления: ${result.stats.unknownBuilder.length}`,
    );
  }
  if (result.stats.unknownAbilities.length > 0) {
    console.log(
      `Новые способности вне сопоставления: ${result.stats.unknownAbilities.length} ` +
        `(${result.stats.unknownAbilities.slice(0, 5).join(", ")}${
          result.stats.unknownAbilities.length > 5 ? "…" : ""
        }); добавлены в конец детерминированно`,
    );
  }
  if (result.stats.staleAbilities.length > 0) {
    console.log(
      `Устаревшие записи сопоставления: ${result.stats.staleAbilities.length}`,
    );
  }
  if (result.stats.changedArticles.length > 0) {
    console.log(
      `Дополнено сопоставление статей: ${result.stats.changedArticles.join(", ")}`,
    );
  }
  if (options.updateIdentity) {
    console.log(
      `Сопоставление: ${path.relative(root, identityPath)} (обновлено)`,
    );
  }
  if (options.check) {
    if (result.ok) {
      console.log("Проверка:      проекции совпадают с каноническими.");
    } else {
      console.log(`Расхождения:  ${result.differences.length}`);
      for (const difference of result.differences.slice(0, 20)) {
        console.log(`  - ${difference}`);
      }
      if (result.differences.length > 20) {
        console.log(`  … ещё ${result.differences.length - 20}`);
      }
      process.exitCode = 1;
    }
  } else {
    console.log(`Каталог:       ${path.relative(root, outDir)}`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
