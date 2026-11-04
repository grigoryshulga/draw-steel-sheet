import type { ReactNode } from "react";
import { Modal } from "./ui";
import "./CardDetailModal.css";

export interface CardDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** Имя карточки в заголовке. */
  title: ReactNode;
  /** Источник под именем: слот, уровень, происхождение. */
  source?: ReactNode;
  /** Чип типа или категории рядом с именем. */
  meta?: ReactNode;
  /** Кнопки в шапке слева от крестика. */
  headerActions?: ReactNode;
  /** Панель рядом с содержимым: бросок способности. */
  sidecar?: ReactNode;
  /** Действия под содержимым. Без пропа футера нет: поп-ап закрывает крестик. */
  footer?: ReactNode;
  wide?: boolean;
  /** Диалог по высоте содержимого: прокручивается страница, а не тело. */
  autoHeight?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Единый поп-ап карточки: имя, источник и чип типа в шапке, содержимое
 * с общим ритмом и действие в футере. Отличается только наполнение —
 * текст правила, карточка способности или разметка листа.
 */
export function CardDetailModal({
  open,
  onClose,
  title,
  source,
  meta,
  headerActions,
  sidecar,
  footer,
  wide = false,
  autoHeight = false,
  className = "",
  children,
}: CardDetailModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide={wide}
      className={`card-detail-modal${autoHeight ? " is-auto" : ""}${
        className ? ` ${className}` : ""
      }`}
      headerActions={headerActions}
      sidecar={sidecar}
      title={
        <span className="card-detail-heading">
          <span className="card-detail-name">{title}</span>
          {source && <span className="card-detail-source">{source}</span>}
          {meta}
        </span>
      }
      footer={footer}
    >
      <div className="card-detail-body">{children}</div>
    </Modal>
  );
}
