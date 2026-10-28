import { useEffect } from "react";
import { Button } from "../../components/ui";
import { Icon } from "../../components/Icons";
import type { RollConfig, RollEntry } from "../../lib/roll";
import { PowerRollPanel } from "./PowerRollPanel";
import "./SheetFabs.css";
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
    <>
      {open && (
        <section
          className="sheet-fab-popover roll-popover"
          role="dialog"
          aria-label="Бросок силы"
        >
          <header className="sheet-fab-popover-head">
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
          <div className="sheet-fab-popover-body">
            <PowerRollPanel onRoll={onRoll} lastRoll={lastRoll} log={log} />
          </div>
        </section>
      )}
      <button
        type="button"
        className={`sheet-fab${open ? " is-open" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-label="Бросок силы"
        title="Бросок силы"
      >
        <Icon name={open ? "close" : "dice"} size={24} />
      </button>
    </>
  );
}
