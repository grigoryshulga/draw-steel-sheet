import type { Character, CharacterSummary } from "../../types";
import { CharacterConflictError, CharacterStorageError, isStorageUnavailable,
  type CharacterRepository, type CharacterSaveOptions } from "./repository";
import { createOfflineStore, type CharacterOfflineStore, type CharacterRecovery } from "./offline-store";

export interface CharacterPersistenceState {
  status: "idle" | "pending" | "saving" | "saved" | "offline" | "conflict" | "error";
  pendingCount: number;
  conflicts: CharacterRecovery[];
  recoveries: CharacterRecovery[];
  /** Nonempty means edits are only safe in memory until storage works again. */
  localError: string;
  error: string;
}
export interface OfflineCharacterRepository extends CharacterRepository {
  stageCharacter(document: Character, options?: CharacterSaveOptions): void;
  isPending(id: string): boolean;
  getState(): CharacterPersistenceState;
  subscribe(listener: (state: CharacterPersistenceState) => void): () => void;
  syncPending(): Promise<void>;
  retryLocalPersistence(): void;
  resolveConflict(recoveryId: string, choice: "keep-local" | "use-server"): Promise<Character | null>;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const uniqueId = () => globalThis.crypto.randomUUID();
const summary = (doc: Character): CharacterSummary => ({ id: doc.id, name: doc.name,
  className: doc.className, ancestry: doc.ancestry, level: doc.level, updatedAt: doc.updatedAt,
  ...(doc.avatar?.url ? { avatarUrl: doc.avatar.url } : {}) });

/** Private owner-document cache. A successful save ALWAYS means remote ack.
 * Local persistence is synchronous and precedes even autosave's debounce.
 * Each instance writes a separate recovery handle. Parent/version links hide
 * superseded edits without deleting an edit another tab may still be changing.
 */
export function createOfflineRepository({
  remote, scope, store = createOfflineStore(scope),
  online = () => typeof navigator === "undefined" || navigator.onLine !== false,
}: {
  remote: CharacterRepository;
  scope: string;
  store?: CharacterOfflineStore;
  online?: () => boolean;
}): OfflineCharacterRepository {
  const listeners = new Set<(state: CharacterPersistenceState) => void>();
  const memory = new Map<string, CharacterRecovery>();
  const snapshots = new Map<string, Character>();
  const bases = new Map<string, Character | null>();
  const active = new Map<string, string>();
  const sources = new Map<string, CharacterRecovery>();
  const adoptions = new Map<string, string>();
  const queues = new Map<string, Promise<unknown>>();
  let index: CharacterSummary[] = [];
  let localError = "", error = "";
  let status: CharacterPersistenceState["status"] = "idle";

  function local<T>(operation: () => T, fallback: T): T {
    try { return operation(); }
    catch {
      localError = "Не удалось надёжно сохранить копию на устройстве. Не закрывайте лист; скачайте JSON.";
      return fallback;
    }
  }
  function recoveries() {
    const records = new Map(local(() => store.recoveries(), []).map(record => [record.id,record]));
    for (const [id,record] of memory) records.set(id,record);
    return [...records.values()].sort((a,b) => a.editedAt.localeCompare(b.editedAt) || a.id.localeCompare(b.id));
  }
  function pending() {
    const records = recoveries();
    const parents = new Set(records.filter(r => r.parent).map(r => `${r.parent!.id}:${r.parent!.versionId}`));
    return records.filter(r => r.state === "pending" && !parents.has(`${r.id}:${r.versionId}`));
  }
  function getState(): CharacterPersistenceState {
    const records = recoveries(), dirty = pending();
    const conflicts = dirty.filter(r => r.conflict);
    const liveIds = new Set(dirty.map(record => record.id));
    return { status: conflicts.length ? "conflict" : dirty.length && (status === "saved" || status === "idle") ? "pending" : status,
      pendingCount: dirty.length, conflicts: clone(conflicts),
      recoveries: clone(records.map(record => record.state === "pending" && !liveIds.has(record.id)
        ? { ...record,state: "resolved" as const } : record)), localError, error };
  }
  function emit() { const state = getState(); for (const listener of listeners) listener(state); }
  function put(record: CharacterRecovery) {
    const copy = clone(record);
    memory.set(copy.id,copy);
    local(() => store.putRecovery(copy), undefined);
  }
  function remember(doc: Character) {
    snapshots.set(doc.id,clone(doc));
    local(() => store.putSnapshot(doc), undefined);
  }
  function cached(id: string) {
    return snapshots.get(id) ?? local(() => store.snapshots(), []).find(doc => doc.id === id);
  }
  function requireOnline() {
    if (!online()) throw new CharacterStorageError("Изменения ожидают сети",0);
  }
  function serial<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = queues.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(action);
    queues.set(id,next);
    const cleanup = () => { if (queues.get(id) === next) queues.delete(id); };
    void next.then(cleanup,cleanup);
    return next;
  }
  function stageCharacter(document: Character, options?: CharacterSaveOptions) {
    const own = memory.get(active.get(document.id) ?? "");
    if (own?.state === "pending" && same(own.document,document) && !options) return;
    // Inherit only the version actually shown to this editor. A different tab
    // may have staged an unrelated branch since this editor loaded its hero.
    const inherited = own ? undefined : sources.get(document.id);
    const base = bases.has(document.id) ? bases.get(document.id)! : null;
    const record: CharacterRecovery = {
      id: own?.id ?? uniqueId(), versionId: uniqueId(),
      ...(own?.parent ? { parent: own.parent } : !own && inherited ?
        { parent: { id: inherited.id, versionId: inherited.versionId } } : {}),
      document: clone(document), base: own?.state === "pending" ? own.base : inherited?.base ?? base,
      expectedUpdatedAt: options ? options.expectedUpdatedAt : own?.state === "pending" ? own.expectedUpdatedAt :
        inherited?.expectedUpdatedAt ?? base?.updatedAt ?? null,
      editedAt: new Date().toISOString(), state: "pending",
      ...((own?.state === "pending" ? own.conflict : inherited?.conflict) ?
        { conflict: clone((own?.state === "pending" ? own.conflict : inherited?.conflict)!) } : {}),
    };
    active.set(document.id,record.id);
    put(record);
    status = "pending"; error = ""; emit();
  }
  function adopt(input: CharacterRecovery): CharacterRecovery {
    if (memory.has(input.id)) return input;
    const key = `${input.id}:${input.versionId}`;
    const existing = memory.get(adoptions.get(key) ?? "");
    if (existing) return existing;
    // A restarted or second tab must NEVER update the original writer's key,
    // even to record an acknowledgement: that writer might still be editing it.
    const record = { ...clone(input),id: uniqueId(),versionId: uniqueId(),
      parent: { id: input.id,versionId: input.versionId } };
    put(record);
    adoptions.set(key,record.id);
    if (!active.has(input.document.id)) active.set(input.document.id,record.id);
    return record;
  }
  async function saveRecovery(input: CharacterRecovery): Promise<Character> {
    if (input.conflict) throw new CharacterConflictError(input.document,input.conflict.server,input.expectedUpdatedAt);
    input = adopt(input);
    return serial(input.document.id, async () => {
      const latest = recoveries().find(r => r.id === input.id) ?? input;
      if (latest.state === "resolved" && latest.versionId === input.versionId) {
        const saved = bases.get(input.document.id) ?? cached(input.document.id);
        if (saved) return clone(saved);
      }
      const record = { ...input, expectedUpdatedAt: latest.expectedUpdatedAt, base: latest.base };
      if (record.conflict) throw new CharacterConflictError(record.document,record.conflict.server,record.expectedUpdatedAt);
      status = "saving"; error = ""; emit();
      try {
        requireOnline();
        const saved = await remote.saveCharacter(record.document,{ expectedUpdatedAt: record.expectedUpdatedAt });
        remember(saved); bases.set(saved.id,saved); sources.delete(saved.id);
        const current = recoveries().find(r => r.id === record.id) ?? record;
        if (current.versionId === record.versionId) {
          put({ ...current, state: "resolved" });
        } else {
          // A later edit is durable already; rebase it only over our own ack.
          put({ ...current, base: saved, expectedUpdatedAt: saved.updatedAt });
        }
        status = "saved"; emit();
        return saved;
      } catch (failure) {
        const current = recoveries().find(r => r.id === record.id) ?? record;
        if (failure instanceof CharacterConflictError) {
          put({ ...current, conflict: { server: clone(failure.server),detectedAt: new Date().toISOString() } });
          status = "conflict";
        } else status = isStorageUnavailable(failure) ? "offline" : "error";
        error = failure instanceof Error ? failure.message : "Ошибка сохранения";
        emit(); throw failure;
      }
    });
  }

