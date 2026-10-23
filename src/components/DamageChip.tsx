import type { DamageType } from "../lib/damageType";

export function DamageChip({ value, type }: { value: string; type?: DamageType }) {
  return (
    <span className="damage-chip" data-type={type?.key}>
      <strong>{value}</strong>
      {type && <em>{type.label}</em>}
    </span>
  );
}
