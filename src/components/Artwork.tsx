import { artFor, type ArtAsset, type ArtKind } from "../lib/art";
import "./Artwork.css";

/** Decorative alongside a visible option name; credits live in the figure and settings. */
export function Artwork({
  kind,
  name,
  className = "",
}: {
  kind: ArtKind;
  name: string;
  className?: string;
}) {
  const art = artFor(kind, name);
  if (!art) return null;
  return (
    <span className={`artwork ${className}`} aria-hidden="true">
      <img
        key={art.src}
        src={art.thumbnailSrc ?? art.src}
        width={art.width}
        height={art.height}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

export function ArtworkFigure({
  art,
  className = "",
}: {
  art?: ArtAsset;
  className?: string;
}) {
  if (!art) return null;
  return (
    <figure className={`artwork-figure ${className}`}>
      <img
        key={art.src}
        src={art.src}
        width={art.width}
        height={art.height}
        alt={art.name}
        loading="lazy"
        decoding="async"
      />
      <figcaption>
        {art.sourceUrl ? (
          <a href={art.sourceUrl} target="_blank" rel="noreferrer">
            {art.credit} ↗
          </a>
        ) : (
          art.credit
        )}
      </figcaption>
    </figure>
  );
}
