import "./CatalogRank.css";
export function CatalogRank({ rank }: { rank?: string }) {
  if (!rank) return null;
  const label = rank === "artifact" ? "Артефакт" : rank === "growing" ? "Предмет с уровнем" : `Эшелон ${rank}`;
  return <span className="catalog-rank" data-rank={rank} title={label} aria-label={label}>
    {rank === "artifact" ? "✦" : rank === "growing" ? "↑" : ["", "I", "II", "III", "IV"][Number(rank)]}
  </span>;
}
