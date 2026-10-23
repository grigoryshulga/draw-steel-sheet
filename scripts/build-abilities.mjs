#!/usr/bin/env node
/**
 * Парсер способностей Draw Steel из markdown-правил.
 *
 * Источники (репозиторий drawsteel-ru):
 *  - vault/08. Классы/<Класс>/<NNN>.md        -> sourceKind "class"
 *  - vault/09. Комплекты/Список Комплектов/*  -> sourceKind "kit"
 *  - vault/13. Ведение Боя/1309|1310|1311*.md -> sourceKind "basic"
 *
 * Выход:
 *  - src/data/abilities.generated.json
 *  - src/data/compendium.ts
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const VAULT = join(ROOT, "..", "drawsteel-ru", "vault");
const OUT_DIR = join(ROOT, "src", "data");

// ---------- вспомогательные ----------

const WARNINGS = [];

const CHAR_MAP = {
  "Мощь": "might",
  "Ловкость": "agility",
  "Разум": "reason",
  "Интуиция": "intuition",
  "Присутствие": "presence",
};

const ACTION_MAP = {
  "Основное действие": "main",
  "Маневр": "maneuver",
  "Действие движения": "move",
  "Триггер": "trigger",
  "Свободный триггер": "free-trigger",
  "Свободный маневр": "free-maneuver",
  "Без действия": "none",
};

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Транслитерация + очистка до [a-z0-9-]. */
function slugify(text) {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Стабильный id из source+name. */
function makeId(source, name) {
  const hash = createHash("sha1").update(`${source}|${name}`, "utf8").digest("hex").slice(0, 10);
  const base = slugify(`${source} ${name}`).slice(0, 60).replace(/-+$/, "");
  return `${base}-${hash}`;
}

/** Убирает markdown-разметку из текста. */
function cleanMd(text) {
  let t = text;
  // wiki-ссылки: [[путь|текст]] -> текст
  t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");
  // [[путь]] -> последний сегмент без номера "123. "
  t = t.replace(/\[\[([^\]]*)\]\]/g, (_, path) =>
    path.split("/").pop().replace(/^\d+[.\u00a0 ]*\s*/, "").trim()
  );
  t = t.replace(/\*\*/g, ""); // жирный
  t = t.replace(/`/g, ""); // код
  t = t.replace(/<\/?[a-z][^>]*>/gi, ""); // HTML-теги
  t = t.replace(/\*/g, ""); // одиночные звёздочки (курсив)
  t = t.replace(/[ \t]{2,}/g, " ");
  return t.trim();
}

function parseCells(line) {
  const parts = line.split("|");
  return parts.slice(1, parts.length - 1).map((c) => c.trim());
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "");
}

// ---------- разбор тиров ----------

const CYR_TO_LAT = { "М": "M", "Л": "A", "Р": "R", "И": "I", "П": "P" };

/** Нормализует буквы характеристик в формуле до латиницы M/A/R/I/P. */
function normalizeFormula(formula) {
  return formula
    .replace(/(^|[\s+,])([МЛРИП])(?=$|[\s+,)])/g, (_, pre, ch) => pre + CYR_TO_LAT[ch])
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Формула урона: цифры, d, +, запятые, "или", латинские буквы. */
function looksLikeFormula(text) {
  return /^[\dd+\s,()MARDIPили]+$/i.test(text) && /\d|[MARDIP]/i.test(text);
}

const DAMAGE_TYPE_BEFORE = / (?:святого|психического|истинного)$/i;

/**
 * Отделяет ведущую формулу урона от эффекта.
 * "5 + М урона; толчок 1" -> { damage: "5 + M", effect: "Толчок 1" }
 * "Толчок 1"               -> { damage: "", effect: "Толчок 1" }
 */
function splitTierText(raw) {
  const text = cleanMd(raw);
  const idx = text.search(/ урона(?![а-яё])/i);
  if (idx === -1) {
    return { damage: "", effect: text };
  }
  let head = text.slice(0, idx);
  // убираем прилагательные типа "святого"/"психического" перед словом "урона"
  while (true) {
    const stripped = head.replace(DAMAGE_TYPE_BEFORE, "");
    if (stripped === head) break;
    head = stripped;
  }
  let tail = text.slice(idx + " урона".length);
  tail = tail.replace(/^[\s;,]+/, "");
  const formula = normalizeFormula(head);
  if (!looksLikeFormula(formula)) {
    return { damage: "", effect: text };
  }
  const effect = tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : "";
  return { damage: formula, effect };
}

// ---------- разбор одного блока ----------

const COST_RE = /\((\d+)(\+)?\s+[^)]+\)\s*$/;
const TIER_RE = /^-\s*\*\*(≤11|11 или меньше|12-16|17\+|17 и выше):\*\*\s*(.*)$/i;
const ROLL_RE = /^\*\*Бросок силы\s*\+\s*(.+?)\s*:?\*\*\s*:?$/;
const TRIGGER_RE = /^\*\*Триггер:\*\*\s*(.*)$/i;

function tierIndex(label) {
  const l = label.toLowerCase();
  if (l === "≤11" || l === "11 или меньше") return 0;
  if (l === "12-16") return 1;
  return 2;
}

/**
 * Разбирает содержимое callout-блока (без префикса ">").
 * headingContext — последний заголовок перед блоком.
 */
function parseBlock(headerLine, bodyLines, headingContext, fileLabel) {
  const title = cleanMd(headerLine.replace(/^\s*\[!example\]\s*/i, ""));
  if (!title) {
    WARNINGS.push(`${fileLabel}: блок без названия пропущен`);
    return null;
  }

  const costMatch = title.match(COST_RE);
  const resourceCost = costMatch ? parseInt(costMatch[1], 10) : 0;
  const name = title.replace(COST_RE, "").trim();

  let kind;
  if (resourceCost > 0) {
    kind = "heroic";
  } else if (/свободный удар/i.test(name)) {
    kind = "free-strike";
  } else if (/знаков/i.test(headingContext)) {
    kind = "signature";
  } else {
    kind = "other";
  }

  let keywords = [];
  let actionType = null;
  let distance = "";
  let target = "";
  let rollCharacteristics = [];
  let rollBonus = 0;
  const tiers = [null, null, null];
  let trigger = "";
  const effectParagraphs = [];

  let flavorParts = [];
  let flavorClosed = false;
  let firstTableSeen = false;

  const pushParagraph = (text) => effectParagraphs.push(text);

  for (const rawLine of bodyLines) {
    const line = rawLine.replace(/^>\s?/, "");
    const t = line.trim();
    if (!t) continue;

    // флейвор: подряд идущие курсивные строки сразу после заголовка
    if (!flavorClosed && /^\*[^*].*\*$/.test(t)) {
      flavorParts.push(t.replace(/^\*|\*$/g, "").trim());
      continue;
    }
    flavorClosed = true;

    // таблица
    if (t.startsWith("|")) {
      const cells = parseCells(t);
      if (cells.length === 0 || isSeparatorRow(cells)) continue;
      if (cells[0].includes("📏") || cells[1]?.includes("🎯")) {
        distance = cleanMd((cells[0] || "").replace(/📏/g, ""));
        target = cleanMd((cells[1] || "").replace(/🎯/g, ""));
      } else if (!firstTableSeen) {
        firstTableSeen = true;
        const kwRaw = cleanMd(cells[0] || "");
        keywords = kwRaw && kwRaw !== "-" ? kwRaw.split(",").map((k) => k.trim()).filter(Boolean) : [];
        const actionRaw = cleanMd(cells[1] || "");
        actionType = ACTION_MAP[actionRaw] ?? null;
        if (!actionType) {
          WARNINGS.push(`${fileLabel}: «${name}» — неизвестный тип действия «${actionRaw}», использую main`);
          actionType = "main";
        }
      }
      continue;
    }

    // бросок силы
    const rollMatch = t.match(ROLL_RE);
    if (rollMatch) {
      const rest = rollMatch[1];
      const found = rest.match(/Мощь|Ловкость|Разум|Интуиция|Присутствие/g);
      if (found) rollCharacteristics = [...new Set(found.map((w) => CHAR_MAP[w]))];
      const withoutChars = rest
        .replace(/Мощь|Ловкость|Разум|Интуиция|Присутствие|или|,|\+/gi, " ")
        .trim();
      const bonus = withoutChars.match(/(\d+)/);
      if (bonus) rollBonus = parseInt(bonus[1], 10);
      continue;
    }

    // тир урона
    const tierMatch = t.match(TIER_RE);
    if (tierMatch) {
      const i = tierIndex(tierMatch[1]);
      if (!tiers[i]) tiers[i] = splitTierText(tierMatch[2]);
      continue;
    }

    // триггер
    const trigMatch = t.match(TRIGGER_RE);
    if (trigMatch) {
      trigger = cleanMd(trigMatch[1]);
      continue;
    }

    // всё остальное — эффект
    if (/^-\s+/.test(t)) {
      // элемент списка продолжает текущий абзац
      const item = cleanMd(t.replace(/^-\s+/, ""));
      if (effectParagraphs.length === 0) {
        pushParagraph(`- ${item}`);
      } else {
        effectParagraphs[effectParagraphs.length - 1] += `\n- ${item}`;
      }
    } else {
      let paragraph = cleanMd(t);
      // «Эффект:» — структурная метка, дублирующая имя поля
      paragraph = paragraph.replace(/^Эффект\s*:\s*/i, "");
      if (paragraph) pushParagraph(paragraph);
    }
  }

  const flavor = flavorParts.join(" ");
  const effect = effectParagraphs.join("\n\n");
  const filledTiers = tiers.map((tr) => tr ?? { damage: "", effect: "" });

  return {
    name,
    flavor,
    actionType: actionType ?? "main",
    kind,
    keywords,
    distance,
    target,
    rollCharacteristics,
    rollBonus,
    resourceCost,
    trigger,
    tiers: filledTiers,
    effect,
  };
}

// ---------- извлечение блоков из файла ----------

const EXAMPLE_RE = /^>\s*\[!example\]\s*(.*)$/i;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/** Возвращает [{ header, body, heading }] блоков callout из текста файла. */
function extractExampleBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let heading = "";
  let i = 0;
  while (i < lines.length) {
    const hm = lines[i].match(HEADING_RE);
    if (hm) {
      heading = hm[2].trim();
      i += 1;
      continue;
    }
    const bm = lines[i].match(EXAMPLE_RE);
    if (!bm) {
      i += 1;
      continue;
    }
    const header = bm[1];
    const body = [];
    i += 1;
    while (i < lines.length && lines[i].startsWith(">")) {
      body.push(lines[i]);
      i += 1;
    }
    blocks.push({ header, body, heading });
  }
  return blocks;
}

// ---------- источники ----------

function listMdFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort()
    .map((f) => join(dir, f));
}

function collectSources() {
  const sources = [];

  // Классы
  const classesDir = join(VAULT, "08. Классы");
  for (const classDir of readdirSync(classesDir, { withFileTypes: true })) {
    if (!classDir.isDirectory()) continue;
    const className = classDir.name;
    for (const file of listMdFiles(join(classesDir, className))) {
      const lm = basename(file).match(/\.\s*(\d+)-й\s+Уровень/i);
      if (!lm) {
        WARNINGS.push(`классы: не распознан уровень в «${basename(file)}», файл пропущен`);
        continue;
      }
      sources.push({
        path: file,
        sourceKind: "class",
        className,
        level: parseInt(lm[1], 10),
        source: className,
      });
    }
  }

  // Комплекты
  const kitsDir = join(VAULT, "09. Комплекты", "Список Комплектов");
  for (const file of listMdFiles(kitsDir)) {
    const kitName = basename(file, ".md").replace(/^\d+\s*[.\u00a0]*\s*/, "").trim();
    sources.push({
      path: file,
      sourceKind: "kit",
      className: `Комплект: ${kitName}`,
      level: 1,
      source: `Комплект: ${kitName}`,
    });
  }

  // Базовые
  const combatDir = join(VAULT, "13. Ведение Боя");
  for (const file of listMdFiles(combatDir)) {
    if (!/^13(09|10|11)/.test(basename(file))) continue;
    sources.push({
      path: file,
      sourceKind: "basic",
      className: "Базовые",
      level: 1,
      source: "Базовые способности",
    });
  }

  return sources;
}

// ---------- главная ----------

function main() {
  const stats = {
    files: 0,
    totalBlocks: 0,
    parsed: 0,
    bySourceKind: { basic: 0, class: 0, kit: 0 },
    withDamage: 0,
    withRoll: 0,
    withTrigger: 0,
    duplicatesDropped: 0,
  };

  const abilities = [];
  const seen = new Set();

  const sources = collectSources();
  for (const src of sources) {
    stats.files += 1;
    const text = readFileSync(src.path, "utf8");
    const fileLabel = basename(src.path);
    for (const block of extractExampleBlocks(text)) {
      stats.totalBlocks += 1;
      const parsed = parseBlock(block.header, block.body, block.heading, fileLabel);
      if (!parsed) continue;

      const dedupKey = `${parsed.name}|${src.source}`;
      if (seen.has(dedupKey)) {
        stats.duplicatesDropped += 1;
        continue;
      }
      seen.add(dedupKey);

      abilities.push({
        id: makeId(src.source, parsed.name),
        name: parsed.name,
        flavor: parsed.flavor,
        actionType: parsed.actionType,
        kind: parsed.kind,
        keywords: parsed.keywords,
        distance: parsed.distance,
        target: parsed.target,
        rollCharacteristics: parsed.rollCharacteristics,
        rollBonus: parsed.rollBonus,
        resourceCost: parsed.resourceCost,
        trigger: parsed.trigger,
        tiers: parsed.tiers,
        effect: parsed.effect,
        source: src.source,
        notes: "",
        className: src.className,
        level: src.level,
        sourceKind: src.sourceKind,
      });
      stats.parsed += 1;
      stats.bySourceKind[src.sourceKind] += 1;
      if (parsed.tiers.some((t) => t.damage)) stats.withDamage += 1;
      if (parsed.rollCharacteristics.length > 0) stats.withRoll += 1;
      if (parsed.trigger) stats.withTrigger += 1;
    }
  }

  const kindRank = { basic: 0, class: 1, kit: 2 };
  abilities.sort((a, b) =>
    kindRank[a.sourceKind] - kindRank[b.sourceKind] ||
    a.className.localeCompare(b.className, "ru") ||
    a.level - b.level ||
    a.name.localeCompare(b.name, "ru")
  );

  mkdirSync(OUT_DIR, { recursive: true });

  const jsonPath = join(OUT_DIR, "abilities.generated.json");
  writeFileSync(jsonPath, JSON.stringify(abilities, null, 2) + "\n", "utf8");

  // compendium.ts is maintained source: it also normalizes legacy ability preferences.

  console.log("=== build-abilities ===");
  console.log(`Файлов обработано:      ${stats.files}`);
  console.log(`Блоков [!example]:      ${stats.totalBlocks}`);
  console.log(`Распознано способностей: ${stats.parsed}`);
  console.log(`  basic: ${stats.bySourceKind.basic}, class: ${stats.bySourceKind.class}, kit: ${stats.bySourceKind.kit}`);
  console.log(`С уроном:               ${stats.withDamage}`);
  console.log(`С броском силы:         ${stats.withRoll}`);
  console.log(`С триггером:            ${stats.withTrigger}`);
  console.log(`Дублей отброшено:       ${stats.duplicatesDropped}`);
  console.log(`JSON: ${jsonPath}`);
  if (WARNINGS.length > 0) {
    console.log(`\nПредупреждения (${WARNINGS.length}):`);
    for (const w of [...new Set(WARNINGS)]) console.log(`  - ${w}`);
  }
}

main();
