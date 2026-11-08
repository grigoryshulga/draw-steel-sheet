import { useEffect, useState } from "react";
import { clearReadingHistory, readReadingHistory, rememberArticle } from "../../lib/reading-history";

const CHANGE_EVENT = "reading-history-change";

/** Pass an ID only after the article has loaded successfully. */
export function useReadingHistory(articleId?: string) {
  const [recentIds, setRecentIds] = useState(readReadingHistory);
  useEffect(() => {
    const sync = () => setRecentIds(readReadingHistory());
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);
  useEffect(() => {
    if (!articleId) return;
    const ids = rememberArticle(articleId);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setRecentIds(ids);
  }, [articleId]);
  return {
    recentIds,
    clearHistory: () => {
      clearReadingHistory();
      window.dispatchEvent(new Event(CHANGE_EVENT));
      setRecentIds([]);
    },
  };
}
