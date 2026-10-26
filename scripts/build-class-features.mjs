#!/usr/bin/env node
/**
 * Генератор скелета классовых особенностей.
 *
 * Источники:
 * - `src/data/builder.generated.json` — особенности 1-го уровня: markdown `classes[].features`.
 * - `src/data/level-up.generated.json` — особенности 2–10 уровней: `features[].{id,name,description}`.
 *
 * Правила разбора (спецификация задачи 3):
 * - Класс 1-го уровня: каждая особенность — заголовок `#### `. Любой более глубокий заголовок
 *   (`##### `, `###### `) внутри её текста даёт вложенную особенность с `parentId`.
 * - Уровни 2–10: сама запись `level-up.features[]` даёт особенность, каждый заголовок глубже неё
 *   внутри `description` — вложенную особенность.
 * - Заголовки-подписи таблиц (`Таблица …`) особенностями не считаются и остаются в тексте родителя.
 * - Группировки способностей (`##### Способность Берсерка 2-го уровня`, таблица «Домен | Способность»)
 *   тоже не особенности: их текст остаётся в родителе, а сами способности живут в каталоге способностей.
 *   Иначе скелет дублировал бы `abilities.generated.json` и раздувал счёт на 36 записей Проводника.
 * - Таблица даёт вложенные особенности, только если её первая колонка — ключевая группа
 *   (аспект/орден/домен/традиция/доктрина/коллегия/амплуа/специализация) или порог
 *   (ячейки начинаются с числа, например шкала свирепости). Прочие таблицы (характеристики форм,
 *   состав комплектов) не разворачиваются.
 * - Строка такой таблицы даёт `keyValue` — первую ячейку — и `keyedBy` из заголовка первой колонки
 *   (`undefined`, если группа не опознана). Если вторая ячейка совпадает с уже разобранной вложенной
 *   особенностью, ключ проставляется ей; иначе из строки создаётся новая вложенная особенность.
 *   Ячейка может перечислять несколько особенностей через запятую — ключ получает каждая, а
 *   несколько ключей у одной особенности склеиваются через запятую.
 * - `id` — слаг `<class-slug>.<keyedBy ?? "feature">.<level>.<name-slug>`, транслитерация кириллицы
 *   таблицей ниже. `description` — markdown источника без изменений; у родителя он не содержит
 *   блоков, вынесенных во вложенные особенности.
 * - Уровень вложенной особенности — уровень родителя, кроме пороговых строк вида
 *   `8 (4-й уровень)`, где уровень берётся из подписи.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builderPath = path.join(root, "src/data/builder.generated.json");
const levelUpPath = path.join(root, "src/data/level-up.generated.json");
const outputPath = path.join(root, "src/data/class-features.generated.json");

const CLASS_SLUGS = {
  Неистовый: "fury",
  Нуль: "null",
  Проводник: "conduit",
  Тактик: "tactician",
  Талант: "talent",
  Тень: "shadow",
  Трубадур: "troubadour",
  Цензор: "censor",
  Элементалист: "elementalist",
};

/** Ключевое слово `keyedBy` по заголовку первой колонки таблицы. */
const KEYED_BY = {
  Аспект: "aspect",
  Орден: "order",
  Домен: "domain",
  Традиция: "tradition",
  Доктрина: "doctrine",
  Коллегия: "college",
  Амплуа: "troupe",
  Специализация: "specialization",
};

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const CAPTION_HEADING = /^таблиц/i;
/** «Способность Берсерка 2-го уровня» — группировка классовых способностей, а не особенность. */
const ABILITY_HEADING = /^способност[ьи]\s+.*\d+-го\s+уровня$/i;
const ABILITY_COLUMN = /^способност[ьи]$/i;
const LEVEL_IN_KEY = /\(\s*(\d+)\s*-\s*[йя]\s+уровень\s*\)/i;

function cleanInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/[*`_]/g, "")
    .trim();
}

function slugify(text) {
  const latin = [...cleanInline(text).toLowerCase()]
    .map((char) => (char in TRANSLIT ? TRANSLIT[char] : char))
    .join("");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(text) {
  return cleanInline(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function stripParens(text) {
  return text.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

/** Блоки текста разбиваются на заголовки глубже `baseDepth`; подписи таблиц остаются в тексте. */
function readSections(text, baseDepth) {
  const lines = text.split("\n");
  const marks = [];
  lines.forEach((line, index) => {
    const match = HEADING.exec(line);
    if (!match) return;
    if (match[1].length <= baseDepth) return;
    const name = cleanInline(match[2]);
    if (CAPTION_HEADING.test(name) || ABILITY_HEADING.test(name)) return;
    marks.push({ index, depth: match[1].length, name });
  });

  const sections = marks.map((mark, position) => {
    const end = position + 1 < marks.length ? marks[position + 1].index : lines.length;
    return { ...mark, description: lines.slice(mark.index + 1, end).join("\n").trim() };
  });

  // Родитель секции — ближайший заголовок меньшей глубины.
  const stack = [];
  for (const section of sections) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= section.depth) stack.pop();
    section.parent = stack[stack.length - 1] ?? null;
    stack.push(section);
  }

  const ownEnd = marks.length > 0 ? marks[0].index : lines.length;
  return { description: lines.slice(0, ownEnd).join("\n").trim(), sections };
}

function splitRow(row) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/** Таблицы блока: первая строка — заголовок, вторая — разделитель, остальные — данные. */
function readTables(text) {
  const lines = text.split("\n");
  const raw = [];
  let current = null;
  lines.forEach((line, index) => {
    if (line.trim().startsWith("|")) {
      if (!current) current = { start: index, rows: [] };
      current.rows.push(line.trim());
      return;
    }
    if (current) {
      raw.push(current);
      current = null;
    }
  });
  if (current) raw.push(current);

  return raw.map((table) => {
    const [header, ...rest] = table.rows;
    const rows = rest.filter((row) => !splitRow(row).every((cell) => /^:?-{2,}:?$/.test(cell)));
    let caption;
    for (let index = table.start - 1; index >= 0; index -= 1) {
      const match = HEADING.exec(lines[index]);
      if (!match) continue;
      const name = cleanInline(match[2]);
      if (CAPTION_HEADING.test(name)) caption = name.replace(/^таблиц[аы]?\s+/i, "").trim();
      break;
    }
    return { header: splitRow(header), rows: rows.map(splitRow), caption };
  });
}

function isThresholdTable(table) {
  return table.rows.length > 0 && table.rows.every((cells) => /^\d/.test(cells[0] ?? ""));
}

/** Ячейка со списком имён через запятую: «Комплект, Первозданная сила». Проза через запятую не режется. */
function splitNames(value) {
  if (!value.includes(",")) return [value];
  if (/[.!?]\s*$/.test(value)) return [value];
  const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (parts.some((part) => part.length > 60)) return [value];
  return parts;
}

/**
 * Имена из ячейки ключевой таблицы. Если ячейка целиком совпадает с заголовком, запятая — часть имени
 * («Видеть, как враги бегут перед тобой»), а не разделитель списка.
 */
function targetsForRow(value, block, sections) {
  const whole = sections.find(
    (section) => section.parent === block.section && normalize(section.name) === normalize(value),
  );
  return whole ? [value] : splitNames(value);
}

/** Развёрнутый блок-аккордеон `> **Заголовок**` внутри текста особенности. */
function findAccordion(text, name) {
  const lines = text.split("\n");
  const target = stripParens(normalize(name));
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^>\s*\*\*(.+?)\*\*\s*$/.exec(lines[index].trim());
    if (!match) continue;
    if (stripParens(normalize(match[1])) !== target) continue;
    const body = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (!lines[next].trim().startsWith(">")) break;
      body.push(lines[next].replace(/^>\s?/, ""));
    }
    const description = body.join("\n").trim();
    if (description) return description;
  }
  return undefined;
}

function levelFromKey(key, fallback) {
  const match = LEVEL_IN_KEY.exec(key);
  return match ? Number(match[1]) : fallback;
}

/**
 * Имя пороговой строки: имя родителя плюс то, что в подписи таблицы уточняет вариант
 * («Таблица Растущей свирепости Берсерка» + «Растущая свирепость» → «Растущая свирепость Берсерка»).
 */
function thresholdRowName(parentName, caption, key) {
  if (!caption) return `${parentName}: ${key}`;
  const stem = (word) => cleanInline(word).toLowerCase().slice(0, 5);
  const parentStems = parentName.split(/\s+/).map(stem);
  const rest = caption.split(/\s+/).filter((word) => !parentStems.includes(stem(word)));
  return `${[parentName, ...rest].join(" ")}: ${key}`;
}

const builder = JSON.parse(fs.readFileSync(builderPath, "utf8"));
const levelUp = JSON.parse(fs.readFileSync(levelUpPath, "utf8"));

const records = [];
const idCounts = new Map();
let disambiguated = 0;

function uniqueId(base) {
  const seen = idCounts.get(base) ?? 0;
  idCounts.set(base, seen + 1);
  if (seen === 0) return base;
  disambiguated += 1;
  return `${base}-${seen + 1}`;
}

/**
 * Раскладывает текст особенности на вложенные записи: заголовки, затем строки таблиц.
 * `parentId`/`parentName` описывают саму особенность, чей текст передан.
 * id назначаются вторым проходом: ключ группы (`keyedBy`) известен только после разбора таблиц,
 * а от него зависит вид id (`fury.aspect.2.…`).
 */
function collectNested({ text, baseDepth, className, classSlug, level, articleId, featureId, parentId, parentName }) {
  const { description, sections } = readSections(text, baseDepth);
  const blocks = [
    { section: null, name: parentName, text: description, level },
    ...sections.map((section) => ({
      section,
      name: section.name,
      text: section.description,
      level,
    })),
  ];

  const rowSpecs = [];
  for (const block of blocks) {
    for (const table of readTables(block.text)) {
      // Таблица способностей — данные для каталога способностей, не для скелета особенностей.
      if (ABILITY_COLUMN.test(table.header[1] ?? "")) continue;
      // Таблица порогов важнее заголовка: «Дисциплина | Преимущество» с числовыми ячейками — шкала, а не ключи.
      const threshold = isThresholdTable(table);
      const keyedBy = threshold ? undefined : KEYED_BY[table.header[0]];
      if (!keyedBy && !threshold) continue;
      for (const cells of table.rows) {
        const key = cells[0] ?? "";
        const value = cells[1] ?? "";
        const targets = keyedBy ? targetsForRow(value, block, sections) : [value];

        for (const target of targets) {
          // Строка таблицы описывает уже разобранный заголовок — ей достаются ключ и группа.
          const existing = sections.find(
            (section) => section.parent === block.section && normalize(section.name) === normalize(target),
          );
          if (existing) {
            const keys = existing.keyValue ? existing.keyValue.split(", ") : [];
            if (!keys.includes(key)) existing.keyValue = [...keys, key].join(", ");
            if (keyedBy && !existing.keyedBy) existing.keyedBy = keyedBy;
            continue;
          }

          const rowLevel = keyedBy ? block.level : levelFromKey(key, block.level);
          rowSpecs.push({
            block,
            keyValue: key,
            keyedBy,
            level: rowLevel,
            name: keyedBy ? target : thresholdRowName(block.name, table.caption, key),
            description: keyedBy ? findAccordion(text, target) ?? `| ${cells.join(" | ")} |` : value,
          });
        }
      }
    }
  }

  const nested = [];
  for (const section of sections) {
    const parent = section.parent ? section.parent.record : null;
    const record = {
      id: uniqueId(`${classSlug}.${section.keyedBy ?? "feature"}.${level}.${slugify(section.name)}`),
      className,
      level,
      name: section.name,
      parentId: parent ? parent.id : parentId,
      ...(section.keyedBy ? { keyedBy: section.keyedBy } : {}),
      ...(section.keyValue ? { keyValue: section.keyValue } : {}),
      articleId,
      ...(featureId ? { featureId } : {}),
      description: section.description,
    };
    section.record = record;
    nested.push(record);
  }

  const rowRecords = rowSpecs.map((spec) => {
    const parent = spec.block.section ? spec.block.section.record : null;
    return {
      id: uniqueId(`${classSlug}.${spec.keyedBy ?? "feature"}.${spec.level}.${slugify(spec.name)}`),
      className,
      level: spec.level,
      name: spec.name,
      parentId: parent ? parent.id : parentId,
      ...(spec.keyedBy ? { keyedBy: spec.keyedBy } : {}),
      keyValue: spec.keyValue,
      articleId,
      ...(featureId ? { featureId } : {}),
      description: spec.description,
    };
  });

  return [...nested, ...rowRecords];
}

// Особенности 1-го уровня: заголовки `####` в markdown класса.
for (const builderClass of builder.classes) {
  const classSlug = CLASS_SLUGS[builderClass.name];
  if (!classSlug || !builderClass.features.trim()) continue;

  const className = builderClass.name;
  const articleId = builderClass.articleId;
  const lines = builderClass.features.split("\n");
  const tops = [];
  lines.forEach((line, index) => {
    const match = HEADING.exec(line);
    if (match && match[1].length === 4) tops.push({ index, name: cleanInline(match[2]) });
  });

  for (const [position, top] of tops.entries()) {
    const end = position + 1 < tops.length ? tops[position + 1].index : lines.length;
    const body = lines.slice(top.index + 1, end).join("\n").trim();
    const record = {
      id: uniqueId(`${classSlug}.feature.1.${slugify(top.name)}`),
      className,
      level: 1,
      name: top.name,
      articleId,
      description: readSections(body, 0).description,
    };
    records.push(record);
    records.push(
      ...collectNested({
        text: body,
        baseDepth: 0,
        className,
        classSlug,
        level: 1,
        articleId,
        parentId: record.id,
        parentName: record.name,
      }),
    );
  }
}

// Особенности 2–10 уровней.
const levelUpByClass = new Map();
for (const entry of levelUp) {
  if (!CLASS_SLUGS[entry.className]) continue;
  const list = levelUpByClass.get(entry.className) ?? [];
  list.push(entry);
  levelUpByClass.set(entry.className, list);
}

for (const [className, entries] of levelUpByClass) {
  const classSlug = CLASS_SLUGS[className];
  entries.sort((a, b) => a.level - b.level);
  for (const entry of entries) {
    for (const feature of entry.features) {
      const name = cleanInline(feature.name);
      const record = {
        id: uniqueId(`${classSlug}.feature.${entry.level}.${slugify(name)}`),
        className,
        level: entry.level,
        name,
        articleId: entry.articleId,
        featureId: feature.id,
        description: readSections(feature.description, 0).description,
      };
      records.push(record);
      records.push(
        ...collectNested({
          text: feature.description,
          baseDepth: 0,
          className,
          classSlug,
          level: entry.level,
          articleId: entry.articleId,
          featureId: feature.id,
          parentId: record.id,
          parentName: record.name,
        }),
      );
    }
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");

const stats = new Map();
for (const record of records) {
  const entry = stats.get(record.className) ?? { total: 0, nested: 0, keyed: 0, levels: new Map() };
  entry.total += 1;
  if (record.parentId) entry.nested += 1;
  if (record.keyValue) entry.keyed += 1;
  entry.levels.set(record.level, (entry.levels.get(record.level) ?? 0) + 1);
  stats.set(record.className, entry);
}

console.log(
  `Всего особенностей: ${records.length}, вложенных ${records.filter((record) => record.parentId).length}, ` +
    `с ключом ${records.filter((record) => record.keyValue).length}`,
);
for (const [className, entry] of stats) {
  const levels = [...entry.levels.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => `${level}:${count}`)
    .join(" ");
  console.log(
    `${className.padEnd(13)} всего ${String(entry.total).padStart(3)} · вложенных ${String(entry.nested).padStart(3)} · ` +
      `с ключом ${String(entry.keyed).padStart(3)} · ${levels}`,
  );
}
if (disambiguated > 0) console.log(`Совпавших слагов разведено суффиксом: ${disambiguated}`);
