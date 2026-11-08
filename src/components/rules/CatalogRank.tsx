import { Icon } from "../Icons";
import "./CatalogRank.css";
export function CatalogRank({ rank }: { rank?: string }) {
  if (!rank) return null;
  const label = rank === "artifact" ? "Артефакт" : rank === "growing" ? "Предмет с уровнем" : `Эшелон ${rank}`;
  return <span className="catalog-rank" data-rank={rank} title={label} aria-label={label}>
    {rank === "artifact" ? <Icon name="abilities" size={14} /> : rank === "growing" ? <Icon name="arrow-up" size={14} /> : ["", "I", "II", "III", "IV"][Number(rank)]}
  </span>;
}
