import type { Character, CharacteristicKey } from "../types";
import { rollPowerRoll, type PowerRollResult } from "./rules";
import { formatBonus } from "./utils";

export interface RollConfig {
  label: string;
  characteristicKey: CharacteristicKey;
  edges: number;
  banes: number;
  bonus: number;
  isMainAction: boolean;
}

export interface RollEntry {
  id: number;
  label: string;
  result: PowerRollResult;
  detail: string;
  at: number;
}


export function createRollEntry(character: Character, config: RollConfig, id: number): RollEntry {
  const characteristic = character.characteristics[config.characteristicKey] ?? 0;
  const result = rollPowerRoll({
    characteristic,
    edges: config.edges,
    banes: config.banes,
    bonus: config.bonus,
    isMainAction: config.isMainAction,
  });
  const parts = [`${result.die1} + ${result.die2} = ${result.natural}`];
  if (characteristic !== 0) parts.push(formatBonus(characteristic));
  if (config.bonus !== 0) parts.push(formatBonus(config.bonus));
  if (result.edgeBonus !== 0) parts.push(formatBonus(result.edgeBonus));

  return {
    id,
    label: config.label,
    result,
    detail: parts.join(" "),
    at: Date.now(),
  };
}
