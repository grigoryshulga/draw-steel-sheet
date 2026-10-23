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
export function catalogLink(chapter = "", group = ""): string {
  const params = new URLSearchParams();
  if (chapter) params.set("chapter", chapter);
  if (group) params.set("group", group);
  return `#/codex/${params.size ? `?${params}` : ""}`;
}
export function readCodexLocation(hash = window.location.hash) {
  const [path, query = ""] = hash.split("?");
  const [, , articleId = "", heading = ""] = path.split("/");
  const params = new URLSearchParams(query);
  let decodedHeading = "";
  try {
    decodedHeading = decodeURIComponent(heading);
  } catch {
    /* malformed link */
  }
  return {
    articleId,
    heading: decodedHeading,
    chapter: params.get("chapter") || "",
    group: params.get("group") || "",
  };
}

/** Old section URLs remain usable, but open rules instead of another index. */
export function resolveCodexArticle(
  articles: RuleArticle[],
  location: ReturnType<typeof readCodexLocation>,
) {
  if (location.articleId)
    return articles.find((a) => a.id === location.articleId);
  if (!location.chapter) return undefined;
  const entries = articles.filter(
    (a) =>
      a.chapter === location.chapter &&
      (!location.group || a.group === location.group),
  );
  return entries.find((a) => a.markdown.trim()) || entries[0];
}
