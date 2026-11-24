import type { CalculationBreakdown } from "../lib/calculation-breakdown";

const labels: Record<string, string> = {
  "Мощь": "Might", "Ловкость": "Agility", "Разум": "Reason", "Интуиция": "Intuition", "Присутствие": "Presence",
  "Урон": "Damage", "Ближний бой": "Melee", "Дальний бой": "Ranged", "Базовый урон": "Base damage", "Базовый урон без комплекта": "Base damage without kit",
  "Кубики урона": "Damage dice", "Общий модификатор урона": "Damage modifier", "Бонус способности": "Ability bonus", "Поправка к этому броску": "Roll adjustment", "Преимущество": "Edge", "Помеха": "Bane",
};
const notes: Record<string, string> = {
  "Преимущества, помехи и поправки к отдельному броску задаются в окне броска.": "Edges, banes, and roll-specific adjustments are set in the roll dialog.",
  "Печатная формула уже включает бонус исходного комплекта. Он вычтен из базы, чтобы применить выбранный профиль один раз.": "The printed formula includes the original kit bonus. It is removed from the base so the selected profile is applied once.",
};

/** Annotate the view model without changing the evaluator's public breakdowns. */
export function englishCalculation(calculation: CalculationBreakdown): CalculationBreakdown {
  return {
    ...calculation,
    englishLabel: labels[calculation.label] ?? calculation.label,
    englishNote: calculation.note ? notes[calculation.note] ?? calculation.note : undefined,
    terms: calculation.terms.map(term => ({
      ...term,
      englishLabel: term.englishLabel ?? labels[term.label] ?? term.label,
    })),
  };
}
