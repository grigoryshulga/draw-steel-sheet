import type { Character, CharacterSummary } from "../../types";
import type { CharacterRepository } from "./repository";

export class StorageRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "StorageRequestError";
  }
}

/** All local persistence requests share error handling and a bounded wait.
 * Writes are never retried implicitly: the autosave controller owns retries.
 */
export function createHttpRepository({
  fetch: fetchRequest = globalThis.fetch,
  timeoutMs = 30_000,
}: { fetch?: typeof fetch; timeoutMs?: number } = {}): CharacterRepository {
  async function readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      // Proxies and misconfigured servers can answer with HTML and a 2xx status.
      throw new StorageRequestError("Сервер вернул некорректный ответ", response.status);
    }
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(init?.headers);
    if (init?.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    try {
      const response = await fetchRequest(path, {
        ...init,
        signal: controller.signal,
        headers,
      });
      if (!response.ok) {
        let message = `Ошибка ${response.status}`;
        try {
          const payload: unknown = await response.json();
          if (payload && typeof payload === "object" && "error" in payload &&
              typeof payload.error === "string" && payload.error.trim()) {
            message = payload.error;
          }
        } catch {
          // Proxies can return HTML instead of an API error document.
        }
        throw new StorageRequestError(message, response.status);
      }
      if (response.status === 204) return undefined as T;
      return await readJson<T>(response);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Сервер не ответил вовремя. Повторите сохранение.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  const path = (id: string) => `/api/characters/${encodeURIComponent(id)}`;
  return {
    async listCharacters() {
      const payload = await request<{ characters?: unknown }>("/api/characters");
      if (!payload || !Array.isArray(payload.characters)) {
        throw new StorageRequestError("Сервер вернул некорректный список героев", 502);
      }
      return payload.characters as CharacterSummary[];
    },
    loadCharacter: (id) => request<Character>(path(id)),
    saveCharacter: (character) => request<Character>(path(character.id), {
      method: "PUT",
      body: JSON.stringify(character),
    }),
    deleteCharacter: (id) => request<void>(path(id), { method: "DELETE" }),
  };
}
