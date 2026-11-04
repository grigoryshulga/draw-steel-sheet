import type { KeyboardEvent, MouseEvent } from "react";

/** Вложенные контролы карточки: клик по ним не выбирает и не открывает карточку. */
const NESTED_CONTROLS = "button, a, input, select, textarea, summary, details, label";

export interface SelectableCardOptions {
  /** Клик по карточке выбирает вариант. */
  onSelect?: () => void;
  /** Клик по карточке открывает её, если выбора нет. */
  onOpen?: () => void;
  /**
   * Карточка открывается кликом по всей площади. Когда это основной способ
   * взаимодействия, карточка становится кнопкой и для клавиатуры.
   */
  openOnCardClick?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** Карточка остаётся кнопкой и без выбора: так ведёт себя карточка билдера. */
  alwaysFocusable?: boolean;
  /**
   * Куда ведёт клавиатура: на всю карточку или только на заголовок-кнопку
   * внутри неё. Заголовок остаётся единственной точкой остановки там, где
   * карточка — лишь дополнительная зона клика.
   */
  keyboardTarget?: "card" | "title";
}

export interface SelectableCardProps {
  role?: "button";
  tabIndex?: number;
  "aria-pressed"?: boolean;
  "aria-disabled"?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface SelectableCardState {
  /** Карточка реагирует на клик. */
  isInteractive: boolean;
  /** Готовые атрибуты и обработчики для корневого элемента карточки. */
  cardProps: SelectableCardProps;
}

/**
 * Общее поведение карточек-выборов: клик выбирает или открывает карточку,
 * Enter и пробел дублируют клик, вложенные контролы не перехватываются.
 * Вид карточки остаётся у компонента, который её рисует.
 */
export function useSelectableCard({
  onSelect,
  onOpen,
  openOnCardClick = true,
  selected = false,
  disabled = false,
  alwaysFocusable = false,
  keyboardTarget = "card",
}: SelectableCardOptions): SelectableCardState {
  const activate = onSelect ?? (openOnCardClick ? onOpen : undefined);
  const isInteractive = !disabled && Boolean(activate);

  const onClick =
    disabled || !activate
      ? undefined
      : (event: MouseEvent<HTMLElement>) => {
          const target = event.target;
          if (target instanceof Element && target.closest(NESTED_CONTROLS)) return;
          activate();
        };

  const onKeyDown =
    disabled || !activate
      ? undefined
      : (event: KeyboardEvent<HTMLElement>) => {
          if (event.target !== event.currentTarget) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activate();
        };

  // Карточка должна быть кнопкой для клавиатуры, если клик по ней — основной
  // способ взаимодействия. Иначе клавиатура идёт через заголовок-кнопку.
  const asButton =
    alwaysFocusable ||
    (Boolean(onSelect) && !disabled) ||
    (keyboardTarget === "card" && openOnCardClick && isInteractive);

  return {
    isInteractive,
    cardProps: {
      ...(asButton ? { role: "button" as const, tabIndex: disabled ? -1 : 0 } : {}),
      ...(onSelect || alwaysFocusable ? { "aria-pressed": selected } : {}),
      ...(disabled ? { "aria-disabled": true } : {}),
      ...(onClick ? { onClick } : {}),
      ...(onKeyDown ? { onKeyDown } : {}),
    },
  };
}
