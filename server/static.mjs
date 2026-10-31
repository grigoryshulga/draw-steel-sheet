import fs from "node:fs/promises";
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
      const data = await fs.readFile(candidate);
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(candidate)] || "application/octet-stream",
        "Cache-Control": candidate.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      // Missing assets must not masquerade as successful HTML responses.
      if (path.extname(rel)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(req.method === "HEAD" ? undefined : "Not found");
        return;
      }
      try {
        const html = await fs.readFile(path.join(dist, "index.html"));
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(req.method === "HEAD" ? undefined : html);
      } catch {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Сборка не найдена. Запустите npm run build или npm run dev.");
      }
    }
  };
}
