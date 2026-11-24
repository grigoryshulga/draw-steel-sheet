import type { Character, CharacteristicKey } from "../types";
import { featureCharacteristicContributions } from "./feature-modifiers";
import { CHARACTERISTICS } from "./rule-display";

export interface CalculationTerm {
  label: string;
  englishLabel?: string;
  value: number | string;
  kind?: "base";
}

/** Display data shared by cards and roll results; every term belongs to the actual calculation. */
export interface CalculationBreakdown {
  label: string;
  englishLabel?: string;
  englishNote?: string;
  englishFormula?: string;
  formula?: string;
  total: string;
  terms: CalculationTerm[];
  note?: string;
}

export function characteristicTerms(
  character: Character,
  key: CharacteristicKey,
  multiplier = 1,
): CalculationTerm[] {
  const name = CHARACTERISTICS.find((entry) => entry.key === key)?.label ?? key;
  return [
    { label: name, value: character.characteristics[key] * multiplier },
    ...featureCharacteristicContributions(character, key).map((source) => ({
      label: `${source.sourceName} · ${name.toLowerCase()}`,
      value: source.value * multiplier,
    })),
  ];
}
