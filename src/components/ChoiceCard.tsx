import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "./ui";
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
  return (
    <Card
      className={`choice-card${className ? ` ${className}` : ""}`}
      selected={selected}
      disabled={disabled}
      onSelect={onSelect}
      onOpen={onOpen}
    >
      <CardHeader className="choice-card-head" eyebrow={eyebrow}>
        {meta && <span className="choice-card-meta">{meta}</span>}
      </CardHeader>
      <CardTitle
        as="h3"
        onOpen={disabled ? undefined : onOpen}
        openLabel={`Открыть: ${title}`}
      >
        {title}
      </CardTitle>
      {summary && <div className="choice-card-summary">{summary}</div>}
      {children}
    </Card>
  );
}
