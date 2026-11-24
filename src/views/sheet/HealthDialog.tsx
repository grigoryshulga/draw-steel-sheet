import { useLocale } from "../../i18n/locale";
import { Modal } from "../../components/ui";
import { HealthControls, RecoveriesReadout } from "./HealthControls";
import "./HealthDialog.css";

/** Мобильный вход: те же мгновенные контролы, закрывается после действия. */
export function HealthDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  return (
    <Modal open onClose={onClose} title={t("Здоровье", "Health")} className="health-dialog">
      <RecoveriesReadout />
      <HealthControls onDone={onClose} />
    </Modal>
  );
}
