import type { Character, DamageTrait } from "../types";
import { featureDamageImmunities } from "./feature-modifiers";

/** Одна строка на листе: ручная запись или иммунитет активной особенности. */
export interface SheetDamageTrait extends DamageTrait {
  source: string;
  automatic: boolean;
}

/**
 * Строки для панели «Здоровье»: автоматические иммунитеты активных
 * особенностей и ручные записи. Показ не зависит от авторасчёта, но сами
 * числа считает один движок — `featureDamageImmunities`.
 */
export function damageTraitsForSheet(character: Character): SheetDamageTrait[] {
  const automatic: SheetDamageTrait[] = [];
  for (const immunity of featureDamageImmunities(character, {
    includeWhenAutomationOff: true,
  })) {
    for (const type of immunity.types) {
      if (!type.trim()) continue;
      automatic.push({
        id: `feature:${immunity.sourceId}:${immunity.value}:${type}`,
        kind: "immunity",
        type,
        value: immunity.value,
        source: immunity.sourceName,
        automatic: true,
      });
    }
  }
  const manual: SheetDamageTrait[] = (character.damageTraits ?? []).map(
    (trait) => ({
      ...trait,
      source: trait.note?.trim() || "Добавлено вручную",
      automatic: false,
    }),
  );
  // Стабильная сортировка: внутри вида сохраняется порядок движка и добавления.
  return [...automatic, ...manual].sort((left, right) =>
    left.kind === right.kind ? 0 : left.kind === "immunity" ? -1 : 1,
  );
}
