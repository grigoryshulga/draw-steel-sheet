import type { LevelUpRule } from "../data/level-up-rules";
import { ABILITY_COMPENDIUM } from "../data/compendium";
import { ALL_CREATION_SKILLS } from "../data/creation-rules";
import { perkById } from "../data/perks";
import { GENERATED_CLASS_FEATURES } from "../data/class-features/skeleton";
import { canonicalAbilityId, canonicalClassFeatureId } from "../data/originals";
import { CHARACTERISTICS } from "./rules";

/** Stable labels for saved level-up choice keys, including records from older sheets. */
export function levelUpChoiceGroupTitle(key: string, rule?: LevelUpRule): string {
  const conduitAbility = /^conduit\.ability\.domain\.(2|6|9)$/.exec(key);
  if (conduitAbility) return `Доменная способность ${conduitAbility[1]}-го уровня`;
  if (key === "conduit.domain.skill.2") return "Навык второго домена";
  if (key === "conduit.domain.4") return "Особенность домена 4-го уровня";
  if (key === "conduit.domain.7") return "Особенность домена 7-го уровня";
  if (key === "perk") return "Перк";
  if (key === "skill") return "Навык";
  if (key === "characteristic") return "Характеристика";
  return rule?.abilityChoices.find((group) => group.id === key)?.label ?? "Другой выбор";
}

/** Resolve a saved choice id to the same label used in the level-up receipt and history. */
export function choiceValueLabel(key: string, id: string): string {
  if (key === "perk") {
    return perkById(id)?.name ?? "Перк (название недоступно)";
  }
  if (key === "skill" || key === "conduit.domain.skill.2") {
    return ALL_CREATION_SKILLS.includes(id) ? id : "Навык (название недоступно)";
  }
  if (key === "characteristic") {
    return CHARACTERISTICS.find((item) => item.key === id || item.label === id)?.label ?? "Характеристика (название недоступно)";
  }
  const feature = GENERATED_CLASS_FEATURES.find(
    (item) => item.id === canonicalClassFeatureId(id),
  );
  if (feature) return feature.name;
  return (
    ABILITY_COMPENDIUM.find(
      (ability) => ability.id === canonicalAbilityId(id),
    )?.name ?? "Способность (название недоступно)"
  );
}
