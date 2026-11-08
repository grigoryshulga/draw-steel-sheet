import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRepository } from "../src/lib/persistence/supabase-repository";
import { createCharacter } from "../src/lib/defaults";
import { CharacterConflictError } from "../src/lib/persistence/repository";

function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = createClient("https://storage.example.test", "test-key", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { fetch, client, repository: createSupabaseRepository(client) };
}

describe("Supabase character repository", () => {
  it("maps cloud summaries to the same contract as local storage", async () => {
    const { fetch, repository } = setup();
    fetch.mockResolvedValueOnce(Response.json([{
      id: "hero", name: "Герой", class_name: "Неистовый", ancestry: "Человек",
      level: 2, updated_at: "2026-01-01T00:00:00Z",
      avatar_url: "https://cdn.example.test/hero.webp",
    }, {
      id: "plain", name: "Без портрета", class_name: "", ancestry: "",
      level: 1, updated_at: "2026-01-02T00:00:00Z", avatar_url: null,
    }]));
    expect(await repository.listCharacters()).toEqual([{
      id: "hero", name: "Герой", className: "Неистовый", ancestry: "Человек",
      level: 2, updatedAt: "2026-01-01T00:00:00Z",
      avatarUrl: "https://cdn.example.test/hero.webp",
    }, {
      id: "plain", name: "Без портрета", className: "", ancestry: "",
      level: 1, updatedAt: "2026-01-02T00:00:00Z",
    }]);
  });

  it("saves a new timestamp without mutating the editor document", async () => {
    const { fetch, repository } = setup();
    const character = createCharacter({ name: "Герой" });
    character.updatedAt = "2020-01-01T00:00:00Z";
    character.avatar = { url: "https://cdn.example.test/avatar.webp", updatedAt: "2026-01-01T00:00:00Z" };
    const serverSaved = { ...character, updatedAt: "2026-11-07T12:00:00.123456+00:00" };
    fetch.mockResolvedValueOnce(Response.json({ document: serverSaved, updatedAt: serverSaved.updatedAt }));
    const saved = await repository.saveCharacter(character);
    expect(saved.updatedAt).not.toBe(character.updatedAt);
    expect(character.updatedAt).toBe("2020-01-01T00:00:00Z");
    const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(String(fetch.mock.calls[0][0])).toContain("/rest/v1/rpc/character_save");
    expect(body.p_document).toEqual(character);
    expect(body.p_expected_updated_at).toBeNull();
    expect(body.p_document.avatar.url).toBe(character.avatar.url);
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

  it("uses updated_at as the CAS base even when a transaction left an older document timestamp", async () => {
    const { fetch, repository } = setup();
    const character = createCharacter();
    const revision = "2026-11-07T11:00:00.123456+00:00";
    fetch.mockResolvedValueOnce(Response.json({ document: character,updated_at: revision }));
    const loaded = await repository.loadCharacter(character.id);
    expect(loaded.updatedAt).toBe(revision);
    fetch.mockResolvedValueOnce(Response.json({ document: loaded,updatedAt: revision }));
    await repository.saveCharacter({ ...loaded,name: "Правка",updatedAt: "2099-01-01T00:00:00Z" });
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string).p_expected_updated_at).toBe(revision);
  });

  it("maps the RPC owner-only conflict detail into two recoverable documents", async () => {
    const { fetch, repository } = setup();
    const local = createCharacter({ name: "Местная" }), server = { ...local,name: "Серверная" };
    fetch.mockResolvedValueOnce(Response.json({ code: "PT409",message: "Конфликт",details: JSON.stringify({ server }) },{ status: 409 }));
    const failure = repository.saveCharacter(local,{ expectedUpdatedAt: local.updatedAt });
    await expect(failure).rejects.toBeInstanceOf(CharacterConflictError);
    await expect(failure).rejects.toMatchObject({ local,server,expectedUpdatedAt: local.updatedAt });
  });

  it("rejects an empty success response without manufacturing a saved revision", async () => {
    const { fetch,repository } = setup();
    fetch.mockResolvedValueOnce(new Response(null,{ status: 200 }));
    await expect(repository.saveCharacter(createCharacter())).rejects.toThrow("не подтвердил");
  });

  it("uploads avatars to the user's folder and deletes them", async () => {
    const { fetch, client, repository } = setup();
    vi.spyOn(client.auth, "getUser").mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);
    fetch.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/storage/v1/object/avatars/") && init?.method === "POST") {
        return Response.json({ Key: "uploaded" });
      }
      if (url.endsWith("/storage/v1/object/avatars") && init?.method === "DELETE") {
        return Response.json([]);
      }
      return Response.json({ message: "unexpected request" }, { status: 500 });
    });

    const avatar = await repository.uploadAvatar(
      "hero",
      new Blob(["RIFF....WEBP"], { type: "image/webp" }),
    );
    expect(avatar.url).toContain("/storage/v1/object/public/avatars/user-1/hero.webp?v=");
    expect(avatar.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const upload = fetch.mock.calls.find(([url]) =>
      String(url).includes("/storage/v1/object/avatars/"),
    );
    expect(upload?.[0]).toBe(
      "https://storage.example.test/storage/v1/object/avatars/user-1/hero.webp",
    );
    expect(upload?.[1]?.method).toBe("POST");

    await expect(repository.deleteAvatar("hero")).resolves.toBeUndefined();
    const removal = fetch.mock.calls.find(([url, init]) =>
      String(url).endsWith("/storage/v1/object/avatars") && init?.method === "DELETE",
    );
    expect(JSON.parse(removal?.[1]?.body as string)).toEqual({
      prefixes: ["user-1/hero.webp"],
    });
  });

  it("rejects avatar uploads without a signed-in user", async () => {
    const { client, repository } = setup();
    vi.spyOn(client.auth, "getUser").mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);
    await expect(
      repository.uploadAvatar("hero", new Blob(["x"], { type: "image/webp" })),
    ).rejects.toThrow("Войдите");
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
