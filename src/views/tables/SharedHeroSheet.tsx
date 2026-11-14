import { useMemo } from "react";
import { AppContext, type AppContextValue } from "../../state/AppContext";
import { deriveStats } from "../../lib/rules";
import { sharedSheetCharacter } from "../../lib/tables/shared-sheet";
import type { SharedHero, TableSection } from "../../lib/tables/types";
import { SheetReadOnlyView } from "../SheetView";

const ignore = () => {};
export function SharedHeroSheet({ hero }: { hero: SharedHero }) {
  const character = useMemo(() => sharedSheetCharacter(hero), [hero]);
  const value = useMemo<AppContextValue>(() => ({
    readOnly: true,
    character, derived: deriveStats(character), update: ignore, patch: ignore,
    performGameAction: () => false, undoGameAction: ignore, gameHistory: [],
    saveStatus: "saved", saveError: "", notify: ignore, goTo: ignore,
  }), [character]);
  return <AppContext.Provider value={value}>
    <SheetReadOnlyView sections={Object.keys(hero.sections) as TableSection[]} />
  </AppContext.Provider>;
}
