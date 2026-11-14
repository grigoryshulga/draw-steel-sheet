import { kitByName } from "../data/kits";
import type { Character } from "../types";
import { activeClassFeatures } from "./class-features";
import { featureConditionMet } from "./feature-conditions";
import { currentFerocity, growingFerocityValue } from "./fury-turn";
import { currentRuntime } from "./runtime";

export interface FerocityRow {
  id: string;
  threshold: number;
  level: number;
  description: string;
  available: boolean;
  active: boolean;
  retained: boolean;
  replacedBy?: number;
}

export interface GrowingFerocityState {
  source: string;
  current: number;
  effective: number;
  turnActive: boolean;
  rows: FerocityRow[];
  missing?: "aspect" | "kit";
}

/** Памятка и расчёты используют те же особенности выбранного аспекта/комплекта. */
export function growingFerocityState(character: Character): GrowingFerocityState | undefined {
  if (character.className !== "Неистовый") return undefined;
  const current = currentFerocity(character);
  const effective = growingFerocityValue(character);
  const turnActive = currentRuntime(character).furyTurn?.active === true;
  const stormwight = featureConditionMet(character, { keyValue: ["Буревестник"] });
  const kit = kitByName(character.kit);
  const aspect = ["Берсерк", "Разоритель"].find((value) => featureConditionMet(character, { keyValue: [value] })) ?? "";
  const source = stormwight && kit?.familyId === "kit.stormwight"
    ? `${kit.name} · ${kit.animalForm}`
    : stormwight ? "Буревестник" : aspect;
  const rows = activeClassFeatures({ ...character, level: 10 }).flatMap((feature): FerocityRow[] => {
    const threshold = feature.mechanics?.when?.resourceAtLeast;
    if (!feature.id.includes("growing-ferocity") || threshold?.name !== "Свирепость") return [];
    const available = feature.level <= character.level;
    const active = available && threshold.value <= effective;
    return [{ id: feature.id, threshold: threshold.value, level: feature.level, description: feature.description,
      available, active, retained: active && threshold.value > current }];
  }).sort((a, b) => a.threshold - b.threshold);
  for (const row of rows) {
    const replacement = row.threshold === 4 ? 8 : row.threshold === 6 ? 10 : undefined;
    if (replacement && rows.some((other) => other.threshold === replacement && other.active)) row.replacedBy = replacement;
  }
  return { source, current, effective, turnActive, rows,
    ...(rows.length ? {} : { missing: stormwight ? "kit" : "aspect" }) };
}
