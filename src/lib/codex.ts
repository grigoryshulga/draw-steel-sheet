/**
 * Чистые помощники ссылок Кодекса: маршруты, заголовки и нормализация текста.
 * Навигационные данные живут в `src/rules/codex-navigation.ts`, чтобы модули,
 * которым нужна только нормализация (например `src/data/library.ts`), не
 * подтягивали манифест правил в свой граф импортов.
 */
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
