import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { compressAssets } from "../scripts/compress-assets.mjs";
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
  await fs.mkdir(path.join(dist, "assets"));
  await fs.writeFile(path.join(dist, "assets", "rules-aBc12345.js"), "export default " + JSON.stringify("Правила героя ".repeat(1000)));
  await compressAssets(dist);
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
  it("serves precompressed assets with immutable caching and validators", async () => {
    const url = `${base}/assets/rules-aBc12345.js`;
    const identity = await fetch(url, { headers: { "Accept-Encoding": "identity" } });
    const plain = await identity.text();
    for (const encoding of ["br", "gzip"]) {
      const response = await fetch(url, { headers: { "Accept-Encoding": encoding } });
      expect(response.headers.get("content-encoding")).toBe(encoding);
      expect(response.headers.get("vary")).toBe("Accept-Encoding");
      expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(Number(response.headers.get("content-length"))).toBeLessThan(Number(identity.headers.get("content-length")) / 5);
      expect(await response.text()).toBe(plain);
      const cached = await fetch(url, { headers: { "Accept-Encoding": encoding, "If-None-Match": response.headers.get("etag")! } });
      expect(cached.status).toBe(304);
      expect(await cached.text()).toBe("");
    }
  });

  it("honors encoding quality and keeps HTML revalidatable", async () => {
    const url = `${base}/assets/rules-aBc12345.js`;
    const disabled = await fetch(url, { headers: { "Accept-Encoding": "br;q=0, gzip;q=0" } });
    expect(disabled.headers.get("content-encoding")).toBeNull();
    const preferred = await fetch(url, { headers: { "Accept-Encoding": "br;q=0.1, gzip;q=1" } });
    expect(preferred.headers.get("content-encoding")).toBe("gzip");
    const head = await fetch(url, { method: "HEAD", headers: { "Accept-Encoding": "br" } });
    expect(head.headers.get("content-encoding")).toBe("br");
    expect(await head.text()).toBe("");
    const html = await fetch(`${base}/characters/hero`);
    expect(html.headers.get("cache-control")).toBe("no-cache");
    const cached = await fetch(`${base}/characters/hero`, { headers: { "If-None-Match": html.headers.get("etag")! } });
    expect(cached.status).toBe(304);
    expect((await fetch(`${base}/app.js`)).headers.get("cache-control")).not.toContain("immutable");
  });

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
