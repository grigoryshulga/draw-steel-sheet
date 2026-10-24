import { classPreset } from "../data/classes";
import {
  CHARACTERISTIC_KEYS,
  type Character,
  type CharacteristicKey,
} from "../types";

export interface CharacteristicArray {
  id: string;
  label: string;
  description: string;
  values: number[];
}

const TWO_PRIMARY_ARRAYS: CharacteristicArray[] = [
  { id: "two-primary-2-minus1", label: "2, −1, −1", description: "Одна высокая характеристика, две низкие", values: [2, -1, -1] },
  { id: "two-primary-1-1-minus1", label: "1, 1, −1", description: "Две усиленные характеристики, одна низкая", values: [1, 1, -1] },
  { id: "two-primary-1-0-0", label: "1, 0, 0", description: "Одна усиленная характеристика без штрафов", values: [1, 0, 0] },
];

const ONE_PRIMARY_ARRAYS: CharacteristicArray[] = [
  { id: "one-primary-2-2-minus1-minus1", label: "2, 2, −1, −1", description: "Две высокие характеристики и два штрафа", values: [2, 2, -1, -1] },
  { id: "one-primary-2-1-1-minus1", label: "2, 1, 1, −1", description: "Одна высокая и две усиленные характеристики, один штраф", values: [2, 1, 1, -1] },
  { id: "one-primary-2-1-0-0", label: "2, 1, 0, 0", description: "Высокая и усиленная характеристики без штрафов", values: [2, 1, 0, 0] },
  { id: "one-primary-1-1-1-0", label: "1, 1, 1, 0", description: "Три усиленные характеристики без штрафов", values: [1, 1, 1, 0] },
];

const ZERO_CHARACTERISTICS: Character["characteristics"] = {
  might: 0,
  agility: 0,
  reason: 0,
  intuition: 0,
  presence: 0,
};

function allocationShape(className: string) {
  const preset = classPreset(className);
  if (!preset) return undefined;
  const fixed = Object.fromEntries(
    Object.entries(preset.starting).filter(([, value]) => value !== undefined),
  ) as Partial<Record<CharacteristicKey, number>>;
  const free = CHARACTERISTIC_KEYS.filter((key) => !(key in fixed));
  const arrays = Object.keys(fixed).length === 1 ? ONE_PRIMARY_ARRAYS : TWO_PRIMARY_ARRAYS;
  return { fixed, free, arrays };
}

export function characteristicArrays(className: string): CharacteristicArray[] {
  return allocationShape(className)?.arrays.map((array) => ({
    ...array,
    values: [...array.values],
  })) ?? [];
}

export function allocateCharacteristicArray(
  className: string,
  arrayId: string,
  current?: Character["characteristics"],
): Character["characteristics"] {
  const shape = allocationShape(className);
  const array = shape?.arrays.find((candidate) => candidate.id === arrayId);
  if (!shape || !array) return current ? { ...current } : { ...ZERO_CHARACTERISTICS };

  const result = { ...ZERO_CHARACTERISTICS, ...shape.fixed };
  shape.free.forEach((key, index) => {
    result[key] = array.values[index] ?? 0;
  });
  return result;
}

export function assignCharacteristicValue(
  className: string,
  current: Character["characteristics"],
  key: CharacteristicKey,
  value: number,
): Character["characteristics"] {
  const shape = allocationShape(className);
  if (
    !shape ||
    !isValidCharacteristicAllocation(className, current) ||
    !shape.free.includes(key) ||
    current[key] === value
  ) return { ...current };
  const swapKey = shape.free.find((candidate) => candidate !== key && current[candidate] === value);
  if (!swapKey) return { ...current };
  return { ...current, [key]: value, [swapKey]: current[key] };
}

export function isValidCharacteristicAllocation(
  className: string,
  value: Character["characteristics"],
): boolean {
  const shape = allocationShape(className);
  if (!shape) return false;
  if (Object.entries(shape.fixed).some(([key, expected]) => value[key as CharacteristicKey] !== expected)) return false;
  const freeValues = shape.free.map((key) => value[key]).sort((a, b) => b - a);
  return shape.arrays.some((array) => array.values.every((entry, index) => freeValues[index] === entry));
}
