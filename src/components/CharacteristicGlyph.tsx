import type { CharacteristicKey } from "../types";
import { splitCharacteristicGlyphs } from "../lib/characteristic-glyphs";
import "./CharacteristicGlyph.css";

const labels: Record<CharacteristicKey, string> = {
  might: "М", agility: "Л", reason: "Р", intuition: "И", presence: "П",
};

export function CharacteristicGlyph({ characteristic, language = "ru" }: { characteristic: CharacteristicKey; language?: "ru" | "en" }) {
  const letter = language === "en" ? ({ might: "M", agility: "A", reason: "R", intuition: "I", presence: "P" } as const)[characteristic] : labels[characteristic];
  return <span className={`characteristic-glyph glyph-${characteristic}${language === "en" ? " is-english" : ""}`} role="img" aria-label={letter}>{language === "en" ? letter : undefined}</span>;
}

export function CharacteristicGlyphText({ text, language = "ru" }: { text: string; language?: "ru" | "en" }) {
  return <>{splitCharacteristicGlyphs(text).map((part, index) => part.characteristic
    ? <CharacteristicGlyph key={index} characteristic={part.characteristic} language={language} />
    : part.text)}</>;
}
