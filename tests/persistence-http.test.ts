import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpRepository, StorageRequestError } from "../src/lib/persistence/http-repository";
import { createCharacter } from "../src/lib/defaults";
import { CharacterConflictError } from "../src/lib/persistence/repository";

afterEach(() => vi.useRealTimers());

describe("HTTP character repository", () => {
  it("round-trips documents and safely encodes character ids", async () => {
    const character = createCharacter({ name: "Герой" });
    character.id = "hero /?#";
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(character));
    const repository = createHttpRepository({ fetch });
    expect(await repository.saveCharacter(character)).toEqual(character);
    expect(fetch).toHaveBeenCalledWith("/api/characters/hero%20%2F%3F%23", expect.objectContaining({
      method: "PUT", body: JSON.stringify(character),
    }));
    fetch.mockResolvedValueOnce(Response.json(character));
    expect(await repository.loadCharacter(character.id)).toEqual(character);
  });

  it("lists summaries and accepts a bodyless deletion response", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ characters: [{ id: "one" }] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const repository = createHttpRepository({ fetch });
    expect(await repository.listCharacters()).toEqual([{ id: "one" }]);
    await expect(repository.deleteCharacter("one")).resolves.toBeUndefined();
  });

  it("sends create-only or the actual loaded server revision, never an editor timestamp", async () => {
    const original = createCharacter();
    original.updatedAt = "2026-11-07T00:00:00.000Z";
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json(original));
    const repository = createHttpRepository({ fetch });
    await repository.saveCharacter(original);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("X-Character-Expected-Updated-At")).toBe("new");
    await repository.loadCharacter(original.id);
    await repository.saveCharacter({ ...original,updatedAt: "2099-01-01T00:00:00.000Z" });
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).get("X-Character-Expected-Updated-At")).toBe(original.updatedAt);
  });

  it("exposes both full documents on a CAS conflict", async () => {
    const local = createCharacter({ name: "Местная" }), server = { ...local,name: "Серверная" };
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ error: "Конфликт",server },{ status: 409 }));
    const failure = createHttpRepository({ fetch }).saveCharacter(local,{ expectedUpdatedAt: local.updatedAt });
    await expect(failure).rejects.toBeInstanceOf(CharacterConflictError);
    await expect(failure).rejects.toMatchObject({ local,server,expectedUpdatedAt: local.updatedAt });
  });

  it.each([{}, { id: "different",updatedAt: "2026-11-07T00:00:00Z" }, { id: "hero",updatedAt: "invalid" }])(
    "does not acknowledge a malformed successful document (%j)", async (payload) => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(payload));
      const character = { ...createCharacter(),id: "hero" };
      await expect(createHttpRepository({ fetch }).saveCharacter(character)).rejects.toThrow("не подтвердил");
    },
  );

  it.each([
    [JSON.stringify({ error: "Нет доступа" }), "Нет доступа"],
    [JSON.stringify({ error: { unexpected: true } }), "Ошибка 503"],
    ["<html>Unavailable</html>", "Ошибка 503"],
  ])("reports useful errors for unsuccessful responses (%s)", async (body, message) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body, { status: 503 }));
    await expect(createHttpRepository({ fetch }).loadCharacter("one"))
      .rejects.toMatchObject({ name: "StorageRequestError", status: 503, message });
    expect(StorageRequestError.prototype).toBeInstanceOf(Error);
  });

  it("reports malformed successful responses instead of exposing a parser error", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("<html>proxy</html>", { status: 200 }))
      .mockResolvedValueOnce(Response.json({ characters: "nope" }));
    const repository = createHttpRepository({ fetch });
    await expect(repository.loadCharacter("one")).rejects.toMatchObject({
      name: "StorageRequestError",
      status: 200,
      message: "Сервер вернул некорректный ответ",
    });
    await expect(repository.listCharacters()).rejects.toMatchObject({
      name: "StorageRequestError",
      status: 502,
      message: "Сервер вернул некорректный список героев",
    });
  });

  it("uploads prepared avatars as binary WebP and removes them", async () => {
    const avatar = { url: "/api/characters/hero/avatar?v=1", updatedAt: "2026-01-01T00:00:00.000Z" };
    const image = new Blob(["RIFF....WEBP"], { type: "image/webp" });
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(avatar))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const repository = createHttpRepository({ fetch });

    expect(await repository.uploadAvatar("hero", image)).toEqual(avatar);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/characters/hero/avatar");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(image);
    expect(new Headers(init?.headers).get("Content-Type")).toBe("image/webp");

    await expect(repository.deleteAvatar("hero")).resolves.toBeUndefined();
    expect(fetch.mock.calls[1][0]).toBe("/api/characters/hero/avatar");
    expect(fetch.mock.calls[1][1]?.method).toBe("DELETE");
  });

  it("aborts stalled requests and lets a subsequent explicit retry succeed", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }))
      .mockResolvedValueOnce(Response.json({ characters: [] }));
    const repository = createHttpRepository({ fetch, timeoutMs: 100 });
    const failure = expect(repository.listCharacters()).rejects.toThrow("Сервер не ответил вовремя");
    await vi.advanceTimersByTimeAsync(100);
    await failure;
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(repository.listCharacters()).resolves.toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
