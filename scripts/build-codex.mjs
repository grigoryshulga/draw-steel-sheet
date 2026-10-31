#!/usr/bin/env node
/** Local, reproducible snapshot of the translation; no runtime dependency on its checkout. */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vault =
  process.env.DS_RULES_DIR || join(root, "..", "drawsteel-ru", "vault");
const out = join(root, "src/data");
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.endsWith(".md")
        ? [join(dir, entry.name)]
        : [],
  );
}
const files = walk(vault)
  .filter((file) => !relative(vault, file).startsWith("00."))
  .sort();
const articles = files.map((file) => {
  const path = relative(vault, file).replaceAll("\\", "/");
  const stem = basename(file, ".md");
  return {
    id: stem.match(/^\d+/)?.[0] || stem,
    title: stem.replace(/^\d+\.\s*/, ""),
    chapter: path.split("/")[0],
    group: path.split("/").slice(1, -1).join(" / "),
    path,
    markdown: readFileSync(file, "utf8")
      .replace(/^\uFEFF/, "")
      .replaceAll("\r\n", "\n"),
  };
});
for (const a of articles) {
  if (articles.filter((other) => other.id === a.id).length > 1) {
    const duplicateId = a.id;
    for (const other of articles.filter((other) => other.id === duplicateId))
      other.id += "-" + other.title.match(/^\d+/)?.[0];
  }
}
const stems = new Map(
  articles.flatMap((a) => [
    [basename(a.path, ".md"), a],
    [a.title, a],
  ]),
);
export function headingId(text) {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, "")
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}
for (const a of articles) {
  a.markdown = a.markdown
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => {
      const [file, heading] = target.split("#");
      const dest = file
        ? stems.get(file.replace(/\.md$/, "").split("/").pop())
        : a;
      const text = label || heading || file.replace(/^\d+\.\s*/, "");
      return dest
        ? `[${text}](#/codex/${dest.id}${heading ? "/" + encodeURIComponent(headingId(heading)) : ""})`
        : text;
    })
    .replace(/^(>\s*)\[!\w+\][+-]?\s*(.*)$/gm, "$1**$2**")
    .replace(/<br\s*\/?>/gi, " · ");
}
if (new Set(articles.map((a) => a.id)).size !== articles.length)
  throw new Error("Duplicate codex article IDs");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "codex.generated.json"), JSON.stringify(articles));
// A small index for contextual links without eagerly importing the book.
writeFileSync(
  join(out, "codex-index.generated.json"),
  JSON.stringify(
    articles.map(({ markdown, ...a }) => ({
      ...a,
      headings: [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => ({
        title: m[1],
        id: headingId(m[1]),
      })),
    })),
  ),
);
console.log(
  `Кодекс: ${articles.length} статей, ${new Set(articles.map((a) => a.chapter)).size} глав`,
);

// Refresh the lightweight catalog whenever the book is rebuilt.
await import("./build-library.mjs");
