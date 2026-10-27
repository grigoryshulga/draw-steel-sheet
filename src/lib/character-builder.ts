import data from "../data/builder.generated.json";
import { ABILITY_COMPENDIUM } from "../data/compendium";
import { classPreset } from "../data/classes";
import {
  classFeatureGroups,
  classFeatureSelectionsFromDraft,
} from "../data/class-feature-rules";
import { ancestryTraitIdsFromNames } from "../data/ancestry-feature-rules";
import { ancestrySkillSlots } from "../data/ancestry-skill-rules";
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
import type { BuilderStepId } from "./builder-steps";
import {
  allocateCharacteristicArray,
  characteristicArrays,
  isValidCharacteristicAllocation,
} from "./characteristic-allocation";
import { resolveSkillSelection } from "./skill-selection";

export const BUILDER_DATA = data;
export interface BuilderDraft {
  version: 1;
  name: string;
  concept: string;
  ancestry: string;
  traits: string[];
  equipment?: FeatureEquipmentFlags;
  culture: Character["culture"];
  ancestrySkills?: string[];
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
  /** Проводник отдельно выбирает домен для особенности 1-го уровня. */
  conduitDomainFeature: string;
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
    ancestrySkills: [],
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
    conduitDomainFeature: "",
  };
}
export function startingCharacteristics(
  className: string,
): Character["characteristics"] {
  const preset = classPreset(className);
  const freeKeys = CHARACTERISTIC_KEYS.filter(
    (key) => !(key in (preset?.starting ?? {})),
  );
  const defaults = freeKeys.length === 4 ? [2, 1, 0, 0] : [1, 0, 0];
  // Набор по умолчанию берётся из общего модуля распределения характеристик.
  const array = characteristicArrays(className).find(
    (candidate) =>
      candidate.values.length === defaults.length &&
      candidate.values.every((value, index) => value === defaults[index]),
  );
  if (array) return allocateCharacteristicArray(className, array.id);
  // Без выбранного класса сохранён прежний черновой набор.
  let i = 0;
  return Object.fromEntries(
    CHARACTERISTIC_KEYS.map((key) => [
      key,
      preset?.starting[key] ?? (i < defaults.length ? defaults[i++] : 0),
    ]),
  ) as Character["characteristics"];
}
export function validCharacteristicArray(draft: BuilderDraft): boolean {
  return isValidCharacteristicAllocation(draft.className, draft.characteristics);
}
/** Каноническое назначение навыков по слотам через общий движок подбора. */
export function selectedSkills(
  slots: SkillSlot[],
  selections: string[],
  prior: string[] = [],
): string[] {
  return resolveSkillSelection(slots, selections, prior).values.filter(Boolean);
}
interface SkillChain {
  slots: ReturnType<typeof builderSkillSlots>;
  ancestry: string[];
  culture: string[];
  career: string[];
  class: string[];
}
/** Порядок источников навыков: происхождение → культура → карьера → класс. */
export function builderSkillSelections(draft: BuilderDraft): SkillChain {
  const slots = builderSkillSlots(draft);
  const ancestry = selectedSkills(slots.ancestry, draft.ancestrySkills ?? []);
  const culture = selectedSkills(slots.culture, draft.cultureSkills, ancestry);
  const prior = [...ancestry, ...culture];
  const career = selectedSkills(slots.career, draft.careerSkills, prior);
  prior.push(...career);
  const classSkills = selectedSkills(slots.class, draft.classSkills, prior);
  return { slots, ancestry, culture, career, class: classSkills };
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
      ? selectedConduitDomain(draft)
      : draft.className === "Цензор"
        ? [draft.domain]
        : [];
  return {
    ancestry: ancestrySkillSlots(draft.ancestry, draft.traits ?? []),
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
      ? selectedConduitDomain(draft)
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

/** Domain cards are granted by the selected conduit domain, never chosen manually. */
function isManualClassAbility(draft: BuilderDraft, ability: (typeof ABILITY_COMPENDIUM)[number]) {
  if (ability.className !== draft.className || ability.level !== 1) return false;
  if (draft.className !== "Проводник") return true;
  const normalize = (name: string) => name.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]/gu, "");
  const domainGrantNames = new Set(Object.values(DOMAIN_GRANTED_ABILITIES).flat().map(normalize));
  return !domainGrantNames.has(normalize(ability.name));
}

