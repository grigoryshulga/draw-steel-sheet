import data from "../data/builder.generated.json";
import { ABILITY_COMPENDIUM } from "../data/compendium";
import { classPreset } from "../data/classes";
import {
  classFeatureGroups,
  classFeatureSelectionsFromDraft,
} from "../data/class-feature-rules";
import { ancestryTraitIdsFromNames } from "../data/ancestry-feature-rules";
import { careerPerkType, perkById } from "../data/perks";
import { kitByName } from "../data/kits";
import {
  CHARACTERISTIC_KEYS,
  type Character,
  type FeatureEquipmentFlags,
} from "../types";
import { recalculateCharacter } from "./character-calculations";
import { createCharacter } from "./defaults";
import {
  ALL_CREATION_SKILLS,
  CLASS_SIGNATURE_COUNTS,
  CAREER_SKILL_SLOTS,
  CLASS_SKILL_SLOTS,
  SUBCLASS_SKILL_SLOTS,
  DOMAIN_SKILL_SLOTS,
  CLASS_GRANTED_ABILITIES,
  SUBCLASS_GRANTED_ABILITIES,
  DOMAIN_GRANTED_ABILITIES,
  cultureSkillSlot,
  canUseKit,
  type SkillSlot,
} from "../data/creation-rules";

