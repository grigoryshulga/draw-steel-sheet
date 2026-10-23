import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PORT = 8899;
const BASE = `http://127.0.0.1:${PORT}`;

let child: ChildProcess | undefined;
let dataDir: string;
let serverStderr = "";

async function waitForHealth(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "нет попыток";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
      lastError = `status ${res.status}`;
    } catch (error) {
      lastError = String(error);
    }
    // Реальные задержки оправданы: опрашиваем внешний процесс сервера,
    // детерминированное управление временем тут неприменимо.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Сервер не поднялся за ${timeoutMs}мс: ${lastError}\n${serverStderr}`);
}

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dss-api-"));
  child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      DS_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    serverStderr += chunk.toString();
  });
  await waitForHealth();
}, 30000);

afterAll(async () => {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    // SIGKILL-страховка по истечении реальных 3 секунд — внешнее поведение ОС.
    const { promise, resolve } = Promise.withResolvers<void>();
    const killTimer = setTimeout(() => child?.kill("SIGKILL"), 3000);
    child.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });
    await promise;
  }
  await fs.rm(dataDir, { recursive: true, force: true });
});

async function getJson(pathname: string) {
  const res = await fetch(`${BASE}${pathname}`);
  return { res, body: (await res.json()) as Record<string, unknown> };
}

describe("API smoke (node server/index.mjs, production, temp data dir)", () => {
  it("GET /api/health → 200 {ok:true}", async () => {
    const { res, body } = await getJson("/api/health");
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("GET /api/characters → 200 {characters:[]} на чистом каталоге", async () => {
    const { res, body } = await getJson("/api/characters");
    expect(res.status).toBe(200);
    expect(body.characters).toEqual([]);
  });

  it("PUT /api/characters/test-hero → 200, id и updatedAt проставлены", async () => {
    const res = await fetch(`${BASE}/api/characters/test-hero`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Дым", className: "Оружник", level: 3 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe("test-hero");
    expect(body.name).toBe("Дым");
    expect(typeof body.updatedAt).toBe("string");
    expect(String(body.updatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("GET /api/characters/test-hero возвращает сохранённое", async () => {
    const { res, body } = await getJson("/api/characters/test-hero");
    expect(res.status).toBe(200);
    expect(body.name).toBe("Дым");
    expect(body.className).toBe("Оружник");
    expect(body.level).toBe(3);
  });

  it("GET /api/characters содержит ровно одного персонажа", async () => {
    const { body } = await getJson("/api/characters");
    const characters = body.characters as Array<Record<string, unknown>>;
    expect(characters).toHaveLength(1);
    expect(characters[0].id).toBe("test-hero");
    expect(characters[0].updatedAt).toBeTruthy();
  });

  it("DELETE /api/characters/test-hero → 200, список пуст", async () => {
    const res = await fetch(`${BASE}/api/characters/test-hero`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const { body } = await getJson("/api/characters");
    expect(body.characters).toEqual([]);

    const missing = await fetch(`${BASE}/api/characters/test-hero`);
    expect(missing.status).toBe(404);
  });

  it("traversal в id не выходит за каталог данных", async () => {
    const evilId = encodeURIComponent("../evil");
    const got = await fetch(`${BASE}/api/characters/${evilId}`);
    expect([400, 404]).toContain(got.status);

    const put = await fetch(`${BASE}/api/characters/${evilId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Злой" }),
    });
    expect([400, 404]).toContain(put.status);

    // Ни файла с злым именем, ни выхода в родительский каталог.
    const dataEntries = await fs.readdir(dataDir, { recursive: true });
    expect(dataEntries.some((entry) => entry.includes("evil"))).toBe(false);
    const parentEntries = await fs.readdir(path.dirname(dataDir));
    expect(parentEntries).not.toContain("evil.json");
  });

  it("битый JSON в PUT → 400", async () => {
    const res = await fetch(`${BASE}/api/characters/broken-json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{oops",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });
});
