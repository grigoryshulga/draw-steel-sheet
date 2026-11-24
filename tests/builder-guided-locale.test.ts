import { describe, expect, it } from "vitest";
import { englishFlowLabel, englishIssue } from "../src/components/builder/language";
import { advanceBuilderFlow, builderAbilityGroups, builderFlow } from "../src/lib/builder-flow";
import { buildCharacter, BUILDER_DATA, builderIssues, builderSkillSlots, emptyBuilderDraft, grantedClassAbilities, startingCharacteristics } from "../src/lib/character-builder";
import { ALL_CREATION_SKILLS, CLASS_SIGNATURE_COUNTS, canUseKit } from "../src/data/creation-rules";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { PERK_COMPENDIUM } from "../src/data/perks";
import { createCharacter } from "../src/lib/defaults";

function completeDraft(className: string) {
  const source = BUILDER_DATA.classes.find(c => c.name === className)!;
  const draft = { ...emptyBuilderDraft(), name: "Авторское имя", ancestry: "Дварф", traits: ["Заземленность", "Искра с твоей кожи"],
    culture: { environment: "Сельское", organization: "Общинная", upbringing: "Академическое" }, career: "Солдат",
    incident: BUILDER_DATA.careers.find(c => c.name === "Солдат")!.incidents[0], perkId: PERK_COMPENDIUM.find(p => p.type === "exploration")!.id,
    className, subclass: className === "Проводник" ? "Жизнь, Защита" : source.subclasses[0].name,
    conduitDomainFeature: className === "Проводник" ? "Защита" : "", domain: className === "Цензор" ? "Жизнь" : "",
    characteristics: startingCharacteristics(className), featureChoices: Object.fromEntries(source.featureChoices.map(g => [g.name, g.options[0].name])) };
  const slots = builderSkillSlots(draft);
  const used = new Set<string>();
  for (const [kind, field] of [["culture", "cultureSkills"], ["career", "careerSkills"], ["class", "classSkills"]] as const) {
    const reserved = new Map<number, string>();
    slots[kind].forEach((slot, index) => { if (slot.fixed && !used.has(slot.fixed)) { reserved.set(index, slot.fixed); used.add(slot.fixed); } });
    draft[field] = slots[kind].map((slot, index) => {
      const fixed = reserved.get(index);
      if (fixed) return fixed;
      const value = (slot.fixed ? ALL_CREATION_SKILLS : slot.options).find(name => !used.has(name))!;
      used.add(value); return value;
    });
  }
  if (canUseKit(className, draft.subclass)) draft.kit = "Гора";
  if (className === "Тактик") draft.secondaryKit = "Снайпер";
  const granted = grantedClassAbilities(draft);
  const available = ABILITY_COMPENDIUM.filter(a => a.className === className && a.level === 1 && !granted.some(g => g.id === a.id));
  draft.abilityIds = [...available.filter(a => a.kind === "signature").slice(0, CLASS_SIGNATURE_COUNTS[className]),
    ...[3, 5].flatMap(cost => available.filter(a => a.resourceCost === cost).slice(0, 1)),
    ...(className === "Проводник" ? available.filter(a => a.name === "Слово Наставления") : [])].map(a => a.id);
  return draft;
}

describe("guided builder language", () => {
  it.each(BUILDER_DATA.classes.filter(c => c.subclasses.length).map(c => c.name))("keeps %s choices and ready hero identical", className => {
    const target = completeDraft(className);
    expect(builderIssues(target).filter(Boolean)).toEqual([]);
    let ru = emptyBuilderDraft();
    let en = emptyBuilderDraft();
    let current = "ancestry";
    const visited = new Set<string>();
    while (current !== "summary") {
      const step = builderFlow(ru).find(item => item.id === current)!;
      expect(step, current).toBeDefined();
      expect(englishFlowLabel(step), current).not.toMatch(/[А-Яа-яЁё]/);
      if (step.issue) expect(englishIssue(step.issue), step.issue).not.toMatch(/[А-Яа-яЁё]/);
      const changes = step.step === "ancestry" ? { ancestry: target.ancestry }
        : step.step === "ancestry-options" ? { traits: target.traits, ancestryChoices: target.ancestryChoices, ancestrySkills: target.ancestrySkills }
        : step.step === "culture" ? step.part === "skills" ? { cultureSkills: target.cultureSkills } : { culture: { ...ru.culture, [step.part]: target.culture[step.part as keyof typeof target.culture] } }
        : step.step === "career" ? { career: target.career }
        : step.step === "career-options" ? step.part === "skills" ? { careerSkills: target.careerSkills } : step.part === "perk" ? { perkId: target.perkId } : { incident: target.incident }
        : step.step === "class" ? { className: target.className }
        : step.step === "class-options" ? step.part === "subclass" ? { subclass: target.subclass } : step.part === "domain" ? { domain: target.domain, conduitDomainFeature: target.conduitDomainFeature } : step.part === "characteristics" ? { characteristics: target.characteristics } : step.part === "skills" ? { classSkills: target.classSkills } : { featureChoices: target.featureChoices }
        : step.step === "kit" ? step.part === "primary" ? { kit: target.kit } : step.part === "secondary" ? { secondaryKit: target.secondaryKit } : {}
        : step.step === "abilities" ? { abilityIds: [...ru.abilityIds, ...builderAbilityGroups(ru).find(group => group.id === step.part)!.entries.filter(ability => target.abilityIds.includes(ability.id)).map(ability => ability.id)] }
        : step.step === "details" ? { name: target.name } : {};
      const ruNext = advanceBuilderFlow(ru, current, changes);
      const enNext = advanceBuilderFlow(en, current, changes);
      expect(enNext, current).toEqual(ruNext);
      expect(ruNext.issue, current).toBe("");
      expect(visited.has(current)).toBe(false);
      visited.add(current); ru = ruNext.draft; en = enNext.draft; current = ruNext.id;
    }
    expect(builderIssues(ru).filter(Boolean)).toEqual([]);
    const seed = createCharacter();
    expect(buildCharacter(en, seed)).toEqual(buildCharacter(ru, seed));
  });
  it("localizes dynamic class, domain, kit and validation steps", () => {
    for (const data of BUILDER_DATA.classes) {
      const draft = { ...emptyBuilderDraft(), className: data.name, subclass: data.name === "Проводник" ? "Жизнь, Защита" : data.subclasses[0]?.name ?? "" };
      for (const step of builderFlow(draft)) {
        expect(englishFlowLabel(step), step.id).not.toMatch(/[А-Яа-яЁё]/);
        if (step.issue) expect(englishIssue(step.issue), step.issue).not.toMatch(/[А-Яа-яЁё]/);
      }
    }
  });
});
