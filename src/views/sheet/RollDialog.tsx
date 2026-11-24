import { useLocale } from "../../i18n/locale";
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
  const { t } = useLocale();
  return (
    <>
      <Button
        size="sm"
        variant="soft"
        icon="dice"
        iconOnly
        aria-label={open ? t("Закрыть бросок силы", "Close power roll") : t("Открыть бросок силы", "Open power roll")}
        title={open ? t("Закрыть бросок силы", "Close power roll") : t("Открыть бросок силы", "Open power roll")}
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <Modal open={open} onClose={onClose} title={t("Бросок силы", "Power Roll")}>
        <PowerRollPanel onRoll={onRoll} lastRoll={lastRoll} log={log} />
      </Modal>
    </>
  );
}
