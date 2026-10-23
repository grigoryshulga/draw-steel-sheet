import { createContext, useContext } from "react";
import type { Character, DerivedStats } from "../types";

import type { SaveStatus } from "../lib/autosave";
import type { GameAction, GameHistoryEntry } from "../lib/game-actions";
export type { SaveStatus } from "../lib/autosave";

export interface AppContextValue {
  character: Character;
  derived: DerivedStats;
  update: (recipe: (character: Character) => Character) => void;
  patch: (patch: Partial<Character>) => void;
  performGameAction: (action: GameAction, operationId?: string) => boolean;
  undoGameAction: () => void;
  gameHistory: GameHistoryEntry[];
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
