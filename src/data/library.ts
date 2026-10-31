import articles from "./library-articles.generated.json";
import { headingId, searchText } from "../lib/codex";

export type CatalogKind = "treasure" | "title" | "project";
export interface CatalogEntry {
  id: string;
  kind: CatalogKind;
  name: string;
  category: string;
  echelon: number | null;
  markdown: string;
  summary: string;
  articleId: string;
  heading: string;
  keywords: string;
  prerequisite: string;
  projectGoal: string;
  projectCharacteristic: string;
}
export const CATALOG_LABELS: Record<CatalogKind, string> = {
  treasure: "Сокровища",
  title: "Титулы",
  project: "Проекты",
};
export function field(markdown: string, label: string) {
  return (
    markdown
      .match(new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*)$`, "mi"))?.[1]
      .trim() || ""
  );
}
export function plainSummary(markdown: string) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>`|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
export const CATALOG: CatalogEntry[] = articles.flatMap((article) => {
  const kind: CatalogKind | null = article.chapter.startsWith("18.")
    ? "treasure"
    : article.chapter.startsWith("19.")
      ? "title"
      : article.chapter.startsWith("16.")
        ? "project"
        : null;
  if (!kind) return [];
  const headings = [...article.markdown.matchAll(/^#### (.+)$/gm)];
  const pieces =
    kind === "project"
      ? [{ name: article.title, heading: "", markdown: article.markdown }]
      : headings.map((match, i) => ({
          name: match[1].replace(/\*\*/g, "").trim(),
          heading: headingId(match[1]),
          markdown: article.markdown
            .slice(match.index! + match[0].length, headings[i + 1]?.index)
            .replace(/\n---\s*$/, "")
            .trim(),
        }));
  return pieces.map((piece) => ({
    ...piece,
    id: piece.heading ? `${article.id}-${piece.heading}` : article.id,
    kind,
    articleId: article.id,
    category: article.group || "Титулы",
    echelon: Number(article.title.match(/(\d)-го Эшелона/i)?.[1]) || null,
    summary: plainSummary(
      piece.markdown
        .split(/\n\s*\n/)
        .find((p) => !/^\*\*[^*]+:\*\*/.test(p) && !/^[#|]/.test(p)) ||
        piece.markdown,
    ),
    keywords: field(piece.markdown, "Ключевые слова"),
    prerequisite: field(piece.markdown, "Предварительное условие"),
    projectGoal: field(piece.markdown, "Цель проекта"),
    projectCharacteristic: field(
      piece.markdown,
      "Характеристика броска проекта",
    ),
  }));
});
export function catalogEntryLink(entry: Pick<CatalogEntry, "kind" | "id">) {
  return `#/catalog/${entry.kind}/${encodeURIComponent(entry.id)}`;
}
export function sourceLink(entry: CatalogEntry) {
  return `#/codex/${entry.articleId}${entry.heading ? `/${encodeURIComponent(entry.heading)}` : ""}`;
}

export interface GlossaryEntry {
  id: string;
  name: string;
  english: string;
  markdown: string;
  letter: string;
}
const glossarySource = articles.find((a) => a.id === "0102")!.markdown;
const terms = [
  ...glossarySource.matchAll(
    /^(?:\*\*([^*\n]+)\*\*|([^*\n:]+ \([^)]+\))):[ \t]*/gm,
  ),
];
export const GLOSSARY: GlossaryEntry[] = terms
  .map((match, i) => {
    const label = match[1] || match[2];
    const name = label.replace(/\s*\([^)]+\)\s*$/, "").trim();
    return {
      id: headingId(name),
      name,
      english: label.match(/\(([^)]+)\)\s*$/)?.[1] || "",
      markdown: glossarySource
        .slice(match.index! + match[0].length, terms[i + 1]?.index)
        .trim(),
      letter: name[0].toLocaleUpperCase("ru"),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "ru"));
export function glossaryLink(id = "") {
  return `#/glossary/${encodeURIComponent(id)}`;
}
export function matchesLibraryQuery(query: string, ...fields: string[]) {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean);
  const haystack = searchText(fields.join(" "));
  return words.every((word) => haystack.includes(word));
}
