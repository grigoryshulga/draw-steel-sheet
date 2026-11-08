import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { themeBootstrapScript } from "../scripts/theme-bootstrap";
import { applyTheme, THEMES, THEME_STORAGE_KEY } from "../src/lib/theme";

afterEach(() => vi.unstubAllGlobals());

function boot(value: string | null, blocked = false) {
  const colors = new Map();
  const root = { dataset: { mode: "dark" }, style: { colorScheme: "", setProperty: (key: string, val: string) => colors.set(key, val) } };
  runInNewContext(themeBootstrapScript(), {
    document: { documentElement: root },
    localStorage: { getItem(key: string) {
      expect(key).toBe(THEME_STORAGE_KEY);
      if (blocked) throw new Error("Blocked");
      return value;
    } },
  });
  return { root, colors };
}

describe("тема первого кадра", () => {
  it("применяет выбранную палитру до загрузки React", () => {
    for (const theme of THEMES) {
      const { root, colors } = boot(JSON.stringify({ name: theme.name }));
      expect(root.dataset.mode).toBe(theme.mode);
      expect(root.style.colorScheme).toBe(theme.mode);
      expect(colors.get("--bg")).toBe(theme.colors.background);
      expect(colors.get("--fg")).toBe(theme.colors.foreground);
    }
  });

  it("использует стандартную тему при недоступном, повреждённом или устаревшем выборе", () => {
    for (const value of [null, "{broken", "null", "42", '{"name":"missing"}', '{"name":"__proto__"}']) {
      expect(boot(value).colors.get("--bg")).toBe(THEMES[0].colors.background);
    }
    expect(boot(null, true).root.dataset.mode).toBe(THEMES[0].mode);
  });

  it("обновляет цветовую схему системных полей при смене темы после запуска", () => {
    const light = THEMES.find((theme) => theme.mode === "light")!;
    const { root } = boot(JSON.stringify({ name: light.name }));
    vi.stubGlobal("document", { documentElement: root });
    applyTheme(THEMES[0]);
    expect(root.style.colorScheme).toBe("dark");
    expect(root.dataset.mode).toBe("dark");
    applyTheme(light);
    expect(root.style.colorScheme).toBe("light");
    expect(root.dataset.mode).toBe("light");
  });
});
