import { afterEach, describe, expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { createAutosave } from "../src/lib/autosave";
import { createOfflineStore } from "../src/lib/persistence/offline-store";
import { createOfflineRepository } from "../src/lib/persistence/offline-repository";
import { CharacterConflictError, CharacterStorageError, type CharacterRepository } from "../src/lib/persistence/repository";
import type { Character } from "../src/types";

function storage() {
  const entries = new Map<string,string>();
  return {
    get length() { return entries.size; },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string,value: string) => { entries.set(key,value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}
function backend() {
  let server: Character | null = createCharacter({ name: "Исходный" });
  server.updatedAt = "2026-11-07T00:00:00.000Z";
  let revision = 0;
  const remote: CharacterRepository = {
    listCharacters: vi.fn(async () => server ? [{ id: server.id, name: server.name, className: server.className,
      ancestry: server.ancestry, level: server.level, updatedAt: server.updatedAt }] : []),
    loadCharacter: vi.fn(async () => {
      if (!server) throw new CharacterStorageError("Не найден",404);
      return structuredClone(server);
    }),
    saveCharacter: vi.fn(async (document,options) => {
      if (options?.expectedUpdatedAt !== (server?.updatedAt ?? null)) {
        throw new CharacterConflictError(document,structuredClone(server),options?.expectedUpdatedAt ?? null);
      }
      server = { ...structuredClone(document),updatedAt: `2026-11-07T00:00:00.${String(++revision).padStart(3,"0")}Z` };
      return structuredClone(server);
    }),
    deleteCharacter: vi.fn(async () => { server = null; }),
    uploadAvatar: vi.fn(), deleteAvatar: vi.fn(),
  };
  return { remote, get server() { return server!; }, set server(doc: Character) { server = doc; } };
}
afterEach(() => vi.useRealTimers());

describe("durable private hero persistence", () => {
  it("stages before debounce, reloads offline, and retries only after remote acknowledgement", async () => {
    vi.useFakeTimers();
    const disk = storage(), cloud = backend();
    let online = true;
    const create = () => createOfflineRepository({ remote: cloud.remote,scope: "account-a",
      store: createOfflineStore("account-a",disk),online: () => online });
    const first = create();
    const original = await first.loadCharacter(cloud.server.id);
    const states: string[] = [];
    const autosave = createAutosave({ save: first.saveCharacter,onEdit: first.stageCharacter,
      onStatus: status => states.push(status) });
    autosave.load(original);
    online = false;
    autosave.edit({ ...original,name: "Правка без сети" });
    expect(cloud.remote.saveCharacter).not.toHaveBeenCalled();
    expect(states.at(-1)).toBe("pending");
    // Simulate a killed tab before its 650ms debounce has even run.
    autosave.dispose();
    const reopened = create();
    expect((await reopened.listCharacters())[0].name).toBe("Правка без сети");
    expect((await reopened.loadCharacter(original.id)).name).toBe("Правка без сети");
    await expect(reopened.syncPending()).rejects.toThrow("сети");
    expect(reopened.getState()).toMatchObject({ status: "offline",pendingCount: 1 });
    online = true;
    const ack = Promise.withResolvers<Character>();
    vi.mocked(cloud.remote.saveCharacter).mockImplementationOnce(() => ack.promise);
    const syncing = reopened.syncPending();
    await vi.waitFor(() => expect(cloud.remote.saveCharacter).toHaveBeenCalledTimes(1));
    expect(reopened.getState()).toMatchObject({ status: "saving",pendingCount: 1 });
    ack.resolve({ ...original,name: "Правка без сети",updatedAt: "2026-11-07T01:00:00.000Z" });
    await syncing;
    expect(reopened.getState()).toMatchObject({ status: "saved",pendingCount: 0 });
    online = false;
    expect((await create().loadCharacter(original.id)).name).toBe("Правка без сети");
  });

  it("keeps server failures dirty across restart and later saves the same expected revision", async () => {
    const disk = storage(), cloud = backend();
    const create = () => createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk) });
    const first = create();
    const doc = await first.loadCharacter(cloud.server.id);
    vi.mocked(cloud.remote.saveCharacter).mockRejectedValueOnce(new CharacterStorageError("Сбой сервера",503));
    await expect(first.saveCharacter({ ...doc,name: "Не потерять" })).rejects.toThrow("Сбой");
    expect(first.getState()).toMatchObject({ status: "offline",pendingCount: 1 });
    const second = create();
    await second.syncPending();
    expect(cloud.server.name).toBe("Не потерять");
    expect(vi.mocked(cloud.remote.saveCharacter).mock.calls[1][1]).toEqual({ expectedUpdatedAt: doc.updatedAt });
    expect(second.getState().pendingCount).toBe(0);
  });

  it("preserves both device versions on conflict, including after a restart and explicit use-server", async () => {
    const cloud = backend(), disk = storage();
    const left = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",storage()) });
    const right = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk) });
    const original = await left.loadCharacter(cloud.server.id);
    await right.loadCharacter(original.id);
    await left.saveCharacter({ ...original,name: "Другое устройство" });
    await expect(right.saveCharacter({ ...original,name: "Местная версия" })).rejects.toBeInstanceOf(CharacterConflictError);
    const reopened = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk) });
    const [conflict] = reopened.getState().conflicts;
    expect(conflict.document.name).toBe("Местная версия");
    expect(conflict.conflict?.server?.name).toBe("Другое устройство");
    const calls = vi.mocked(cloud.remote.saveCharacter).mock.calls.length;
    await expect(reopened.syncPending()).rejects.toBeInstanceOf(CharacterConflictError);
    expect(cloud.remote.saveCharacter).toHaveBeenCalledTimes(calls);
    expect((await reopened.resolveConflict(conflict.id,"use-server"))?.name).toBe("Другое устройство");
    expect(reopened.getState().pendingCount).toBe(0);
    const archived = reopened.getState().recoveries.find(r => r.id === conflict.id)!;
    expect(archived.state).toBe("resolved");
    expect(archived.document.name).toBe("Местная версия");
    expect(archived.conflict?.server?.name).toBe("Другое устройство");
  });

  it("keep-local uses CAS against the chosen server version and retains both originals", async () => {
    const cloud = backend();
    const repo = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",storage()) });
    const original = await repo.loadCharacter(cloud.server.id);
    cloud.server = { ...cloud.server,name: "Сервер",updatedAt: "2026-11-07T03:00:00.000Z" };
    await expect(repo.saveCharacter({ ...original,name: "Местная" })).rejects.toBeInstanceOf(CharacterConflictError);
    const [conflict] = repo.getState().conflicts;
    await repo.resolveConflict(conflict.id,"keep-local");
    expect(cloud.server.name).toBe("Местная");
    expect(vi.mocked(cloud.remote.saveCharacter).mock.calls.at(-1)?.[1]).toEqual({
      expectedUpdatedAt: "2026-11-07T03:00:00.000Z",
    });
    expect(repo.getState().recoveries.find(r => r.id === conflict.id)?.conflict?.server?.name).toBe("Сервер");
    expect(repo.getState().pendingCount).toBe(0);
  });

  it("isolates cached snapshots, lists and dirty queues by account", async () => {
    const disk = storage(), cloud = backend();
    const first = createOfflineRepository({ remote: cloud.remote,scope: "user-a",store: createOfflineStore("user-a",disk) });
    const doc = await first.loadCharacter(cloud.server.id);
    first.stageCharacter({ ...doc,name: "Секрет аккаунта A" });
    const second = createOfflineRepository({ remote: cloud.remote,scope: "user-b",store: createOfflineStore("user-b",disk),online: () => false });
    expect(second.getState().recoveries).toEqual([]);
    await expect(second.loadCharacter(doc.id)).rejects.toThrow("сети");
    await expect(second.listCharacters()).rejects.toThrow("сети");
    await second.syncPending();
    expect(cloud.remote.saveCharacter).not.toHaveBeenCalled();
  });

  it("does not hide access denial or deletion behind a cached clean document", async () => {
    const cloud = backend();
    const repo = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",storage()) });
    const doc = await repo.loadCharacter(cloud.server.id);
    vi.mocked(cloud.remote.loadCharacter).mockRejectedValueOnce(new CharacterStorageError("Нет доступа",403));
    await expect(repo.loadCharacter(doc.id)).rejects.toMatchObject({ status: 403 });
    vi.mocked(cloud.remote.loadCharacter).mockRejectedValueOnce(new CharacterStorageError("Удалён",404));
    await expect(repo.loadCharacter(doc.id)).rejects.toMatchObject({ status: 404 });
  });

  it("never overwrites concurrent item trade inventory with an older full-document save", async () => {
    const cloud = backend();
    const repo = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",storage()) });
    const original = await repo.loadCharacter(cloud.server.id);
    const tradedInventory = [{ id: "gift",name: "Подарок",category: "gear" as const,qty: 1,equipped: false,notes: "" }];
    cloud.server = { ...cloud.server,inventory: tradedInventory,updatedAt: "2026-11-07T04:00:00.000Z" };
    await expect(repo.saveCharacter({ ...original,name: "Новое имя" })).rejects.toBeInstanceOf(CharacterConflictError);
    expect(cloud.server.inventory).toEqual(tradedInventory);
    const [conflict] = repo.getState().conflicts;
    expect(conflict.conflict?.server?.inventory).toEqual(tradedInventory);
    expect(conflict.document.inventory).toEqual(original.inventory);
  });

  it("keeps the latest edit durable while an older revision is being acknowledged", async () => {
    const disk = storage(), cloud = backend();
    const repo = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk) });
    const doc = await repo.loadCharacter(cloud.server.id);
    const ack = Promise.withResolvers<Character>();
    vi.mocked(cloud.remote.saveCharacter).mockImplementationOnce(() => ack.promise);
    const saving = repo.saveCharacter({ ...doc,name: "Первое" });
    await vi.waitFor(() => expect(cloud.remote.saveCharacter).toHaveBeenCalledTimes(1));
    repo.stageCharacter({ ...doc,name: "Последнее" });
    const saved = { ...doc,name: "Первое",updatedAt: "2026-11-07T05:00:00.000Z" };
    ack.resolve(saved);
    await saving;
    expect(repo.getState()).toMatchObject({ pendingCount: 1,status: "pending" });
    const reopened = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk),online: () => false });
    expect((await reopened.loadCharacter(doc.id)).name).toBe("Последнее");
    expect(reopened.getState().recoveries.find(r => r.state === "pending")?.expectedUpdatedAt).toBe(saved.updatedAt);
  });

  it("keeps two offline tabs as separate branches rather than losing one local version", async () => {
    const disk = storage(), cloud = backend();
    const create = () => createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk) });
    const left = create(), right = create();
    const original = await left.loadCharacter(cloud.server.id);
    await right.loadCharacter(original.id);
    left.stageCharacter({ ...original,name: "Левая вкладка" });
    right.stageCharacter({ ...original,name: "Правая вкладка" });
    expect(create().getState().pendingCount).toBe(2);
    await expect(create().syncPending()).rejects.toBeInstanceOf(CharacterConflictError);
    const records = create().getState().recoveries;
    expect([...new Set(records.map(r => r.document.name))].sort()).toEqual(["Левая вкладка","Правая вкладка"]);
    expect(records.filter(r => r.conflict)).toHaveLength(1);
  });

  it("a restored editor can continue offline without replaying an obsolete ancestor", async () => {
    const disk = storage(), cloud = backend();
    const create = () => createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk) });
    const first = create(), original = await first.loadCharacter(cloud.server.id);
    first.stageCharacter({ ...original,name: "До закрытия" });
    const second = create(), restored = await second.loadCharacter(original.id);
    second.stageCharacter({ ...restored,name: "После открытия" });
    expect(second.getState().pendingCount).toBe(1);
    await second.syncPending();
    expect(cloud.server.name).toBe("После открытия");
    expect(cloud.remote.saveCharacter).toHaveBeenCalledTimes(1);
    expect(create().getState().pendingCount).toBe(0);
    // Both source documents still exist as recovery handles.
    expect(create().getState().recoveries).toHaveLength(2);
  });

  it("a second tab acknowledging a recovered write cannot replace the first tab's newer local edit", async () => {
    const disk = storage(), cloud = backend();
    const create = () => createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk) });
    const editing = create(),doc = await editing.loadCharacter(cloud.server.id);
    editing.stageCharacter({ ...doc,name: "Отправляется" });
    const ack = Promise.withResolvers<Character>();
    vi.mocked(cloud.remote.saveCharacter).mockImplementationOnce(() => ack.promise);
    const recovering = create(),syncing = recovering.syncPending();
    await vi.waitFor(() => expect(cloud.remote.saveCharacter).toHaveBeenCalledTimes(1));
    editing.stageCharacter({ ...doc,name: "Новая правка первой вкладки" });
    ack.resolve({ ...doc,name: "Отправляется",updatedAt: "2026-11-07T06:00:00Z" });
    await syncing;
    const reopened = create();
    expect((await reopened.loadCharacter(doc.id)).name).toBe("Новая правка первой вкладки");
    expect(reopened.getState().pendingCount).toBe(1);
    expect(reopened.getState().recoveries.some(r => r.document.name === "Отправляется")).toBe(true);
  });

  it("warns when local storage is unavailable without pretending memory is durable", async () => {
    const disk = storage(), cloud = backend();
    disk.setItem = () => { throw new DOMException("Quota exceeded","QuotaExceededError"); };
    const repo = createOfflineRepository({ remote: cloud.remote,scope: "a",store: createOfflineStore("a",disk),online: () => false });
    repo.stageCharacter({ ...cloud.server,name: "В памяти" });
    expect(repo.getState()).toMatchObject({ pendingCount: 1,status: "pending" });
    expect(repo.getState().localError).toContain("Не удалось надёжно");
    expect((await repo.loadCharacter(cloud.server.id)).name).toBe("В памяти");
  });
});
