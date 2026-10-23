import { describe, expect, it } from "vitest";
import { THEMES, themeToTokens } from "../src/lib/theme";

function luminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length < 3) throw new Error(`Некорректный цвет: ${hex}`);
  const linear = channels.slice(0, 3).map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("доступность цветовых схем", () => {
  it("все текстовые и статусные цвета соответствуют WCAG AA на фоне и поверхности", () => {
    const foregroundTokens = [
      "--fg", "--fg-bright", "--muted", "--accent", "--red", "--orange",
      "--yellow", "--green", "--cyan", "--blue", "--magenta", "--brown",
      "--tier1", "--tier2", "--tier3",
    ];

    for (const theme of THEMES) {
      const tokens = themeToTokens(theme);
      for (const foregroundToken of foregroundTokens) {
        for (const backgroundToken of ["--bg", "--surface"]) {
          const ratio = contrastRatio(tokens[foregroundToken], tokens[backgroundToken]);
          expect(
            ratio,
            `${theme.name}: ${foregroundToken} на ${backgroundToken}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(
        contrastRatio(tokens["--accent-ink"], tokens["--accent"]),
        `${theme.name}: текст кнопки на акцентном фоне`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
