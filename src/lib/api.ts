import type { Character } from "../types";
import { supabase } from "./supabase";
import { createHttpRepository } from "./persistence/http-repository";
import { createSupabaseRepository } from "./persistence/supabase-repository";
import { createOfflineRepository, type OfflineCharacterRepository } from "./persistence/offline-repository";
import { CharacterStorageError, type CharacterRepository, type CharacterSaveOptions } from "./persistence/repository";

const repositories = new Map<string, OfflineCharacterRepository>();

/** The lifecycle supplies StorageScope. Never derive private cache keys from a
 * mutable global "last user" value, and never share a queue between accounts. */
export function getCharacterRepository(scope: string): OfflineCharacterRepository {
  if (supabase && scope === "local") throw new CharacterStorageError("Требуется вход",401);
  const existing = repositories.get(scope);
  if (existing) return existing;
  const adapter = supabase ? createSupabaseRepository(supabase) : createHttpRepository();
  async function authorized<T>(operation: () => Promise<T>): Promise<T> {
    if (supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session?.user.id !== scope) {
        throw new CharacterStorageError("Аккаунт изменился. Откройте лист заново.",401);
      }
    }
    return operation();
  }
  const remote: CharacterRepository = {
    listCharacters: () => authorized(() => adapter.listCharacters()),
    loadCharacter: id => authorized(() => adapter.loadCharacter(id)),
    saveCharacter: (doc,options) => authorized(() => adapter.saveCharacter(doc,options)),
    deleteCharacter: id => authorized(() => adapter.deleteCharacter(id)),
    uploadAvatar: (id,image) => authorized(() => adapter.uploadAvatar(id,image)),
    deleteAvatar: id => authorized(() => adapter.deleteAvatar(id)),
  };
  const repository = createOfflineRepository({ scope, remote });
  repositories.set(scope,repository);
  return repository;
}

async function currentRepository() {
  if (!supabase) return getCharacterRepository("local");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new CharacterStorageError("Требуется вход",401);
  return getCharacterRepository(data.session.user.id);
}

// Existing view API and JSON return shapes are unchanged.
export const listCharacters = async () => (await currentRepository()).listCharacters();
export const loadCharacter = async (id: string) => (await currentRepository()).loadCharacter(id);
export const saveCharacter = async (doc: Character, options?: CharacterSaveOptions) =>
  (await currentRepository()).saveCharacter(doc,options);
export const deleteCharacter = async (id: string) => (await currentRepository()).deleteCharacter(id);
export const uploadAvatar = async (id: string, image: Blob) => (await currentRepository()).uploadAvatar(id,image);
export const deleteAvatar = async (id: string) => (await currentRepository()).deleteAvatar(id);
