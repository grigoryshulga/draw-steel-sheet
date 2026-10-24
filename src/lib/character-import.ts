import { makeId } from "../data/templates";
import { normalizeCharacter } from "./defaults";
import { CHARACTERISTIC_KEYS, type ActionType, type Character } from "../types";

const MAX_IMPORT_SIZE = 2 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path: string): never {
  throw new Error(
    `Некорректные данные героя: поле «${path}» имеет неверный формат.`,
  );
}

function optionalString(object: JsonObject, key: string, path = key): void {
  if (key in object && typeof object[key] !== "string") fail(path);
}

function optionalNumber(object: JsonObject, key: string, path = key): void {
  if (
    key in object &&
    (typeof object[key] !== "number" || !Number.isFinite(object[key]))
  )
    fail(path);
}

function requireStrings(
  object: JsonObject,
  fields: string[],
  path: string,
): void {
  for (const key of fields) {
    if (typeof object[key] !== "string") fail(`${path}.${key}`);
  }
}

function optionalStringArray(object: JsonObject, key: string): void {
  if (
    key in object &&
    (!Array.isArray(object[key]) ||
      !object[key].every((item) => typeof item === "string"))
  ) {
    fail(key);
  }
}

function validateStringFields(
  value: unknown,
  fields: string[],
  path: string,
): void {
  if (value === undefined) return;
  if (!isObject(value)) fail(path);
  for (const field of fields) optionalString(value, field, `${path}.${field}`);
}

function validateNumberFields(
  value: unknown,
  fields: string[],
  path: string,
): void {
  if (value === undefined) return;
  if (!isObject(value)) fail(path);
  for (const field of fields) optionalNumber(value, field, `${path}.${field}`);
}

function validateArrayOfObjects(
  object: JsonObject,
  key: string,
  validate: (item: JsonObject, index: number) => void,
): void {
  if (!(key in object)) return;
  const value = object[key];
  if (!Array.isArray(value)) fail(key);
  value.forEach((item, index) => {
    if (!isObject(item)) fail(`${key}[${index}]`);
    validate(item, index);
  });
}

