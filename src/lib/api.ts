import type {
  Character,
  CharacterSummary,
} from "../types";
import { supabase, supabaseEnabled } from "./supabase";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function listCharacters(): Promise<CharacterSummary[]> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
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
  }
  const payload = await request<{ characters: CharacterSummary[] }>("/api/characters");
  return payload.characters;
}

export async function loadCharacter(id: string): Promise<Character> {
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("characters")
      .select("document")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data.document as Character;
  }
  return request<Character>(`/api/characters/${encodeURIComponent(id)}`);
}

export async function saveCharacter(character: Character): Promise<Character> {
  if (supabaseEnabled && supabase) {
    const saved = { ...character, updatedAt: new Date().toISOString() };
    const { error } = await supabase.from("characters").upsert({
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
  }
  return request<Character>(
    `/api/characters/${encodeURIComponent(character.id)}`,
    {
      method: "PUT",
      body: JSON.stringify(character),
    },
  );
}

export async function deleteCharacter(id: string): Promise<void> {
  if (supabaseEnabled && supabase) {
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await request(`/api/characters/${encodeURIComponent(id)}`, { method: "DELETE" });
}
