/** Draw Steel echelons start at levels 1/4/7/10 and cap at four. */
export function echelon(level: number): number {
  if (!Number.isFinite(level)) return 1;
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel >= 10) return 4;
  if (safeLevel >= 7) return 3;
  if (safeLevel >= 4) return 2;
  return 1;
}
