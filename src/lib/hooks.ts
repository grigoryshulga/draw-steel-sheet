import { useCallback, useEffect, useState, type RefObject } from "react";

export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref, onOutside, active]);
}

export function useHashTab(
  fallback: string,
  allowed: readonly string[],
): [string, (tab: string) => void] {
  const read = useCallback(() => {
    const value = window.location.hash.replace(/^#\/?/, "").split('/')[0];
    return allowed.includes(value) ? value : fallback;
  }, [allowed, fallback]);

  const [tab, setTabState] = useState(read);

  useEffect(() => {
    const onHash = () => setTabState(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [read]);

  const setTab = useCallback((next: string) => {
    const safe = allowed.includes(next) ? next : fallback;
    setTabState(safe);
    const hash = `#/${safe}`;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }, [allowed, fallback]);

  return [tab, setTab];
}
