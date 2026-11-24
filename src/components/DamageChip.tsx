import { CharacteristicGlyphText } from "./CharacteristicGlyph";
import type { DamageType } from "../lib/damageType";
import type { ReactNode } from 'react';

export function DamageChip({
  value,
  type,
  label,
  language = "ru",
}: {
  value: string;
  type?: DamageType;
  label?: ReactNode;
  language?: "ru" | "en";
}) {
  return (
    <span className="damage-chip" data-type={type?.key}>
      <strong><CharacteristicGlyphText text={value} language={language} /></strong>
      <em>{label ?? (language === "en" ? (type ? type.key[0].toUpperCase() + type.key.slice(1) : "damage") : (type ? type.label : "урона"))}</em>
    </span>
  );
}
