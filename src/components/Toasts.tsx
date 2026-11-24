import { useLocale } from "../i18n/locale";
import { Icon } from "./Icons";

export interface ToastMessage {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  const { t } = useLocale();
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.tone}${index < toasts.length - 1 ? " is-previous" : ""}`}
        >
          <Icon
            name={
              toast.tone === "error"
                ? "warning"
                : toast.tone === "success"
                  ? "check"
                  : "spark"
            }
            size={16}
          />
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label={t("Скрыть уведомление", "Dismiss notification")}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
