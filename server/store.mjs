import fs from "node:fs/promises";
import path from "node:path";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_BYTES = 2 * 1024 * 1024;

export function createStore(dataDir) {
  const charactersDir = path.join(dataDir, "characters");

  async function ensureDir() {
    await fs.mkdir(charactersDir, { recursive: true });
  }

  function fileFor(id) {
    if (!ID_PATTERN.test(id)) {
      throw Object.assign(new Error("Некорректный идентификатор персонажа"), {
        status: 400,
      });
    }
    return path.join(charactersDir, `${id}.json`);
  }

  async function list() {
    await ensureDir();
    const entries = await fs.readdir(charactersDir, { withFileTypes: true });
    const characters = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(charactersDir, entry.name), "utf8");
        const doc = JSON.parse(raw);
        characters.push({
          id: doc.id,
          name: doc.name || "Без имени",
          className: doc.className || "",
          ancestry: doc.ancestry || "",
          level: doc.level ?? 1,
          updatedAt: doc.updatedAt || "",
        });
      } catch {
        // Повреждённый файл не должен ломать список.
      }
    }
    characters.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return characters;
  }

  async function get(id) {
    await ensureDir();
    try {
      const raw = await fs.readFile(fileFor(id), "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw Object.assign(new Error("Персонаж не найден"), { status: 404 });
      }
      throw error;
    }
  }

  async function save(id, doc) {
    await ensureDir();
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      throw Object.assign(new Error("Ожидается объект персонажа"), { status: 400 });
    }
    if (doc.id && doc.id !== id) {
      throw Object.assign(new Error("Идентификатор в документе не совпадает"), {
        status: 400,
      });
    }
    const target = fileFor(id);
    const payload = {
      ...doc,
      id,
      updatedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(payload, null, 2);
    if (Buffer.byteLength(json, "utf8") > MAX_BYTES) {
      throw Object.assign(new Error("Персонаж слишком большой"), { status: 413 });
    }
    const temp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temp, json, "utf8");
    await fs.rename(temp, target);
    return payload;
  }

  async function remove(id) {
    await ensureDir();
    try {
      await fs.unlink(fileFor(id));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return { list, get, save, remove, charactersDir };
}
