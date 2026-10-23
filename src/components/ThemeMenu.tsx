import { useRef, useState } from "react";
import { useOutsideClick } from "../lib/hooks";
import type { ThemeChoice } from "../lib/theme";
import type { OmarchyTheme } from "../types";
import { Icon } from "./Icons";

export function ThemeMenu({
  themes,
  current,
  choice,
  onChoose,
}: {
  themes: OmarchyTheme[];
  current: string;
  choice: ThemeChoice;
  onChoose: (choice: ThemeChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);

  const activeName = choice.mode === "auto" ? current : choice.name;

  return (
    <div className="theme-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-sm theme-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Тема Omarchy"
      >
        <Icon name="palette" size={16} />
        <span className="theme-trigger-name">{activeName || "Тема"}</span>
        <Icon name="chevron-down" size={13} className="chevron" />
      </button>

      {open && (
        <div className="popover theme-popover" role="menu">
          <button
            type="button"
            className={`menu-item ${choice.mode === "auto" ? "is-active" : ""}`.trim()}
            onClick={() => {
              onChoose({ mode: "auto" });
              setOpen(false);
            }}
            role="menuitemradio"
            aria-checked={choice.mode === "auto"}
          >
            <Icon name="spark" size={16} className="menu-icon" />
            <span>Следовать за Omarchy</span>
            <span className="menu-item-meta">{current || "—"}</span>
          </button>

          <div className="menu-sep" />
          <div className="menu-label">Палитры</div>

          <div className="theme-list">
            {themes.map((theme) => {
              const isActive = choice.mode === "manual" && choice.name === theme.name;
              return (
                <button
                  key={theme.name}
                  type="button"
                  className={`menu-item ${isActive ? "is-active" : ""}`.trim()}
                  onClick={() => {
                    onChoose({ mode: "manual", name: theme.name });
                    setOpen(false);
                  }}
                  role="menuitemradio"
                  aria-checked={isActive}
                >
                  <span
                    className="theme-swatch-lg"
                    style={{ background: theme.colors.background }}
                  >
                    <span style={{ background: theme.colors.accent }} />
                  </span>
                  <span>{theme.name}</span>
                  {theme.name === current && <span className="menu-item-meta">сейчас</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
