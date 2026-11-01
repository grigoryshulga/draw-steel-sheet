import type { CharacteristicKey } from "../types";

export type GlyphTextPart = { text: string; characteristic?: CharacteristicKey };

const glyphKeys: Record<string, CharacteristicKey> = {
  М: "might", Л: "agility", Р: "reason", И: "intuition", П: "presence",
};

/** Только отдельные обозначения; союз «И» заменяется лишь в контексте формулы. */
export function splitCharacteristicGlyphs(text: string): GlyphTextPart[] {
  const result: GlyphTextPart[] = [];
  const pattern = /(?<![\p{L}\p{N}_])[МЛРИП](?![\p{L}\p{N}_])/gu;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    const symbol = match[0];
    if (symbol === "И" && !/[+<>=−-]\s*$/u.test(text.slice(0, index)) && !/^\s*[+<>=−-]/u.test(text.slice(index + 1)) && !/(?:М|Л|Р|П)\s+или\s*$/u.test(text.slice(0, index)) && !/^\s*или\s+(?:М|Л|Р|П)(?![\p{L}\p{N}_])/u.test(text.slice(index + 1)) && text.trim() !== "И") continue;
    if (index > offset) result.push({ text: text.slice(offset, index) });
    result.push({ text: symbol, characteristic: glyphKeys[symbol] });
    offset = index + symbol.length;
  }
  if (offset < text.length) result.push({ text: text.slice(offset) });
  return result;
}
