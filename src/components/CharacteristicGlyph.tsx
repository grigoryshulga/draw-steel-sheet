import type { CharacteristicKey } from "../types";
import { splitCharacteristicGlyphs } from "../lib/characteristic-glyphs";
import "./CharacteristicGlyph.css";

const labels: Record<CharacteristicKey, string> = {
  might: "М", agility: "Л", reason: "Р", intuition: "И", presence: "П",
};

export function CharacteristicGlyph({ characteristic }: { characteristic: CharacteristicKey }) {
  return <span className={`characteristic-glyph glyph-${characteristic}`} role="img" aria-label={labels[characteristic]} />;
}

export function CharacteristicGlyphText({ text }: { text: string }) {
  return <>{splitCharacteristicGlyphs(text).map((part, index) => part.characteristic
    ? <CharacteristicGlyph key={index} characteristic={part.characteristic} />
    : part.text)}</>;
}
