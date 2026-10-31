/** Выбранный вариант поднимается первым, как в шаге класса. */
export function selectedFirst<T>(
  items: readonly T[],
  isSelected: (item: T) => boolean,
): T[] {
  return [...items].sort(
    (a, b) => Number(isSelected(b)) - Number(isSelected(a)),
  );
}
