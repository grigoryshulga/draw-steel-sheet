const MAX_BODY_BYTES = 2 * 1024 * 1024;

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function methodNotAllowed(res, allow) {
  sendJson(res, 405, { error: "Метод не поддерживается" }, { Allow: allow });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  // Read the whole body even after the limit: aborting mid-request can reset the
  // socket before the client receives the 413 response. Extra bytes are discarded.
  for await (const chunk of req) {
    if (tooLarge) continue;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
      chunks.length = 0;
      continue;
    }
    chunks.push(chunk);
  }
  if (tooLarge) {
    throw Object.assign(new Error("Слишком большой запрос"), { status: 413 });
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Ожидается корректный JSON"), { status: 400 });
  }
}

export function createApi({ store }) {
  return async function handleApi(req, res) {
    let pathname;
    try {
      const parsed = new URL(req.url || "/", "http://localhost");
      pathname = decodeURIComponent(parsed.pathname);
    } catch {
      sendJson(res, 400, { error: "Некорректный адрес" });
      return true;
    }
    if (pathname !== "/api" && !pathname.startsWith("/api/")) return false;

    try {
      if (pathname === "/api") {
        sendJson(res, 404, { error: "Не найдено" });
        return true;
      }

      if (pathname === "/api/health") {
        if (req.method !== "GET") {
          methodNotAllowed(res, "GET");
          return true;
        }
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (pathname === "/api/characters") {
        if (req.method !== "GET") {
          methodNotAllowed(res, "GET");
          return true;
        }
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
        methodNotAllowed(res, "GET, PUT, DELETE");
        return true;
      }

      sendJson(res, 404, { error: "Не найдено" });
      return true;
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) console.error(error);
      sendJson(res, status, { error: status >= 500 ? "Внутренняя ошибка" : error.message });
      return true;
    }
  };
}

