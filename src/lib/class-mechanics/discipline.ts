import type { Character } from "../../types";

/** Pure threshold lookup shared with conditions; deliberately has no mechanics imports. */
export function heldDiscipline(character: Character): number {
  const peak = character.classMechanics?.null?.peakDiscipline;
  return Math.max(
    character.heroicResource.current,
    typeof peak === "number" && Number.isFinite(peak) ? peak : 0,
  );
}
