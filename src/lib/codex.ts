import index from "../data/codex-index.generated.json";

export interface RuleArticle {
  id: string;
  title: string;
  chapter: string;
  group: string;
  path: string;
  markdown: string;
}
export const CODEX_INDEX = index;
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, "")
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}
export function searchText(text: string): string {
  return text.toLocaleLowerCase("ru").replace(/ё/g, "е");
}
export function codexLink(title: string): string {
  const article = CODEX_INDEX.find(
    (a) => searchText(a.title) === searchText(title),
  );
  return article ? `#/codex/${article.id}` : "#/codex";
}
export function readCodexLocation(): { articleId: string; heading: string } {
  const [, , articleId = "", heading = ""] = window.location.hash.split("/");
  try {
    return { articleId, heading: decodeURIComponent(heading) };
  } catch {
    return { articleId, heading: "" };
  }
}
