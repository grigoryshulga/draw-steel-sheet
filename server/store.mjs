import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_BYTES = 2 * 1024 * 1024;
/** Подготовленный портрет приходит уже сжатым; запас только на служебные заголовки. */
const MAX_AVATAR_BYTES = 512 * 1024;
// Enough parallel reads to keep large team directories fast without exhausting
// the descriptor pool on modest servers.
const LIST_CONCURRENCY = 16;

function isDocument(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function corruptDocument() {
  return Object.assign(new Error("Файл персонажа повреждён"), { status: 500 });
}

export function createStore(dataDir) {
  const charactersDir = path.join(dataDir, "characters");
  const avatarsDir = path.join(dataDir, "avatars");

  // Serialize mutations per character; unrelated characters remain independent.
  const mutations = new Map();
  function mutate(id, operation) {
    const previous = mutations.get(id) || Promise.resolve();
    const pending = previous.catch(() => {}).then(operation);
    mutations.set(id, pending);
    const cleanup = () => {
      if (mutations.get(id) === pending) mutations.delete(id);
    };
    pending.then(cleanup, cleanup);
    return pending;
  }

  async function ensureDir() {
    await fs.mkdir(charactersDir, { recursive: true });
  }

  async function ensureAvatarsDir() {
    await fs.mkdir(avatarsDir, { recursive: true });
  }

  function fileFor(id) {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      throw Object.assign(new Error("Некорректный идентификатор персонажа"), {
        status: 400,
      });
    }
    return path.join(charactersDir, `${id}.json`);
  }

  function avatarFileFor(id) {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      throw Object.assign(new Error("Некорректный идентификатор персонажа"), {
        status: 400,
      });
    }
    return path.join(avatarsDir, `${id}.webp`);
  }

  async function list() {
    await ensureDir();
    const entries = await fs.readdir(charactersDir, { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);
    const characters = [];
    for (let index = 0; index < names.length; index += LIST_CONCURRENCY) {
      const batch = names.slice(index, index + LIST_CONCURRENCY);
      const summaries = await Promise.all(batch.map((name) => readSummary(name)));
      for (const summary of summaries) {
        if (summary) characters.push(summary);
      }
    }
    characters.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id.localeCompare(b.id));
    return characters;
  }

  async function readSummary(name) {
    try {
      const raw = await fs.readFile(path.join(charactersDir, name), "utf8");
      const doc = JSON.parse(raw);
      const id = name.slice(0, -5);
      if (!isDocument(doc) || doc.id !== id || !ID_PATTERN.test(doc.id)) return null;
      return {
        id: doc.id,
        name: doc.name || "Без имени",
        className: doc.className || "",
        ancestry: doc.ancestry || "",
        level: doc.level ?? 1,
        updatedAt: doc.updatedAt || "",
        ...(doc.avatar && typeof doc.avatar.url === "string" && doc.avatar.url
          ? { avatarUrl: doc.avatar.url }
          : {}),
      };
    } catch {
      // Повреждённый файл не должен ломать список.
      return null;
    }
  }

  async function get(id) {
    await ensureDir();
    let raw;
    try {
      raw = await fs.readFile(fileFor(id), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw Object.assign(new Error("Персонаж не найден"), { status: 404 });
      }
      throw error;
    }
    let doc;
    try {
      doc = JSON.parse(raw);
    } catch {
      throw corruptDocument();
    }
    // A document must match the file that stores it; otherwise clients could
    // edit one hero while overwriting another.
    if (!isDocument(doc) || doc.id !== id) throw corruptDocument();
    return doc;
  }

  function save(id, doc) {
    return mutate(id, () => saveDocument(id, doc));
  }

  async function saveDocument(id, doc) {
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
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, json, { encoding: "utf8", flag: "wx" });
      await fs.rename(temp, target);
    } finally {
      // Never let cleanup errors mask the original write failure.
      await fs.rm(temp, { force: true }).catch(() => {});
    }
    return payload;
  }

  function remove(id) {
    return mutate(id, () => removeDocument(id));
  }

  async function removeDocument(id) {
    await ensureDir();
    try {
      await fs.unlink(fileFor(id));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    // Портрет не должен переживать героя.
    await fs.rm(avatarFileFor(id), { force: true }).catch(() => {});
  }

  function saveAvatar(id, buffer) {
    return mutate(id, () => writeAvatar(id, buffer));
  }

  async function writeAvatar(id, buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw Object.assign(new Error("Пустой файл портрета"), { status: 400 });
    }
    if (buffer.length > MAX_AVATAR_BYTES) {
      throw Object.assign(new Error("Портрет больше 512 КБ"), { status: 413 });
    }
    const isWebp =
      buffer.length > 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";
    if (!isWebp) {
      throw Object.assign(new Error("Поддерживается только WebP"), {
        status: 415,
      });
    }
    await ensureAvatarsDir();
    const target = avatarFileFor(id);
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, buffer, { flag: "wx" });
      await fs.rename(temp, target);
    } finally {
      await fs.rm(temp, { force: true }).catch(() => {});
    }
  }

  async function readAvatar(id) {
    try {
      return await fs.readFile(avatarFileFor(id));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  function removeAvatar(id) {
    return mutate(id, () => removeAvatarFile(id));
  }

  async function removeAvatarFile(id) {
    await fs.rm(avatarFileFor(id), { force: true });
  }

  return {
    list,
    get,
    save,
    remove,
    saveAvatar,
    readAvatar,
    removeAvatar,
    charactersDir,
    avatarsDir,
  };
}
