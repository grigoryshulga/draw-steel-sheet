import { useLocale } from "../../../i18n/locale";
import { useCallback, useState, type ReactNode } from "react";
import { CardDetailModal } from "../../../components/CardDetailModal";
import { AbilityCardContent } from "../../../components/AbilityCard";
import type { Ability, Character } from "../../../types";
import { mechanicAbilityName, useAbilityCatalog } from "../../../components/abilityOriginal";

export { RuleText } from "../../../components/RuleText";

export function useMechanicAbilityName(): (ability: Ability) => string {
  const { locale } = useLocale();
  const catalog = useAbilityCatalog(locale === "en");
  return useCallback((ability: Ability) => locale === "en"
    ? mechanicAbilityName(ability, catalog)
    : ability.name, [catalog, locale]);
}

export function MechanicDetails({
  title,
  label = "Правила",
  children,
  className = "class-mechanics-link",
}: {
  title: string;
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={t(`Открыть: ${title}`, `Open: ${title}`)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label === "Правила" ? t("Правила", "Rules") : label}
      </button>
      {open && (
        <CardDetailModal open title={title} onClose={() => setOpen(false)}>
          {children}
        </CardDetailModal>
      )}
    </>
  );
}
export function AbilityPeek({
  ability,
  character,
}: {
  ability: Ability;
  character: Character;
}) {
  const abilityName = useMechanicAbilityName();
  const name = abilityName(ability);
  return (
    <MechanicDetails title={name} label={name}>
      <AbilityCardContent ability={ability} character={character} />
    </MechanicDetails>
  );
}
