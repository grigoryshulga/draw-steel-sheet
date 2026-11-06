import { CATALOG } from "../data/library";
import { CatalogAction } from "./CatalogAction";

/** Full catalog records are only needed when this article can start a project. */
export function ArticleCatalogActions({ articleId }: { articleId: string }) {
  return CATALOG.filter((entry) => entry.articleId === articleId && entry.kind === "project")
    .map((entry) => <CatalogAction key={entry.id} entry={entry} />);
}
