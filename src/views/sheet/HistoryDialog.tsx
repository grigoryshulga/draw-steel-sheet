import { useState } from "react";
import { Button, Modal } from "../../components/ui";
import { useApp } from "../../state/AppContext";
import { GameHistory } from "./GameHistory";

/**
 * Журнал действий и отмена из панели листа.
 */
export function HistoryDialog() {
  const { gameHistory } = useApp();
  const [open, setOpen] = useState(false);
  const activeCount = gameHistory.filter((entry) => !entry.undone).length;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon="history"
        iconOnly
        aria-label={`Открыть историю действий${activeCount > 0 ? `, записей: ${activeCount}` : ""}`}
        title={`История действий${activeCount > 0 ? ` · ${activeCount}` : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="История и отмена"
      >
        <GameHistory turnControls />
      </Modal>
    </>
  );
}
