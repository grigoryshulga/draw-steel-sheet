import { useId, useRef, useState, type ReactNode } from "react";
import { pageBounds, RESULTS_PAGE_SIZE } from "../../lib/pagination";
import { Button } from "./Button";
import "./PaginatedResults.css";

/** Give this component a key derived from the filters to restart at page one. */
export function PaginatedResults<T>({
  items,
  initialIndex = 0,
  label = "Результаты",
  children,
}: {
  items: readonly T[];
  initialIndex?: number;
  label?: string;
  children: (visible: readonly T[]) => ReactNode;
}) {
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
        aria-label={items.length ? `${label}: ${start + 1}–${end} из ${items.length}` : `${label}: пусто`}
      >
        {children(items.slice(start, end))}
      </div>
      {pageCount > 1 && (
        <nav className="results-pagination" aria-label={`Страницы: ${label.toLocaleLowerCase("ru")}`}>
          <Button
            size="sm"
            icon="arrow-left"
            iconOnly
            aria-label="Предыдущая страница"
            aria-controls={resultsId}
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
          />
          <span role="status" aria-live="polite" aria-atomic="true">{page + 1} / {pageCount}</span>
          <Button
            size="sm"
            icon="arrow-right"
            iconOnly
            aria-label="Следующая страница"
            aria-controls={resultsId}
            disabled={page === pageCount - 1}
            onClick={() => changePage(page + 1)}
          />
        </nav>
      )}
    </div>
  );
}
