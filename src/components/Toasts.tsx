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
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <Icon
            name={toast.tone === "error" ? "warning" : toast.tone === "success" ? "check" : "spark"}
            size={16}
          />
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Скрыть уведомление"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
