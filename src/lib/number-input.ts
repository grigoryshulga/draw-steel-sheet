export function parseNumberInputDraft(draft: string): number | null {
  const trimmed = draft.trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "." ||
    trimmed === "-."
  ) {
    return null;
  }
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function normalizeNumberInput(
  value: number | null,
  current: number,
  min?: number,
  max?: number,
): number {
  let next = value ?? current;
  if (!Number.isFinite(next)) next = current;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}
