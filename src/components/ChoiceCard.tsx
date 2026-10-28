import type { KeyboardEvent, ReactNode } from "react";
import "./ChoiceCard.css";

export interface ChoiceCardProps {
  /** Надпись над заголовком: категория, стоимость или тип. */
  eyebrow?: ReactNode;
  title: string;
  summary?: ReactNode;
  /** Плашка справа: очки, «получено» или другой счётчик. */
  meta?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  /** Заголовок открывает полный текст в поп-апе. */
  onOpen?: () => void;
  children?: ReactNode;
  className?: string;
}

/**
 * Карточка выбора: клик выбирает вариант, заголовок открывает превью.
 * Используется для черт происхождения, инцидентов и подклассов в билдере.
 */
export function ChoiceCard({
  eyebrow,
  title,
  summary,
  meta,
  selected = false,
  disabled = false,
  onSelect,
  onOpen,
  children,
  className = "",
}: ChoiceCardProps) {
  const interactive = Boolean(onSelect || onOpen) && !disabled;
  const onCardClick = disabled ? undefined : (onSelect ?? onOpen);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onCardClick || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCardClick();
    }
  };

  return (
    <article
      className={`choice-card${selected ? " is-selected" : ""}${
        disabled ? " is-disabled" : ""
      }${interactive ? " is-interactive" : ""}${
        className ? ` ${className}` : ""
      }`}
      aria-pressed={onSelect ? selected : undefined}
      {...(onCardClick
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onCardClick,
            onKeyDown,
          }
        : {})}
    >
      {(eyebrow || meta) && (
        <header className="choice-card-head">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {meta && <span className="choice-card-meta">{meta}</span>}
        </header>
      )}
      <h3>
        {onOpen && !disabled ? (
          <button
            type="button"
            className="choice-card-title"
            aria-label={`Открыть: ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            {title}
          </button>
        ) : (
          title
        )}
      </h3>
      {summary && <div className="choice-card-summary">{summary}</div>}
      {children}
    </article>
  );
}
