import { kitByName, kitBonusLabel, type Kit } from "../data/kits";

/** Names stored on characters are never rewritten for display. */
export function kitDisplayName(name: string, locale: string): string {
  const kit = kitByName(name);
  return locale === "en" && kit && kit.name === name ? kit.originalName || name : name;
}

const bonusNames: Record<string, string> = {
  "выносливости": "Stamina", "скорости": "Speed", "устойчивости": "Stability", "отходу": "Disengage",
  "урону (Ближний)": "Melee damage", "урону (Дальний)": "Ranged damage",
  "расстоянию (Ближний)": "Melee distance", "расстоянию (Дальний)": "Ranged distance",
};
export function kitDisplayBonus(label: string, locale: string): string {
  return locale === "en" ? bonusNames[label] || kitBonusLabel(label) : kitBonusLabel(label);
}
export function kitDisplayValue(value: string, locale: string): string {
  return locale === "en" ? value.replace("за эшелон", "per echelon") : value;
}
export function kitDisplaySignature(kit: Kit, locale: string): string {
  if (locale !== "en") return kit.signatureAbility;
  return kit.originalDescription?.match(/#{5} Signature Ability\s+#{6} ([^\n]+)/)?.[1] || kit.signatureAbility;
}
export function kitDisplayEquipment(kit: Kit, locale: string): string {
  if (locale !== "en") return kit.equipment;
  if (kit.familyId || kit.variants?.length) return "You wear no armor and wield only unarmed strikes, which become devastating natural weapons as your ferocity grows.";
  return kit.originalDescription?.match(/#{5} Equipment\s+([^\n]+)/)?.[1] || kit.equipment;
}
const stormFields: Record<string, [string, string, string]> = {
  "Борен": ["Bear", "Blizzard", "cold"], "Корвен": ["Crow", "Anabatic wind", "fire"],
  "Раден": ["Rat", "Rat flood", "corruption"], "Вукен": ["Wolf", "Thunderstorm", "lightning"],
};
export function kitDisplayStorm(kit: Kit, locale: string): [string | undefined, string | undefined, string | undefined] {
  return locale === "en" && stormFields[kit.name] ? stormFields[kit.name] : [kit.animalForm, kit.storm, kit.damageType];
}
