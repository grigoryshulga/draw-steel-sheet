import { Button, Modal } from "../../components/ui";
import type { RollConfig, RollEntry } from "../../lib/roll";
import { PowerRollPanel } from "./PowerRollPanel";
import "./RollDialog.css";

/** Бросок из панели листа с управлением фокусом через общий диалог. */
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
  return (
    <>
      <Button
        size="sm"
        variant="soft"
        icon="dice"
        iconOnly
        aria-label={open ? "Закрыть бросок силы" : "Открыть бросок силы"}
        title={open ? "Закрыть бросок силы" : "Открыть бросок силы"}
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <Modal open={open} onClose={onClose} title="Бросок силы">
        <PowerRollPanel onRoll={onRoll} lastRoll={lastRoll} log={log} />
      </Modal>
    </>
  );
}
