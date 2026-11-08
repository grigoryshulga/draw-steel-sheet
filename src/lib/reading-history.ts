const STORAGE_KEY = "ds-reading-history-v1";
const HISTORY_LIMIT = 6;

function uniqueIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, HISTORY_LIMIT)
    : [];
}

/** Only public article IDs are retained; no hero or account data. */
export function readReadingHistory(): string[] {
  try {
    return uniqueIds(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function rememberArticle(id: string): string[] {
  const ids = uniqueIds([id, ...readReadingHistory()]);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Reading remains available with blocked storage or a full quota.
  }
  return ids;
}

export function clearReadingHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The view can still clear its in-memory list.
  }
}
