import { useEffect, useState } from "react";
import { basicActionSource } from "../data/templates";
import { canonicalAbilityId } from "../data/originals";
import type { Ability } from "../types";

// Only associate a saved ability with its source when its rule fields still match.
let catalogPromise: Promise<Ability[]> | undefined;
export function useAbilityCatalog(enabled = true): Ability[] {
  const [catalog, setCatalog] = useState<Ability[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    catalogPromise ??= import("../data/compendium").then(({ ABILITY_COMPENDIUM }) => ABILITY_COMPENDIUM);
    void catalogPromise.then((entries) => {
      if (active) setCatalog(entries);
    }).catch(() => { catalogPromise = undefined; });
    return () => { active = false; };
  }, [enabled]);
  return catalog;
}

export function useAbilityOriginal(ability: Ability, canonical = false): Ability | undefined {
  const catalog = useAbilityCatalog(!canonical);
  return canonical && ability.originalDescription?.trim() ? ability : findAbilityOriginal(ability, catalog);
}

export function findAbilityOriginal(ability: Ability, catalog: Ability[]): Ability | undefined {
  const fields: (keyof Ability)[] = ["name", "flavor", "actionType", "kind", "keywords", "weaponMode", "distance", "target", "rollCharacteristics", "rollBonus", "resourceCost", "trigger", "tiers", "effect"];
  const starter = basicActionSource(ability);
  if (starter && fields.every(field => field === "name" || JSON.stringify(ability[field] ?? null) ===
    JSON.stringify((starter.template as Partial<Ability>)[field] ?? null))) {
    return { ...ability, id: starter.id, originalName: starter.name, originalDescription: starter.description };
  }
  const id = canonicalAbilityId(ability.id);
  const exact = catalog.find(entry => entry.id === id);
  const candidates = exact ? [exact] : ability.originalId ? catalog.filter(entry => entry.originalId === ability.originalId) : catalog.filter(entry => entry.name === ability.name);
  const matches = candidates.filter(entry => fields.every(field =>
    JSON.stringify(ability[field] ?? null) === JSON.stringify(entry[field] ?? null),
  ));
  return matches.length === 1 && matches[0].originalDescription?.trim() ? matches[0] : undefined;
}

/** Resolve names independently of rule text, which may have been edited. */
export function mechanicAbilityName(ability: Pick<Ability, "id" | "name" | "originalId"> & { source?: string }, catalog: Ability[]): string {
  const starter = basicActionSource(ability);
  if (starter) return starter.name;
  const exact = catalog.find(entry => entry.id === canonicalAbilityId(ability.id));
  const candidates = exact ? [exact] : ability.originalId
    ? catalog.filter(entry => entry.originalId === ability.originalId)
    : catalog.filter(entry => entry.name === ability.name);
  const matches = candidates.filter(entry => entry.name === ability.name && entry.originalName);
  return matches.length === 1 ? matches[0].originalName! : ability.name;
}
