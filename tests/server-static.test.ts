import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createStaticHandler } from "../server/static.mjs";

let root: string;
let server: http.Server;
let base: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "dss-static-"));
  const dist = path.join(root, "dist");
  await fs.mkdir(dist);
  await fs.mkdir(path.join(root, "dist-private"));
  await fs.writeFile(path.join(dist, "index.html"), "<main>Application</main>");
  await fs.writeFile(path.join(dist, "app.js"), "export default 1;");
  await fs.writeFile(path.join(root, "dist-private", "secret.txt"), "secret");
  server = http.createServer(createStaticHandler(dist));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(root, { recursive: true, force: true });
});

describe("production static handler", () => {
  it("serves assets with their type and SPA routes as HTML", async () => {
    const asset = await fetch(`${base}/app.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("javascript");
    const route = await fetch(`${base}/characters/hero`);
    expect(route.status).toBe(200);
    expect(await route.text()).toContain("Application");
  });

  it("does not return the application for missing assets", async () => {
    const response = await fetch(`${base}/missing.js`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Application");
  });

  it("rejects traversal to a sibling directory sharing the dist prefix", async () => {
    const response = await fetch(`${base}/..%2fdist-private/secret.txt`);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("secret");
  });

  it("supports HEAD and rejects writes", async () => {
    const head = await fetch(`${base}/app.js`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const write = await fetch(`${base}/app.js`, { method: "POST" });
    expect(write.status).toBe(405);
    expect(write.headers.get("allow")).toBe("GET, HEAD");
  });

  it("rejects malformed URL encoding without crashing", async () => {
    expect((await fetch(`${base}/%zz`)).status).toBe(400);
    expect((await fetch(`${base}/`)).status).toBe(200);
  });
});
