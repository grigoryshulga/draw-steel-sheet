import type { ReactNode } from "react";

/* ---------- Chips / tags ---------- */

export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: "default" | "accent" | "red" | "green" | "yellow" | "blue" | "magenta";
  title?: string;
  className?: string;
}

export function Chip({
  active = false,
  onClick,
  children,
  tone = "default",
  title,
  className = "",
}: ChipProps) {
  if (!onClick) {
    return (
      <span
        className={`chip chip-static chip-${tone} ${className}`.trim()}
        title={title}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`chip chip-${tone} ${active ? "is-active" : ""} ${className}`.trim()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
