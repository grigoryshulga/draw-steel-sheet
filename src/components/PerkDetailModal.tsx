import type { ReactNode } from "react";
import { PERK_TYPE_META } from "../data/perks";
import { RichText } from "./RichText";
import { Button, Chip, Modal } from "./ui";
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
      title="Перк"
      footer={
        <>
          {action}
          {action && <span className="grow" />}
          <Button variant="primary" onClick={onClose}>
            Закрыть
          </Button>
        </>
      }
    >
      <div className="perk-detail-modal">
        <div className="hstack wrap">
          {meta && <Chip tone={meta.tone}>{meta.label}</Chip>}
          {eyebrow && <span className="small muted">{eyebrow}</span>}
        </div>
        <h3>{name}</h3>
        {summary && <p className="perk-detail-summary">{summary}</p>}
        {description ? (
          <RichText text={description} />
        ) : (
          <p className="muted">Полное описание этого перка недоступно.</p>
        )}
      </div>
    </Modal>
  );
}
