import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { lockModalScroll } from "./modal-scroll-lock";

/* ---------- Modal ---------- */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Кнопки в шапке слева от крестика. */
  headerActions?: ReactNode;
  wide?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  headerActions,
  wide = false,
  className = "",
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    if (!dialogRef.current?.contains(document.activeElement))
      focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (
        Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !==
        dialogRef.current
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !dialogRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const unlockScroll = lockModalScroll(document.body);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={`modal ${wide ? "modal-wide" : ""} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <div className="modal-head-actions">
            {headerActions}
            <Button
              variant="ghost"
              icon="close"
              iconOnly
              aria-label="Закрыть"
              onClick={onClose}
            />
          </div>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
