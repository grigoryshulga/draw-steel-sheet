import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./HelpTooltip.css";

interface HelpTooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function HelpTooltip({ label, children, className }: HelpTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const open = (pinned || hovered || focused) && !dismissed;

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleHoverClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setHovered(false), 120);
  };

  useLayoutEffect(() => {
    if (!open) return;

    const positionPopup = () => {
      const trigger = triggerRef.current;
      const popup = popupRef.current;
      if (!trigger || !popup) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const margin = 16;
      const left = Math.min(
        Math.max(margin, triggerRect.left + triggerRect.width / 2 - popupRect.width / 2),
        window.innerWidth - popupRect.width - margin,
      );
      const below = window.innerHeight - triggerRect.bottom;
      const preferredTop = below < popupRect.height + 8
        ? Math.max(margin, triggerRect.top - popupRect.height - 8)
        : triggerRect.bottom + 8;
      const top = Math.min(
        Math.max(margin, preferredTop),
        window.innerHeight - popupRect.height - margin,
      );

      setPosition({ left, top });
    };

    positionPopup();
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const dismiss = () => {
      setPinned(false);
      setHovered(false);
      setDismissed(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        dismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => () => clearCloseTimer(), []);

  const popup = open && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popupRef}
          id={tooltipId}
          className="help-tooltip-popup"
          role="tooltip"
          style={{ left: position.left, top: position.top }}
          onMouseEnter={() => {
            clearCloseTimer();
            setHovered(true);
          }}
          onMouseLeave={scheduleHoverClose}
        >
          {children}
        </div>,
        document.body,
      )
    : null;

  return (
    <span className={`help-tooltip${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="help-tooltip-trigger"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => {
          clearCloseTimer();
          setDismissed(false);
          setHovered(true);
        }}
        onMouseLeave={scheduleHoverClose}
        onFocus={() => {
          setDismissed(false);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          setDismissed(false);
        }}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setHovered(false);
            setDismissed(true);
          } else {
            setDismissed(false);
            setPinned(true);
          }
        }}
      >
        ?
      </button>
      {popup}
    </span>
  );
}
