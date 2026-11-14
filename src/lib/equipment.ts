import { ABILITY_COMPENDIUM } from "../data/compendium";
import { KIT_COMPENDIUM, kitByName, type Kit } from "../data/kits";
import type { Character, CompendiumAbility } from "../types";

/** Все способности комплекта, включая общее превращение буревестника. */
export function kitGrantedAbilities(kit: Kit): CompendiumAbility[] {
  const abilities = kit.grantedAbilityIds
    ? kit.grantedAbilityIds.flatMap((id) => {
        const ability = ABILITY_COMPENDIUM.find((item) => item.id === id);
        return ability ? [ability] : [];
      })
    : ABILITY_COMPENDIUM.filter((ability) =>
        ability.source === `Комплект: ${kit.name}` && ability.name === kit.signatureAbility,
      );
  return abilities.map((ability) => ({ ...ability, source: `Комплект: ${kit.name}` }));
}

/** Switching kits replaces their granted signatures without duplicating them or touching class abilities. */
export function changeKit(
  character: Character,
  name: string,
  secondary = false,
): Character {
  const next = {
    ...character,
    ...(secondary ? { secondaryKit: name } : { kit: name }),
  };
  if (!character.automation?.enabled) return next;
  const oldKits = [character.kit, character.secondaryKit].filter(Boolean);
  const oldSources = new Set(oldKits.map((name) => `Комплект: ${name}`));
  for (const name of [...oldKits, next.kit, next.secondaryKit]) {
    const familyId = kitByName(name ?? "")?.familyId;
    // Старые сохранения приписывали все пять способностей общей записи.
    const family = KIT_COMPENDIUM.find((kit) => kit.id === familyId);
    if (family) oldSources.add(`Комплект: ${family.name}`);
  }
  const kits = [
    ...new Set([next.kit, next.secondaryKit].filter((s): s is string => !!s)),
  ];
  const abilities = character.abilities.filter(
    (a) => !oldSources.has(a.source),
  );
  for (const kitName of kits) {
    const kit = kitByName(kitName);
    for (const ability of kit ? kitGrantedAbilities(kit) : []) {
      if (!abilities.some((a) => a.name === ability.name && a.source === ability.source))
        abilities.push(ability);
    }
  }
  return { ...next, abilities };
}
