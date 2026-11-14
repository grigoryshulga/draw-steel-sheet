import type { Character } from "../types";
import { currentRuntime, withoutFuryTurn } from "./runtime";

/** Счётчик ресурса и максимум хода — разные числа: расход не снимает уже полученные преимущества. */
export function currentFerocity(character: Character): number {
  const value = character.heroicResource.current;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function growingFerocityValue(character: Character): number {
  const current = currentFerocity(character);
  if (character.className !== "Неистовый") return current;
  const turn = currentRuntime(character).furyTurn;
  return turn?.active ? Math.max(current, turn.peak) : current;
}

/** Наблюдает обычную правку ресурса. Явная замена runtime (в том числе отмена) имеет приоритет. */
export function trackFuryTurn(previous: Character, next: Character): Character {
  const turn = next.runtime?.furyTurn;
  if (!turn) return next;
  if (next.className !== "Неистовый") return { ...next, runtime: withoutFuryTurn(currentRuntime(next)) };
  if (!turn.active || previous.runtime?.furyTurn !== turn) return next;
  const peak = Math.max(turn.peak, currentFerocity(previous), currentFerocity(next));
  if (peak === turn.peak) return next;
  return { ...next, runtime: { ...currentRuntime(next), furyTurn: { active: true, peak } } };
}
