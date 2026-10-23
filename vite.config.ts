import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8787,
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
