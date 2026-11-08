import type { Character, CharacterAvatar, CharacterSummary } from "../../types";

export interface CharacterSaveOptions {
  /** null means create only; a timestamp means replace exactly this server version. */
  expectedUpdatedAt: string | null;
}

export class CharacterConflictError extends Error {
  readonly status = 409;
  constructor(
    readonly local: Character,
    readonly server: Character | null,
    readonly expectedUpdatedAt: string | null,
  ) {
    super("Герой уже изменён на сервере. Обе версии сохранены для выбора.");
    this.name = "CharacterConflictError";
  }
}

export class CharacterStorageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CharacterStorageError";
  }
}

/** Only transport failures permit a private cached response; denial/404 never do. */
export function isStorageUnavailable(error: unknown): boolean {
  if (error instanceof CharacterStorageError) return error.status === 0 || error.status >= 500;
  return error instanceof TypeError || (error instanceof Error &&
    /network|fetch|offline|сети|не ответил вовремя/i.test(error.message));
}

/** Storage contract shared by local and authenticated cloud adapters.
 * Saves return the persisted document; failed writes reject and must not be
 * acknowledged by autosave. Callers normalize loaded documents before editing.
 */
export interface CharacterRepository {
  listCharacters(): Promise<CharacterSummary[]>;
  loadCharacter(id: string): Promise<Character>;
  saveCharacter(character: Character, options?: CharacterSaveOptions): Promise<Character>;
  deleteCharacter(id: string): Promise<void>;
  /** Загружает уже подготовленный WebP и возвращает адрес для документа. */
  uploadAvatar(characterId: string, image: Blob): Promise<CharacterAvatar>;
  /** Удаляет файл портрета; отсутствие файла не считается ошибкой. */
  deleteAvatar(characterId: string): Promise<void>;
}
