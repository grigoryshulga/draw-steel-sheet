import { CONSUMER_CLASS_FEATURES } from "../rules/consumer-features";
import { withPreferredCharacteristic } from "../rules/consumer-data";
import { canonicalAbilityId } from "../data/originals";
import type { Character } from "../types";
import { activeClassFeatures } from "./class-features";
import { normalizeFeatureText } from "./utils";

const cardsByFeature = new Map(CONSUMER_CLASS_FEATURES.flatMap((feature) =>
  feature.grantedAbility ? [[feature.id, withPreferredCharacteristic(feature.grantedAbility)] as const] : [],
));

/** Карточки, доступные только пока активна выдавшая их особенность. */
export function classFeatureAbilityEntries(character: Character) {
  return activeClassFeatures(character).flatMap((feature) => {
    const ability = cardsByFeature.get(feature.id);
    return ability ? [{ ability, feature }] : [];
  });
}

/** Старый лист мог уже сохранить эту карточку, в том числе с локальным ID. */
export function missingClassFeatureAbilities(character: Character) {
  return classFeatureAbilityEntries(character)
    .map((entry) => entry.ability)
    .filter((grant) => !character.abilities.some((owned) =>
      canonicalAbilityId(owned.id) === grant.id ||
      (normalizeFeatureText(owned.name ?? "") === normalizeFeatureText(grant.name) &&
        normalizeFeatureText(owned.source ?? "") === normalizeFeatureText(grant.source)),
    ));
}
