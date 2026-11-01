import { CharacteristicGlyphText } from "./CharacteristicGlyph";
import type { DamageType } from "../lib/damageType";

export function DamageChip({
  value,
  type,
}: {
  value: string;
  type?: DamageType;
}) {
  return (
    <span className="damage-chip" data-type={type?.key}>
      <strong><CharacteristicGlyphText text={value} /></strong>
      <em>{type ? type.label : "урона"}</em>
    </span>
  );
}
