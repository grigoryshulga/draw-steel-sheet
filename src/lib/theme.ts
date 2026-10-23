import type { AppTheme } from "../types";

export type ThemeChoice = { name: string };

const STORAGE_KEY = "draw-steel-sheet.theme";

/** Встроенные палитры подобраны для читаемости текста и элементов интерфейса. */
export const THEMES: AppTheme[] = [
  {
    name: "Стальная ночь",
    mode: "dark",
    colors: {
      background: "#11151b", darker_background: "#0b0e12", lighter_background: "#1d242d",
      foreground: "#e8edf2", bright_foreground: "#f8fbff", dark_foreground: "#aab6c2",
      accent: "#73d9b2", selection: "#283a38", selection_foreground: "#11151b",
      red: "#ff8e91", orange: "#ffb36b", yellow: "#f2d46f", green: "#83d6a3",
      cyan: "#72d8d2", blue: "#8db9ff", magenta: "#d7a4f5", brown: "#c89168",
    },
  },
  {
    name: "Тёплый костёр",
    mode: "dark",
    colors: {
      background: "#19120f", darker_background: "#100b09", lighter_background: "#2a1e19",
      foreground: "#f2e8dd", bright_foreground: "#fff8f0", dark_foreground: "#c0aa97",
      accent: "#ffb36b", selection: "#493026", selection_foreground: "#19120f",
      red: "#ff9990", orange: "#ffb36b", yellow: "#f1d27c", green: "#9bd29a",
      cyan: "#83d2c7", blue: "#9bbcff", magenta: "#e0a9cb", brown: "#d39b70",
    },
  },
  {
    name: "Лиловые сумерки",
    mode: "dark",
    colors: {
      background: "#15121c", darker_background: "#0d0b13", lighter_background: "#24202f",
      foreground: "#eee8f7", bright_foreground: "#fcf9ff", dark_foreground: "#b9afc8",
      accent: "#c5a3ff", selection: "#382d4c", selection_foreground: "#15121c",
      red: "#ff969f", orange: "#ffb47d", yellow: "#efd17b", green: "#91d6a4",
      cyan: "#82d5d0", blue: "#a3baff", magenta: "#d4a7f5", brown: "#c79574",
    },
  },
  {
    name: "Светлый пергамент",
    mode: "light",
    colors: {
      background: "#f3eedf", darker_background: "#e5decc", lighter_background: "#fffaf0",
      foreground: "#29251f", bright_foreground: "#171410", dark_foreground: "#655b4e",
      light_foreground: "#655b4e", accent: "#245b52", selection: "#d9e5d7", selection_foreground: "#ffffff",
      red: "#a52e36", orange: "#8f4a16", yellow: "#765500", green: "#286b3c",
      cyan: "#176a69", blue: "#315a9b", magenta: "#7b438c", brown: "#74451f",
    },
  },
  {
    name: "Синяя глубина",
    mode: "dark",
    colors: {
      background: "#0d1724", darker_background: "#08101a", lighter_background: "#17283a",
      foreground: "#e7f0fa", bright_foreground: "#f7fbff", dark_foreground: "#a8bcd2",
      accent: "#78c8f4", selection: "#203c52", selection_foreground: "#0d1724",
      red: "#ff929b", orange: "#ffb477", yellow: "#f0d475", green: "#83d7a6",
      cyan: "#71d8d6", blue: "#91baff", magenta: "#d1a8f5", brown: "#c89168",
    },
  },
];

export function readThemeChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const value = parsed as { name?: unknown; mode?: unknown };
        if (typeof value.name === "string" && THEMES.some((theme) => theme.name === value.name)) {
          return { name: value.name };
        }
      }
    }
  } catch {
    // Повреждённое или недоступное хранилище не мешает запуску приложения.
  }
  return { name: THEMES[0].name };
}

export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // The selected theme still applies when browser storage is unavailable.
  }
}

function pick(colors: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (colors[key]) return colors[key];
  }
  return "";
}

export function themeToTokens(theme: AppTheme): Record<string, string> {
  const c = theme.colors;
  const tokens: Record<string, string> = {
    "--bg": pick(c, "background") || "#111",
    "--bg-deep": pick(c, "darker_background", "background") || "#0a0a0a",
    "--surface": pick(c, "lighter_background", "background") || "#1a1a1a",
    "--fg": pick(c, "foreground") || "#eee",
    "--fg-bright": pick(c, "bright_foreground", "foreground") || "#fff",
    "--muted": pick(c, "dark_foreground", "foreground") || "#999",
    "--accent": pick(c, "accent", "blue") || "#58fcb5",
    "--accent-ink": pick(c, "selection_foreground", "background") || "#000",
    "--selection": pick(c, "selection", "lighter_background") || "#222",
    "--red": pick(c, "red") || "#ff5555",
    "--orange": pick(c, "orange", "red") || "#ff983b",
    "--yellow": pick(c, "yellow") || "#e6f64e",
    "--green": pick(c, "green") || "#85dd88",
    "--cyan": pick(c, "cyan") || "#72e8b5",
    "--blue": pick(c, "blue") || "#92a8fa",
    "--magenta": pick(c, "magenta") || "#cd98ed",
    "--brown": pick(c, "brown") || "#995b23",
    "--tier1": pick(c, "red", "orange") || "#ff8618",
    "--tier2": pick(c, "yellow", "orange") || "#d8e378",
    "--tier3": pick(c, "green", "cyan") || "#85dd88",
  };
  return tokens;
}

export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(themeToTokens(theme))) {
    root.style.setProperty(key, value);
  }
  root.dataset.mode = theme.mode;
  root.dataset.theme = theme.name;
}

export function resolveTheme(themes: AppTheme[], choice: ThemeChoice): AppTheme {
  return themes.find((theme) => theme.name === choice.name) ?? themes[0];
}
