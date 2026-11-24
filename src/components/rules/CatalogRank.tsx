import { useArticleText } from "../../i18n/locale";
import { Icon } from "../Icons";
import "./CatalogRank.css";
export function CatalogRank({ rank }: { rank?: string }) {
  const t = useArticleText();
  if (!rank) return null;
  const label = rank === "artifact" ? t("Артефакт", "Artifact") : rank === "growing" ? t("Предмет с уровнем", "Leveled treasure") : t(`Эшелон ${rank}`, `Echelon ${rank}`);
  return <span className="catalog-rank" data-rank={rank} title={label} aria-label={label}>
    {rank === "artifact" ? <Icon name="abilities" size={14} /> : rank === "growing" ? <Icon name="arrow-up" size={14} /> : ["", "I", "II", "III", "IV"][Number(rank)]}
  </span>;
}
