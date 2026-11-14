import { useState, type ReactNode } from "react";
import { CardDetailModal } from "../../../components/CardDetailModal";
import { AbilityCardContent } from "../../../components/AbilityCard";
import type { Ability, Character } from "../../../types";

export { RuleText } from "../../../components/RuleText";

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
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={`Открыть: ${title}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
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
  return (
    <MechanicDetails title={ability.name} label={ability.name}>
      <AbilityCardContent ability={ability} character={character} />
    </MechanicDetails>
  );
}
