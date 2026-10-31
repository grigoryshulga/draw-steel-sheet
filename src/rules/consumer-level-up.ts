import levelUpJson from "../generated/consumers/level-up.json";
import type {
  ConsumerLevelUpProjection,
  ConsumerLevelUpRule,
} from "./consumer-data";

/**
 * Правила повышения уровня из статей 08xx. Единственный потребитель
 * `generated/consumers/level-up.json`; `src/data/level-up-rules.ts` сохраняет
 * прежний контракт `LevelUpRule`.
 */
const projection = levelUpJson as ConsumerLevelUpProjection;

export const CANONICAL_LEVEL_UP_RULES: ConsumerLevelUpRule[] = projection.rules;
