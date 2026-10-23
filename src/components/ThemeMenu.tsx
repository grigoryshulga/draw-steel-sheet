import { useRef, useState } from "react";
import { useOutsideClick } from "../lib/hooks";
import type { ThemeChoice } from "../lib/theme";
import type { AppTheme } from "../types";
import { Icon } from "./Icons";

export function ThemeMenu({
  themes,
  choice,
  onChoose,
}: {
  themes: AppTheme[];
  choice: ThemeChoice;
  onChoose: (choice: ThemeChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const activeTheme = themes.find((theme) => theme.name === choice.name) ?? themes[0];

  return (
    <div
      className="theme-menu"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-sm theme-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="Цветовая тема"
      >
        <Icon name="palette" size={16} />
        <span className="theme-trigger-name">{activeTheme?.name ?? "Тема"}</span>
        <Icon name="chevron-down" size={13} className="chevron" />
      </button>

      {open && (
        <div className="popover theme-popover" aria-label="Цветовая тема">
          <div className="menu-label">Цветовая схема</div>
          <div className="theme-list">
            {themes.map((theme) => {
              const isActive = choice.name === theme.name;
              return (
                <button
                  key={theme.name}
                  type="button"
                  className={`menu-item ${isActive ? "is-active" : ""}`.trim()}
                  onClick={() => {
                    onChoose({ name: theme.name });
                    setOpen(false);
                  }}
                  aria-pressed={isActive}
                >
                  <span className="theme-swatch-lg" style={{ background: theme.colors.background }}>
                    <span style={{ background: theme.colors.accent }} />
                  </span>
                  <span>{theme.name}</span>
                  <span className="menu-item-meta">{theme.mode === "light" ? "светлая" : "тёмная"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
