import type { AncestryFeatureMechanics } from "../types";
import { ANCESTRY_ABILITY_MECHANICS } from "./abilities";

/**
 * Реестр механик происхождений: ключ — `id` записи скелета из канонической
 * проекции `generated/consumers/features.json`. Объект изменяемый — тесты
 * подмешивают записи и убирают их после себя.
 */
export const ANCESTRY_FEATURE_MECHANICS: Record<
  string,
  AncestryFeatureMechanics
> = {
  ...ANCESTRY_ABILITY_MECHANICS,
};

/** Механика черты или `undefined`, если она пока описана только прозой. */
export function ancestryMechanicsFor(
  id: string,
): AncestryFeatureMechanics | undefined {
  return ANCESTRY_FEATURE_MECHANICS[id];
}

export { ANCESTRY_ABILITY_MECHANICS };