function validateCharacterShape(value: JsonObject): void {
  const strings = [
    "id",
    "name",
    "ancestry",
    "className",
    "career",
    "subclass",
    "wealth",
    "renown",
    "size",
    "speed",
    "stability",
    "disengage",
    "kit",
    "secondaryKit",
    "weapon",
    "armor",
    "equipmentEffects",
    "ancestryTraits",
    "classFeatures",
    "createdAt",
    "updatedAt",
  ];
  const numbers = ["level", "xp", "epic", "victories", "surges", "heroTokens"];
  for (const key of strings) optionalString(value, key);
  for (const key of numbers) optionalNumber(value, key);

  if ("characteristics" in value) {
    const characteristics = value.characteristics;
    if (!isObject(characteristics)) fail("characteristics");
    for (const key of ["might", "agility", "reason", "intuition", "presence"]) {
      optionalNumber(characteristics, key, `characteristics.${key}`);
    }
  }

  validateNumberFields(value.stamina, ["current", "max", "temp"], "stamina");
  validateNumberFields(value.recoveries, ["current", "max"], "recoveries");
  if ("heroicResource" in value) {
    const resource = value.heroicResource;
    if (!isObject(resource)) fail("heroicResource");
    optionalString(resource, "name", "heroicResource.name");
    optionalNumber(resource, "current", "heroicResource.current");
    optionalNumber(resource, "max", "heroicResource.max");
  }

  for (const key of ["skills", "languages"]) optionalStringArray(value, key);
  validateStringFields(
    value.culture,
    ["environment", "organization", "upbringing"],
    "culture",
  );
  validateStringFields(
    value.careerInfo,
    ["benefits", "details", "incitingIncident"],
    "careerInfo",
  );
  // Older documents stored all notes in one freeform field.
  if (typeof value.notes !== "string") {
    validateStringFields(
      value.notes,
      ["story", "contacts", "debts", "secrets", "misc"],
      "notes",
    );
  }

  if ("conditions" in value) {
    const conditions = value.conditions;
    if (!isObject(conditions)) fail("conditions");
    for (const [key, state] of Object.entries(conditions)) {
      if (!isObject(state)) fail(`conditions.${key}`);
      if ("active" in state && typeof state.active !== "boolean")
        fail(`conditions.${key}.active`);
      optionalString(state, "ends", `conditions.${key}.ends`);
      if ("saveEnds" in state && typeof state.saveEnds !== "boolean")
        fail(`conditions.${key}.saveEnds`);
    }
  }

  validateArrayOfObjects(value, "abilities", (ability, index) => {
    const path = `abilities[${index}]`;
    for (const key of [
      "id",
      "name",
      "flavor",
      "actionType",
      "kind",
      "distance",
      "target",
      "preferredCharacteristic",
      "trigger",
      "effect",
      "source",
      "notes",
      "weaponMode",
    ]) {
      optionalString(ability, key, `${path}.${key}`);
    }
    for (const key of ["rollBonus", "resourceCost"])
      optionalNumber(ability, key, `${path}.${key}`);
    requireStrings(
      ability,
      [
        "id",
        "name",
        "flavor",
        "distance",
        "target",
        "trigger",
        "effect",
        "source",
        "notes",
      ],
      path,
    );
    for (const key of ["rollBonus", "resourceCost"]) {
      if (typeof ability[key] !== "number") fail(`${path}.${key}`);
    }
    if (!isActionType(ability.actionType)) {
      fail(`${path}.actionType`);
    }
    if (
      !["free-strike", "signature", "heroic", "other"].includes(
        String(ability.kind),
      )
    ) {
      fail(`${path}.kind`);
    }
    if (
      !Array.isArray(ability.keywords) ||
      !ability.keywords.every((entry) => typeof entry === "string")
    ) {
      fail(`${path}.keywords`);
    }
    if ("rollCharacteristics" in ability) {
      if (
        !Array.isArray(ability.rollCharacteristics) ||
        !ability.rollCharacteristics.every(isCharacteristicKey)
      ) {
        fail(`${path}.rollCharacteristics`);
      }
    }
    if (
      "preferredCharacteristic" in ability &&
      ability.preferredCharacteristic !== "" &&
      !isCharacteristicKey(ability.preferredCharacteristic)
    ) {
      fail(`${path}.preferredCharacteristic`);
    }
    if (!Array.isArray(ability.tiers) || ability.tiers.length !== 3)
      fail(`${path}.tiers`);
    validateArrayOfObjects(ability, "tiers", (tier, tierIndex) => {
      if (typeof tier.damage !== "string")
        fail(`${path}.tiers[${tierIndex}].damage`);
      if (typeof tier.effect !== "string")
        fail(`${path}.tiers[${tierIndex}].effect`);
    });
  });

  validateArrayOfObjects(value, "perks", (perk, index) => {
    const path = `perks[${index}]`;
    requireStrings(perk, ["perkId", "name", "type", "source"], path);
    if (typeof perk.level !== "number") fail(`${path}.level`);
    for (const key of [
      "perkId",
      "name",
      "type",
      "source",
      "summary",
      "description",
    ]) {
      optionalString(perk, key, `${path}.${key}`);
    }
    optionalNumber(perk, "level", `${path}.level`);
  });

  validateArrayOfObjects(value, "inventory", (item, index) => {
    const path = `inventory[${index}]`;
    requireStrings(item, ["id", "name", "category", "notes"], path);
    if (
      !["gear", "consumable", "treasure", "trinket", "title"].includes(
        String(item.category),
      )
    )
      fail(`${path}.category`);
    if (typeof item.qty !== "number") fail(`${path}.qty`);
    for (const key of ["id", "name", "category", "notes"])
      optionalString(item, key, `${path}.${key}`);
    optionalNumber(item, "qty", `${path}.qty`);
    if ("equipped" in item && typeof item.equipped !== "boolean")
      fail(`${path}.equipped`);
  });
  validateArrayOfObjects(value, "projects", (project, index) => {
    const path = `projects[${index}]`;
    requireStrings(
      project,
      ["id", "name", "assigned", "characteristic", "goal", "points"],
      path,
    );
  });

  if ("automation" in value) {
    const automation = value.automation;
    if (!isObject(automation)) fail("automation");
    if ("enabled" in automation && typeof automation.enabled !== "boolean")
      fail("automation.enabled");
    optionalStringArray(automation, "ancestryTraits");
    for (const key of ["meleeDamageKit", "rangedDamageKit"])
      optionalString(automation, key, `automation.${key}`);
    if ("adjustments" in automation) {
      const adjustments = automation.adjustments;
      if (!isObject(adjustments)) fail("automation.adjustments");
      for (const key of [
        "stamina",
        "recoveries",
        "speed",
        "stability",
        "disengage",
      ]) {
        optionalNumber(adjustments, key, `automation.adjustments.${key}`);
      }
    }
    if ("classFeatureSelections" in automation) {
      const selections = automation.classFeatureSelections;
      if (!isObject(selections)) fail("automation.classFeatureSelections");
      for (const [groupId, optionId] of Object.entries(selections)) {
        if (typeof optionId !== "string") {
          fail(`automation.classFeatureSelections.${groupId}`);
        }
      }
    }
  }
}

function isCharacteristicKey(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (CHARACTERISTIC_KEYS as readonly string[]).includes(value)
  );
}

function isActionType(value: unknown): value is ActionType {
  return (
    typeof value === "string" &&
    [
      "main",
      "maneuver",
      "move",
      "trigger",
      "free-trigger",
      "free-maneuver",
      "none",
    ].includes(value)
  );
}

/** Читает и безопасно нормализует JSON-лист героя. */
export async function parseCharacterImport(
  file: Pick<File, "size" | "text">,
): Promise<Character> {
  if (file.size > MAX_IMPORT_SIZE) {
    throw new Error("Файл героя слишком большой. Максимальный размер — 2 МиБ.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("Не удалось прочитать файл героя: проверьте формат JSON.");
  }
  if (!isObject(parsed)) {
    throw new Error("В файле должны быть данные одного героя в формате JSON.");
  }
  if (typeof parsed.name !== "string" || !parsed.name.trim()) {
    throw new Error("В файле не указано имя героя.");
  }
  if ("schemaVersion" in parsed && parsed.schemaVersion !== 1) {
    throw new Error("Версия файла героя не поддерживается.");
  }

  validateCharacterShape(parsed);
  const now = new Date().toISOString();
  const character = normalizeCharacter(parsed as Partial<Character>);
  return {
    ...character,
    name: character.name.trim(),
    id: makeId(),
    createdAt: now,
    updatedAt: now,
  };
}
