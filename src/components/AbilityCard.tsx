import type { ReactNode } from "react";
import { CharacteristicGlyphText } from "./CharacteristicGlyph";
import type { Ability, Character } from "../types";
import { AbilityCardFrame } from "./rules/AbilityCardFrame";
import {
  AbilityBody,
  AbilityTags,
  type AbilitySheetView,
} from "./rules/AbilitySheet";
import { abilityCardView } from "./rules/abilityCardView";
import "./AbilityCard.css";

function AbilityContent({ ability, view, full }: {
  ability: Ability;
  view: AbilitySheetView;
  full: boolean;
}) {
  return <>
    {ability.trigger && (
      <p className="sheet-ability-trigger-text"><strong>Триггер:</strong> <CharacteristicGlyphText text={ability.trigger} /></p>
    )}
    <AbilityBody view={view} full={full} />
  </>;
}

/** Содержимое способности внутри карточки выбора: без второй оболочки и шапки. */
export function AbilityCardContent({ ability, character, showName = false }: {
  ability: Ability;
  character: Character;
  showName?: boolean;
}) {
  const view = abilityCardView(ability, character);
  return (
    <div className="ability-card-content">
      {showName && <strong className="ability-card-content-name">{ability.name}</strong>}
      <AbilityTags view={view} />
      <AbilityContent ability={ability} view={view} full />
    </div>
  );
}

export interface AbilityCardProps {
  ability: Ability;
  character: Character;
  /** Происхождение из подкласса: «Орден», «Домен», «Доктрина» и т. п. */
  origin?: { label: string; value?: string } | null;
  onOpen?: () => void;
  /** Клик по карточке открывает её; клавиатурное управление — через заголовок. */
  openOnCardClick?: boolean;
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
  openOnCardClick = false,
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

  return (
    <AbilityCardFrame
      title={ability.name || "Без названия"}
      titleText={ability.name || "Без названия"}
      tags={<AbilityTags view={view} />}
      actionType={ability.actionType}
      kind={ability.kind}
      full={full}
      flat={flat}
      className={className}
      data-basic={view.basic ? "true" : undefined}
      data-openable={openOnCardClick && onOpen ? "true" : undefined}
      selected={selected}
      onSelect={onSelect}
      onOpen={onOpen}
      openOnCardClick={openOnCardClick}
      keyboardTarget="title"
    >
      <AbilityContent ability={ability} view={view} full={full} />

      {details}

      {footerAction && <footer className="sheet-ability-footer">
        {footerAction && (
          <span
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {footerAction}
          </span>
        )}
      </footer>}
    </AbilityCardFrame>
  );
}
