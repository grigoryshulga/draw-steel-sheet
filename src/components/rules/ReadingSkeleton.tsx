import { useLocale } from "../../i18n/locale";
import "./ReadingSkeleton.css";

/** Content-shaped placeholder shared by the book, catalog and hero builder. */
export function ReadingSkeleton({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <div className="reading-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label ?? t("Загружаем правила…", "Loading rules…")}</span>
      <div className="reading-skeleton-content" aria-hidden="true">
        <span className="reading-skeleton-heading" />
        <span /><span /><span />
        <div className="reading-skeleton-block"><span /><span /><span /></div>
        <span /><span />
      </div>
    </div>
  );
}
