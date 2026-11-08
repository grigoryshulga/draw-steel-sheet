import type { Character, CharacterSummary } from "../../types";

export interface CharacterRecovery {
  id: string;
  versionId: string;
  parent?: { id: string; versionId: string };
  document: Character;
  /** The actual acknowledged document, never the editor's updatedAt. */
  base: Character | null;
  expectedUpdatedAt: string | null;
  editedAt: string;
  state: "pending" | "resolved";
  conflict?: { server: Character | null; detectedAt: string };
  resolution?: "keep-local" | "use-server";
}

export interface CharacterOfflineStore {
  snapshots(): Character[];
  putSnapshot(document: Character): void;
  removeSnapshot(id: string): void;
  summaries(): CharacterSummary[];
  putSummaries(summaries: CharacterSummary[]): void;
  recoveries(): CharacterRecovery[];
  putRecovery(recovery: CharacterRecovery): void;
  removeRecovery(id: string): void;
}

/** Synchronous, atomic per-record writes: edit() persists before the debounce.
 * Each writer uses its own recovery key so two tabs cannot overwrite its edits.
 * No public/table projections belong in this store. Scope must come from Auth.
 * Storage failures deliberately throw: the repository exposes a warning and
 * keeps an in-memory fallback, without claiming it is durable.
 */
export function createOfflineStore(
  scope: string,
  storage: Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem"> | (() => Storage) = () => globalThis.localStorage,
): CharacterOfflineStore {
  if (!scope) throw new Error("Не задан аккаунт локального хранилища");
  const prefix = `draw-steel:own-characters:v1:${encodeURIComponent(scope)}:`;
  const backend = () => typeof storage === "function" ? storage() : storage;
  const key = (kind: string, id: string) => `${prefix}${kind}:${encodeURIComponent(id)}`;
  function write(kind: string, id: string, value: unknown) {
    backend().setItem(key(kind,id), JSON.stringify({ version: 1, scope, value }));
  }
  function read<T>(entry: string): T | undefined {
    const raw = backend().getItem(entry);
    if (raw === null) return undefined;
    const envelope = JSON.parse(raw);
    if (envelope.version !== 1 || envelope.scope !== scope) throw new Error("Локальная копия повреждена");
    return envelope.value as T;
  }
  function list<T>(kind: string): T[] {
    const entries: string[] = [];
    const source = backend();
    for (let index = 0; index < source.length; index++) {
      const entry = source.key(index);
      if (entry?.startsWith(`${prefix}${kind}:`)) entries.push(entry);
    }
    return entries.flatMap(entry => {
      const value = read<T>(entry);
      return value === undefined ? [] : [value];
    });
  }
  return {
    snapshots: () => list<Character>("snapshot"),
    putSnapshot: doc => write("snapshot",doc.id,doc),
    removeSnapshot: id => backend().removeItem(key("snapshot",id)),
    summaries: () => read<CharacterSummary[]>(key("index","all")) ?? [],
    putSummaries: summaries => write("index","all",summaries),
    recoveries: () => list<CharacterRecovery>("recovery"),
    putRecovery: recovery => write("recovery",recovery.id,recovery),
    removeRecovery: id => backend().removeItem(key("recovery",id)),
  };
}
