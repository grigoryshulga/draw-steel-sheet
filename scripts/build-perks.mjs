#!/usr/bin/env node
/**
 * Собирает перки из переведённых правил Draw Steel.
 *
 * Источники:
 *  - vault/10. Перки/1002…1007 — тексты перков
 *  - vault/06. Список Карьер — тип перка, который даёт карьера
 *  - vault/08. Классы — ограничения перков на 2/6/10 уровнях
 *
 * Выход: src/data/perks.generated.json
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VAULT = join(ROOT, "..", "drawsteel-ru", "vault");
const OUT = join(ROOT, "src", "data", "perks.generated.json");

const PERK_FILES = [
  ["crafting", "1002. Перки Ремесла.md"],
  ["exploration", "1003. Перки Исследования.md"],
  ["interpersonal", "1004. Межличностные Перки.md"],
  ["intrigue", "1005. Перки Интриги.md"],
  ["lore", "1006. Перки Знаний.md"],
  ["supernatural", "1007. Сверхъестественные Перки.md"],
];

const TYPE_LABELS = {
  crafting: "Ремесло",
  exploration: "Исследование",
  interpersonal: "Межличностные",
  intrigue: "Интрига",
  lore: "Знания",
  supernatural: "Сверхъестественное",
};

function read(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function typeFromPhrase(phrase) {
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

function cleanBody(body) {
  let text = body.replace(/\r\n/g, "\n");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^\[!example\]\s*(.+)$/gim, "Способность «$1».");
  text = text.replace(/^\[!tip\]\s*(.+)$/gim, "$1");
  text = text
    .split("\n")
    .filter((line) => !/^\s*\|/.test(line))
    .join("\n");
  text = text
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

function makeSummary(description) {
  const generic = /^(У вас есть следующая способность\.?|Вы получаете один перк|В этом разделе|Способность «|Эффект:)/i;
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

function perkId(type, name) {
  return `perk-${createHash("sha1").update(`${type}|${name}`).digest("hex").slice(0, 12)}`;
}

// ---------- перки ----------

const perks = [];
for (const [type, file] of PERK_FILES) {
  const text = read(join(VAULT, "10. Перки", file));
  const matches = [...text.matchAll(/^####\s+(.+?)\s*$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const name = match[1].replace(/\*\*/g, "").trim();
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? text.length;
    const description = cleanBody(text.slice(bodyStart, bodyEnd));
    if (!description) continue;
    perks.push({
      id: perkId(type, name),
      name,
      type,
      summary: makeSummary(description),
      description,
      source: `Перки: ${TYPE_LABELS[type]}`,
    });
  }
}

// ---------- карьеры ----------

const careersDir = join(VAULT, "06. Список Карьер");
const careerPerkTypes = {};
for (const file of readdirSync(careersDir).filter((name) => name.endsWith(".md"))) {
  const career = basename(file, ".md").replace(/^\d+\.\s*/, "");
  const text = read(join(careersDir, file));
  const line = text
    .split("\n")
    .find((item) => /перк/i.test(item) && /один перк/i.test(item));
  if (!line) continue;
  const phrase = line.match(/Один перк(?: группы)?\s+([^(*\n]+)/i)?.[1] ?? "";
  const types = typeFromPhrase(phrase);
  if (types.length === 1) careerPerkTypes[career] = types[0];
}

// ---------- классовые перки ----------

const classPerkRestrictions = {};
const classesDir = join(VAULT, "08. Классы");
for (const entry of readdirSync(classesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const className = entry.name;
  const restrictions = {};
  for (const file of readdirSync(join(classesDir, className)).filter((name) => name.endsWith(".md"))) {
    const level = Number(file.match(/^\d{4}\.\s+(\d+)-й/)?.[1] ?? 0);
    if (![2, 6, 10].includes(level)) continue;
    const text = read(join(classesDir, className, file));
    const heading = text.match(/^####\s+Перк\s*$/m);
    if (!heading) continue;
    const start = (heading.index ?? 0) + heading[0].length;
    const rest = text.slice(start);
    const nextHeading = rest.search(/^#{1,4}\s+/m);
    const body = (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).replace(/\n+/g, " ");
    const types = typeFromPhrase(body);
    if (types.length > 0) restrictions[level] = types;
  }
  if (Object.keys(restrictions).length > 0) {
    classPerkRestrictions[className] = restrictions;
  }
}

// ---------- запись ----------

perks.sort((a, b) => {
  const order = Object.keys(TYPE_LABELS);
  return order.indexOf(a.type) - order.indexOf(b.type) || a.name.localeCompare(b.name, "ru");
});

const payload = { perks, careerPerkTypes, classPerkRestrictions };
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log("=== build-perks ===");
console.log(`Перков: ${perks.length}`);
console.log(
  Object.entries(TYPE_LABELS)
    .map(([type, label]) => `${label}: ${perks.filter((perk) => perk.type === type).length}`)
    .join(", "),
);
console.log(`Карьер с типом перка: ${Object.keys(careerPerkTypes).length}`);
console.log(`Классов с ограничениями: ${Object.keys(classPerkRestrictions).length}`);
console.log(`JSON: ${OUT}`);
