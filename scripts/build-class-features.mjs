#!/usr/bin/env node
/**
 * Генератор скелета классовых особенностей.
 *
 * Источники:
 * - `src/data/builder.generated.json` — особенности 1-го уровня: markdown `classes[].features`.
 * - `src/data/level-up.generated.json` — особенности 2–10 уровней: `features[].{id,name,description}`.
 *
 * Правила разбора:
 * - Класс 1-го уровня: каждая особенность — заголовок `#### `. Любой более глубокий заголовок
 *   (`##### `, `###### `) внутри её текста даёт вложенную особенность с `parentId`.
 * - Уровни 2–10: сама запись `level-up.features[]` даёт особенность, каждый заголовок внутри её
 *   `description` — вложенную особенность.
 * - Заголовки-подписи таблиц (`Таблица …`) особенностями не считаются и остаются в тексте родителя.
 * - Таблица даёт вложенные особенности, только если её первая колонка — ключевая группа
 *   (аспект/орден/домен/традиция/доктрина/коллегия/амплуа/специализация) или порог
 *   (ячейки начинаются с числа, например шкала свирепости). Прочие таблицы (характеристики форм,
 *   состав комплектов) не разворачиваются.
 * - Строка такой таблицы даёт `keyValue` — первую ячейку — и `keyedBy` из заголовка первой колонки
 *   (`undefined`, если группа не опознана). Ключ ставится уже разобранной особенности с тем же
 *   названием на том же уровне класса (в том числе из другой записи того же уровня: таблица-сводка
 *   и отдельная фича — это одна особенность, а не две). Если такой особенности нет, но в тексте
 *   особенности есть развёрнутый блок `> **Название**` — из строки создаётся новая вложенная
 *   особенность с этим текстом. Если нет ни особенности, ни текста, строка пропускается: стаб
 *   с одной строкой таблицы в `description` — фантом, он не создаётся.
 *   Ячейка может перечислять несколько названий через запятую — ключ получает каждое, а несколько
 *   ключей у одной особенности склеиваются через запятую.
 * - `id` — слаг `<class-slug>.<keyedBy ?? "feature">.<level>.<name-slug>`, транслитерация кириллицы
 *   таблицей ниже. Ключи проставляются до выдачи `id`, поэтому «Непреодолимая сила» аспекта
 *   Берсерка получает `fury.aspect.2.nepreodolimaya-sila`, а не `fury.feature.2.…`.
 * - Уровень вложенной особенности — уровень родителя, кроме пороговых строк вида
 *   `8 (4-й уровень)`, где уровень берётся из подписи.
 * - `description` — markdown источника. У записи, из которой вынесены вложенные особенности, он
 *   содержит только текст до первого вложенного заголовка, а текст самих заголовков лежит в детях.
 *   Суммарный текст не теряется: родитель + все его потомки = исходный блок целиком.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

/** Точные расхождения между названием в сводной таблице и заголовком аккордеона в книге. */
const ACCORDION_ALIASES = {
  "боги повелевают вам повиноваться": "Боги Требуют Послушания",
};

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const CAPTION_HEADING = /^таблиц/i;
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

/**
 * Дерево заголовков блока: собственный текст записи (до первого вложенного заголовка) и дети.
 * Подписи таблиц дочерними записями не становятся и остаются в тексте родителя.
 */
function readNodeTree(text, baseDepth) {
  const lines = text.split("\n");
  const marks = [];
  lines.forEach((line, index) => {
    const match = HEADING.exec(line);
    if (!match) return;
    if (match[1].length <= baseDepth) return;
    const name = cleanInline(match[2]);
    if (CAPTION_HEADING.test(name)) return;
    marks.push({ index, depth: match[1].length, name });
  });

  const nodes = marks.map((mark, position) => ({
    name: mark.name,
    depth: mark.depth,
    ownText: lines
      .slice(mark.index + 1, position + 1 < marks.length ? marks[position + 1].index : lines.length)
      .join("\n")
      .trim(),
    children: [],
  }));

  const roots = [];
  const stack = [];
  for (const node of nodes) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) stack.pop();
    if (stack.length > 0) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }

  return {
    ownText: lines.slice(0, marks.length > 0 ? marks[0].index : lines.length).join("\n").trim(),
    children: roots,
  };
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

/** Ячейка со списком названий через запятую: «Комплект, Первозданная сила». Проза через запятую не режется. */
function splitNames(value) {
  if (!value.includes(",")) return [value];
  if (/[.!?]\s*$/.test(value)) return [value];
  const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (parts.some((part) => part.length > 60)) return [value];
  return parts;
}

