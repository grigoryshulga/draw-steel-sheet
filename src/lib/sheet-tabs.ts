/**
 * Переключение вкладок листа из разных панелей.
 *
 * Вкладка «Развитие» живёт внутри SheetView, а открыть её нужно и из
 * панели «Развитие» боковой колонки. Общий контекст ради одной вкладки
 * тяжеловат, поэтому панели просят переключение событием.
 */
export type SheetTab = "sheet" | "development";

const SWITCH_EVENT = "draw-steel:sheet-tab";

/** Попросить лист открыть вкладку. */
export function openSheetTab(tab: SheetTab): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SheetTab>(SWITCH_EVENT, { detail: tab }));
}

/** Подписка на такие просьбы: возвращает функцию отписки. */
export function onSheetTabRequest(
  listener: (tab: SheetTab) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<SheetTab>).detail;
    if (detail === "sheet" || detail === "development") listener(detail);
  };
  window.addEventListener(SWITCH_EVENT, handler);
  return () => window.removeEventListener(SWITCH_EVENT, handler);
}
