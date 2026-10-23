import type { OmarchyTheme } from "../types";

export type ThemeChoice = { mode: "auto" } | { mode: "manual"; name: string };

const STORAGE_KEY = "draw-steel-sheet.theme";

export function readThemeChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: "auto" };
    const parsed = JSON.parse(raw) as ThemeChoice;
    if (parsed.mode === "manual" && typeof parsed.name === "string") {
      return { mode: "manual", name: parsed.name };
    }
  } catch {
    // ignore
  }
  return { mode: "auto" };
}

export function writeThemeChoice(choice: ThemeChoice): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
}

function pick(colors: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (colors[key]) return colors[key];
  }
  return "";
}

/**
 * Превращает палитру Omarchy в токены листа.
 * Все цвета берутся из colors.toml выбранной темы.
 */
export function themeToTokens(theme: OmarchyTheme): Record<string, string> {
  const c = theme.colors;
  const tokens: Record<string, string> = {
    "--bg": pick(c, "background", "dark_background") || "#111",
    "--bg-deep": pick(c, "darker_background", "dark_background", "background") || "#0a0a0a",
    "--surface": pick(c, "lighter_background", "selection", "background") || "#1a1a1a",
    "--fg": pick(c, "foreground", "bright_foreground") || "#eee",
    "--fg-bright": pick(c, "bright_foreground", "light_foreground", "foreground") || "#fff",
    "--muted": pick(c, "dark_foreground", "muted", "foreground") || "#999",
    "--accent": pick(c, "accent", "bright_cyan", "cyan", "blue") || "#58fcb5",
    "--accent-ink": pick(c, "selection_foreground", "background") || "#000",
    "--selection": pick(c, "selection", "lighter_background") || "#222",
    "--red": pick(c, "red", "bright_red") || "#ff5555",
    "--orange": pick(c, "orange", "red") || "#ff983b",
    "--yellow": pick(c, "yellow", "bright_yellow") || "#e6f64e",
    "--green": pick(c, "green", "bright_green") || "#85dd88",
    "--cyan": pick(c, "cyan", "bright_cyan") || "#72e8b5",
    "--blue": pick(c, "blue", "bright_blue") || "#92a8fa",
    "--magenta": pick(c, "magenta", "bright_magenta") || "#cd98ed",
    "--brown": pick(c, "brown") || "#995b23",
    "--tier1": pick(c, "red", "bright_red", "orange") || "#ff8618",
    "--tier2": pick(c, "yellow", "bright_yellow", "orange") || "#d8e378",
    "--tier3": pick(c, "green", "bright_green", "cyan") || "#85dd88",
  };

  if (theme.mode === "light") {
    // Для светлых тем поверхности строятся от фона, а не от «светлее».
    tokens["--bg"] = pick(c, "background", "lighter_background") || "#f4f1ea";
    tokens["--bg-deep"] = pick(c, "dark_background", "background") || "#e9e4da";
    tokens["--surface"] = pick(c, "lighter_background", "background") || "#fbf8f2";
    // На светлом фоне вторичный текст должен быть темнее, иначе 9–11 px подписи не читаются.
    tokens["--muted"] = pick(c, "light_foreground", "dark_foreground", "foreground") || "#555";
  }

  return tokens;
}

export function applyTheme(theme: OmarchyTheme): void {
  const root = document.documentElement;
  const tokens = themeToTokens(theme);
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
  root.dataset.mode = theme.mode;
  root.dataset.theme = theme.name;
}

export function resolveTheme(
  themes: OmarchyTheme[],
  current: string,
  choice: ThemeChoice,
): OmarchyTheme | undefined {
  if (choice.mode === "manual") {
    return themes.find((theme) => theme.name === choice.name) ?? themes.find((t) => t.name === current) ?? themes[0];
  }
  return themes.find((theme) => theme.name === current) ?? themes[0];
}