  const repository: OfflineCharacterRepository = {
    stageCharacter, getState,
    retryLocalPersistence() {
      try {
        for (const doc of snapshots.values()) store.putSnapshot(doc);
        for (const record of memory.values()) store.putRecovery(record);
        if (index.length) store.putSummaries(index);
        localError = "";
      } catch {
        localError = "Не удалось надёжно сохранить копию на устройстве. Не закрывайте лист; скачайте JSON.";
      }
      emit();
    },
    subscribe(listener) { listeners.add(listener); listener(getState()); return () => { listeners.delete(listener); }; },
    isPending: id => pending().some(r => r.document.id === id),
    async listCharacters() {
      try {
        requireOnline();
        index = await remote.listCharacters();
        local(() => store.putSummaries(index),undefined);
        status = "idle"; error = "";
      } catch (failure) {
        if (!isStorageUnavailable(failure)) throw failure;
        index = local(() => store.summaries(),index);
        for (const doc of local(() => store.snapshots(),[...snapshots.values()])) {
          if (!index.some(item => item.id === doc.id)) index.push(summary(doc));
        }
        status = "offline";
        if (!index.length && !pending().length) { emit(); throw failure; }
      }
      const result = new Map(index.map(item => [item.id,item]));
      for (const record of pending()) result.set(record.document.id,summary(record.document));
      emit();
      return [...result.values()].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async loadCharacter(id) {
      const dirty = pending().filter(r => r.document.id === id).at(-1);
      if (dirty) {
        bases.set(id,dirty.base); sources.set(id,clone(dirty));
        emit(); return clone(dirty.document);
      }
      try {
        requireOnline();
        const doc = await remote.loadCharacter(id);
        remember(doc); bases.set(id,doc); sources.delete(id); status = "saved"; error = ""; emit();
        return doc;
      } catch (failure) {
        if (!isStorageUnavailable(failure)) throw failure;
        const doc = cached(id);
        if (!doc) throw failure;
        bases.set(id,doc); status = "offline"; emit(); return clone(doc);
      }
    },
    async saveCharacter(document, options) {
      stageCharacter(document,options);
      const record = memory.get(active.get(document.id)!)!;
      return saveRecovery(record);
    },
    async syncPending() {
      let firstFailure: unknown;
      // Different local branches remain independent and each CAS is checked.
      for (const record of pending()) {
        try { await saveRecovery(record); }
        catch (failure) { firstFailure ??= failure; }
      }
      if (firstFailure) throw firstFailure;
    },
    async resolveConflict(recoveryId, choice) {
      const source = pending().find(r => r.id === recoveryId);
      if (!source?.conflict) throw new Error("Конфликт больше не ожидает решения");
      const record = adopt(source);
      return serial(record.document.id, async () => {
        requireOnline();
        if (choice === "use-server") {
          let server: Character | null;
          try { server = await remote.loadCharacter(record.document.id); }
          catch (failure) {
            if (!(failure instanceof CharacterStorageError) || failure.status !== 404) throw failure;
            server = null;
          }
          if (server) remember(server);
          else {
            snapshots.delete(record.document.id);
            local(() => store.removeSnapshot(record.document.id),undefined);
          }
          // Persist the chosen snapshot before clearing the pending branch.
          // Keep the original pair downloadable even after the choice.
          put({ ...record,state: "resolved",resolution: choice });
          bases.set(record.document.id,server); sources.delete(record.document.id);
          active.delete(record.document.id);
          status = "saved"; error = ""; emit(); return server;
        }
        try {
          const saved = await remote.saveCharacter(record.document,{
            expectedUpdatedAt: record.conflict!.server?.updatedAt ?? null,
          });
          // Do not rewrite the conflict pair with the resolution's new timestamp.
          remember(saved);
          put({ ...record,state: "resolved",resolution: choice });
          bases.set(saved.id,saved); sources.delete(saved.id); active.delete(saved.id);
          status = "saved"; error = ""; emit(); return saved;
        } catch (failure) {
          if (failure instanceof CharacterConflictError) {
            // Preserve the previous pair as history before storing a newer conflict.
            put({ ...record,id: uniqueId(),state: "resolved" });
            put({ ...record,conflict: { server: failure.server,detectedAt: new Date().toISOString() } });
          }
          error = failure instanceof Error ? failure.message : "Ошибка сохранения";
          status = isStorageUnavailable(failure) ? "offline" : "error"; emit(); throw failure;
        }
      });
    },
    async deleteCharacter(id) {
      await serial(id,async () => { requireOnline(); await remote.deleteCharacter(id); });
      for (const record of pending().filter(r => r.document.id === id)) put({ ...adopt(record),state: "resolved" });
      snapshots.delete(id); bases.delete(id); active.delete(id);
      index = index.filter(doc => doc.id !== id);
      local(() => { store.removeSnapshot(id); store.putSummaries(index); },undefined);
      emit();
    },
    uploadAvatar: (id,image) => { requireOnline(); return remote.uploadAvatar(id,image); },
    deleteAvatar: id => { requireOnline(); return remote.deleteAvatar(id); },
  };
  return repository;
}
