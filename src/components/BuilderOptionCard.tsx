import type { ReactNode } from "react";
import { RuleText } from "./RuleText";
import { Card } from "./ui";
import { type ArtKind } from "../lib/art";
import "./BuilderOptionCard.css";

export interface BuilderOptionCardProps {
  kind: ArtKind;
  name: string;
  /** Полный текст в markdown; показывается у выбранной карточки. */
  summary?: string;
  /** Короткая выжимка для невыбранной карточки. */
  snippet?: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  /** Дополнительные факты: комплектам нужны снаряжение и бонусы. */
  children?: ReactNode;
  className?: string;
}

/**
 * Крупная карточка выбора билдера: портрет служит подложкой под текстом,
 * заголовок читается поверх него, а выбранная карточка раскрывает полный
 * текст и подсвечивается акцентом.
 */
export function BuilderOptionCard({
  name,
  summary,
  snippet,
  selected = false,
  disabled = false,
  onSelect,
  children,
  className = "",
}: BuilderOptionCardProps) {

  return (
    <Card
      className={`builder-option-card${className ? ` ${className}` : ""}`}
      selected={selected}
      disabled={disabled}
      onSelect={onSelect}
      alwaysFocusable
    >
      <div className="builder-option-body">
        <h3 className="builder-option-name">{name}</h3>
        {selected && summary ? (
          <div className="builder-option-copy">
            <RuleText text={summary} />
          </div>
        ) : snippet ? (
          <p className="builder-option-snippet">{snippet}</p>
        ) : null}
        {children}
      </div>
    </Card>
  );
}
