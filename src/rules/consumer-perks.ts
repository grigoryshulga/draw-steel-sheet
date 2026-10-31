import perksJson from "../generated/consumers/perks.json";
import type {
  ConsumerPerk,
  ConsumerPerkProjection,
  PerkType,
} from "./consumer-data";

/**
 * Перки, типы перков карьер и ограничения классовых перков из канонических
 * статей глав 06/08/10. Единственный потребитель
 * `generated/consumers/perks.json`; контракт `src/data/perks.ts` остаётся
 * прежним.
 */
const projection = perksJson as ConsumerPerkProjection;

export const CANONICAL_PERKS: ConsumerPerk[] = projection.perks;
export const CANONICAL_CAREER_PERK_TYPES: Record<string, PerkType> =
  projection.careerPerkTypes;
export const CANONICAL_CLASS_PERK_RESTRICTIONS: Record<
  string,
  Record<string, PerkType[]>
> = projection.classPerkRestrictions;
