import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStore } from "../server/store.mjs";

/** server/store.mjs — нетипизированный JS, повторяем его контракт локально. */
interface CharacterSummaryLike {
  id: string;
  name: string;
  className: string;
  ancestry: string;
  level: number;
  updatedAt: string;
}

interface CharacterStore {
  list(): Promise<CharacterSummaryLike[]>;
  get(id: string): Promise<Record<string, unknown>>;
  save(id: string, doc: object): Promise<CharacterSummaryLike & Record<string, unknown>>;
  remove(id: string): Promise<void>;
  charactersDir: string;
}

let dataDir: string;
let store: CharacterStore;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dss-store-"));
  store = createStore(dataDir) as unknown as CharacterStore;
});

afterAll(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

function sampleDoc(name: string) {
  return {
    name,
    className: "Воин",
    ancestry: "Человек",
    level: 2,
  };
}

describe("createStore", () => {
  it("save возвращает документ с id и updatedAt, файл лежит на месте без tmp-остатков", async () => {
    const saved = await store.save("hero-1", sampleDoc("Первый"));

    expect(saved.id).toBe("hero-1");
    expect(saved.name).toBe("Первый");
    expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    const files = await fs.readdir(store.charactersDir);
    expect(files).toContain("hero-1.json");
    expect(files.filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("get возвращает сохранённый документ целиком", async () => {
    const doc = await store.get("hero-1");
    expect(doc.id).toBe("hero-1");
    expect(doc.className).toBe("Воин");
    expect(typeof doc.updatedAt).toBe("string");
  });

  it("get отсутствующего → ошибка со статусом 404", async () => {
    await expect(store.get("no-such-hero")).rejects.toMatchObject({ status: 404 });
  });

  it("list возвращает сводки; порядок — по updatedAt по убыванию", async () => {
    await store.save("hero-2", sampleDoc("Второй"));
    const list = await store.list();

    const byId = Object.fromEntries(list.map((c) => [c.id, c]));
    expect(byId["hero-1"].name).toBe("Первый");
    expect(byId["hero-2"].level).toBe(2);

    const timestamps = list.map((c) => c.updatedAt);
    const sorted = [...timestamps].sort((a, b) => (a < b ? 1 : -1));
    expect(timestamps).toEqual(sorted);
  });

  it("save обновляет updatedAt при повторной записи", async () => {
    const first = await store.save("hero-2", sampleDoc("Второй"));
    const second = await store.save("hero-2", sampleDoc("Второй-обновлённый"));
    expect(second.updatedAt >= first.updatedAt).toBe(true);
    expect(second.name).toBe("Второй-обновлённый");
    const doc = await store.get("hero-2");
    expect(doc.name).toBe("Второй-обновлённый");
  });

  it.each(["../evil", "a/b", "", "."])("некорректный id %j → статус 400", async (id) => {
    await expect(store.get(id)).rejects.toMatchObject({ status: 400 });
    await expect(store.save(id, sampleDoc("Злой"))).rejects.toMatchObject({ status: 400 });
    await expect(store.remove(id)).rejects.toMatchObject({ status: 400 });
  });

  it("id в документе, не совпадающий с id в пути → 400", async () => {
    await expect(
      store.save("hero-1", { ...sampleDoc("Двойник"), id: "hero-2" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([[1, 2, 3], "строка", null])("не-объект %j при save → 400", async (bad) => {
    await expect(store.save("bad-doc", bad as never)).rejects.toMatchObject({ status: 400 });
  });

  it("документ больше 2 МБ → 413, файл не создаётся", async () => {
    const huge = { name: "Огромный", blob: "x".repeat(2 * 1024 * 1024) };
    await expect(store.save("huge-hero", huge)).rejects.toMatchObject({ status: 413 });
    await expect(store.get("huge-hero")).rejects.toMatchObject({ status: 404 });
  });

  it("повреждённый JSON не ломает list", async () => {
    await fs.writeFile(path.join(store.charactersDir, "broken.json"), "{не json", "utf8");
    const list = await store.list();
    expect(list.some((c) => c.id === "hero-1")).toBe(true);
    expect(list.some((c) => c.id === "broken")).toBe(false);
  });

  it("remove удаляет файл, повторное удаление не падает", async () => {
    await store.remove("hero-2");
    await expect(fs.access(path.join(store.charactersDir, "hero-2.json"))).rejects.toThrow();
    await expect(store.remove("hero-2")).resolves.toBeUndefined();
  });
});
