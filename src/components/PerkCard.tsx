import type { KeyboardEvent, ReactNode } from "react";
import { PERK_TYPE_META } from "../data/perks";
import type { PerkType } from "../types";
import { Chip } from "./ui";
import "./PerkCard.css";

export interface PerkCardProps {
  /** Надпись над названием: слот, источник или «Перк». */
  eyebrow: ReactNode;
  name: string;
  type?: PerkType | null;
  summary?: string;
  /** Карточка участвует в выборе: клик выбирает её. */
  onSelect?: () => void;
  selected?: boolean;
  /** Заголовок открывает полное описание в поп-апе. */
  onOpen?: () => void;
  /** Действия внизу карточки: выбор, изменение, удаление. */
  footerAction?: ReactNode;
  className?: string;
}

/**
 * Карточка перка — один вид и на листе, и в «Развитии».
 * Плоская рамка с верхней линией, название, краткое описание и действия.
 */
export function PerkCard({
  eyebrow,
  name,
  type,
  summary,
  onSelect,
  selected = false,
  onOpen,
  footerAction,
  className = "",
}: PerkCardProps) {
  const meta = type ? PERK_TYPE_META[type] : null;
  const interactive = Boolean(onSelect || onOpen);
  const onCardClick = onSelect ?? onOpen;
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onCardClick || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCardClick();
    }
  };
  return (
    <article
      className={`sheet-perk-card is-filled${selected ? " is-selected" : ""}${
        interactive ? " is-interactive" : ""
      }${className ? ` ${className}` : ""}`}
      data-selected={selected || undefined}
      data-type={type ?? undefined}
      {...(onCardClick
        ? {
            role: "button",
            tabIndex: 0,
            "aria-pressed": onSelect ? selected : undefined,
            onClick: onCardClick,
            onKeyDown,
          }
        : {})}
    >
      <header className="sheet-perk-head">
        <span className="eyebrow">{eyebrow}</span>
        {meta && <Chip tone={meta.tone}>{meta.short}</Chip>}
      </header>
      <h3>
        {onOpen ? (
          <button
            type="button"
            className="sheet-perk-title"
            aria-label={`Открыть перк: ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            {name}
          </button>
        ) : (
          name
        )}
      </h3>
      {summary && <p className="sheet-perk-summary">{summary}</p>}
      {footerAction && (
        <div
          className="sheet-perk-card-actions"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {footerAction}
        </div>
      )}
    </article>
  );
}
