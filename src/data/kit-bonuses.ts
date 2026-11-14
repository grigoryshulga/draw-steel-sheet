/** Подписи бонусов не зависят от загрузки справочника комплектов. */
const BONUS_LABELS: Record<string, string> = {
  "выносливости": "Выносливость",
  "скорости": "Скорость",
  "устойчивости": "Устойчивость",
  "отходу": "Отход",
  "урону (Ближний)": "Урон (Ближний)",
  "урону (Дальний)": "Урон (Дальний)",
  "расстоянию (Ближний)": "Дистанция (Ближний)",
  "расстоянию (Дальний)": "Дистанция (Дальний)",
};

export function kitBonusLabel(label: string): string {
  const cleaned = label.trim();
  return BONUS_LABELS[cleaned] ?? cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
