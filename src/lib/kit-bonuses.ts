import { kitByName, type Kit } from "../data/kits";
import type { Character } from "../types";

export type KitBonusPreferences = Pick<
  NonNullable<Character["automation"]>,
  "meleeDamageKit" | "rangedDamageKit" | "kitBonusSelections"
>;

export interface KitLoadout {
  kit: string;
  secondaryKit?: string;
  automation?: KitBonusPreferences;
}

export interface KitBonusOption {
  kit: Kit;
  value: string;
}

export interface ResolvedKitBonus extends KitBonusOption {
  label: string;
  options: KitBonusOption[];
}

const BONUS_ORDER = [
  "выносливости", "скорости", "устойчивости", "отходу",
  "урону (Ближний)", "урону (Дальний)",
  "расстоянию (Ближний)", "расстоянию (Дальний)",
];

export function equippedKits(loadout: KitLoadout): Kit[] {
  const kits = [loadout.kit, loadout.secondaryKit ?? ""].flatMap((name) => {
    const kit = kitByName(name);
    return kit ? [kit] : [];
  });
  return kits.filter((kit, index) => kits.findIndex((other) => other.id === kit.id) === index);
}

function damagePreference(label: string) {
  if (label === "урону (Ближний)") return "meleeDamageKit";
  if (label === "урону (Дальний)") return "rangedDamageKit";
  return undefined;
}

export function kitBonusOptions(loadout: KitLoadout, label: string): KitBonusOption[] {
  return equippedKits(loadout).flatMap((kit) => {
    const bonus = kit.bonuses.find((entry) => entry.label === label);
    return bonus ? [{ kit, value: bonus.value }] : [];
  });
}

/** A damage profile is indivisible: never construct a per-tier maximum from two kits. */
export function resolvedKitBonus(loadout: KitLoadout, label: string): ResolvedKitBonus | undefined {
  const options = kitBonusOptions(loadout, label);
  if (!options.length) return undefined;
  const damageKey = damagePreference(label);
  const chosen = damageKey
    ? loadout.automation?.[damageKey]
    : loadout.automation?.kitBonusSelections?.[label];
  const selected = options.find((option) => option.kit.id === kitByName(chosen ?? "")?.id);
  const values = (option: KitBonusOption) => option.value.split("/").map((value) => parseFloat(value) || 0);
  // Use an unambiguously better profile; for a trade-off retain the first kit
  // until the player chooses. Scalar bonuses naturally take their maximum.
  const preferred = options.find((option) => options.every((other) =>
    values(other).every((value, tier) => (values(option)[tier] ?? 0) >= value),
  ));
  return { label, options, ...(selected ?? preferred ?? options[0]) };
}

export function resolvedKitBonuses(loadout: KitLoadout): ResolvedKitBonus[] {
  const labels = [...new Set(equippedKits(loadout).flatMap((kit) => kit.bonuses.map((bonus) => bonus.label)))];
  labels.sort((a, b) => BONUS_ORDER.indexOf(a) - BONUS_ORDER.indexOf(b));
  return labels.flatMap((label) => {
    const bonus = resolvedKitBonus(loadout, label);
    return bonus ? [bonus] : [];
  });
}

/** Keeps the historic damage fields readable by old character documents. */
export function selectKitBonus(
  preferences: KitBonusPreferences | undefined,
  label: string,
  kit: string,
): KitBonusPreferences {
  const { meleeDamageKit, rangedDamageKit, kitBonusSelections } = preferences ?? {};
  const next = { meleeDamageKit, rangedDamageKit, kitBonusSelections };
  const damageKey = damagePreference(label);
  return damageKey
    ? { ...next, [damageKey]: kit }
    : { ...next, kitBonusSelections: { ...kitBonusSelections, [label]: kit } };
}

/** Remove departed sources while retaining deliberate choices for the other kit. */
export function validKitBonusPreferences(loadout: KitLoadout): KitBonusPreferences {
  const current = loadout.automation ?? {};
  const valid = (label: string, name: string | undefined) =>
    kitBonusOptions(loadout, label).find((option) => option.kit.id === kitByName(name ?? "")?.id)?.kit.name ?? "";
  return {
    meleeDamageKit: valid("урону (Ближний)", current.meleeDamageKit),
    rangedDamageKit: valid("урону (Дальний)", current.rangedDamageKit),
    ...(current.kitBonusSelections ? {
      kitBonusSelections: Object.fromEntries(Object.entries(current.kitBonusSelections)
        .flatMap(([label, name]) => {
          const kit = valid(label, name);
          return kit ? [[label, kit]] : [];
        })),
    } : {}),
  };
}
