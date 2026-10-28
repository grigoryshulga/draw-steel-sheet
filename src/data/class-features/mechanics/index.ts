import type { FeatureMechanics } from "../types";
import { FURY_MECHANICS } from "./fury";
import { CENSOR_BASE_MECHANICS } from "./censor-base";
import { CENSOR_DOMAIN_MECHANICS } from "./censor-domains";
import { CENSOR_LEVEL_MECHANICS } from "./censor-levels";
import { CENSOR_ORDER_MECHANICS } from "./censor-orders";
import { CONDUIT_BASE_MECHANICS } from "./conduit-base";
import { CONDUIT_DOMAIN_MECHANICS, CONDUIT_DOMAIN_PRAYERS } from "./conduit-domains";
import { CONDUIT_LEVEL_MECHANICS } from "./conduit-levels";
import { CONDUIT_RESOURCE_MECHANICS } from "./conduit-resource";

/**
 * Реестр механик классовых особенностей: ключ — `id` записи скелета.
 * Объект изменяемый — тесты подмешивают записи и убирают их после себя.
 * Наполняется по классам: записи классов вливаются сюда через спред.
 */
export const FEATURE_MECHANICS: Record<string, FeatureMechanics> = {
  ...FURY_MECHANICS,
  ...CENSOR_BASE_MECHANICS,
  ...CENSOR_DOMAIN_MECHANICS,
  ...CENSOR_LEVEL_MECHANICS,
  ...CENSOR_ORDER_MECHANICS,
  ...CONDUIT_BASE_MECHANICS,
  ...CONDUIT_DOMAIN_MECHANICS,
  ...CONDUIT_DOMAIN_PRAYERS,
  ...CONDUIT_LEVEL_MECHANICS,
  ...CONDUIT_RESOURCE_MECHANICS,
};

/** Механика фичи или `undefined`, если она описана только прозой или ещё не разобрана. */
export function mechanicsFor(id: string): FeatureMechanics | undefined {
  return FEATURE_MECHANICS[id];
}

export { FURY_MECHANICS, FURY_RESOURCE } from "./fury";
export { CENSOR_RESOURCE } from "./censor-resource";
export { CONDUIT_RESOURCE } from "./conduit-resource";
export { NOT_YET, TEXT_ONLY } from "./exceptions";
export type { FeatureMechanics };
