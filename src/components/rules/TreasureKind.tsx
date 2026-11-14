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
  const kind = treasureEquipmentKind(entry);
  if (!kind) return null;
  const { label, icon } = META[kind];
  return <span className="catalog-treasure-kind" title={label} aria-label={label}><Icon name={icon} size={16} /></span>;
}
