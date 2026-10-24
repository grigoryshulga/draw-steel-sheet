import { CONDITIONS, CONDITION_END_VALUES } from "../data/conditions";
import { emptyNotes } from "../data/notes";
import { classPreset, heroicResourceName } from "../data/classes";
import { DEFAULT_ABILITIES, makeId } from "../data/templates";
import type {
  Ability,
  Character,
  CharacteristicKey,
  LevelAdvancementRecord,
} from "../types";

const ZERO_CHARACTERISTICS: Record<CharacteristicKey, number> = {
  might: 0,
  agility: 0,
  reason: 0,
  intuition: 0,
  presence: 0,
};

export interface NewCharacterOptions {
  name?: string;
  className?: string;
  ancestry?: string;
  level?: number;
}

export function createCharacter(options: NewCharacterOptions = {}): Character {
  const now = new Date().toISOString();
  const level = clampLevel(options.level ?? 1);
  const preset = options.className ? classPreset(options.className) : undefined;

  const characteristics = { ...ZERO_CHARACTERISTICS };
  if (preset) {
    for (const [key, value] of Object.entries(preset.starting)) {
      characteristics[key as CharacteristicKey] = value as number;
    }
  }

  const maxStamina = preset
    ? preset.staminaBase + preset.staminaPerLevel * (level - 1)
    : 0;
  const maxRecoveries = preset?.recoveries ?? 0;

  return {
    schemaVersion: 1,
    id: makeId(),
    name: options.name?.trim() || "Новый герой",
    ancestry: options.ancestry ?? "",
    className: preset?.name ?? "",
    career: "",
    subclass: "",
    level,
    xp: 0,
    epic: 0,
    victories: 0,
    wealth: "",
    renown: "",

    characteristics,

    stamina: { current: maxStamina, max: maxStamina, temp: 0 },
    recoveries: { current: maxRecoveries, max: maxRecoveries },
    heroicResource: {
      name: heroicResourceName(preset?.name ?? ""),
      current: 0,
      max: 6,
    },
    surges: 0,
    heroTokens: 3,

    size: "1",
    speed: "5",
    stability: "0",
    disengage: "1",

    kit: "",
    weapon: "",
    armor: "",
    equipmentEffects: "",

    conditions: Object.fromEntries(
      CONDITIONS.map((condition) => [
        condition.key,
        { active: false, ends: "save" },
      ]),
    ),
    abilities: DEFAULT_ABILITIES.map((ability) => ({
      ...ability,
      id: makeId(),
    })),
    perks: [],

    skills: [],
    languages: [],
    culture: { environment: "", organization: "", upbringing: "" },
    careerInfo: { benefits: "", details: "", incitingIncident: "" },
    ancestryTraits: "",
    classFeatures: "",
    notes: emptyNotes(),

    inventory: [],
    projects: [],

    createdAt: now,
    updatedAt: now,
  };
}

/** Приводит импортированный или старый документ к актуальной схеме. */
function normalizeConditions(value: unknown): Character["conditions"] {
  const base = Object.fromEntries(
    CONDITIONS.map((condition) => [
      condition.key,
      { active: false, ends: "save" as const },
    ]),
  ) as Character["conditions"];
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<
    string,
    { active?: boolean; ends?: unknown; saveEnds?: unknown }
  >;

  for (const condition of CONDITIONS) {
    const state = raw[condition.key];
    if (!state || typeof state !== "object") continue;
    const ends =
      typeof state.ends === "string" &&
      CONDITION_END_VALUES.has(state.ends as never)
        ? (state.ends as Character["conditions"][string]["ends"])
        : state.saveEnds === true
          ? "save"
          : state.active
            ? "until-removed"
            : "save";
    base[condition.key] = { active: Boolean(state.active), ends };
  }

  return base as Character["conditions"];
}

function normalizeNotes(value: unknown): Character["notes"] {
  const base = emptyNotes();
  if (typeof value === "string") {
    return { ...base, misc: value };
  }
  if (value && typeof value === "object") {
    return { ...base, ...(value as Partial<Character["notes"]>) };
  }
  return base;
}

function normalizeAbilities(value: unknown): Ability[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const ability = raw as Partial<Ability> & {
      rollCharacteristics?: CharacteristicKey[];
      preferredCharacteristic?: CharacteristicKey | "";
    };
    const rollCharacteristics = Array.isArray(ability.rollCharacteristics)
      ? ability.rollCharacteristics
      : [];
    const preferred =
      ability.preferredCharacteristic &&
      rollCharacteristics.includes(ability.preferredCharacteristic)
        ? ability.preferredCharacteristic
        : (rollCharacteristics[0] ?? "");
    return {
      ...raw,
      rollCharacteristics,
      preferredCharacteristic: preferred,
    } as Ability;
  });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLevelAdvancementRecord(value: unknown): value is LevelAdvancementRecord {
  if (!isObjectRecord(value)) return false;
  const { fromLevel, toLevel } = value;
  return (
    Number.isSafeInteger(fromLevel) &&
    Number.isSafeInteger(toLevel) &&
    (fromLevel as number) >= 1 &&
    (fromLevel as number) <= 9 &&
    toLevel === (fromLevel as number) + 1 &&
    (toLevel as number) <= 10 &&
    typeof value.className === "string" &&
    typeof value.subclass === "string" &&
    (value.mode === "xp" || value.mode === "milestone") &&
    typeof value.articleId === "string" &&
    isObjectRecord(value.choices) &&
    Object.values(value.choices).every(
      (choice) => Array.isArray(choice) && choice.every((id) => typeof id === "string"),
    ) &&
    typeof value.notes === "string" &&
    typeof value.createdAt === "string" &&
    Number.isFinite(Date.parse(value.createdAt))
  );
}

