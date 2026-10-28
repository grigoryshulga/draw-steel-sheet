import type { KeyboardEvent, ReactNode } from "react";
import { Artwork } from "./Artwork";
import { RuleText } from "./RuleText";
import { artFor, type ArtKind } from "../lib/art";
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
  kind,
  name,
  summary,
  snippet,
  selected = false,
  disabled = false,
  onSelect,
  children,
  className = "",
}: BuilderOptionCardProps) {
  const hasArt = Boolean(artFor(kind, name));
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <article
      className={`builder-option-card${hasArt ? " with-art" : ""}${
        selected ? " is-selected" : ""
      }${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={onKeyDown}
    >
      {hasArt && <Artwork kind={kind} name={name} className="builder-option-art" />}
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
    </article>
  );
}
