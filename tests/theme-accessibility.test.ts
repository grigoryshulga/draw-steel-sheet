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

function mix(foreground: string, background: string, amount: number): string {
  const channels = [1, 3, 5].map((index) => {
    const front = parseInt(foreground.slice(index, index + 2), 16);
    const back = parseInt(background.slice(index, index + 2), 16);
    return Math.round(front * amount + back * (1 - amount)).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
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

  it("задаёт узнаваемые цвета действий и читаемые шапки для каждой темы", () => {
    const hues = ["--ability-passive", "--ability-main", "--ability-maneuver", "--ability-trigger", "--ability-basic"] as const;
    for (const theme of THEMES) {
      const tokens = themeToTokens(theme);
      for (const key of hues) {
        const color = tokens[key];
        expect(color, `${theme.name}: ${key}`).toMatch(/^#[0-9a-f]{6}$/i);
        for (const background of ["--bg", "--surface"]) {
          expect(contrastRatio(tokens["--fg-bright"], mix(color, tokens[background], 0.28)), `${theme.name}: ${key} на ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      const rgb = (key: typeof hues[number]) => [1, 3, 5].map((i) => parseInt(tokens[key].slice(i, i + 2), 16));
      const [or, og, ob] = rgb("--ability-passive");
      const [br, bg, bb] = rgb("--ability-main");
      const [gr, gg, gb] = rgb("--ability-maneuver");
      const [pr, pg, pb] = rgb("--ability-trigger");
      const [nr, ng, nb] = rgb("--ability-basic");
      expect(or > og && og > ob, `${theme.name}: оранжевый`).toBe(true);
      expect(bb > br && bb > bg, `${theme.name}: синий`).toBe(true);
      expect(gg > gr && gg > gb, `${theme.name}: зелёный`).toBe(true);
      expect(pb > pg && pr > pg, `${theme.name}: фиолетовый`).toBe(true);
      expect(nr === ng && ng === nb, `${theme.name}: серый`).toBe(true);
    }
  });

});
