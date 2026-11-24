import { useArticleText } from "../../i18n/locale";
import type { CatalogEntry } from "../../rules/consumer-data";
import { treasureEquipmentKind } from "../../lib/catalog-presentation";
import { Icon, type IconName } from "../Icons";

const META: Record<NonNullable<ReturnType<typeof treasureEquipmentKind>>, { label: string; icon: IconName }> = {
  armor: { label: "Броня и щиты", icon: "shield" },
  weapon: { label: "Оружие", icon: "sword" },
  implement: { label: "Катализатор", icon: "spark" },
  other: { label: "Прочее сокровище", icon: "inventory" },
};
export function TreasureKind({ entry }: { entry?: CatalogEntry }) {
  const t = useArticleText();
  const kind = treasureEquipmentKind(entry);
  if (!kind) return null;
  const { icon } = META[kind];
  const label = t(META[kind].label, { armor: "Armor and shields", weapon: "Weapon", implement: "Implement", other: "Other treasure" }[kind]);
  return <span className="catalog-treasure-kind" title={label} aria-label={label}><Icon name={icon} size={16} /></span>;
}
