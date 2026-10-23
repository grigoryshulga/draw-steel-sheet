import { Modal } from "../../components/ui";
import type { RollConfig, RollEntry } from "../../lib/roll";
import { PowerRollPanel } from "./PowerRollPanel";
import "./RollDialog.css";

export function RollDialog({
  open,
  onClose,
  onRoll,
  lastRoll,
  log,
}: {
  open: boolean;
  onClose: () => void;
  onRoll: (config: RollConfig) => void;
  lastRoll: RollEntry | null;
  log: RollEntry[];
}) {
  return (
    <Modal open={open} onClose={onClose} wide title="Бросок силы">
      <PowerRollPanel onRoll={onRoll} lastRoll={lastRoll} log={log} />
    </Modal>
  );
}
