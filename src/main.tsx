import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/base.css";
import "./styles/components.css";
import { applyTheme, readThemeChoice, resolveTheme, THEMES } from "./lib/theme";
// Общая карточка используется в нескольких лениво загружаемых разделах.
import "./components/AbilityCard.css";

// Apply all theme tokens before the first React render, including the auth page.
applyTheme(resolveTheme(THEMES, readThemeChoice()));

const root = document.getElementById("root");
if (!root) throw new Error("Не найден корневой элемент #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("./offline-worker.js").then(async () => {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "CACHE_ASSETS", urls: performance.getEntriesByType("resource").map(entry => entry.name) });
  }).catch(() => { /* Hero persistence reports unavailable local storage independently. */ });
}
