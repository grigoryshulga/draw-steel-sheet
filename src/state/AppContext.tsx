import { createContext, useContext } from "react";
import type { Character, DerivedStats } from "../types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AppContextValue {
  character: Character;
  derived: DerivedStats;
  update: (recipe: (character: Character) => Character) => void;
  patch: (patch: Partial<Character>) => void;
  saveStatus: SaveStatus;
  saveError: string;
  notify: (message: string, tone?: "info" | "success" | "error") => void;
  goTo: (tab: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppContext.Provider");
  return value;
}
