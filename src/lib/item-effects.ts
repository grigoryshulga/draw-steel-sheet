import type { ItemEffect } from "../types";

export const ITEM_EFFECT_LABELS: Record<ItemEffect["field"], string> = {
  stamina: "Выносливость", recoveries: "Восстановления", speed: "Скорость",
  stability: "Устойчивость", disengage: "Отход", save: "Спасбросок",
  rolledDamage: "Урон броска", freeStrikeDamage: "Урон свободного удара",
};

/** Accept only bounded, declarative numeric effects from saved or remote data. */
export function normalizeItemEffects(input: unknown): ItemEffect[] {
  if (!Array.isArray(input)) return [];
  return input.filter((entry): entry is ItemEffect =>
    entry !== null && typeof entry === "object" &&
    typeof entry.field === "string" && Object.hasOwn(ITEM_EFFECT_LABELS, entry.field) &&
    typeof entry.value === "number" && Number.isInteger(entry.value) &&
    entry.value >= -100 && entry.value <= 100,
  ).slice(0, 16).map(({ field, value }) => ({ field, value }));
}
