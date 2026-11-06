import { catalogAccent } from "../../lib/catalog-presentation";
import type { CatalogEntry } from "../../rules/consumer-data";
import { CatalogRank } from "./CatalogRank";
import { PerkCard } from "../PerkCard";
import type { PerkType } from "../../types";
import type { ReactNode } from "react";
import { artFor, type ArtKind } from "../../lib/art";
import "./ReferenceList.css";

type ReferenceListEntry = {
  catalog?: CatalogEntry;
  perk?: { type: PerkType };
  id?: string;
  name: string;
  summary?: string;
  eyebrow?: string;
  echelon?: number | null;
};

/** Одна разметка списка справочника: ссылки в каталоге, выбор строки в мастере. */
export function ReferenceList<T extends ReferenceListEntry>({
  entries,
  selectedId,
  artKind,
  hrefFor,
  onSelect,
  metaFor,
  label,
}: {
  entries: readonly T[];
  selectedId?: string;
  artKind?: ArtKind;
  hrefFor?: (entry: T) => string;
  onSelect?: (entry: T) => void;
  metaFor?: (entry: T) => ReactNode;
  label?: string;
}) {
  return (
    <div
      className="catalog-cards"
      role={onSelect ? "group" : undefined}
      aria-label={label}
    >
      {entries.map((entry) => {
        const id = entry.id ?? entry.name;
        if (entry.perk && hrefFor) return (
          <a key={id} className="catalog-perk-link" href={hrefFor(entry)} aria-current={id === selectedId ? "page" : undefined}>
            <PerkCard name={entry.name} type={entry.perk.type} summary={entry.summary} banded selected={id === selectedId} />
          </a>
        );
        const rank = catalogAccent(entry.catalog);
        const art = artKind ? artFor(artKind, entry.name) : undefined;
        const className = `catalog-card${art ? " has-art" : ""}`;
        const content = (
          <>
            {art && (
              <span className="catalog-card-art" aria-hidden="true">
                <img
                  src={art.thumbnailSrc ?? art.src}
                  alt=""
                  width={art.width}
                  height={art.height}
                  loading="lazy"
                  decoding="async"
                />
              </span>
            )}
            <span className="catalog-card-body">
              <span className="catalog-card-meta">
              {(entry.eyebrow || entry.echelon) && (
                <span className="eyebrow">
                  {entry.eyebrow}
                  {!rank && entry.eyebrow && entry.echelon ? " · " : ""}
                  {!rank && entry.echelon ? `Эшелон ${entry.echelon}` : ""}
                </span>
              )}
              <CatalogRank rank={rank} />
              </span>
              <span className="catalog-card-title">{entry.name}</span>
              {entry.summary && (
                <span className="catalog-card-summary">{entry.summary}</span>
              )}
              {metaFor?.(entry)}
            </span>
          </>
        );
        return hrefFor ? (
          <a
            key={id}
            className={className}
            data-rank={rank}
            data-catalog-kind={entry.catalog?.kind}
            href={hrefFor(entry)}
            aria-current={id === selectedId ? "page" : undefined}
          >
            {content}
          </a>
        ) : (
          <button
            key={id}
            type="button"
            className={className}
            data-rank={rank}
            data-catalog-kind={entry.catalog?.kind}
            aria-pressed={id === selectedId}
            onClick={() => onSelect?.(entry)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
