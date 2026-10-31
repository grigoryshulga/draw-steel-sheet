/**
 * Общие детерминированные помощники миграции и сборки канонических правил.
 *
 * Здесь нет чтения данных: только преобразование текста, путей и JSON.
 * Импорт и сборка используют один и тот же `headingId`, `searchText` и
 * разбиение глав на пакеты, поэтому опубликованные ID совпадают со старыми
 * ссылками Кодекса.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION = 1;
export const RULE_KINDS = [
  "ability",
  "feature",
  "ancestry",
  "class",
  "career",
  "culture",
  "complication",
  "kit",
  "perk",
  "item",
  "project",
  "title",
];

/** Стоимость ресурса в заголовке блока способности. */
export const COST_RE = /\((\d+)(\+)?\s+[^)]+\)\s*$/;

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function cleanInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/[*`_]/g, "")
    .trim();
}

export function normalizeName(text) {
  return cleanInline(text)
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

export function keyName(text) {
  return normalizeName(text).toLocaleLowerCase("ru");
}

/** Слаг для каталогов и служебных имён. Идентичность в JSON не меняется. */
export function slugify(text) {
  const latin = [...cleanInline(text).toLocaleLowerCase("ru")]
    .map((char) => (char in TRANSLIT ? TRANSLIT[char] : char))
    .join("");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Имя файла статьи: ID остаётся в JSON, имя лишь санируется. */
export function safeFileStem(id) {
  return id
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Точно повторяет `src/lib/codex.ts`, чтобы старые ссылки на заголовки жили. */
export function headingId(text) {
  return text
    .toLocaleLowerCase("ru")
    .replace(/[*_`]/g, "")
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

/** Точно повторяет `src/lib/codex.ts`; используется для поиска и индекса. */
export function searchText(text) {
  return text.toLocaleLowerCase("ru").replace(/ё/g, "е");
}

export function normalizeSearchText(text) {
  return searchText(text).replace(/\s+/g, " ").trim();
}

export function indexLines(text) {
  const lines = text.split("\n");
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return { lines, offsets };
}

/**
 * Заголовки статьи. `end` — начало следующего содержательного заголовка,
 * поэтому подписи таблиц (`###### Таблица …`) не обрывают родительский блок.
 */
export function parseHeadings(text) {
  const { lines, offsets } = indexLines(text);
  const items = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (!match) continue;
    const name = cleanInline(match[2]);
    items.push({
      level: match[1].length,
      title: match[2],
      name,
      start: offsets[index],
      line: lines[index],
      lineIndex: index,
      caption: /^таблиц/i.test(name),
    });
  }
  return items.map((item, index) => {
    let end = text.length;
    for (let next = index + 1; next < items.length; next += 1) {
      if (!items[next].caption) {
        end = items[next].start;
        break;
      }
    }
    return { ...item, end };
  });
}

/** Цитатные блоки `> **Название**` — кандидаты в способности и статблоки. */
export function parseAbilityBlocks(text) {
  const { lines, offsets } = indexLines(text);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^>\s*\*\*(.+?)\*\*\s*$/.exec(lines[index]);
    if (!match) continue;
    let last = index;
    while (last + 1 < lines.length && lines[last + 1].startsWith(">")) {
      last += 1;
    }
    const start = offsets[index];
    const end = offsets[last] + lines[last].length;
    const markdown = text.slice(start, end);
    const unquoted = markdown
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""));
    const body = unquoted.slice(1).join("\n").trim();
    const title = match[1].trim();
    blocks.push({
      title,
      name: title.replace(COST_RE, "").trim(),
      start,
      end,
      markdown,
      body,
      structured: /📏|🎯|Бросок силы|\*\*Триггер:|\*\*Эффект:|\*\*Потратить/i.test(
        body,
      ),
    });
    index = last;
  }
  return blocks;
}

