#!/usr/bin/env node
/**
 * Собирает комплекты из переведённых правил Draw Steel.
 * Источник: vault/09. Комплекты/Список Комплектов/*.md
 * Выход: src/data/kits.generated.json
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KITS_DIR = join(ROOT, "..", "drawsteel-ru", "vault", "09. Комплекты", "Список Комплектов");
const OUT = join(ROOT, "src", "data", "kits.generated.json");

function clean(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^>\s?/gm, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2")
    .replace(/`/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sections(text) {
  const result = new Map();
  const matches = [...text.matchAll(/^#####\s+(.+?)\s*$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    result.set(match[1].trim(), text.slice(start, end));
  }
  return result;
}

const kits = [];
for (const file of readdirSync(KITS_DIR).filter((name) => name.endsWith(".md"))) {
  const text = readFileSync(join(KITS_DIR, file), "utf8").replace(/^\uFEFF/, "");
  const name = basename(file, ".md").replace(/^\d+\.\s*/, "");
  const parts = sections(text);
  const summary = clean(text.split(/^#####/m)[0] ?? "");
  const equipment = clean(parts.get("Снаряжение") ?? "").replace(/\n+/g, " ");

  const bonuses = [];
  const bonusText = parts.get("Бонусы комплекта") ?? "";
  for (const line of bonusText.split("\n")) {
    const match = line.match(/^\*\*(.+?):\*\*\s*(.+?)\s*$/);
    if (!match) continue;
    bonuses.push({
      label: match[1].replace(/^Бонус к\s+/i, "").trim(),
      value: match[2].trim(),
    });
  }

  const signature = (parts.get("Знаковая способность") ?? "").match(/\[!example\]\s*(.+)/);
  kits.push({
    id: `kit-${createHash("sha1").update(name).digest("hex").slice(0, 12)}`,
    name,
    summary,
    equipment,
    bonuses,
    signatureAbility: signature ? signature[1].trim() : "",
  });
}

kits.sort((a, b) => a.name.localeCompare(b.name, "ru"));
writeFileSync(OUT, `${JSON.stringify(kits, null, 2)}\n`, "utf8");
console.log("=== build-kits ===");
console.log(`Комплектов: ${kits.length}`);
console.log(`С бонусами: ${kits.filter((kit) => kit.bonuses.length > 0).length}`);
console.log(`JSON: ${OUT}`);
