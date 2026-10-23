import type { SaveStatus } from "../state/AppContext";
import { Icon } from "./Icons";

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "Черновик",
  pending: "Есть изменения",
  saving: "Сохранение…",
  saved: "Сохранено",
  error: "Не сохранено",
};

/** Компактный статус сохранения: спиннер, галочка или предупреждение; подробности — в тултипе. */
export function SaveIndicator({
  status,
  error,
}: {
  status: SaveStatus;
  error: string;
}) {
  const label = SAVE_LABEL[status];
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
