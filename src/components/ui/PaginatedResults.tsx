import { useLocale } from "../../i18n/locale";
import { useId, useRef, useState, type ReactNode } from "react";
import { pageBounds, RESULTS_PAGE_SIZE } from "../../lib/pagination";
import { Button } from "./Button";
import "./PaginatedResults.css";

/** Give this component a key derived from the filters to restart at page one. */
export function PaginatedResults<T>({
  items,
  initialIndex = 0,
  label: suppliedLabel,
  children,
}: {
  items: readonly T[];
  initialIndex?: number;
  label?: string;
  children: (visible: readonly T[]) => ReactNode;
}) {
  const { t, locale } = useLocale();
  const label = suppliedLabel ?? t("Результаты", "Results");
  const [requestedPage, setPage] = useState(() => Math.floor(Math.max(0, initialIndex) / RESULTS_PAGE_SIZE));
  const { page, pageCount, start, end } = pageBounds(items.length, requestedPage);
  const resultsId = useId();
  const results = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    setPage(next);
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: "start" });
  };
  return (
    <div className="paginated-results">
      <div
        ref={results}
        id={resultsId}
        tabIndex={-1}
        className="paginated-results-page"
        role="region"
        aria-label={items.length ? `${label}: ${start + 1}–${end} ${t("из", "of")} ${items.length}` : `${label}: ${t("пусто", "empty")}`}
      >
        {children(items.slice(start, end))}
      </div>
      {pageCount > 1 && (
        <nav className="results-pagination" aria-label={`${t("Страницы", "Pages")}: ${label.toLocaleLowerCase(locale)}`}>
          <Button
            size="sm"
            icon="arrow-left"
            iconOnly
            aria-label={t("Предыдущая страница", "Previous page")}
            aria-controls={resultsId}
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
          />
          <span role="status" aria-live="polite" aria-atomic="true">{page + 1} / {pageCount}</span>
          <Button
            size="sm"
            icon="arrow-right"
            iconOnly
            aria-label={t("Следующая страница", "Next page")}
            aria-controls={resultsId}
            disabled={page === pageCount - 1}
            onClick={() => changePage(page + 1)}
          />
        </nav>
      )}
    </div>
  );
}
