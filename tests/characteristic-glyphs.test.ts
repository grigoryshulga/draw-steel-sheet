import { describe, expect, it } from "vitest";
import { splitCharacteristicGlyphs } from "../src/lib/characteristic-glyphs";

describe("глифы характеристик в тексте способностей", () => {
  it("выделяет отдельные буквы в формулах и проверках потенциала", () => {
    expect(splitCharacteristicGlyphs("3 + М, Л < СИЛЬНЫЙ; Р + П")).toEqual([
      { text: "3 + " }, { text: "М", characteristic: "might" }, { text: ", " },
      { text: "Л", characteristic: "agility" }, { text: " < СИЛЬНЫЙ; " },
      { text: "Р", characteristic: "reason" }, { text: " + " },
      { text: "П", characteristic: "presence" },
    ]);
  });

  it("не заменяет буквы внутри слов, цифр и союз И", () => {
    expect(splitCharacteristicGlyphs("И цель получает Мощь, Л1 и М_тест.")).toEqual([
      { text: "И цель получает Мощь, Л1 и М_тест." },
    ]);
    expect(splitCharacteristicGlyphs("И")[0]).toEqual({ text: "И", characteristic: "intuition" });
    expect(splitCharacteristicGlyphs("И или М")[0]).toEqual({ text: "И", characteristic: "intuition" });
    expect(splitCharacteristicGlyphs("М или И").at(-1)).toEqual({ text: "И", characteristic: "intuition" });
    expect(splitCharacteristicGlyphs("И < СЛАБЫЙ")[0]).toEqual({ text: "И", characteristic: "intuition" });
  });
});
