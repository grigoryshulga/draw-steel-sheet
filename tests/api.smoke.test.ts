import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let BASE = "";

let child: ChildProcess | undefined;
let dataDir: string | undefined;
let serverStderr = "";

async function waitForOwnedServer(timeoutMs = 15000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const ownedChild = child;
  if (!ownedChild) throw new Error("Дочерний сервер не запущен");

  return new Promise((resolve, reject) => {
    let output = "";
    const cleanup = () => {
      clearTimeout(timer);
      ownedChild.stdout?.off("data", onData);
      ownedChild.off("error", onError);
      ownedChild.off("exit", onExit);
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(`${message}\n${serverStderr}`));
    };
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (!match) return;
      cleanup();
      resolve(`http://127.0.0.1:${match[1]}`);
    };
    const onError = (error: Error) =>
      fail(`Не удалось запустить API сервер: ${error.message}`);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
      fail(
        `API сервер завершился до готовности (code=${code}, signal=${signal})`,
      );
    const timer = setTimeout(
      () => {
        fail(
          `API сервер не сообщил о готовности за ${timeoutMs}мс. stdout: ${output}`,
        );
      },
      Math.max(0, deadline - Date.now()),
    );

    ownedChild.stdout?.on("data", onData);
    ownedChild.once("error", onError);
    ownedChild.once("exit", onExit);
  });
}

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dss-api-"));
  child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      DS_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    serverStderr += chunk.toString();
  });
  BASE = await waitForOwnedServer();
}, 30000);

afterAll(async () => {
  const ownedChild = child;
  if (
    ownedChild?.pid !== undefined &&
    ownedChild.exitCode === null &&
    ownedChild.signalCode === null
  ) {
    const exited = new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      ownedChild.once("exit", finish);
      // Recheck after installing the listener to close the exit-listener race.
      if (ownedChild.exitCode !== null || ownedChild.signalCode !== null)
        finish();
    });
    ownedChild.kill("SIGTERM");
    // Реальная страховка ОС на случай, если дочерний сервер не завершится после SIGTERM.
    const killTimer = setTimeout(() => ownedChild.kill("SIGKILL"), 3000);
    await exited;
    clearTimeout(killTimer);
  }
  if (dataDir) await fs.rm(dataDir, { recursive: true, force: true });
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

  it("the bare /api namespace returns JSON instead of the SPA document", async () => {
    const res = await fetch(`${BASE}/api`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Не найдено" });
  });

  it.each([
    ["/api/health", "GET"],
    ["/api/characters", "GET"],
    ["/api/characters/test-hero", "GET, PUT, DELETE"],
  ])("rejects unsupported methods on %s with Allow: %s", async (pathname, allow) => {
    const res = await fetch(`${BASE}${pathname}`, { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe(allow);
    expect(await res.json()).toHaveProperty("error");
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
    const res = await fetch(`${BASE}/api/characters/test-hero`, {
      method: "DELETE",
    });
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
  it("oversized request returns JSON 413 and leaves the server responsive", async () => {
    const response = await fetch(`${BASE}/api/characters/oversized`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Large", notes: "x".repeat(2 * 1024 * 1024) }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toHaveProperty("error");
    expect((await getJson("/api/health")).res.status).toBe(200);
    expect((await getJson("/api/characters/oversized")).res.status).toBe(404);
  });

});
