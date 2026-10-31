import type { KeyboardEvent, ReactNode } from "react";
import type { Ability, Character } from "../types";
import {
  AbilityBody,
  AbilityTags,
  abilityRollSummary,
} from "./rules/AbilitySheet";
import { abilityCardView } from "./rules/abilityCardView";
import "./AbilityCard.css";

export interface AbilityCardProps {
  ability: Ability;
  character: Character;
  /** Происхождение из подкласса: «Орден», «Домен», «Доктрина» и т. п. */
  origin?: { label: string; value?: string } | null;
  onOpen?: () => void;
  /** Карточка участвует в выборе: клик выбирает, заголовок открывает превью. */
  onSelect?: () => void;
  selected?: boolean;
  /** Полное превью: эффект не обрезается. */
  full?: boolean;
  /** Без рамки и фона: карточка как содержимое поп-апа, а не карточка в карточке. */
  flat?: boolean;
  footerAction?: ReactNode;
  details?: ReactNode;
  className?: string;
}

export function AbilityCard({
  ability,
  character,
  origin,
  onOpen,
  onSelect,
  selected = false,
  full = false,
  flat = false,
  footerAction,
  details,
  className,
}: AbilityCardProps) {
  // Расчёты листа живут в `abilityCardView`: общая презентация получает
  // готовые значения и не знает, есть ли у читателя герой.
  const view = abilityCardView(ability, character, origin);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <article
      className={`sheet-ability-card${selected ? " is-selected" : ""}${full ? " is-full" : ""}${flat ? " is-flat" : ""}${className ? ` ${className}` : ""}`}
      data-action={ability.actionType}
      data-kind={ability.kind}
      {...(onSelect
        ? {
            role: "button",
            tabIndex: 0,
            "aria-pressed": selected,
            onClick: onSelect,
            onKeyDown,
          }
        : {})}
    >
      <header className="sheet-ability-card-head">
        <h4>
          {onOpen ? (
            <button
              type="button"
              className="sheet-ability-title"
              aria-label={`Открыть способность: ${ability.name || "без названия"}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
            >
              {ability.name || "Без названия"}
            </button>
          ) : (
            ability.name || "Без названия"
          )}
        </h4>
        <AbilityTags view={view} />
      </header>

      <AbilityBody view={view} full={full} />

      {details}

      <footer className="sheet-ability-footer">
        <span title="Бросок силы">
          <em>Бросок</em> {abilityRollSummary(ability)}
        </span>
        {ability.trigger && (
          <span className="sheet-ability-trigger">триггер</span>
        )}
        {footerAction && (
          <span
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {footerAction}
          </span>
        )}
      </footer>
    </article>
  );
}
