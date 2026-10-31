import { createContext, useContext, type ReactNode } from "react";
import {
  builderSkillSlots,
  type BuilderDraft,
} from "../../lib/character-builder";
import type { BuilderStepId } from "../../lib/builder-steps";
import type { Ability, Character, Perk } from "../../types";

export type BuilderSkillSlots = ReturnType<typeof builderSkillSlots>;
export type BuilderStepIssues = Record<BuilderStepId, string>;

export interface TraitDetail {
  name: string;
  text: string;
}

export interface IncidentDetail {
  title: string;
  text: string;
}

export interface SubclassDetail {
  title: string;
  text: string;
}

/** Общие зависимости шагов: черновик, навигация и производные значения. */
export interface BuilderStepContextValue {
  draft: BuilderDraft;
  patch: (changes: Partial<BuilderDraft>) => void;
  go: (step: BuilderStepId) => void;
  issues: BuilderStepIssues;
  hero: Character;
  skillSlots: BuilderSkillSlots;
  ancestrySkills: string[];
  cultureSkills: string[];
  careerSkills: string[];
  busy: boolean;
  createBlankCharacter: () => void;
  openPerk: (perk: Perk) => void;
  openTrait: (detail: TraitDetail) => void;
  openIncident: (detail: IncidentDetail) => void;
  openSubclass: (detail: SubclassDetail) => void;
  openAbility: (ability: Ability) => void;
}

const BuilderStepContext = createContext<BuilderStepContextValue | null>(null);

export function BuilderStepProvider({
  value,
  children,
}: {
  value: BuilderStepContextValue;
  children: ReactNode;
}) {
  return (
    <BuilderStepContext.Provider value={value}>
      {children}
    </BuilderStepContext.Provider>
  );
}

export function useBuilderStep(): BuilderStepContextValue {
  const value = useContext(BuilderStepContext);
  if (!value)
    throw new Error("useBuilderStep must be used inside BuilderStepProvider");
  return value;
}
