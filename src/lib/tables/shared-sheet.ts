import { createCharacter } from "../defaults";
import type { Character } from "../../types";
import type { SharedHero, TableSection } from "./types";

const fields: Record<TableSection, readonly (keyof Character)[]> = {
  hero: ["career", "subclass", "characteristics", "size", "speed", "stability", "disengage", "kit", "secondaryKit", "weapon", "armor", "equipmentEffects", "abilities", "damageTraits", "ancestryTraits", "classFeatures"],
  development: ["xp", "xpThreshold", "epic", "victories", "perks", "skills", "languages", "culture", "careerInfo", "advancements", "automation"],
  inventory: ["inventory", "wealth", "renown"],
  journal: ["projects"],
  companions: [],
};

/** Local display model from the authorized projection; never fetches another owner's document. */
export function sharedSheetCharacter(hero: SharedHero): Character {
  const character = createCharacter();
  character.abilities = [];
  for (const [section, keys] of Object.entries(fields)) {
    const value = hero.sections[section as TableSection];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const key of keys) {
      if (Object.hasOwn(value, key)) Object.assign(character, { [key]: structuredClone((value as Record<string, unknown>)[key]) });
    }
  }
  return {
    ...character,
    id: hero.id, name: hero.name, ancestry: hero.ancestry, className: hero.className,
    level: hero.level, stamina: structuredClone(hero.stamina), conditions: { ...character.conditions, ...structuredClone(hero.conditions) },
    heroicResource: structuredClone(hero.resources.heroicResource), recoveries: structuredClone(hero.resources.recoveries),
    surges: hero.resources.surges, heroTokens: hero.resources.heroTokens,
    notes: { ...character.notes, ...structuredClone(hero.notes) }, updatedAt: hero.updatedAt,
  };
}
