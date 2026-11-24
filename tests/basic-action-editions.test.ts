import { describe, expect, it } from "vitest";
import { findAbilityOriginal, mechanicAbilityName } from "../src/components/abilityOriginal";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { BASIC_ABILITIES, abilityFromTemplate } from "../src/data/templates";

describe("basic action editions on saved hero sheets", () => {
  const names = ["Melee Weapon Free Strike", "Ranged Weapon Free Strike", "Charge", "Defend", "Heal",
    "Catch Breath", "Aid Attack", "Grab", "Knockback", "Escape Grab", "Opportunity Attack"];
  it.each(BASIC_ABILITIES.map((template, i) => [template, names[i]] as const))("resolves %s as %s without changing the save", (template, name) => {
    const ability = abilityFromTemplate(template);
    const saved = JSON.stringify(ability);
    expect(findAbilityOriginal(ability, ABILITY_COMPENDIUM)?.originalName).toBe(name);
    expect(mechanicAbilityName(ability, ABILITY_COMPENDIUM)).toBe(name);
    expect(findAbilityOriginal({ ...ability, effect: "Мой эффект" }, ABILITY_COMPENDIUM)).toBeUndefined();
    const custom = { ...ability, name: "Мой удар" };
    expect(findAbilityOriginal(custom, ABILITY_COMPENDIUM)).toBeUndefined();
    expect(mechanicAbilityName(custom, ABILITY_COMPENDIUM)).toBe(custom.name);
    expect(JSON.stringify(ability)).toBe(saved);
  });
});
