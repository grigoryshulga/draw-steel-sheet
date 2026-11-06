import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";

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

// Prefer the client's highest-quality supported representation (Brotli on ties).
function encodings(header = "") {
  const weights = new Map(header.toLowerCase().split(",").map((part) => {
    const [name, ...params] = part.trim().split(";");
    const quality = params.find((param) => param.trim().startsWith("q="));
    const value = quality ? Number(quality.trim().slice(2)) : 1;
    return [name, Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0];
  }));
  return ["br", "gzip"].map((name) => ({ name, quality: weights.get(name) ?? weights.get("*") ?? 0 }))
    .filter(({ quality }) => quality > 0)
    .sort((a, b) => b.quality - a.quality);
}

async function sendFile(req, res, file, immutable = false) {
  let stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error("Not a file");
  let representation = file;
  let encoding;
  for (const option of encodings(req.headers["accept-encoding"])) {
    const compressed = `${file}.${option.name === "br" ? "br" : "gz"}`;
    try {
      const compressedStat = await fs.stat(compressed);
      if (!compressedStat.isFile() || compressedStat.mtimeMs < stat.mtimeMs) continue;
      representation = compressed;
      stat = compressedStat;
      encoding = option.name;
      break;
    } catch { /* Builds without precompression still work. */ }
  }
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}-${encoding ?? "identity"}"`;
  const headers = {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": file.endsWith("index.html") ? "no-cache"
      : immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    "Vary": "Accept-Encoding",
    "ETag": etag,
    ...(encoding ? { "Content-Encoding": encoding } : {}),
  };
  if ((req.headers["if-none-match"] ?? "").split(",").some((tag) =>
    tag.trim() === "*" || tag.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""))) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  if (req.method === "HEAD") res.end();
  else {
    // Stream images and large packs without allocating a full-file buffer per request.
    try { await pipeline(createReadStream(representation), res); }
    catch { res.destroy(); }
  }
}

export function createStaticHandler(directory) {
  const dist = path.resolve(directory);
  return async function serveStatic(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    let rel;
    try {
      const parsed = new URL(req.url || "/", "http://localhost");
      rel = decodeURIComponent(parsed.pathname);
      if (rel.includes("\0")) throw new Error("Invalid path");
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }
    const candidate = path.join(dist, rel === "/" ? "index.html" : rel);

    const relative = path.relative(dist, candidate);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const immutable = relative.startsWith(`assets${path.sep}`) && /-[\w-]{8,}\.[^.]+$/.test(relative);
      await sendFile(req, res, candidate, immutable);
    } catch {
      // Missing assets must not masquerade as successful HTML responses.
      if (path.extname(rel)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(req.method === "HEAD" ? undefined : "Not found");
        return;
      }
      try {
        await sendFile(req, res, path.join(dist, "index.html"));
      } catch {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Сборка не найдена. Запустите npm run build или npm run dev.");
      }
    }
  };
}
