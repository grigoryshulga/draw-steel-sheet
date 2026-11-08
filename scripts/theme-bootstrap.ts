import { THEMES, THEME_STORAGE_KEY } from "../src/lib/theme.ts";

/** Vite injects only paint-critical colors, derived from the real theme source. */
export function themeBootstrapScript(): string {
  const palettes = THEMES.map((theme) => [theme.name, theme.mode, theme.colors.background, theme.colors.foreground]);
  return `(()=>{const themes=${JSON.stringify(palettes).replace(/</g, "\\u003c")};let choice;try{choice=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"null")}catch{}const t=themes.find(t=>t[0]===choice?.name)||themes[0];const r=document.documentElement;r.dataset.mode=t[1];r.style.colorScheme=t[1];r.style.setProperty("--bg",t[2]);r.style.setProperty("--fg",t[3])})()`;
}