/**
 * Черты происхождений записаны абзацами `**Название (N очко)**: текст`.
 * Блок продолжается до следующей черты или заголовка и включает вложенный
 * цитатный статблок/способность.
 */
export function parseTraitRegions(text) {
  const { lines, offsets } = indexLines(text);
  const starts = [];
  const headings = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^(#{1,6})\s+/.test(lines[index])) headings.push(index);
    const match = /^\*\*(.+?)\s*\((\d+)\s+очк[а-я]*\)\*\*:\s*(.*)$/.exec(
      lines[index],
    );
    if (!match) continue;
    starts.push({
      name: match[1],
      cost: Number(match[2]),
      text: match[3],
      start: offsets[index],
      lineIndex: index,
      line: lines[index],
    });
  }
  for (let position = 0; position < starts.length; position += 1) {
    const trait = starts[position];
    let boundary = text.length;
    const nextTrait = starts[position + 1]?.start;
    if (nextTrait !== undefined) boundary = Math.min(boundary, nextTrait);
    const nextHeading = headings.find((index) => index > trait.lineIndex);
    if (nextHeading !== undefined) boundary = Math.min(boundary, offsets[nextHeading]);
    let lastNonEmpty = trait.lineIndex;
    for (let index = trait.lineIndex; index < lines.length; index += 1) {
      if (offsets[index] >= boundary) break;
      if (lines[index].trim()) lastNonEmpty = index;
    }
    trait.end = offsets[lastNonEmpty] + lines[lastNonEmpty].length;
    const rest = lines.slice(trait.lineIndex + 1, lastNonEmpty + 1).join("\n");
    trait.body = (trait.text + (rest ? `\n${rest}` : "")).trim();
    trait.markdown = text.slice(trait.start, trait.end);
  }
  return starts;
}

/** Каталог главы: `08. Классы` -> `08-klassy`. */
export function chapterSlug(chapter) {
  const match = /^(\d+)\.\s*(.*)$/.exec(chapter);
  if (!match) return slugify(chapter) || "chapter";
  const rest = slugify(match[2]);
  return rest ? `${match[1]}-${rest}` : match[1];
}

/**
 * Пакеты: глава — базовая единица, но глава классов делится по классам,
 * чтобы ленивая загрузка не тянула весь раздел на 1,4 МБ.
 */
export function packIdForArticle(article) {
  const match = /^(\d+)/.exec(article.chapter);
  const chapter = match ? match[1] : slugify(article.chapter) || "chapter";
  if (chapter === "08" && article.group) {
    const group = slugify(article.group);
    if (group) return `chapter-08-${group}`;
  }
  return `chapter-${chapter}`;
}

export function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function writeJsonText(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
}

export function writeJson(file, value) {
  writeJsonText(file, jsonText(value));
}

/** Рекурсивный детерминированный список JSON-файлов. */
export function walkJson(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries.sort((a, b) => compareStrings(a.name, b.name))) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkJson(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
  }
  return files;
}

/** Список исходников, всё ещё читающих устаревший dataset. */
export function findDatasetConsumers(root, datasetNames) {
  const targets = new Set(datasetNames.map((name) => path.basename(name)));
  const results = [];
  const walk = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => compareStrings(a.name, b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
          continue;
        }
        walk(full);
        continue;
      }
      if (!/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) continue;
      // Сами generated JSON — входные данные, а не потребители.
      if (entry.name.endsWith(".generated.json")) continue;
      const source = readFileSync(full, "utf8");
      for (const target of targets) {
        if (source.includes(target)) {
          results.push({
            path: path.relative(root, full).replaceAll(path.sep, "/"),
            dataset: target,
          });
          break;
        }
      }
    }
  };
  for (const folder of ["src", "scripts", "tests"]) {
    walk(path.join(root, folder));
  }
  return results.sort((a, b) =>
    compareStrings(a.dataset, b.dataset) || compareStrings(a.path, b.path),
  );
}
