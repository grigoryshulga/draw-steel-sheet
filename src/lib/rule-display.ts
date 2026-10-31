import type { CharacteristicKey } from "../types";

// Lightweight labels shared by reference reading and character calculations.
export const CHARACTERISTICS: {
  key: CharacteristicKey;
  short: string;
  label: string;
  testLabel: string;
}[] = [
  { key: "might", short: "М", label: "Мощь", testLabel: "Мощи" },
  { key: "agility", short: "Л", label: "Ловкость", testLabel: "Ловкости" },
  { key: "reason", short: "Р", label: "Разум", testLabel: "Разума" },
  { key: "intuition", short: "И", label: "Интуиция", testLabel: "Интуиции" },
  {
    key: "presence",
    short: "П",
    label: "Присутствие",
    testLabel: "Присутствия",
  },
];

export function characteristicShort(key: CharacteristicKey): string {
  return CHARACTERISTICS.find((c) => c.key === key)?.short ?? key;
}

export type Tier = 1 | 2 | 3;

/** Диапазоны суммы броска силы для тиров. */
export const TIER_ROLL_RANGES: Record<Tier, string> = {
  1: "≤ 11",
  2: "12–16",
  3: "17+",
};

export const BASIC_ABILITY_SOURCE = "Базовые способности";
