import { describe, expect, it } from "vitest";
import { parseColorsToml } from "../server/theme.mjs";

/** server/theme.mjs — нетипизированный JS, повторяем контракт локально. */
interface ParsedPalette {
  mode: string;
  colors: Record<string, string>;
}

function parse(text: string): ParsedPalette {
  return parseColorsToml(text) as ParsedPalette;
}

describe("parseColorsToml", () => {
  it("пустой текст — тёмная тема без цветов", () => {
    expect(parse("")).toEqual({ mode: "dark", colors: {} });
  });

  it("mode = light распознаётся", () => {
    expect(parse('mode = "light"\n').mode).toBe("light");
  });

  it("неизвестный mode остаётся тёмным", () => {
    expect(parse("mode = \"solarized\"\n").mode).toBe("dark");
  });

  it("hex-цвета собираются в colors, кавычки срезаются", () => {
    const { colors } = parse('background = "#1a1b26"\nforeground = \'#c0caf5\'\n');
    expect(colors).toEqual({
      background: "#1a1b26",
      foreground: "#c0caf5",
    });
  });

  it("поддерживаются короткие и длинные hex (3–8 цифр)", () => {
    const { colors } = parse("accent = #abc\naccent2 = #aabbcc\naccent3 = #aabbccdd\n");
    expect(colors).toEqual({ accent: "#abc", accent2: "#aabbcc", accent3: "#aabbccdd" });
  });

  it("не-hex значения игнорируются", () => {
    const { colors } = parse(
      'name = "Тёмная"\ncount = 7\nweird = #xyz\ntiny = #12\nlong = #123456789\n',
    );
    expect(colors).toEqual({});
  });

  it("комментарии и пустые строки игнорируются", () => {
    const { mode, colors } = parse(
      '# текущая тема\n\nmode = "light"\n# background = "#000000"\nbackground = "#ffffff"\n',
    );
    expect(mode).toBe("light");
    expect(colors).toEqual({ background: "#ffffff" });
  });

  it("мусорные строки без '=' не ломают парсер", () => {
    const { mode, colors } = parse("это не toml\n=\nmode = dark\njusttext\n");
    expect(mode).toBe("dark");
    expect(colors).toEqual({});
  });

  it("CRLF-переводы строк обрабатываются", () => {
    const { mode, colors } = parse('mode = "light"\r\nbackground = "#ffffff"\r\n');
    expect(mode).toBe("light");
    expect(colors).toEqual({ background: "#ffffff" });
  });
});
