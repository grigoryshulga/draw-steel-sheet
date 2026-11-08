import type { Character, CharacterAvatar, CharacterSummary } from "../../types";
import { CharacterConflictError, CharacterStorageError, type CharacterRepository } from "./repository";

export class StorageRequestError extends CharacterStorageError {
  constructor(message: string, readonly status: number) {
    super(message, status);
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
  const revisions = new Map<string, string>();
  function document(value: Character, id: string): Character {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.id !== id ||
        typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) {
      throw new StorageRequestError("Сервер не подтвердил версию героя", 502);
    }
    return value;
  }
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
        let payload: unknown;
        try {
          payload = await response.json();
          if (payload && typeof payload === "object" && "error" in payload &&
              typeof payload.error === "string" && payload.error.trim()) {
            message = payload.error;
          }
        } catch {
          // Proxies can return HTML instead of an API error document.
        }
        if (response.status === 409 && init?.method === "PUT" &&
            payload && typeof payload === "object" && "server" in payload) {
          throw new CharacterConflictError(JSON.parse(String(init.body)) as Character,
            payload.server as Character | null,
            headers.get("X-Character-Expected-Updated-At") === "new" ? null :
              headers.get("X-Character-Expected-Updated-At"));
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
    async loadCharacter(id) {
      const loaded = document(await request<Character>(path(id)), id);
      revisions.set(id, loaded.updatedAt);
      return loaded;
    },
    async saveCharacter(character, options) {
      const expected = options ? options.expectedUpdatedAt : revisions.get(character.id) ?? null;
      const saved = document(await request<Character>(path(character.id), {
        method: "PUT",
        headers: { "X-Character-Expected-Updated-At": expected ?? "new" },
        body: JSON.stringify(character),
      }), character.id);
      revisions.set(character.id, saved.updatedAt);
      return saved;
    },
    async deleteCharacter(id) {
      await request<void>(path(id), { method: "DELETE" });
      revisions.delete(id);
    },
    uploadAvatar: (id, image) => request<CharacterAvatar>(`${path(id)}/avatar`, {
      method: "PUT",
      body: image,
      headers: { "Content-Type": "image/webp" },
    }),
    deleteAvatar: async (id) => {
      await request<void>(`${path(id)}/avatar`, { method: "DELETE" });
    },
  };
}
