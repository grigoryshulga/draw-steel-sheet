import { useLocale } from "../../i18n/locale";
import { useState } from "react";
import { Button, Modal } from "../../components/ui";
import { useApp } from "../../state/AppContext";
import { GameHistory } from "./GameHistory";

/**
 * Журнал действий и отмена из панели листа.
 */
export function HistoryDialog() {
  const { t } = useLocale();
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
        aria-label={t(`Открыть историю действий${activeCount > 0 ? `, записей: ${activeCount}` : ""}`, `Open action history${activeCount > 0 ? `, ${activeCount} entries` : ""}`)}
        title={t(`История действий${activeCount > 0 ? ` · ${activeCount}` : ""}`, `Action history${activeCount > 0 ? ` · ${activeCount}` : ""}`)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("История и отмена", "History and undo")}
      >
        <GameHistory turnControls />
      </Modal>
    </>
  );
}
