import { useLocale } from "../i18n/locale";
import type { SaveStatus } from "../state/AppContext";
import { Icon } from "./Icons";

const saveLabels = (t: (ru: string, en: string) => string): Record<SaveStatus, string> => ({
  idle: t("Черновик", "Draft"),
  pending: t("Есть изменения", "Unsaved changes"),
  saving: t("Сохранение…", "Saving…"),
  saved: t("Сохранено", "Saved"),
  error: t("Не сохранено", "Not saved"),
});

/** Компактный статус сохранения: спиннер, галочка или предупреждение; подробности — в тултипе. */
export function SaveIndicator({
  status,
  error,
}: {
  status: SaveStatus;
  error: string;
}) {
  const { t } = useLocale();
  const label = saveLabels(t)[status];
  return (
    <span
      className={`save-state is-${status}`}
      title={status === "error" ? error || label : label}
      aria-label={label}
      role="status"
    >
      {status === "pending" || status === "saving" ? (
        <span className="save-spinner" />
      ) : status === "saved" ? (
        <Icon name="check" size={14} />
      ) : status === "error" ? (
        <Icon name="warning" size={14} />
      ) : (
        <span className="save-dot" />
      )}
    </span>
  );
}
