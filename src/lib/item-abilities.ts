import { ABILITY_COMPENDIUM } from "../data/compendium";
import { normalizeItemAbilityIds } from "./item-ability-ids";
import type { Ability, Character } from "../types";

/** Derive cards instead of copying grants into the hero's saved abilities. */
export function itemAbilityEntries(character: Character): { ability: Ability; itemName: string }[] {
  return character.inventory.filter(item => item.equipped && item.qty > 0).flatMap(item =>
    normalizeItemAbilityIds(item.abilityIds).flatMap(id => {
      const ability = ABILITY_COMPENDIUM.find(entry => entry.id === id);
      return ability ? [{ itemName: item.name, ability: {
        ...ability,
        id: `item:${item.id}:${ability.id}`,
        source: `Предмет · ${item.name}`,
      } }] : [];
    }),
  );
}
