import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const STATE_DIR = path.join(HOME, ".local/state/omarchy/current");

export function parseColorsToml(text) {
  const colors = {};
  let mode = "dark";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][\w-]*)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    if (key === "mode") {
      mode = value === "light" ? "light" : "dark";
    } else if (/^#[0-9a-f]{3,8}$/i.test(value)) {
      colors[key] = value;
    }
  }
  return { mode, colors };
}

async function readPalette(dir) {
  const text = await fs.readFile(path.join(dir, "colors.toml"), "utf8");
  return parseColorsToml(text);
}

async function themeDirs(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      dir: path.join(root, entry.name),
      source: root.includes(`${path.sep}.config${path.sep}`) ? "user" : "system",
    }));
}

async function currentThemeName() {
  try {
    return (await fs.readFile(path.join(STATE_DIR, "theme.name"), "utf8")).trim();
  } catch {
    return "";
  }
}

export async function loadThemes() {
  const roots = [
    path.join(HOME, ".config/omarchy/themes"),
    path.join(HOME, "omarchy/themes"),
  ];

  const byName = new Map();
  for (const root of roots) {
    for (const theme of await themeDirs(root)) {
      if (byName.has(theme.name)) continue;
      try {
        const { mode, colors } = await readPalette(theme.dir);
        byName.set(theme.name, {
          name: theme.name,
          mode,
          colors,
          source: theme.source,
        });
      } catch {
        // Тема без colors.toml пропускается.
      }
    }
  }

  // Текущая тема может быть установлена вне обычных каталогов.
  let current = await currentThemeName();
  const currentDir = await fs.realpath(STATE_DIR).catch(() => "");
  if (currentDir) {
    const themeLink = path.join(currentDir, "theme");
    try {
      const real = await fs.realpath(themeLink);
      const name = current || path.basename(real);
      if (!byName.has(name)) {
        const { mode, colors } = await readPalette(real);
        byName.set(name, { name, mode, colors, source: "user" });
      }
      current = name;
    } catch {
      // Символическая ссылка недоступна — оставляем имя из theme.name.
    }
  }

  return {
    current,
    themes: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
