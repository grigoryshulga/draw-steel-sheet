import raw from "../data/art.generated.json";

export type ArtKind = "class" | "ancestry" | "kit" | "career";
export interface ArtAsset {
  kind: ArtKind;
  name: string;
  src: string;
  thumbnailSrc?: string;
  width: number;
  height: number;
  origin: "official" | "generated";
  sourceUrl?: string;
  credit: string;
  articleIds: string[];
}

export const ART_ASSETS = raw as ArtAsset[];
const normalized = (name: string) =>
  name.trim().toLocaleLowerCase("ru").replace(/ё/g, "е");
const byName = new Map(
  ART_ASSETS.map((art) => [`${art.kind}:${normalized(art.name)}`, art]),
);
const byArticle = new Map(
  ART_ASSETS.flatMap((art) => art.articleIds.map((id) => [id, art] as const)),
);

export function artFor(kind: ArtKind, name: string): ArtAsset | undefined {
  return byName.get(`${kind}:${normalized(name)}`);
}

export function artForArticle(articleId: string): ArtAsset | undefined {
  return byArticle.get(articleId);
}
