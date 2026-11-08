import type { SupabaseClient } from "@supabase/supabase-js";
import type { Character, CharacterAvatar } from "../../types";
import { CharacterConflictError, CharacterStorageError, type CharacterRepository } from "./repository";

/** Bucket создаётся миграцией `supabase/migrations/202611040001_create_avatars_bucket.sql`. */
export const AVATAR_BUCKET = "avatars";

/** Uses the authenticated client; ownership is enforced by database RLS. */
export function createSupabaseRepository(client: SupabaseClient): CharacterRepository {
  const revisions = new Map<string, string>();
  async function currentUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Войдите, чтобы сохранить портрет.");
    return data.user.id;
  }

  const avatarObject = (userId: string, characterId: string) =>
    `${userId}/${characterId}.webp`;

  return {
    async listCharacters() {
      const { data, error, status } = await client
        .from("characters")
        .select("id, name, class_name, ancestry, level, updated_at, avatar_url")
        .order("updated_at", { ascending: false });
      if (error) throw new CharacterStorageError(error.message, status);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        className: row.class_name,
        ancestry: row.ancestry,
        level: row.level,
        updatedAt: row.updated_at,
        ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
      }));
    },
    async loadCharacter(id: string) {
      const { data, error, status } = await client
        .from("characters")
        .select("document, updated_at")
        .eq("id", id)
        .single();
      if (error) throw new CharacterStorageError(error.message, status === 406 ? 404 : status);
      const document: unknown = data?.document;
      if (!document || typeof document !== "object" || Array.isArray(document) ||
          !("id" in document) || document.id !== id) {
        throw new Error("Документ персонажа повреждён");
      }
      const saved = { ...document, updatedAt: data.updated_at ?? (document as Character).updatedAt } as Character;
      if (typeof saved.updatedAt !== "string" || !Number.isFinite(Date.parse(saved.updatedAt))) {
        throw new CharacterStorageError("Сервер не подтвердил версию героя", 502);
      }
      revisions.set(id, saved.updatedAt);
      return saved;
    },
    async saveCharacter(character: Character, options) {
      const expected = options ? options.expectedUpdatedAt : revisions.get(character.id) ?? null;
      const { data, error, status } = await client.rpc("character_save", {
        p_document: character,
        p_expected_updated_at: expected,
      });
      if (error) {
        if (error.code === "PT409") {
          let server: Character | null;
          try {
            server = JSON.parse(error.details).server;
            if (server !== null && (!server || typeof server !== "object" || server.id !== character.id)) {
              throw new Error("Invalid conflict");
            }
          }
          catch { throw new CharacterStorageError("Некорректный ответ о конфликте", 502); }
          throw new CharacterConflictError(character, server, expected);
        }
        throw new CharacterStorageError(error.message, status);
      }
      if (!data?.document || data.document.id !== character.id ||
          typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))) {
        throw new CharacterStorageError("Сервер не подтвердил сохранение героя", 502);
      }
      const saved = { ...data.document, updatedAt: data.updatedAt } as Character;
      revisions.set(character.id, saved.updatedAt);
      return saved;
    },
    async deleteCharacter(id: string) {
      const userId = await currentUserId().catch(() => null);
      const { error } = await client.from("characters").delete().eq("id", id);
      if (error) throw new Error(error.message);
      if (userId) {
        // Файл портрета не должен переживать героя; неудача не отменяет удаление листа.
        await client.storage.from(AVATAR_BUCKET).remove([avatarObject(userId, id)]).catch(() => undefined);
      }
      return;
    },
    async uploadAvatar(characterId: string, image: Blob): Promise<CharacterAvatar> {
      const userId = await currentUserId();
      const object = avatarObject(userId, characterId);
      const { error } = await client.storage.from(AVATAR_BUCKET).upload(object, image, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
      if (error) throw new Error(error.message);
      const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(object);
      const updatedAt = new Date().toISOString();
      return { url: `${data.publicUrl}?v=${Date.parse(updatedAt)}`, updatedAt };
    },
    async deleteAvatar(characterId: string) {
      const userId = await currentUserId();
      const { error } = await client.storage
        .from(AVATAR_BUCKET)
        .remove([avatarObject(userId, characterId)]);
      // Удаление отсутствующего объекта Supabase не считает ошибкой.
      if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    },
  };
}
