import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const DEV = process.argv.includes("--dev") || process.env.NODE_ENV !== "production";
const DATA_DIR = process.env.DS_DATA_DIR || path.join(ROOT, "data");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) {
      throw Object.assign(new Error("Слишком большой запрос"), { status: 413 });
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Ожидается корректный JSON"), { status: 400 });
  }
}

function createApi({ store }) {
  return async function handleApi(req, res) {
    const parsed = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let pathname;
    try {
      pathname = decodeURIComponent(parsed.pathname);
    } catch {
      sendJson(res, 400, { error: "Некорректный адрес" });
      return true;
    }
    if (!pathname.startsWith("/api/")) return false;

    try {
      if (req.method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (req.method === "GET" && pathname === "/api/characters") {
        sendJson(res, 200, { characters: await store.list() });
        return true;
      }

      const match = pathname.match(/^\/api\/characters\/([^/]+)$/);
      if (match) {
        const id = match[1];
        if (req.method === "GET") {
          sendJson(res, 200, await store.get(id));
          return true;
        }
        if (req.method === "PUT") {
          const doc = await readBody(req);
          sendJson(res, 200, await store.save(id, doc));
          return true;
        }
        if (req.method === "DELETE") {
          await store.remove(id);
          sendJson(res, 200, { ok: true });
          return true;
        }
        sendJson(res, 405, { error: "Метод не поддерживается" });
        return true;
      }

      sendJson(res, 404, { error: "Не найдено" });
      return true;
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) console.error(error);
      sendJson(res, status, { error: error.message || "Внутренняя ошибка" });
      return true;
    }
  };
}

async function serveStatic(req, res) {
  const dist = path.join(ROOT, "dist");
  const parsed = new URL(req.url || "/", "http://localhost");
  let rel;
  try {
    rel = decodeURIComponent(parsed.pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }
  const candidate = path.join(dist, rel === "/" ? "index.html" : rel);

  if (!candidate.startsWith(dist)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(candidate);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(candidate)] || "application/octet-stream",
      "Cache-Control": candidate.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=3600",
    });
    res.end(data);
  } catch {
    try {
      const html = await fs.readFile(path.join(dist, "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(html);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Сборка не найдена. Запустите npm run build или npm run dev.");
    }
  }
}

const store = createStore(DATA_DIR);
const handleApi = createApi({ store });

let vite;
const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  if (DEV) {
    vite.middlewares(req, res);
  } else {
    await serveStatic(req, res);
  }
});

if (DEV) {
  const { createServer } = await import("vite");
  vite = await createServer({
    root: ROOT,
    appType: "spa",
    server: {
      middlewareMode: true,
      ws: { server },
    },
  });
}

server.listen(PORT, HOST, () => {
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : PORT;
  console.log(
    `Достать листы!: http://${HOST}:${boundPort} (${DEV ? "разработка" : "продакшен"})`,
  );
  console.log(`Данные персонажей: ${store.charactersDir}`);
});
