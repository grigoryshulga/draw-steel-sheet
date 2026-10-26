import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Конфиг исполняется в Node, но `@types/node` в проекте нет: объявляем только
 * то, что читаем. Иначе `tsc -b` проходит лишь на устаревшем кэше сборки.
 */
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8787,
    // Хосты для общего доступа к дев-серверу (Tailscale и т.п.):
    // VITE_ALLOWED_HOSTS=callibri.example.ts.net,192.168.1.10
    allowedHosts: (process.env.VITE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  },
  build: {
    outDir: "dist",
    // Каталог способностей — отдельный ленивый чанк с данными.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