/** Развёрнутый блок-аккордеон `> **Заголовок**` внутри текста особенности. */function findAccordion(text, name) {
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

/** Заголовки источников, которые обязаны стать записями скелета (`####` и `#####`). */
export function sourceHeadings(builder, levelUp) {
  const headings = [];
  const keep = (depth) => depth === 4 || depth === 5;
  for (const builderClass of builder.classes) {
    if (!CLASS_SLUGS[builderClass.name]) continue;
    for (const line of builderClass.features.split("\n")) {
      const match = HEADING.exec(line);
      if (!match) continue;
      const name = cleanInline(match[2]);
      if (!keep(match[1].length) || CAPTION_HEADING.test(name)) continue;
      headings.push({ className: builderClass.name, level: 1, name });
    }
  }
  for (const entry of levelUp) {
    if (!CLASS_SLUGS[entry.className]) continue;
    for (const feature of entry.features) {
      for (const line of feature.description.split("\n")) {
        const match = HEADING.exec(line);
        if (!match) continue;
        const name = cleanInline(match[2]);
        if (!keep(match[1].length) || CAPTION_HEADING.test(name)) continue;
        headings.push({ className: entry.className, level: entry.level, name });
      }
    }
  }
  return headings;
}

/** Плоский список исходных описаний: по одному «корню» на особенность. */
function readTopSpecs(builder, levelUp) {
  const specs = [];
  for (const builderClass of builder.classes) {
    const classSlug = CLASS_SLUGS[builderClass.name];
    if (!classSlug || !builderClass.features.trim()) continue;
    const lines = builderClass.features.split("\n");
    const tops = [];
    lines.forEach((line, index) => {
      const match = HEADING.exec(line);
      if (match && match[1].length === 4) tops.push({ index, name: cleanInline(match[2]) });
    });
    for (const [position, top] of tops.entries()) {
      const end = position + 1 < tops.length ? tops[position + 1].index : lines.length;
      specs.push({
        className: builderClass.name,
        classSlug,
        level: 1,
        name: top.name,
        articleId: builderClass.articleId,
        text: lines.slice(top.index + 1, end).join("\n").trim(),
      });
    }
  }

  const byClass = new Map();
  for (const entry of levelUp) {
    if (!CLASS_SLUGS[entry.className]) continue;
    const list = byClass.get(entry.className) ?? [];
    list.push(entry);
    byClass.set(entry.className, list);
  }
  for (const [className, entries] of byClass) {
    entries.sort((a, b) => a.level - b.level);
    for (const entry of entries) {
      for (const feature of entry.features) {
        specs.push({
          className,
          classSlug: CLASS_SLUGS[className],
          level: entry.level,
          name: cleanInline(feature.name),
          articleId: entry.articleId,
          featureId: feature.id,
          text: feature.description,
        });
      }
    }
  }
  return specs;
}

function nodeRecordBase(spec) {
  return {
    className: spec.className,
    classSlug: spec.classSlug,
    level: spec.level,
    articleId: spec.articleId,
    ...(spec.featureId ? { featureId: spec.featureId } : {}),
  };
}

function attachNode(spec, tree, parent, rootText) {
  const node = { ...nodeRecordBase(spec), name: tree.name, parent, rootText, children: [], rows: [] };
  for (const child of tree.children) node.children.push(attachNode(spec, child, node, rootText));
  node.ownText = tree.ownText;
  return node;
}

/**
 * Собирает записи скелета из разобранных источников.
 * Порядок: два прохода — сначала всё дерево заголовков (чтобы строки таблиц могли найти свою
 * особенность в другой записи того же уровня), потом разрешение таблиц и выдача id.
 */
export function buildClassFeatures(builder, levelUp) {
  const specs = readTopSpecs(builder, levelUp);
  const roots = [];
  for (const spec of specs) {
    const tree = readNodeTree(spec.text, 0);
    const rootNode = { ...nodeRecordBase(spec), name: spec.name, parent: null, rootText: spec.text, ownText: tree.ownText, children: [], rows: [] };
    for (const child of tree.children) rootNode.children.push(attachNode(spec, child, rootNode, spec.text));
    roots.push(rootNode);
  }

  const index = new Map();
  const indexKey = (node, name) => `${node.className}\u0000${node.level}\u0000${normalize(name)}`;
  const indexNode = (node) => {
    const key = indexKey(node, node.name);
    index.set(key, [...(index.get(key) ?? []), node]);
  };
  const findNode = (node, name) => (index.get(indexKey(node, name)) ?? [])[0];
  const findTwinByHeadWord = (node, name) => {
    const head = normalize(name).split(" ").pop();
    if (!head) return undefined;
    const candidates = [];
    for (const list of index.values()) {
      for (const candidate of list) {
        if (candidate.className !== node.className || candidate.level !== node.level) continue;
        if (candidate.keyValue || candidate.rows.length > 0) continue;
        if (normalize(candidate.name).split(" ").pop() !== head) continue;
        candidates.push(candidate);
      }
    }
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  const walk = (node, visit) => {
    visit(node);
    for (const child of node.children) walk(child, visit);
  };
  for (const rootNode of roots) walk(rootNode, (node) => indexNode(node));

  const makeRowNode = (node, fields) => {
    const rowNode = {
      className: node.className,
      classSlug: node.classSlug,
      level: fields.level,
      articleId: node.articleId,
      ...(node.featureId ? { featureId: node.featureId } : {}),
      name: fields.name,
      parent: node,
      rootText: node.rootText,
      ownText: fields.description,
      children: [],
      rows: [],
      ...(fields.keyValue ? { keyValue: fields.keyValue } : {}),
      ...(fields.keyedBy ? { keyedBy: fields.keyedBy } : {}),
    };
    node.rows.push(rowNode);
    indexNode(rowNode);
    return rowNode;
  };

  for (const rootNode of roots) {
    walk(rootNode, (node) => {
      for (const table of readTables(node.ownText)) {
        // Таблица порогов важнее заголовка: «Дисциплина | Преимущество» с числовыми ячейками — шкала, а не ключи.
        const threshold = isThresholdTable(table);
        const keyedBy = threshold ? undefined : KEYED_BY[table.header[0]];
        if (!keyedBy && !threshold) continue;

        for (const cells of table.rows) {
          const key = cells[0] ?? "";
          const value = cells[1] ?? "";

          if (!keyedBy) {
            makeRowNode(node, {
              name: thresholdRowName(node.name, table.caption, key),
              level: levelFromKey(key, node.level),
              keyValue: key,
              description: value,
            });
            continue;
          }

          // Запятая внутри цельного названия («Видеть, как враги бегут перед тобой») — не разделитель.
          const whole = findNode(node, value);
          const targets = whole ? [value] : splitNames(value);
          for (const target of targets) {
            const existing = findNode(node, target);
            if (existing) {
              const keys = existing.keyValue ? existing.keyValue.split(", ") : [];
              if (!keys.includes(key)) existing.keyValue = [...keys, key].join(", ");
              if (!existing.keyedBy) existing.keyedBy = keyedBy;
              continue;
            }
            // Текста для строки нет и своей особенности тоже нет — такая строка не запись.
            const accordionName = ACCORDION_ALIASES[normalize(target)] ?? target;
            const accordion = findAccordion(node.rootText, accordionName);
            if (accordion) {
              makeRowNode(node, {
                name: target,
                level: node.level,
                keyValue: key,
                keyedBy,
                description: accordion,
              });
              continue;
            }

            // Книга называет одну и ту же особенность в сводке и в заголовке по-разному
            // («Универсальная связь» в таблице и «Безграничная связь» в тексте). Пробуем найти
            // единственную ещё не отмеченную особенность того же уровня с тем же главным словом.
            const twin = findTwinByHeadWord(node, target);
            if (twin) {
              const keys = twin.keyValue ? twin.keyValue.split(", ") : [];
              if (!keys.includes(key)) twin.keyValue = [...keys, key].join(", ");
              if (!twin.keyedBy) twin.keyedBy = keyedBy;
            }
          }
        }
      }
    });
  }

  const records = [];
  const idCounts = new Map();
  const uniqueId = (base) => {
    const seen = idCounts.get(base) ?? 0;
    idCounts.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };

  const emit = (node) => {
    node.id = uniqueId(`${node.classSlug}.${node.keyedBy ?? "feature"}.${node.level}.${slugify(node.name)}`);
    records.push({
      id: node.id,
      className: node.className,
      level: node.level,
      name: node.name,
      ...(node.parent ? { parentId: node.parent.id } : {}),
      ...(node.keyedBy ? { keyedBy: node.keyedBy } : {}),
      ...(node.keyValue ? { keyValue: node.keyValue } : {}),
      articleId: node.articleId,
      ...(node.featureId ? { featureId: node.featureId } : {}),
      description: node.ownText,
    });
    for (const row of node.rows) emit(row);
    for (const child of node.children) emit(child);
  };

  for (const rootNode of roots) emit(rootNode);
  return records;
}

export function readSources() {
  return {
    builder: JSON.parse(fs.readFileSync(builderPath, "utf8")),
    levelUp: JSON.parse(fs.readFileSync(levelUpPath, "utf8")),
  };
}

function printStats(records) {
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
}

function main() {
  const { builder, levelUp } = readSources();
  const records = buildClassFeatures(builder, levelUp);
  fs.writeFileSync(outputPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  printStats(records);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
