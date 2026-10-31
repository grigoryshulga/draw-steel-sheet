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
  {
    // Палитра Catppuccin Mocha; коричневого во флэйворе нет — тон подобран в тон пастелям.
    name: "Вечер с Котучино",
    mode: "dark",
    colors: {
      background: "#1e1e2e", darker_background: "#11111b", lighter_background: "#313244",
      foreground: "#cdd6f4", bright_foreground: "#f5e0dc", dark_foreground: "#a6adc8",
      accent: "#cba6f7", selection: "#45475a", selection_foreground: "#1e1e2e",
      red: "#f38ba8", orange: "#fab387", yellow: "#f9e2af", green: "#a6e3a1",
      cyan: "#94e2d5", blue: "#89b4fa", magenta: "#f5c2e7", brown: "#dcbba8",
    },
  },
  {
    // Серый интерфейс + базовые классические цвета терминала (осветлённые под AA).
    name: "Тёмная классика",
    mode: "dark",
    colors: {
      background: "#121212", darker_background: "#0a0a0a", lighter_background: "#232323",
      foreground: "#e6e6e6", bright_foreground: "#ffffff", dark_foreground: "#9e9e9e",
      accent: "#f0f0f0", selection: "#333333", selection_foreground: "#121212",
      red: "#ff5f5f", orange: "#ffa500", yellow: "#f5f55f", green: "#55e755",
      cyan: "#55f5f5", blue: "#8282ff", magenta: "#ff5fff", brown: "#c98a5e",
    },
  },
  {
    // Серый интерфейс + тёмные классические цвета терминала (нормальная яркость ANSI).
    name: "Светлая классика",
    mode: "light",
    colors: {
      background: "#fafafa", darker_background: "#e6e6e6", lighter_background: "#ffffff",
      foreground: "#242424", bright_foreground: "#000000", dark_foreground: "#5c5c5c",
      accent: "#242424", selection: "#d9d9d9", selection_foreground: "#ffffff",
      red: "#a80000", orange: "#b34700", yellow: "#757500", green: "#006f14",
      cyan: "#006a7a", blue: "#0000ee", magenta: "#8b008b", brown: "#7a4a1f",
    },
  },
  {
    // Угольно-зелёное логово с кислотным акцентом и «болезненными» статусными тонами.
    name: "Обитель некроманта",
    mode: "dark",
    colors: {
      background: "#0a120d", darker_background: "#060a08", lighter_background: "#15221b",
      foreground: "#d3e6d8", bright_foreground: "#effff2", dark_foreground: "#8fa996",
      accent: "#7dff5a", selection: "#1d3a28", selection_foreground: "#060a08",
      red: "#ff8a8a", orange: "#ffb35c", yellow: "#d2f06b", green: "#6be86b",
      cyan: "#52e0b0", blue: "#8ec8f5", magenta: "#c19bf2", brown: "#c9a06b",
    },
  },
  {
    // Истинный чёрный для OLED: максимальный контраст, статусные цвета яркие.
    name: "Чёрный бархат",
    mode: "dark",
    colors: {
      background: "#000000", darker_background: "#000000", lighter_background: "#16161a",
      foreground: "#e8e8ec", bright_foreground: "#ffffff", dark_foreground: "#9c9ca6",
      accent: "#82aaff", selection: "#26262e", selection_foreground: "#0a0a0a",
      red: "#ff6b6b", orange: "#ffb36b", yellow: "#ffe066", green: "#69db7c",
      cyan: "#4dd7d0", blue: "#82aaff", magenta: "#e29aff", brown: "#d0a06a",
    },
  },
  {
    // Палитра Nord; красный и коричневый слегка осветлены ради WCAG AA.
    name: "Полярная ночь",
    mode: "dark",
    colors: {
      background: "#2e3440", darker_background: "#232831", lighter_background: "#3b4252",
      foreground: "#eceff4", bright_foreground: "#f8fafc", dark_foreground: "#b9c4d4",
      accent: "#88c0d0", selection: "#434c5e", selection_foreground: "#2e3440",
      red: "#f09999", orange: "#eab886", yellow: "#ead9a0", green: "#a3be8c",
      cyan: "#8fbcbb", blue: "#96b3d3", magenta: "#c9a8c4", brown: "#ceac8a",
    },
  },
  {
    // Палитра Rose Pine; зелёный и синий подобраны в тон — во флэйворе их нет.
    name: "Лунная роза",
    mode: "dark",
    colors: {
      background: "#191724", darker_background: "#131120", lighter_background: "#1f1d2e",
      foreground: "#e0def4", bright_foreground: "#f4f2fe", dark_foreground: "#908caa",
      accent: "#ebbcba", selection: "#403d52", selection_foreground: "#191724",
      red: "#eb6f92", orange: "#f6c177", yellow: "#f0d29b", green: "#9ed4a3",
      cyan: "#9ccfd8", blue: "#a9b8e8", magenta: "#c4a7e7", brown: "#d4a98c",
    },
  },
  {
    // Палитра Synthwave '84; красный чуть ярче канона ради WCAG AA.
    name: "Неоновый драйв",
    mode: "dark",
    colors: {
      background: "#1a1721", darker_background: "#14111c", lighter_background: "#2a2338",
      foreground: "#efeaff", bright_foreground: "#ffffff", dark_foreground: "#a99fc0",
      accent: "#ff7edb", selection: "#34294f", selection_foreground: "#1a1721",
      red: "#ff5d68", orange: "#ffb469", yellow: "#fede5d", green: "#72f1b8",
      cyan: "#36f9f6", blue: "#7aa2ff", magenta: "#f97ffb", brown: "#d5a46f",
    },
  },
  {
    // Палитра Solarized Dark; текст и статусы заметно осветлены — канон темнее AA.
    name: "Медный закат",
    mode: "dark",
    colors: {
      background: "#002b36", darker_background: "#001e26", lighter_background: "#073642",
      foreground: "#a8b6b6", bright_foreground: "#eee8d5", dark_foreground: "#a5b4b4",
      accent: "#d6a312", selection: "#0d4653", selection_foreground: "#002b36",
      red: "#ff6b61", orange: "#f4793f", yellow: "#d6a312", green: "#b3cf50",
      cyan: "#3fc1b3", blue: "#4aa8e0", magenta: "#ef6eab", brown: "#d19a6c",
    },
  },
  {
    // Деловой минимал-лайт в духе GitHub Primer.
    name: "Чистый лист",
    mode: "light",
    colors: {
      background: "#ffffff", darker_background: "#eff2f5", lighter_background: "#f6f8fa",
      foreground: "#1f2328", bright_foreground: "#000000", dark_foreground: "#59636e",
      accent: "#0969da", selection: "#ddf4ff", selection_foreground: "#ffffff",
      red: "#cf222e", orange: "#bc4c00", yellow: "#956400", green: "#1a7f37",
      cyan: "#1b7c83", blue: "#0969da", magenta: "#8250df", brown: "#953800",
    },
  },
  {
    // Catppuccin Latte — светлая пара к Моче; тёплые статусы затемнены ради AA.
    name: "Утренний латте",
    mode: "light",
    colors: {
      background: "#eff1f5", darker_background: "#dce0e8", lighter_background: "#e6e9ef",
      foreground: "#4c4f69", bright_foreground: "#232433", dark_foreground: "#5f6278",
      accent: "#8437e8", selection: "#ccd0e5", selection_foreground: "#ffffff",
      red: "#c30d35", orange: "#a94c0c", yellow: "#7e6419", green: "#2c761d",
      cyan: "#237171", blue: "#2b5fd9", magenta: "#7a2fa8", brown: "#7a4a1f",
    },
  },
  {
    // Палитра Everforest; красный, синий, розовый и коричневый чуть светлее канона ради AA.
    name: "Хвойный лес",
    mode: "dark",
    colors: {
      background: "#2b3339", darker_background: "#252c31", lighter_background: "#3a464c",
      foreground: "#d3c6aa", bright_foreground: "#f2efdf", dark_foreground: "#b5c0b7",
      accent: "#a7c080", selection: "#454f55", selection_foreground: "#2b3339",
      red: "#f09da3", orange: "#f0a97e", yellow: "#dbbc7f", green: "#a7c080",
      cyan: "#8fc9be", blue: "#92b8cb", magenta: "#daa5be", brown: "#d1ae7e",
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
