import raw from "./abilities.generated.json";
import type { CompendiumAbility } from "../types";
import type { AbilityWithPreferred } from "../lib/abilities";

type RawCompendiumAbility = Omit<CompendiumAbility, "preferredCharacteristic"> &
  Pick<AbilityWithPreferred, "preferredCharacteristic">;

export const ABILITY_COMPENDIUM: CompendiumAbility[] = (raw as RawCompendiumAbility[]).map(
  (entry) => ({
    ...entry,
    preferredCharacteristic:
      entry.preferredCharacteristic &&
      entry.rollCharacteristics.includes(entry.preferredCharacteristic)
        ? entry.preferredCharacteristic
        : (entry.rollCharacteristics[0] ?? ""),
  }),
);
