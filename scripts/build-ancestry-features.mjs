#!/usr/bin/env node
/**
 * Генератор скелета особенностей происхождений.
 *
 * Источник — `src/data/builder.generated.json`: знаковые черты (`signature`,
 * markdown с заголовками `####`) и купленные черты (`traits[]`).
 *
 * Правила разбора:
 * - Каждый заголовок `#### Знаковая Черта: Имя` становится отдельной записью
 *   `signature`; текст — до следующего заголовка.
 * - Каждая купленная черта становится записью `trait` с её стоимостью.
 * - `id` — `<ancestry-slug>.<feature-slug>`, а для знаковых —
 *   `ancestry.<ancestry-slug>.signature.<feature-slug>`.
 * - Исключения из слагов перечислены ниже: они сохраняют ID, которые уже
 *   записаны в сохранённых листах (`ANCESTRY_FEATURE_RULES`) и в тестах.
 * - Порядок записей повторяет порядок книги: сначала знаковые черты, затем
 *   купленные. Это порядок выдачи способностей на листе.
 *
 * Механика (способности, выборы, эффекты) живёт отдельно — в
 * `src/data/ancestry-features/mechanics/*`, ключом по `id` из этого файла.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builderPath = path.join(root, "src/data/builder.generated.json");
const outputPath = path.join(root, "src/data/ancestry-features.generated.json");

const ANCESTRY_SLUGS = {
  Дьявол: "devil",
  "Драконий Рыцарь": "dragon-knight",
  Дварф: "dwarf",
  "Лесной Эльф": "forest-elf",
  "Высший Эльф": "high-elf",
  Хакаан: "hakaan",
  Человек: "human",
  Меманек: "memanek",
  Орк: "orc",
  Полдер: "polder",
  Ревенант: "revenant",
  "Рейдер Времени": "time-raider",
  Таурус: "taurus",
  Ящер: "lizard",
};

/**
 * Стабильные ID. Здесь две группы:
 * - 11 числовых черт, уже сохранённых в `ANCESTRY_FEATURE_RULES`;
 * - способности и знаковые черты, которые получают читаемые английские ID,
 *   как в справочнике способностей.
 */
const FEATURE_IDS = {
  "Дьявол|Звериные ноги": "ancestry.devil.beast-legs",
  "Дьявол|Светящиеся глаза": "ancestry.devil.glowing-eyes",
  "Драконий Рыцарь|Драконий страж": "ancestry.dragon-knight.draconian-guard",
  "Драконий Рыцарь|Драконья гордость": "ancestry.dragon-knight.draconic-pride",
  "Драконий Рыцарь|Помни свою клятву": "ancestry.dragon-knight.remember-your-oath",
  "Драконий Рыцарь|Драконье дыхание": "ancestry.dragon-knight.dragon-breath",
  "Дварф|Заземленность": "ancestry.dwarf.grounded",
  "Дварф|Искра с твоей кожи": "ancestry.dwarf.spark-from-your-skin",
  "Лесной Эльф|Стремительный": "ancestry.forest-elf.swift",
  "Лесной Эльф|Леса защищают": "ancestry.forest-elf.the-wode-defends",
  "Высший Эльф|Грациозное отступление": "ancestry.high-elf.graceful-retreat",
  "Высший Эльф|Очарование ужаса": "ancestry.high-elf.glamor-of-terror",
  "Человек|Запас прочности": "ancestry.human.reserve-of-strength",
  "Человек|Решимость": "ancestry.human.determination",
  "Человек|Сопротивление неестественному": "ancestry.human.resist-the-unnatural",
  "Меманек|Молниеносная ловкость": "ancestry.memanek.lightning-agility",
  "Меманек|Хранитель порядка": "ancestry.memanek.keeper-of-order",
  "Орк|Заземленность": "ancestry.orc.grounded",
  "Полдер|Грациозное отступление": "ancestry.polder.graceful-retreat",
  "Полдер|Реактивное перемещение": "ancestry.polder.reactive-tumble",
  "Ревенант|Метка мести": "ancestry.revenant.detonate-sigil",
  "Рейдер Времени|Потустороннее зрение": "ancestry.time-raider.beyondsight",
  "Рейдер Времени|Дальновидность": "ancestry.time-raider.foresight",
  "Рейдер Времени|Псионический дар": "ancestry.time-raider.psionic-gift",
  "Таурус|Звериные ноги": "ancestry.taurus.beast-legs",
  "Таурус|Заземленность": "ancestry.taurus.grounded",
  "Таурус|Дать Волю": "ancestry.taurus.let-loose",
  "Ящер|Наследие драконов": "ancestry.lizard.dragon-heritage",
};

const SIGNATURE_IDS = {
  "Человек|Видение Сверхъестественного":
    "ancestry.human.signature.detect-the-supernatural",
  "Полдер|Слияние С Тенью": "ancestry.polder.signature.shadowmeld",
};

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

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

function normalizeName(text) {
  return cleanInline(text).replace(/\s+/g, " ").trim();
}

function ancestrySlug(name) {
  return (
    ANCESTRY_SLUGS[name] ??
    slugify(name)
  );
}

function traitId(ancestryName, name) {
  return (
    FEATURE_IDS[`${ancestryName}|${name}`] ??
    `ancestry.${ancestrySlug(ancestryName)}.${slugify(name)}`
  );
}

function signatureId(ancestryName, name) {
  return (
    SIGNATURE_IDS[`${ancestryName}|${name}`] ??
    `ancestry.${ancestrySlug(ancestryName)}.signature.${slugify(name)}`
  );
}

/** Заголовки `####` знаковых черт: имя после «Знаковая Черта:». */
function readSignatures(ancestry) {
  const matches = [
    ...ancestry.signature.matchAll(/^####\s+(.+?)\s*$/gm),
  ];
  return matches.map((match, index) => {
    const heading = normalizeName(match[1]);
    const name =
      heading.match(/^знаковая\s+черта\s*:?\s*(.+)$/i)?.[1]?.trim() ||
      heading;
    return {
      name,
      description: ancestry.signature
        .slice(match.index + match[0].length, matches[index + 1]?.index ?? ancestry.signature.length)
        .trim(),
    };
  });
}

const data = JSON.parse(fs.readFileSync(builderPath, "utf8"));
const features = [];
const seen = new Set();

for (const ancestry of data.ancestries) {
  for (const signature of readSignatures(ancestry)) {
    const id = signatureId(ancestry.name, signature.name);
    if (seen.has(id)) throw new Error(`Повторяющийся ID: ${id}`);
    seen.add(id);
    features.push({
      id,
      ancestryName: ancestry.name,
      kind: "signature",
      name: signature.name,
      articleId: ancestry.articleId,
      description: signature.description,
    });
  }

  for (const trait of ancestry.traits) {
    const id = traitId(ancestry.name, trait.name);
    if (seen.has(id)) throw new Error(`Повторяющийся ID: ${id}`);
    seen.add(id);
    features.push({
      id,
      ancestryName: ancestry.name,
      kind: "trait",
      name: trait.name,
      cost: trait.cost,
      articleId: ancestry.articleId,
      description: trait.text,
    });
  }
}

fs.writeFileSync(outputPath, JSON.stringify(features, null, 2) + "\n");
console.log(
  `Происхождения: ${data.ancestries.length} происхождений, ${features.length} записей особенностей`,
);
