import { Modal } from "../../components/ui";
import { HealthControls, RecoveriesReadout } from "./HealthControls";
import "./HealthDialog.css";

/** Мобильный вход: те же мгновенные контролы, закрывается после действия. */
export function HealthDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Здоровье" className="health-dialog">
      <RecoveriesReadout />
      <HealthControls onDone={onClose} />
    </Modal>
  );
}
