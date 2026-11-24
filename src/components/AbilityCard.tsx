import type { ReactNode } from "react";
import { useRuleLanguage } from "../i18n/locale";
import { EnglishHeroAbility } from "./rules/EnglishHeroAbility";
import { useAbilityOriginal } from "./abilityOriginal";
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

function AbilityContent({ ability, view, full, showCalculations = false, original }: {
  ability: Ability;
  view: AbilitySheetView;
  full: boolean;
  showCalculations?: boolean;
  original?: Ability;
}) {
  if (original) return <EnglishHeroAbility original={original} base={view} full={full} showCalculations={showCalculations} />;
  const triggerText = ability.trigger;
  return <>
    {full && view.flavor && <p className="sheet-ability-detail-flavor"><CharacteristicGlyphText text={view.flavor} /></p>}
    {triggerText && (
      <p className="sheet-ability-trigger-text"><strong>Триггер:</strong> <CharacteristicGlyphText text={triggerText} /></p>
    )}
    <AbilityBody view={view} full={full} showCalculations={showCalculations} />
  </>;
}

/** Содержимое способности внутри карточки выбора: без второй оболочки и шапки. */
export function AbilityCardContent({ ability, character, showName = false, showCalculations = false }: {
  ability: Ability;
  character: Character;
  showName?: boolean;
  /** Показом формул управляет поп-ап; встроенные карточки показывают только итоги. */
  showCalculations?: boolean;
}) {
  const view = abilityCardView(ability, character);
  const original = useAbilityOriginal(ability);
  const { language } = useRuleLanguage(ability.originalId || ability.id, original?.originalDescription);
  const english = language === "en" ? original : undefined;
  return (
    <div className="ability-card-content" lang={language}>
      {showName && <strong className="ability-card-content-name">{language === "en" ? original?.originalName || ability.name : ability.name}</strong>}
      <AbilityTags view={view} language={language} />
      <AbilityContent ability={ability} original={english} view={view} full showCalculations={showCalculations} />
    </div>
  );
}

export interface AbilityCardProps {
  ability: Ability;
  character: Character;
  /** Direct, unmodified catalog projection. */
  canonical?: boolean;
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
  headerAction?: ReactNode;
  footerAction?: ReactNode;
  details?: ReactNode;
  className?: string;
}

export function AbilityCard({
  ability,
  character,
  canonical = false,
  origin,
  onOpen,
  openOnCardClick = false,
  onSelect,
  selected = false,
  full = false,
  flat = false,
  headerAction,
  footerAction,
  details,
  className,
}: AbilityCardProps) {
  // Расчёты листа живут в `abilityCardView`: общая презентация получает
  // готовые значения и не знает, есть ли у читателя герой.
  const view = abilityCardView(ability, character, origin);
  const original = useAbilityOriginal(ability, canonical);
  const { language } = useRuleLanguage(ability.originalId || ability.id, original?.originalDescription);
  const english = language === "en" ? original : undefined;

  return (
    <AbilityCardFrame
      title={(language === "en" && original?.originalName) || ability.name || "Без названия"}
      titleText={(language === "en" && original?.originalName) || ability.name || "Без названия"}
      tags={<AbilityTags view={view} language={language} />}
      headerAction={headerAction}
      language={language}
      lang={language}
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
      <AbilityContent ability={ability} original={english} view={view} full={full} />

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
