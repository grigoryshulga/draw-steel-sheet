import type { SupabaseClient } from "@supabase/supabase-js";
import type { Character, CharacterAvatar } from "../../types";
import type { CharacterRepository } from "./repository";

/** Bucket создаётся миграцией `supabase/migrations/202611040001_create_avatars_bucket.sql`. */
export const AVATAR_BUCKET = "avatars";

/** Uses the authenticated client; ownership is enforced by database RLS. */
export function createSupabaseRepository(client: SupabaseClient): CharacterRepository {
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
      const { data, error } = await client
        .from("characters")
        .select("id, name, class_name, ancestry, level, updated_at, avatar_url")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
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
      const { data, error } = await client
        .from("characters")
        .select("document")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      const document: unknown = data?.document;
      if (!document || typeof document !== "object" || Array.isArray(document)) {
        throw new Error("Документ персонажа повреждён");
      }
      return document as Character;
    },
    async saveCharacter(character: Character) {
      const saved = { ...character, updatedAt: new Date().toISOString() };
      const { error } = await client.from("characters").upsert({
        id: saved.id,
        name: saved.name || "Без имени",
        class_name: saved.className || "",
        ancestry: saved.ancestry || "",
        level: saved.level ?? 1,
        avatar_url: saved.avatar?.url ?? null,
        document: saved,
        updated_at: saved.updatedAt,
      });
      if (error) throw new Error(error.message);
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
