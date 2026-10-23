import raw from "./perks.generated.json";
import type { Character, Perk, PerkType, SelectedPerk } from "../types";

export const PERK_COMPENDIUM = raw.perks as Perk[];
export const CAREER_PERK_TYPES = raw.careerPerkTypes as Record<string, PerkType>;
export const CLASS_PERK_RESTRICTIONS = raw.classPerkRestrictions as Record<
  string,
  Record<string, PerkType[]>
>;

export const PERK_TYPE_META: Record<
  PerkType,
  { label: string; short: string; tone: "default" | "accent" | "blue" | "green" | "yellow" | "magenta" }
> = {
  crafting: { label: "Ремесло", short: "Ремесло", tone: "yellow" },
  exploration: { label: "Исследование", short: "Исследование", tone: "green" },
  interpersonal: { label: "Межличностные", short: "Межличностные", tone: "blue" },
  intrigue: { label: "Интрига", short: "Интрига", tone: "magenta" },
  lore: { label: "Знания", short: "Знания", tone: "accent" },
  supernatural: { label: "Сверхъестественное", short: "Сверхъестественное", tone: "default" },
};

export const ALL_PERK_TYPES = Object.keys(PERK_TYPE_META) as PerkType[];
export const CLASS_PERK_LEVELS = [2, 4, 6, 8, 10] as const;

export interface PerkSlot {
  key: string;
  source: "career" | "class";
  level: number;
  title: string;
  allowedTypes: PerkType[];
}

export function perkById(id: string): Perk | undefined {
  return PERK_COMPENDIUM.find((perk) => perk.id === id);
}

export function careerPerkType(career: string): PerkType | undefined {
  return CAREER_PERK_TYPES[career.trim()];
}

export function classPerkTypes(className: string, level: number): PerkType[] {
  if (level === 4 || level === 8) return ALL_PERK_TYPES;
  const restriction = CLASS_PERK_RESTRICTIONS[className]?.[String(level)];
  return restriction && restriction.length > 0 ? restriction : ALL_PERK_TYPES;
}

export function perkSlots(character: Pick<Character, "career" | "className" | "level">): PerkSlot[] {
  const careerType = careerPerkType(character.career);
  const slots: PerkSlot[] = [
    {
      key: "career",
      source: "career",
      level: 0,
      title: "Карьера",
      allowedTypes: careerType ? [careerType] : ALL_PERK_TYPES,
    },
  ];

  for (const level of CLASS_PERK_LEVELS) {
    if (character.level < level) continue;
    const allowedTypes = classPerkTypes(character.className, level);
    slots.push({
      key: `class-${level}`,
      source: "class",
      level,
      title: `Класс · ${level} уровень`,
      allowedTypes,
    });
  }

  return slots;
}

export function selectedPerkForSlot(
  character: Pick<Character, "perks">,
  slot: PerkSlot,
): SelectedPerk | undefined {
  return character.perks.find((perk) =>
    slot.source === "career"
      ? perk.source === "career"
      : perk.source === "class" && perk.level === slot.level,
  );
}

export function isPerkUsed(
  character: Pick<Character, "perks">,
  perkId: string,
  exceptSlot?: PerkSlot,
): boolean {
  return character.perks.some((perk) => {
    if (perk.perkId !== perkId) return false;
    if (!exceptSlot) return true;
    if (exceptSlot.source === "career") return perk.source !== "career";
    return !(perk.source === "class" && perk.level === exceptSlot.level);
  });
}