function cloneAdvancementRecord(
  record: LevelAdvancementRecord,
): LevelAdvancementRecord {
  return {
    fromLevel: record.fromLevel,
    toLevel: record.toLevel,
    className: record.className,
    subclass: record.subclass,
    mode: record.mode,
    articleId: record.articleId,
    choices: Object.fromEntries(
      Object.entries(record.choices).map(([key, ids]) => [key, [...ids]]),
    ),
    notes: record.notes,
    createdAt: record.createdAt,
  };
}

export function normalizeCharacter(input: Partial<Character>): Character {
  const base = createCharacter({
    name: input.name,
    className: input.className,
    ancestry: input.ancestry,
    level: input.level,
  });

  const { advancements: rawAdvancements, ...inputWithoutAdvancements } =
    input as Partial<Character> & { advancements?: unknown };
  const normalizedAdvancements = Array.isArray(rawAdvancements) &&
    rawAdvancements.every(isLevelAdvancementRecord)
    ? rawAdvancements.map(cloneAdvancementRecord)
    : undefined;

  const rawAutomation = input.automation;
  const {
    classFeatureSelections: _rawSelections,
    ancestryTraitIds: _rawAncestryTraitIds,
    equipment: _rawEquipment,
    ...automationWithoutSelections
  } = rawAutomation ?? {};
  const hasFeatureSelections =
    rawAutomation !== undefined &&
    Object.prototype.hasOwnProperty.call(
      rawAutomation,
      "classFeatureSelections",
    );
  const normalizedSelections =
    hasFeatureSelections &&
    rawAutomation?.classFeatureSelections &&
    typeof rawAutomation.classFeatureSelections === "object" &&
    !Array.isArray(rawAutomation.classFeatureSelections) &&
    Object.values(rawAutomation.classFeatureSelections).every(
      (value) => typeof value === "string",
    )
      ? { ...rawAutomation.classFeatureSelections }
      : undefined;
  const normalizedAncestryTraitIds = Array.isArray(
    rawAutomation?.ancestryTraitIds,
  ) && rawAutomation.ancestryTraitIds.every((id) => typeof id === "string")
    ? [...rawAutomation.ancestryTraitIds]
    : undefined;
  const rawEquipment = rawAutomation?.equipment;
  const normalizedEquipment =
    rawEquipment !== null &&
    typeof rawEquipment === "object" &&
    !Array.isArray(rawEquipment) &&
    ["lightArmor", "lightWeapon"].every(
      (key) =>
        !(key in rawEquipment) ||
        typeof (rawEquipment as Record<string, unknown>)[key] === "boolean",
    )
      ? {
          ...(rawEquipment as Record<string, unknown>),
          lightArmor:
            (rawEquipment as Record<string, unknown>).lightArmor === true,
          lightWeapon:
            (rawEquipment as Record<string, unknown>).lightWeapon === true,
        }
      : undefined;

  return {
    ...base,
    ...inputWithoutAdvancements,
    schemaVersion: 1,
    id: input.id || base.id,
    characteristics: {
      ...base.characteristics,
      ...(input.characteristics ?? {}),
    },
    stamina: { ...base.stamina, ...(input.stamina ?? {}) },
    recoveries: { ...base.recoveries, ...(input.recoveries ?? {}) },
    heroicResource: {
      ...base.heroicResource,
      ...(input.heroicResource ?? {}),
      name: heroicResourceName(input.className ?? base.className),
    },
    culture: { ...base.culture, ...(input.culture ?? {}) },
    careerInfo: { ...base.careerInfo, ...(input.careerInfo ?? {}) },
    conditions: normalizeConditions(
      (input as unknown as { conditions?: unknown }).conditions,
    ),
    abilities: Array.isArray(input.abilities)
      ? normalizeAbilities(input.abilities)
      : base.abilities,
    perks: Array.isArray(input.perks) ? input.perks : [],
    inventory: Array.isArray(input.inventory) ? input.inventory : [],
    projects: Array.isArray(input.projects) ? input.projects : [],
    skills: Array.isArray(input.skills) ? input.skills : [],
    languages: Array.isArray(input.languages) ? input.languages : [],
    notes: normalizeNotes((input as unknown as { notes?: unknown }).notes),
    ...(normalizedAdvancements
      ? { advancements: normalizedAdvancements }
      : {}),
    ...(rawAutomation
      ? {
          automation: {
            ...automationWithoutSelections,
            ...(hasFeatureSelections && normalizedSelections
              ? { classFeatureSelections: normalizedSelections }
              : {}),
            ...(normalizedAncestryTraitIds
              ? { ancestryTraitIds: normalizedAncestryTraitIds }
              : {}),
            ...(normalizedEquipment
              ? { equipment: normalizedEquipment }
              : {}),
          },
        }
      : {}),
  } as Character;
}

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(10, Math.max(1, Math.round(level)));
}
