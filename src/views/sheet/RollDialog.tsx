import { useEffect } from "react";
import { Button } from "../../components/ui";
import { Icon } from "../../components/Icons";
import type { RollConfig, RollEntry } from "../../lib/roll";
import { PowerRollPanel } from "./PowerRollPanel";
import "./RollDialog.css";

/** Плавающая кнопка броска в правом нижнем углу; по нажатию над ней раскрывается небольшая панель. */
export function RollDialog({
  open,
  onToggle,
  onClose,
  onRoll,
  lastRoll,
  log,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRoll: (config: RollConfig) => void;
  lastRoll: RollEntry | null;
  log: RollEntry[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className="roll-fab-wrap">
      {open && (
        <section
          className="roll-popover"
          role="dialog"
          aria-label="Бросок силы"
        >
          <header className="roll-popover-head">
            <strong>Бросок силы</strong>
            <Button
              variant="ghost"
              size="sm"
              icon="close"
              iconOnly
              aria-label="Закрыть"
              onClick={onClose}
            />
          </header>
          <div className="roll-popover-body">
            <PowerRollPanel onRoll={onRoll} lastRoll={lastRoll} log={log} />
          </div>
        </section>
      )}
      <button
        type="button"
        className={`roll-fab${open ? " is-open" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-label="Бросок силы"
        title="Бросок силы"
      >
        <Icon name={open ? "close" : "dice"} size={24} />
      </button>
    </div>
  );
}
