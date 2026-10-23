import { ABILITY_COMPENDIUM } from "../data/compendium";
import { kitByName } from "../data/kits";
import type { Character } from "../types";

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
  const kits = [
    ...new Set([next.kit, next.secondaryKit].filter((s): s is string => !!s)),
  ];
  const abilities = character.abilities.filter(
    (a) => !oldKits.some((k) => a.source === `Комплект: ${k}`),
  );
  for (const kitName of kits) {
    const kit = kitByName(kitName);
    const ability =
      kit &&
      ABILITY_COMPENDIUM.find(
        (a) =>
          a.source === `Комплект: ${kitName}` &&
          a.name === kit.signatureAbility,
      );
    if (
      ability &&
      !abilities.some(
        (a) => a.name === ability.name && a.source === ability.source,
      )
    )
      abilities.push({ ...ability });
  }
  return { ...next, abilities };
}
