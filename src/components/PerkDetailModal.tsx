import type { ReactNode } from "react";
import { PERK_TYPE_META } from "../data/perks";
import { RuleText } from "./RuleText";
import { Chip, Modal } from "./ui";
import type { PerkType } from "../types";
import "./PerkDetailModal.css";

export interface PerkDetailModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  type?: PerkType | null;
  /** Подпись слота: «Карьера», «Класс · 2 уровень» и т. п. */
  eyebrow?: string;
  summary?: string;
  description?: string;
  /** Действие конкретного экрана: «Заменить», «Выбрать» и т. п. */
  action?: ReactNode;
}

/**
 * Единый поп-ап перка для листа, редактора героя, «Развития» и билдера.
 * Отличается только одно действие в футере; содержимое всегда одинаковое.
 */
export function PerkDetailModal({
  open,
  onClose,
  name,
  type,
  eyebrow,
  summary,
  description,
  action,
}: PerkDetailModalProps) {
  const meta = type ? PERK_TYPE_META[type] : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="perk-detail-heading">
          <span className="perk-detail-name">{name || "Перк"}</span>
          {eyebrow && <span className="perk-detail-source">{eyebrow}</span>}
          {meta && <Chip tone={meta.tone}>{meta.label}</Chip>}
        </span>
      }
      className="perk-detail-dialog"
      footer={action}
    >
      <div className="perk-detail-modal">
        {description || summary ? (
          <RuleText text={description || summary || ""} />
        ) : (
          <p className="muted">Полное описание этого перка недоступно.</p>
        )}
      </div>
    </Modal>
  );
}
