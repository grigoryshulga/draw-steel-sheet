import { useEffect, useState } from "react";
import { Button } from "../../components/ui";
import { Icon } from "../../components/Icons";
import { useApp } from "../../state/AppContext";
import { GameHistory } from "./GameHistory";
import "./SheetFabs.css";

/**
 * Вторая плавающая кнопка: журнал действий и отмена. Раунд и схватка
 * переехали сюда же — это те же игровые действия, что попадают в историю.
 */
export function HistoryDialog() {
  const { gameHistory } = useApp();
  const [open, setOpen] = useState(false);
  const activeCount = gameHistory.filter((entry) => !entry.undone).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <section
          className="sheet-fab-popover sheet-history-popover"
          role="dialog"
          aria-label="История и отмена"
        >
          <header className="sheet-fab-popover-head">
            <strong>История и отмена</strong>
            <Button
              variant="ghost"
              size="sm"
              icon="close"
              iconOnly
              aria-label="Закрыть"
              onClick={() => setOpen(false)}
            />
          </header>
          <div className="sheet-fab-popover-body">
            <GameHistory turnControls />
          </div>
        </section>
      )}
      <button
        type="button"
        className={`sheet-fab is-secondary${open ? " is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          activeCount > 0
            ? `История и отмена: ${activeCount}`
            : "История и отмена"
        }
        title="История и отмена"
      >
        <Icon name={open ? "close" : "history"} size={22} />
        {!open && activeCount > 0 && (
          <span className="sheet-fab-badge">{activeCount}</span>
        )}
      </button>
    </>
  );
}
