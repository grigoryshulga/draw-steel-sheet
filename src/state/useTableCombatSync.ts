import { useEffect, useMemo, useState } from "react";
import type { Character } from "../types";
import { syncCharacterCombat, tableCombatForHero } from "../lib/tables/combat";
import { tableRepository } from "../lib/tables/repository";
import type { HeroTableCombat } from "../lib/tables/types";
import type { useTables } from "./useTables";

export function useTableCombatSync(
  character: Character | null,
  update: (recipe: (current: Character) => Character) => void,
  { selected, table, stale }: ReturnType<typeof useTables>,
  changingCharacter: boolean,
) {
  const bound = character?.runtime?.tableCombat?.tableId;
  const board = character && table && !stale && table.id === selected && (!bound || bound === table.id)
    ? tableCombatForHero(table, character.id) : undefined;
  const heroId = board === undefined ? character?.id : undefined;
  const request = useMemo(() => heroId ? { heroId } : undefined, [heroId]);
  const [remote, setRemote] = useState<{ request: NonNullable<typeof request>; state: HeroTableCombat | null; signature: string }>();

  useEffect(() => {
    if (!request) return;
    let alive = true;
    let reading = false;
    const refresh = async () => {
      if (reading) return;
      reading = true;
      try {
        const state = await tableRepository.readHeroCombat(request.heroId);
        const signature = JSON.stringify(state);
        if (alive) setRemote(old => old?.request === request && old.signature === signature
          ? old : { request, state, signature });
      } catch {
        // An unavailable server cannot confirm that combat ended.
      } finally {
        reading = false;
      }
    };
    void refresh();
    const unsubscribe = tableRepository.subscribe("", () => void refresh());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [request]);

  const snapshot = board === undefined && remote?.request === request ? remote?.state : board;
  useEffect(() => {
    if (!character || changingCharacter || snapshot === undefined) return;
    const next = syncCharacterCombat(character, snapshot);
    if (next !== character) update(current => current === character ? next
      : current.id === character.id ? syncCharacterCombat(current, snapshot) : current);
  }, [changingCharacter, character, snapshot, update]);
}