export const BUILDER_DATA = data;
export interface BuilderDraft {
  version: 1;
  name: string;
  concept: string;
  ancestry: string;
  traits: string[];
  equipment?: FeatureEquipmentFlags;
  culture: Character["culture"];
  cultureSkills: string[];
  career: string;
  careerSkills: string[];
  perkId: string;
  incident: string;
  className: string;
  subclass: string;
  characteristics: Character["characteristics"];
  classSkills: string[];
  abilityIds: string[];
  kit: string;
  secondaryKit: string;
  meleeDamageKit: string;
  rangedDamageKit: string;
  complication: string;
  languages: string;
  details: string;
  connections: string;
  features: string;
  domain: string;
  featureChoices: Record<string, string>;
}
export function emptyBuilderDraft(): BuilderDraft {
  return {
    version: 1,
    name: "",
    concept: "",
    ancestry: "",
    traits: [],
    equipment: { lightArmor: false, lightWeapon: false },
    culture: { environment: "", organization: "", upbringing: "" },
    cultureSkills: [],
    career: "",
    careerSkills: [],
    perkId: "",
    incident: "",
    className: "",
    subclass: "",
    characteristics: {
      might: 0,
      agility: 0,
      reason: 0,
      intuition: 0,
      presence: 0,
    },
    classSkills: [],
    abilityIds: [],
    kit: "",
    secondaryKit: "",
    meleeDamageKit: "",
    rangedDamageKit: "",
    complication: "",
    languages: "",
    details: "",
    connections: "",
    features: "",
    domain: "",
    featureChoices: {},
  };
}
export function startingCharacteristics(
  className: string,
): Character["characteristics"] {
  const preset = classPreset(className);
  const remaining =
    preset && Object.keys(preset.starting).length === 1
      ? [2, 1, 0, 0]
      : [1, 0, 0];
  let i = 0;
  return Object.fromEntries(
    CHARACTERISTIC_KEYS.map((key) => [
      key,
      preset?.starting[key] ?? remaining[i++] ?? 0,
    ]),
  ) as Character["characteristics"];
}
export function validCharacteristicArray(draft: BuilderDraft): boolean {
  const preset = classPreset(draft.className);
  if (!preset) return false;
  if (
    Object.entries(preset.starting).some(
      ([key, value]) =>
        draft.characteristics[key as keyof Character["characteristics"]] !==
        value,
    )
  )
    return false;
  const free = CHARACTERISTIC_KEYS.filter((key) => !(key in preset.starting))
    .map((key) => draft.characteristics[key])
    .sort((a, b) => b - a)
    .join(",");
  return (
    Object.keys(preset.starting).length === 1
      ? ["2,2,-1,-1", "2,1,1,-1", "2,1,0,0", "1,1,1,0"]
      : ["2,-1,-1", "1,1,-1", "1,0,0"]
  ).includes(free);
}
export function selectedSkills(
  slots: SkillSlot[],
  selections: string[],
): string[] {
  return slots.map((s, i) => selections[i] || s.fixed || "").filter(Boolean);
}
export function builderSkillSlots(draft: BuilderDraft) {
  const culture = (
    Object.keys(draft.culture) as (keyof Character["culture"])[]
  ).map((key) => {
    const option = data.cultures[key].find(
      (o) => o.name === draft.culture[key],
    );
    return option
      ? cultureSkillSlot(option.text)
      : { label: "Навык культуры", options: [] };
  });
  const domains =
    draft.className === "Проводник"
      ? draft.subclass.split(", ")
      : draft.className === "Цензор"
        ? [draft.domain]
        : [];
  return {
    culture,
    career: CAREER_SKILL_SLOTS[draft.career] ?? [],
    class: [
      ...(CLASS_SKILL_SLOTS[draft.className] ?? []),
      ...(SUBCLASS_SKILL_SLOTS[draft.subclass] ?? []),
      ...domains
        .filter((d) => DOMAIN_SKILL_SLOTS[d])
        .map((d) => DOMAIN_SKILL_SLOTS[d]),
    ],
  };
}
export function grantedClassAbilities(draft: BuilderDraft) {
  const domains =
    draft.className === "Проводник"
      ? draft.subclass.split(", ")
      : draft.className === "Цензор"
        ? [draft.domain]
        : [];
  const names = [
    ...(CLASS_GRANTED_ABILITIES[draft.className] ?? []),
    ...(SUBCLASS_GRANTED_ABILITIES[draft.subclass] ?? []),
    ...domains.flatMap((d) => DOMAIN_GRANTED_ABILITIES[d] ?? []),
  ];
  const normalized = (name: string) =>
    name
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}]/gu, "");
  return ABILITY_COMPENDIUM.filter(
    (a) =>
      a.className === draft.className &&
      a.level === 1 &&
      names.some((n) => normalized(n) === normalized(a.name)),
  );
}
export function buildCharacter(
  draft: BuilderDraft,
  seed: Character = createCharacter(),
): Character {
  const ancestry = data.ancestries.find((a) => a.name === draft.ancestry);
  const traits =
    ancestry?.traits.filter((t) => draft.traits.includes(t.name)) ?? [];
  const career = data.careers.find((c) => c.name === draft.career);
  const perk = perkById(draft.perkId);
  const kit = canUseKit(draft.className, draft.subclass)
    ? kitByName(draft.kit)
    : undefined;
  const complication = data.complications.find(
    (c) => c.name === draft.complication,
  );
  const slots = builderSkillSlots(draft);
  const skillChoices = [
    ...selectedSkills(slots.culture, draft.cultureSkills),
    ...selectedSkills(slots.career, draft.careerSkills),
    ...selectedSkills(slots.class, draft.classSkills),
  ];
  const granted = grantedClassAbilities(draft);
  const classData = data.classes.find((c) => c.name === draft.className);
  const classFeatureSelections = classFeatureSelectionsFromDraft(
    draft.className,
    draft.featureChoices,
  );
  const registryGroups = classFeatureGroups(draft.className);
  const registryGroupsByName = new Map(
    registryGroups.map((group) => [group.name, group]),
  );
  const mappedGroupIds = new Set(
    registryGroups
      .filter((group) => classFeatureSelections[group.id])
      .map((group) => group.id),
  );
  const abilities = ABILITY_COMPENDIUM.filter(
    (a) =>
      (draft.abilityIds.includes(a.id) || granted.some((g) => g.id === a.id)) &&
      a.className === draft.className &&
      a.level === 1,
  );
  const kitAbilities = [
    kit,
    draft.className === "Тактик" ? kitByName(draft.secondaryKit) : undefined,
  ]
    .filter(Boolean)
    .flatMap((kit) => {
      const ability = ABILITY_COMPENDIUM.find(
        (a) =>
          a.source === `Комплект: ${kit!.name}` &&
          a.name === kit!.signatureAbility,
      );
      return ability ? [ability] : [];
    });
  const doc: Character = {
    ...seed,
    name: draft.name.trim() || "Новый герой",
    ancestry: draft.ancestry,
    className: draft.className,
    level: 1,
    career: draft.career,
    subclass: draft.subclass,
    characteristics: { ...draft.characteristics },
    culture: { ...draft.culture },
    careerInfo: {
      benefits: career?.benefits.replace(/\*\*/g, "") ?? "",
      details: "",
      incitingIncident: draft.incident,
    },
    ancestryTraits: [
      ancestry?.signature,
      ...traits.map((t) => `${t.name} (${t.cost}): ${t.text}`),
    ]
      .filter(Boolean)
      .join("\n\n"),
    classFeatures: [
      classData?.subclasses.find((s) => s.name === draft.subclass)?.text,
      draft.domain ? `Домен: ${draft.domain}` : "",
      ...(classData?.featureChoices.flatMap((group) => {
        const option = group.options.find(
          (o) => o.name === draft.featureChoices[group.name],
        );
        if (!option) return [];
        const registryGroup = registryGroupsByName.get(group.name);
        return registryGroup && mappedGroupIds.has(registryGroup.id)
          ? []
          : [`${option.name}\n${option.text}`];
      }) ?? []),
      draft.features,
    ]
      .filter(Boolean)
      .join("\n\n"),
    notes: {
      ...seed.notes,
      story: [draft.concept, draft.details].filter(Boolean).join("\n\n"),
      contacts: draft.connections,
      misc: complication
        ? `Нюанс: ${complication.name}\n\n${complication.text}`
        : "",
    },
    kit: kit?.name ?? "",
    secondaryKit: draft.className === "Тактик" ? draft.secondaryKit : "",
    equipmentEffects: "",
    skills: [...new Set(skillChoices)],
    languages: [
      ...new Set(
        draft.languages
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ],
    renown: String(career?.renown ?? 0),
    wealth: String(career?.wealth ?? 0),
    perks: perk
      ? [
          {
            perkId: perk.id,
            name: perk.name,
            type: perk.type,
            source: "career",
            level: 0,
          },
        ]
      : [],
    abilities: [...seed.abilities, ...abilities, ...kitAbilities].map((a) => ({
      ...a,
    })),
    size: draft.ancestry === "Хакаан" ? "1L" : "1М",
    automation: {
      enabled: true,
      adjustments: {},
      ancestryTraits: traits.map((t) => t.name),
      ancestryTraitIds: ancestryTraitIdsFromNames(
        draft.ancestry,
        traits.map((t) => t.name),
      ),
      equipment: {
        lightArmor: draft.equipment?.lightArmor ?? false,
        lightWeapon: draft.equipment?.lightWeapon ?? false,
      },
      meleeDamageKit: draft.meleeDamageKit,
      rangedDamageKit: draft.rangedDamageKit,
      classFeatureSelections,
    },
  };
  const calculated = recalculateCharacter(seed, doc);
  return {
    ...calculated,
    stamina: { ...calculated.stamina, current: calculated.stamina.max },
    recoveries: {
      ...calculated.recoveries,
      current: calculated.recoveries.max,
    },
  };
}

/** Required choices are validated in one place for the wizard and importable creation workflows. */
export function builderIssues(draft: BuilderDraft): string[] {
  const ancestry = data.ancestries.find((a) => a.name === draft.ancestry);
  const career = data.careers.find((c) => c.name === draft.career);
  const classData = data.classes.find((c) => c.name === draft.className);
  const preset = classPreset(draft.className);
  const skillSlots = builderSkillSlots(draft);
  const cultureSkills = selectedSkills(skillSlots.culture, draft.cultureSkills);
  const careerSkills = selectedSkills(skillSlots.career, draft.careerSkills);
  const traitsSpent =
    ancestry?.traits
      .filter((t) => draft.traits.includes(t.name))
      .reduce((sum, t) => sum + t.cost, 0) ?? 0;
  const granted = grantedClassAbilities(draft);
  const classAbilities = ABILITY_COMPENDIUM.filter(
    (a) =>
      a.className === draft.className &&
      a.level === 1 &&
      !granted.some((g) => g.id === a.id),
  );
  const selectedAbilities = classAbilities.filter((a) =>
    draft.abilityIds.includes(a.id),
  );
  const signatureCount = CLASS_SIGNATURE_COUNTS[draft.className] ?? 0;
  const missingSkills = (
    slots: SkillSlot[],
    values: string[],
    prior: string[] = [],
  ) =>
    slots.some((s, i) => {
      const previousValues = slots
        .slice(0, i)
        .map((s, j) => values[j] || s.fixed || "");
      const duplicate =
        s.fixed && [...prior, ...previousValues].includes(s.fixed);
      const value = values[i] || (!duplicate ? s.fixed : "");
      return (
        !value ||
        !(duplicate ? ALL_CREATION_SKILLS : s.options).includes(value) ||
        prior.includes(value) ||
        slots.some((other, j) => j < i && (values[j] || other.fixed) === value)
      );
    });
  const issues = [
    draft.name.trim() ? "" : "Дайте герою имя.",
    !ancestry
      ? "Выберите происхождение."
      : traitsSpent !== ancestry.budget
        ? `Распределите ${ancestry.budget} очка происхождения (выбрано ${traitsSpent}).`
        : "",
    Object.values(draft.culture).some((v) => !v) ||
    missingSkills(skillSlots.culture, draft.cultureSkills)
      ? "Выберите три аспекта культуры и три разных навыка."
      : "",
    !career
      ? "Выберите карьеру."
      : !draft.incident
        ? "Выберите побуждающий инцидент."
        : !draft.perkId ||
            perkById(draft.perkId)?.type !== careerPerkType(draft.career)
          ? "Выберите перк карьеры."
          : missingSkills(skillSlots.career, draft.careerSkills, cultureSkills)
            ? "Заполните навыки карьеры; повторяющиеся навыки замените."
            : "",
    !preset
      ? "Выберите класс."
      : !draft.subclass ||
          (draft.className === "Проводник"
            ? new Set(draft.subclass.split(", ").filter(Boolean)).size !== 2 ||
              draft.subclass
                .split(", ")
                .some(
                  (name) => !classData?.subclasses.some((s) => s.name === name),
                )
            : !classData?.subclasses.some((s) => s.name === draft.subclass))
        ? "Выберите подкласс (для проводника — два домена)."
        : draft.className === "Цензор" && !draft.domain
          ? "Выберите домен цензора."
          : classData?.featureChoices.some(
                (g) =>
                  !g.options.some(
                    (o) => o.name === draft.featureChoices[g.name],
                  ),
              )
            ? "Выберите дополнительные особенности класса."
            : !validCharacteristicArray(draft)
              ? "Распределение характеристик должно соответствовать одному из наборов класса."
              : missingSkills(skillSlots.class, draft.classSkills, [
                    ...cultureSkills,
                    ...careerSkills,
                  ])
                ? "Заполните навыки класса; повторяющиеся навыки замените."
                : "",
    canUseKit(draft.className, draft.subclass) && !draft.kit
      ? "Выберите комплект."
      : draft.className === "Тактик" &&
          (!draft.secondaryKit || draft.secondaryKit === draft.kit)
        ? "Выберите второй, отличный комплект тактика."
        : "",
    selectedAbilities.filter((a) => a.kind === "signature").length !==
    signatureCount
      ? `Выберите знаковые способности класса: ${signatureCount}.`
      : [3, 5].some(
            (cost) =>
              classAbilities.some((a) => a.resourceCost === cost) &&
              selectedAbilities.filter((a) => a.resourceCost === cost)
                .length !== 1,
          )
        ? "Выберите по одной героической способности за 3 и за 5 ресурса."
        : draft.className === "Проводник" &&
            selectedAbilities.filter((a) =>
              ["Слово Наставления", "Слово Суда"].includes(a.name),
            ).length !== 1
          ? "Выберите один триггер проводника."
          : "",
    "",
    "",
  ];
  return issues;
}
