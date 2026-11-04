import { makeId } from "../data/templates";
import type { Character, DamageTrait, DamageTraitKind } from "../types";
import { DAMAGE_TYPE_OPTIONS, damageTypeDative } from "./damageType";

export interface NewDamageTrait {
  kind: DamageTraitKind;
  type: string;
  value: number;
  note?: string;
}

/** Все виды урона отдельной строкой: особенность может давать «иммунитет к урону». */
export const DAMAGE_TRAIT_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "урон", label: "Урон (все виды)" },
  ...DAMAGE_TYPE_OPTIONS,
];

const MAX_TRAITS = 50;
const MAX_TYPE_LENGTH = 40;
const MAX_NOTE_LENGTH = 140;
const MAX_VALUE = 999;

/** Фраза для подсказки и списка: «Иммунитет к огню 5». */
export function damageTraitText(
  trait: Pick<DamageTrait, "kind" | "type" | "value">,
): string {
  const noun = trait.kind === "immunity" ? "Иммунитет" : "Уязвимость";
  const dative = damageTypeDative(trait.type);
  return dative
    ? `${noun} к ${dative} ${trait.value}`
    : `${noun}: ${trait.type} ${trait.value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isKind(value: unknown): value is DamageTraitKind {
  return value === "immunity" || value === "weakness";
}

function sanitizeDamageTrait(value: unknown): DamageTrait | null {
  if (!isRecord(value) || !isKind(value.kind)) return null;
  const type = typeof value.type === "string" ? value.type.trim() : "";
  const number = typeof value.value === "number" ? value.value : Number.NaN;
  if (!type || type.length > MAX_TYPE_LENGTH) return null;
  if (!Number.isFinite(number) || !Number.isInteger(number)) return null;
  if (number < 1 || number > MAX_VALUE) return null;
  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim().slice(0, 100)
      : makeId();
  const note =
    typeof value.note === "string" && value.note.trim()
      ? value.note.trim().slice(0, MAX_NOTE_LENGTH)
      : undefined;
  return { id, kind: value.kind, type, value: number, ...(note ? { note } : {}) };
}

/** Приводит импортированные и старые записи к безопасному виду. */
export function normalizeDamageTraits(value: unknown): DamageTrait[] {
  if (!Array.isArray(value)) return [];
  const result: DamageTrait[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const trait = sanitizeDamageTrait(item);
    if (!trait) continue;
    const key = `${trait.kind}|${trait.type.toLowerCase()}|${trait.value}|${trait.note ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trait);
    if (result.length >= MAX_TRAITS) break;
  }
  return result;
}

function sameDamageTrait(trait: DamageTrait, next: NewDamageTrait): boolean {
  return (
    trait.kind === next.kind &&
    trait.type.toLowerCase() === next.type.trim().toLowerCase() &&
    trait.value === next.value &&
    (trait.note?.trim() ?? "") === (next.note?.trim() ?? "")
  );
}

/** Добавляет ручную запись; повторная такая же запись ничего не меняет. */
export function withDamageTrait(
  character: Character,
  input: NewDamageTrait,
): Character {
  const trait = sanitizeDamageTrait({ ...input, id: makeId() });
  if (!trait) return character;
  const traits = character.damageTraits ?? [];
  if (traits.length >= MAX_TRAITS) return character;
  if (traits.some((current) => sameDamageTrait(current, trait))) {
    return character;
  }
  return { ...character, damageTraits: [...traits, trait] };
}

/** Удаляет ручную запись по id; автоматические иммунитеты не затрагиваются. */
export function withoutDamageTrait(character: Character, id: string): Character {
  const traits = character.damageTraits ?? [];
  const next = traits.filter((trait) => trait.id !== id);
  return next.length === traits.length
    ? character
    : { ...character, damageTraits: next };
}
