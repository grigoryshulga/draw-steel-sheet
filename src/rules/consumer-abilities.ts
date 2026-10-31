import abilitiesJson from "../generated/consumers/abilities.json";
import type { CompendiumAbility } from "../types";
import {
  withPreferredCharacteristic,
  type ConsumerAbilityProjection,
} from "./consumer-data";

/**
 * Каталог способностей из канонических сущностей. Единственный потребитель
 * `generated/consumers/abilities.json`: импорт этого модуля не подтягивает
 * статьи каталога и глоссария.
 */
const projection = abilitiesJson as ConsumerAbilityProjection;

export const CANONICAL_ABILITY_COMPENDIUM: CompendiumAbility[] =
  projection.abilities.map(withPreferredCharacteristic);
