import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.mjs";
import { createApi } from "./api.mjs";
import { createStaticHandler } from "./static.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const DEV = process.argv.includes("--dev") || process.env.NODE_ENV !== "production";
const DATA_DIR = process.env.DS_DATA_DIR || path.join(ROOT, "data");

const store = createStore(DATA_DIR);
const handleApi = createApi({ store });
const serveStatic = createStaticHandler(path.join(ROOT, "dist"));

let vite;
const server = http.createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    if (DEV) {
      vite.middlewares(req, res);
    } else {
      await serveStatic(req, res);
    }
  } catch (error) {
    console.error(error);
    if (res.headersSent) {
      res.destroy();
    } else {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Внутренняя ошибка");
    }
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
