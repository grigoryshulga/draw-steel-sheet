import type { Character, CharacterSummary } from "../../types";

/** Storage contract shared by local and authenticated cloud adapters.
 * Saves return the persisted document; failed writes reject and must not be
 * acknowledged by autosave. Callers normalize loaded documents before editing.
 */
export interface CharacterRepository {
  listCharacters(): Promise<CharacterSummary[]>;
  loadCharacter(id: string): Promise<Character>;
  saveCharacter(character: Character): Promise<Character>;
  deleteCharacter(id: string): Promise<void>;
}
