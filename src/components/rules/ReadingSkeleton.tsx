import "./ReadingSkeleton.css";

/** Content-shaped placeholder shared by the book, catalog and hero builder. */
export function ReadingSkeleton({ label = "Загружаем правила…" }: { label?: string }) {
  return (
    <div className="reading-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="reading-skeleton-content" aria-hidden="true">
        <span className="reading-skeleton-heading" />
        <span /><span /><span />
        <div className="reading-skeleton-block"><span /><span /><span /></div>
        <span /><span />
      </div>
    </div>
  );
}
