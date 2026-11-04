import type { HTMLAttributes, ReactNode } from "react";
import { useSelectableCard } from "./useSelectableCard";
import "./Card.css";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "onSelect"> {
  selected?: boolean;
  disabled?: boolean;
  /** Клик по карточке выбирает её; состояние уходит в `aria-pressed`. */
  onSelect?: () => void;
  /** Клик по карточке открывает её, если выбора нет. */
  onOpen?: () => void;
  /** Открывать карточку кликом по всей площади, а не только по заголовку. */
  openOnCardClick?: boolean;
  /** Карточка остаётся кнопкой и без выбора: так ведёт себя карточка билдера. */
  alwaysFocusable?: boolean;
  /** Клавиатурная остановка: на карточке или только на заголовке-кнопке. */
  keyboardTarget?: "card" | "title";
  className?: string;
  children?: ReactNode;
}

/**
 * Общая оболочка карточек: семантика выбора, клавиатура и состояния.
 * Вид задаёт компонент-наследник своими классами (способности, перки, выборы),
 * поэтому правила листа продолжают переопределять карточки как раньше.
 */
export function Card({
  selected = false,
  disabled = false,
  onSelect,
  onOpen,
  openOnCardClick = true,
  alwaysFocusable = false,
  keyboardTarget = "card",
  className = "",
  children,
  ...rest
}: CardProps) {
  const { isInteractive, cardProps } = useSelectableCard({
    onSelect,
    onOpen,
    openOnCardClick,
    selected,
    disabled,
    alwaysFocusable,
    keyboardTarget,
  });

  const classes = [
    className,
    selected && "is-selected",
    isInteractive && "is-interactive",
    disabled && "is-disabled",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes} {...rest} {...cardProps}>
      {children}
    </article>
  );
}

export interface CardHeaderProps {
  /** Надпись над названием: слот, источник или тип. */
  eyebrow?: ReactNode;
  /** Хвост шапки: чип типа, счётчик, действия. Название карточка кладёт сама. */
  children?: ReactNode;
  /** Класс карточки: он же держит её собственные правила шапки. */
  className?: string;
  /** Оставить пустую шапку в потоке, чтобы карточка не меняла ритм. */
  reserveSpace?: boolean;
}

/** Шапка карточки: надпись слева, чипы и счётчики справа. */
export function CardHeader({
  eyebrow,
  children,
  className = "",
  reserveSpace = false,
}: CardHeaderProps) {
  if (!reserveSpace && !eyebrow && !children) return null;
  return (
    <header className={`card-header${className ? ` ${className}` : ""}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {children}
    </header>
  );
}

export interface CardTitleProps {
  as?: "h2" | "h3" | "h4";
  children: ReactNode;
  /** Заголовок открывает карточку: он же становится кнопкой. */
  onOpen?: () => void;
  /** Подпись кнопки для скринридера. */
  openLabel?: string;
  /** Атрибут title: полное имя, когда заголовок обрезается. */
  title?: string;
  className?: string;
}

/** Название карточки: один размер и шрифт у всех карточек. */
export function CardTitle({
  as: Heading = "h3",
  children,
  onOpen,
  openLabel,
  title,
  className = "",
}: CardTitleProps) {
  return (
    <Heading className={`card-title${className ? ` ${className}` : ""}`} title={title}>
      {onOpen ? (
        <button
          type="button"
          className="card-title-button"
          aria-label={openLabel}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {children}
        </button>
      ) : (
        children
      )}
    </Heading>
  );
}
