import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpRepository, StorageRequestError } from "../src/lib/persistence/http-repository";
import { createCharacter } from "../src/lib/defaults";

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
