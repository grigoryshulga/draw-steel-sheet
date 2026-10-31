import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRepository } from "../src/lib/persistence/supabase-repository";
import { createCharacter } from "../src/lib/defaults";

function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = createClient("https://storage.example.test", "test-key", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { fetch, repository: createSupabaseRepository(client) };
}

describe("Supabase character repository", () => {
  it("maps cloud summaries to the same contract as local storage", async () => {
    const { fetch, repository } = setup();
    fetch.mockResolvedValueOnce(Response.json([{
      id: "hero", name: "Герой", class_name: "Неистовый", ancestry: "Человек",
      level: 2, updated_at: "2026-01-01T00:00:00Z",
    }]));
    expect(await repository.listCharacters()).toEqual([{
      id: "hero", name: "Герой", className: "Неистовый", ancestry: "Человек",
      level: 2, updatedAt: "2026-01-01T00:00:00Z",
    }]);
  });

  it("saves a new timestamp without mutating the editor document", async () => {
    const { fetch, repository } = setup();
    fetch.mockResolvedValueOnce(new Response(null, { status: 201 }));
    const character = createCharacter({ name: "Герой" });
    character.updatedAt = "2020-01-01T00:00:00Z";
    const saved = await repository.saveCharacter(character);
    expect(saved.updatedAt).not.toBe(character.updatedAt);
    expect(character.updatedAt).toBe("2020-01-01T00:00:00Z");
    const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(body.document).toEqual(saved);
    expect(body.updated_at).toBe(saved.updatedAt);
    expect(body).not.toHaveProperty("user_id");
  });

  it("loads documents and deletes by id", async () => {
    const { fetch, repository } = setup();
    const character = createCharacter();
    fetch.mockResolvedValueOnce(Response.json({ document: character }));
    expect(await repository.loadCharacter(character.id)).toEqual(character);
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await repository.deleteCharacter(character.id);
    expect(fetch.mock.calls[1][1]!.method).toBe("DELETE");
    expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get("id")).toBe(`eq.${character.id}`);
  });

  it("rejects a missing cloud document instead of returning undefined", async () => {
    const { fetch, repository } = setup();
    fetch.mockResolvedValueOnce(Response.json({ document: null }));
    await expect(repository.loadCharacter("hero")).rejects.toThrow("Документ персонажа повреждён");
  });

  it("rejects failed writes instead of acknowledging them", async () => {
    const { fetch, repository } = setup();
    fetch.mockResolvedValueOnce(Response.json({ message: "Permission denied", code: "42501" }, { status: 403 }));
    await expect(repository.saveCharacter(createCharacter())).rejects.toThrow("Permission denied");
  });
});