export function selectableClassAbilities(draft: BuilderDraft) {
  const grantedIds = new Set(grantedClassAbilities(draft).map((ability) => ability.id));
  return ABILITY_COMPENDIUM.filter(
    (ability) => isManualClassAbility(draft, ability) && !grantedIds.has(ability.id),
  );
}

/** На 1-м уровне Проводник получает доменные данные только из явного выбора. */
function selectedConduitDomain(draft: BuilderDraft): string[] {
  const pair = draft.subclass.split(",").map((domain) => domain.trim());
  const choice = draft.conduitDomainFeature.trim();
  return pair.length === 2 && pair[0] && pair[1] && pair[0] !== pair[1] &&
    pair.includes(choice)
    ? [choice]
    : [];
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
  const skills = builderSkillSelections(draft);
  const skillChoices = [
    ...skills.ancestry,
    ...skills.culture,
    ...skills.career,
    ...skills.class,
  ];
  const granted = grantedClassAbilities(draft);
  const classData = data.classes.find((c) => c.name === draft.className);
  const classFeatureSelections = classFeatureSelectionsFromDraft(
    draft.className,
    draft.featureChoices,
  );
  if (draft.className === "Проводник") {
    const domains = draft.subclass
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (domains.length) classFeatureSelections["conduit.domain"] = domains.join(", ");
    if (domains.includes(draft.conduitDomainFeature)) {
      classFeatureSelections["conduit.domain.1"] = draft.conduitDomainFeature;
    }
  }
  // У Цензора орден хранится как подкласс (`character.subclass`) и читается
  // фолбэком `censor.order`; домен приложение нигде больше не хранит, поэтому
  // пишем его явно — иначе особенности доменов не активируются.
  if (draft.className === "Цензор" && draft.domain.trim() !== "") {
    classFeatureSelections["censor.domain"] = draft.domain.trim();
  }
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
      isManualClassAbility(draft, a) || granted.some((g) => g.id === a.id),
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

interface BuilderIssueParts {
  name: string;
  ancestry: string;
  ancestryOptions: string;
  culture: string;
  career: string;
  careerOptions: string;
  class: string;
  classOptions: string;
  kit: string;
  abilities: string;
}

/**
 * Required choices are validated in one place for the wizard and importable
 * creation workflows. Skill validation runs through the same matching engine
 * the builder UI uses, so a draft cannot bypass the selection rules by keeping
 * plausible-looking per-slot arrays.
 */
function builderIssueParts(draft: BuilderDraft): BuilderIssueParts {
  const ancestry = data.ancestries.find((a) => a.name === draft.ancestry);
  const career = data.careers.find((c) => c.name === draft.career);
  const classData = data.classes.find((c) => c.name === draft.className);
  const preset = classPreset(draft.className);
  const skills = builderSkillSelections(draft);
  const traitsSpent =
    ancestry?.traits
      .filter((t) => draft.traits.includes(t.name))
      .reduce((sum, t) => sum + t.cost, 0) ?? 0;
  const ancestrySkillsComplete = resolveSkillSelection(
    skills.slots.ancestry,
    draft.ancestrySkills ?? [],
  ).complete;
  const cultureSkillsComplete = resolveSkillSelection(
    skills.slots.culture,
    draft.cultureSkills,
    skills.ancestry,
  ).complete;
  const careerPrior = [...skills.ancestry, ...skills.culture];
  const careerSkillsComplete = resolveSkillSelection(
    skills.slots.career,
    draft.careerSkills,
    careerPrior,
  ).complete;
  const classSkillsComplete = resolveSkillSelection(
    skills.slots.class,
    draft.classSkills,
    [...careerPrior, ...skills.career],
  ).complete;
  const classAbilities = selectableClassAbilities(draft);
  const selectedAbilities = classAbilities.filter((a) =>
    draft.abilityIds.includes(a.id),
  );
  const signatureCount = CLASS_SIGNATURE_COUNTS[draft.className] ?? 0;
  const forbiddenDomainCardSelected =
    draft.className === "Проводник" &&
    draft.abilityIds.some((id) => {
      const ability = ABILITY_COMPENDIUM.find((entry) => entry.id === id);
      return ability && !isManualClassAbility(draft, ability);
    });
  return {
    name: draft.name.trim() ? "" : "Дайте герою имя.",
    ancestry: ancestry ? "" : "Выберите происхождение.",
    ancestryOptions: !ancestry
      ? ""
      : traitsSpent !== ancestry.budget
        ? `Распределите ${ancestry.budget} очка происхождения (выбрано ${traitsSpent}).`
        : ancestrySkillsComplete
          ? ""
          : "Выберите навыки происхождения; повторяющиеся навыки замените.",
    culture:
      Object.values(draft.culture).some((v) => !v) || !cultureSkillsComplete
        ? "Выберите три аспекта культуры и три разных навыка."
        : "",
    career: career ? "" : "Выберите карьеру.",
    careerOptions: !career
      ? ""
      : !draft.incident
        ? "Выберите побуждающий инцидент."
        : !draft.perkId ||
            perkById(draft.perkId)?.type !== careerPerkType(draft.career)
          ? "Выберите перк карьеры."
          : careerSkillsComplete
            ? ""
            : "Заполните навыки карьеры; повторяющиеся навыки замените.",
    class: preset ? "" : "Выберите класс.",
    classOptions: !preset
      ? ""
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
          : draft.className === "Проводник" &&
              !draft.subclass
                .split(",")
                .map((name) => name.trim())
                .includes(draft.conduitDomainFeature)
            ? "Выберите домен для особенности 1-го уровня из двух выбранных."
          : classData?.featureChoices.some(
                (g) =>
                  !g.options.some(
                    (o) => o.name === draft.featureChoices[g.name],
                  ),
              )
            ? "Выберите дополнительные особенности класса."
            : !validCharacteristicArray(draft)
              ? "Распределение характеристик должно соответствовать одному из наборов класса."
              : classSkillsComplete
                ? ""
                : "Заполните навыки класса; повторяющиеся навыки замените.",
    kit:
      canUseKit(draft.className, draft.subclass) && !draft.kit
        ? "Выберите комплект."
        : draft.className === "Тактик" &&
            (!draft.secondaryKit || draft.secondaryKit === draft.kit)
          ? "Выберите второй, отличный комплект тактика."
          : "",
    abilities: forbiddenDomainCardSelected
      ? "Особенности доменов выдаются автоматически только выбранным доменом."
      : selectedAbilities.filter((a) => a.kind === "signature").length !==
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
  };
}

/**
 * Legacy nine-position issue list. Positions are part of the public contract
 * for callers and tests, so they are kept even though the UI is grouped into
 * twelve steps.
 */
export function builderIssues(draft: BuilderDraft): string[] {
  const parts = builderIssueParts(draft);
  return [
    parts.name,
    parts.ancestry || parts.ancestryOptions,
    parts.culture,
    parts.career || parts.careerOptions,
    parts.class || parts.classOptions,
    parts.kit,
    parts.abilities,
    "",
    "",
  ];
}

/** One issue per stable UI step id; empty string means the step is complete. */
export function builderStepIssues(
  draft: BuilderDraft,
): Record<BuilderStepId, string> {
  const parts = builderIssueParts(draft);
  const ancestry = data.ancestries.find((a) => a.name === draft.ancestry);
  const career = data.careers.find((c) => c.name === draft.career);
  const classData = data.classes.find((c) => c.name === draft.className);
  // A catalog entry without basics (the unfinished «Призыватель») is not a
  // selectable class, and a step whose parent choice is still missing must
  // never look complete in the wizard.
  const classReady = Boolean(classData?.basics?.trim());
  return {
    concept: parts.name,
    ancestry: parts.ancestry,
    "ancestry-options": ancestry
      ? parts.ancestryOptions
      : "Сначала выберите происхождение.",
    culture: parts.culture,
    career: parts.career,
    "career-options": career
      ? parts.careerOptions
      : "Сначала выберите карьеру.",
    class: classReady ? "" : "Выберите класс.",
    "class-options": classReady
      ? parts.classOptions
      : "Сначала выберите класс.",
    kit: classReady ? parts.kit : "Сначала выберите класс.",
    abilities: classReady ? parts.abilities : "Сначала выберите класс.",
    details: "",
    summary: "",
  };
}
