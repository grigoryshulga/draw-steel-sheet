import { kitByName } from "../data/kits";
import type { FeatureCondition, FeatureEffect } from "../data/class-features/types";
import type { Character } from "../types";
import type { ActiveClassFeature } from "./class-features";
import { featureConditionMet } from "./feature-conditions";
import { stormwightFormState } from "./stormwight-forms";

/** Пороговые правила выбранного комплекта: видны по уровню, числовые эффекты — по свирепости. */
export function stormwightFeatures(character: Character): ActiveClassFeature[] {
  if (character.className !== "Неистовый" || !featureConditionMet(character, { keyValue: ["Буревестник"] })) return [];
  const kit = kitByName(character.kit);
  if (kit?.familyId !== "kit.stormwight") return [];
  const features: ActiveClassFeature[] = (kit.growingFerocity ?? []).filter((row) => row.level <= character.level).map((row) => {
    const when: FeatureCondition = { resourceAtLeast: { name: "Свирепость", value: row.threshold, useTurnPeak: true } };
    const effects: FeatureEffect[] = [];
    if (["kit.corven", "kit.raden"].includes(kit.id) && row.threshold === 2) {
      effects.push({ kind: "field", field: "disengage", value: { characteristic: "agility" }, when });
    }
    if (kit.id === "kit.vuken" && row.threshold === 12) {
      for (const field of ["push", "pull", "slide"] as const) {
        effects.push({ kind: "field", field, value: { characteristic: "agility" }, when, filter: { powerRoll: true } });
      }
    }
    return {
      id: `${kit.id}.growing-ferocity.${row.threshold}`,
      name: `Растущая свирепость: ${kit.name} · ${row.threshold}`,
      level: row.level,
      className: character.className,
      description: row.description,
      mechanics: { kinds: effects.length ? ["situational", "bonus"] : ["situational"], when, effects },
    };
  });
  if (kit.formRules?.aspect) features.push({
    id: `${kit.id}.aspect-benefits`, name: `${kit.name}: преимущества аспекта`, level: 1,
    className: character.className, description: kit.formRules.aspect, mechanics: { kinds: ["situational"] },
  });
  const form = stormwightFormState(character);
  if (form && form.form !== "true") features.push({
    id: `${kit.id}.form.${form.form}`, name: `${form.form === "animal" ? "Форма животного" : "Форма гибрида"}: ${kit.animalForm}`,
    level: 1, className: character.className, description: form.description,
    mechanics: { kinds: ["situational", ...(form.speedBonus ? ["bonus" as const] : [])],
      effects: form.speedBonus ? [{ kind: "field", field: "speed", value: form.speedBonus }] : [] },
  });
  return features;
}
