import raw from "./kits.generated.json";
import type { OriginalFields } from "../types";

export interface KitBonus {
  label: string;
  value: string;
}

export interface Kit extends OriginalFields {
  id: string;
  name: string;
  summary: string;
  equipment: string;
  bonuses: KitBonus[];
  signatureAbility: string;
}

export const KIT_COMPENDIUM = raw as Kit[];

function normalizeKitName(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

export function kitByName(name: string): Kit | undefined {
  const needle = normalizeKitName(name);
  if (!needle) return undefined;
  return KIT_COMPENDIUM.find((kit) => normalizeKitName(kit.name) === needle);
}

const BONUS_LABELS: Record<string, string> = {
  "выносливости": "Выносливость",
  "скорости": "Скорость",
  "устойчивости": "Устойчивость",
  "отходу": "Отход",
  "урону (Ближний)": "Урон (Ближний)",
  "урону (Дальний)": "Урон (Дальний)",
  "расстоянию (Ближний)": "Дистанция (Ближний)",
  "расстоянию (Дальний)": "Дистанция (Дальний)",
};

export function kitBonusLabel(label: string): string {
  const cleaned = label.trim();
  return BONUS_LABELS[cleaned] ?? cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
