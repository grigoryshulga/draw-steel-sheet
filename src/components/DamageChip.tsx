import { CharacteristicGlyphText } from "./CharacteristicGlyph";
import type { DamageType } from "../lib/damageType";
import type { ReactNode } from 'react';

export function DamageChip({
  value,
  type,
  label,
}: {
  value: string;
  type?: DamageType;
  label?: ReactNode;
}) {
  return (
    <span className="damage-chip" data-type={type?.key}>
      <strong><CharacteristicGlyphText text={value} /></strong>
      <em>{label ?? (type ? type.label : "урона")}</em>
    </span>
  );
}
