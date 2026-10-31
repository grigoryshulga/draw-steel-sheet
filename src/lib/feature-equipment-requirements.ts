import { CONDUIT_BASE_MECHANICS } from "../data/class-features/mechanics/conduit-base";
import type { FeatureEquipmentFlags } from "../types";
import { resolveConduitFeatureChoice } from "./class-features";

const conduitSoldierPrayer = CONDUIT_BASE_MECHANICS["feature.conduit.level-1.prayer-of-soldiers-skill"];
const talentBattleIds = new Set(["talent.augmentation.battle", "Боевая аугментация"]);
const elementalistBattleIds = new Set(["elementalist.enchantment.battle", "Зачарование битвы"]);

function selectedValueMatches(value: unknown, values: Set<string>): boolean {
  return typeof value === "string" && value.split(",").some((part) => values.has(part.trim()));
}

/** Returns only equipment flags required by the currently selected feature. */
export function featureEquipmentRequirements(
  className: string,
  selections: Record<string, unknown> = {},
): FeatureEquipmentFlags | undefined {
  const prayer = selections["conduit.prayer"];
  const soldier = className === "Проводник" && typeof prayer === "string" &&
    resolveConduitFeatureChoice("conduit.prayer", prayer)?.legacyId === "conduit.prayer.soldier";
  const talent = className === "Талант" && selectedValueMatches(selections["talent.augmentation"], talentBattleIds);
  const elementalist = className === "Элементалист" && selectedValueMatches(selections["elementalist.enchantment"], elementalistBattleIds);
  const hasRequirements = [talent, elementalist].some(Boolean) ||
    (soldier && conduitSoldierPrayer.effects?.some((effect) => effect.kind === "field" && effect.when?.equipment));
  return hasRequirements ? { lightArmor: true, lightWeapon: true } : undefined;
}
