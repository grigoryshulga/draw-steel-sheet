import type { SupabaseClient } from "@supabase/supabase-js";
import type { Character } from "../../types";
import type { CharacterRepository } from "./repository";

/** Uses the authenticated client; ownership is enforced by database RLS. */
export function createSupabaseRepository(client: SupabaseClient): CharacterRepository {
  return {
    async listCharacters() {
      const { data, error } = await client
        .from("characters")
        .select("id, name, class_name, ancestry, level, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        className: row.class_name,
        ancestry: row.ancestry,
        level: row.level,
        updatedAt: row.updated_at,
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
        document: saved,
        updated_at: saved.updatedAt,
      });
      if (error) throw new Error(error.message);
      return saved;
    },
    async deleteCharacter(id: string) {
      const { error } = await client.from("characters").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    },
  };
}
