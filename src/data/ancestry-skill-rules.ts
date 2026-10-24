import type { SkillSlot } from "./creation-rules";
import { SKILL_GROUPS } from "./skills";

/**
 * Explicit ancestry skill grants for hero creation.
 *
 * Only source-backed proficiencies live here. Prose is never parsed: the
 * creative-roleplay traits (project bonuses, advantage text) must not silently
 * become skill proficiencies.
 *
 * Included:
 *  - Дьявол — «Серебряный Язык»: one additional interpersonal skill.
 *  - Таурус — «Зов Горизонта»: one additional exploration skill.
 *  - Ящер — «Проворность Как Инстинкт»: one additional intrigue skill.
 *  - Ящер / «Скользкая чешуя»: fixed intrigue skill «Мастер ускользания»
 *    (the source text misspells it as «ускальзывания», so the catalog name is
 *    mapped explicitly instead of matching the printed word).
 *
 * Excluded on purpose:
 *  - Орк / «Страстный ремесленник» grants a project bonus when two crafting
 *    skills are already chosen; it never grants proficiency.
 *  - Every other trait that only changes statistics or grants abilities.
 */
type SkillGroupKey = (typeof SKILL_GROUPS)[number]["key"];

interface SignatureSkillGrant {
  group: SkillGroupKey;
  label: string;
}

const SIGNATURE_SKILL_GRANTS: Record<string, SignatureSkillGrant> = {
  Дьявол: { group: "interpersonal", label: "Навык происхождения (межличностный)" },
  Таурус: { group: "exploration", label: "Навык происхождения (исследование)" },
  Ящер: { group: "intrigue", label: "Навык происхождения (интрига)" },
};

const TRAIT_SKILL_GRANTS: Record<string, Record<string, string>> = {
  Ящер: { "Скользкая чешуя": "Мастер ускользания" },
};

function groupSkills(key: SkillGroupKey): string[] {
  return [...(SKILL_GROUPS.find((group) => group.key === key)?.skills ?? [])];
}

/**
 * Skill slots granted by the ancestry itself, before culture, career and class.
 * The order is stable: signature grant first, then trait grants in the order the
 * traits are stored on the draft.
 */
export function ancestrySkillSlots(
  ancestry: string,
  traits: readonly string[] = [],
): SkillSlot[] {
  const slots: SkillSlot[] = [];
  const signature = SIGNATURE_SKILL_GRANTS[ancestry];
  if (signature)
    slots.push({ label: signature.label, options: groupSkills(signature.group) });
  const grants = TRAIT_SKILL_GRANTS[ancestry];
  if (grants)
    for (const [trait, skill] of Object.entries(grants))
      if (traits.includes(trait))
        slots.push({ label: skill, options: [skill], fixed: skill });
  return slots;
}

/** True when the ancestry or one of its traits can grant skill proficiency. */
export function ancestryGrantsSkills(
  ancestry: string,
  traits: readonly string[] = [],
): boolean {
  return ancestrySkillSlots(ancestry, traits).length > 0;
}
