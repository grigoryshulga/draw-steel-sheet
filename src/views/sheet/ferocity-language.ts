import type { Locale } from "../../i18n/locale";
import type { FerocityRow } from "../../lib/fury-ferocity";

const standard: Record<string, string[]> = {
  boren: ["You can have up to two creatures grabbed at once. Whenever you strike a creature you have grabbed, you gain 1 surge.", "The first time you grab a creature on your turn, you gain 1 surge.", "You gain an edge on Grab and Knockback maneuvers.", "The first time you grab a creature on your turn, you gain 2 surges instead of 1.", "You gain a double edge on Grab and Knockback maneuvers.", "Whenever you use a heroic ability, you gain 10 temporary Stamina. While you have a creature grabbed, ability rolls against it gain a potency bonus equal to your Might score."],
  corven: ["Whenever you use the Disengage move action, the distance you can shift gains a bonus equal to your Agility score.", "The first time you shift on your turn, you gain 1 surge.", "You gain an edge on Agility tests and the Escape Grab and Knockback maneuvers.", "The first time you shift on your turn, you gain 2 surges instead of 1.", "You gain a double edge on Agility tests and the Escape Grab and Knockback maneuvers.", "Whenever you use a heroic ability, you gain 10 temporary Stamina. The potency of effects targeting you is reduced by 2 for you."],
  vuken: ["Whenever you use the Knockback maneuver, you can target one additional creature.", "The first time you push a creature or knock a creature prone on your turn, you gain 1 surge.", "You gain an edge on Agility tests and the Knockback maneuver.", "The first time you push a creature or knock a creature prone on your turn, you gain 2 surges.", "You gain a double edge on Agility tests and the Knockback maneuver.", "Whenever you use a heroic ability, you gain 10 temporary Stamina. Additionally, whenever you make a power roll that imposes forced movement on a target, the forced movement distance gains a bonus equal to your Agility score."],
};

export function ferocityDescription(row: FerocityRow, locale: Locale): string {
  if (locale !== "en") return row.description;
  if (row.originalDescription) return row.originalDescription;
  const key = row.id.match(/kit\.(boren|corven|raden|vuken)\.growing-ferocity\.\d+$/)?.[1];
  const index = [2, 4, 6, 8, 10, 12].indexOf(row.threshold);
  return key && index >= 0 ? standard[key === "raden" ? "corven" : key]?.[index] || row.description : row.description;
}

export function ferocitySource(source: string, locale: Locale): string {
  if (locale !== "en") return source;
  return ({ "Берсерк": "Berserker", "Разоритель": "Reaver", "Буревестник": "Stormwight", "Борен · Медведь": "Boren · Bear", "Корвен · Ворон": "Corven · Crow", "Раден · Крыса": "Raden · Rat", "Вукен · Волк": "Vuken · Wolf" } as Record<string, string>)[source] || source;
}
