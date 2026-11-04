import { useCallback, useEffect, useState } from "react";

/**
 * Закладки Кодекса — единые для «Читать» и «Справочника». Источник истины —
 * localStorage; представления синхронизируются событием, поэтому закладка,
 * поставленная на лендинге класса, сразу видна в списке закладок читалки.
 */
const STORAGE_KEY = "ds-codex-bookmarks";
const CHANGE_EVENT = "codex-bookmarks-change";

export function readCodexBookmarks(): string[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]",
    );
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeCodexBookmarks(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* storage can be unavailable */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useCodexBookmarks(): {
  bookmarks: string[];
  toggleBookmark: (id: string) => void;
} {
  const [bookmarks, setBookmarks] = useState<string[]>(readCodexBookmarks);

  useEffect(() => {
    const sync = () => setBookmarks(readCodexBookmarks());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    const current = readCodexBookmarks();
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    writeCodexBookmarks(next);
    setBookmarks(next);
  }, []);

  return { bookmarks, toggleBookmark };
}
