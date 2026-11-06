import projection from "../generated/consumers/level-up-grants.json";
import type { ConsumerLevelUpRule } from "./consumer-data";

/** Attribution on the sheet only needs grant identity, not full level-up prose. */
export const LEVEL_UP_GRANTS = projection.rules as Pick<ConsumerLevelUpRule,
  "className" | "level" | "grantedAbilities">[];
