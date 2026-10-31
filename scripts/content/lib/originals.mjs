import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const REFERENCE_DIR = path.join(REPO_ROOT, "scripts/originals/reference");
const MAP_DIR = path.join(REPO_ROOT, "scripts/originals/maps");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const readMap = (name) => {
  try {
    const value = readJson(path.join(MAP_DIR, `${name}.json`));
    return value.map ?? value;
  } catch {
    return {};
  }
};

const REFERENCE_FILES = [
  "abilities",
  "features",
  "ancestry-traits",
  "ancestries",
  "cultures",
  "careers",
  "classes",
  "complications",
  "perks",
  "kits",
  "conditions",
  "skills",
  "projects",
  "titles",
  "treasures",
];

const reference = {};
for (const name of REFERENCE_FILES) {
  let list = [];
  try {
    list = readJson(path.join(REFERENCE_DIR, `${name}.json`));
  } catch {
    continue;
  }
  for (const entry of list) {
    if (entry.scc) reference[entry.scc] = { ...entry, kind: name };
  }
}

const codexSections = readJson(path.join(REFERENCE_DIR, "codex-sections.json"));
const codexArticleMap = {};
for (let index = 1; index <= 20; index += 1) {
  const name = `codex-${String(index).padStart(2, "0")}`;
  Object.assign(codexArticleMap, readMap(name));
}

const CLASS_MAPS = [
  "fury",
  "null",
  "conduit",
  "tactician",
  "talent",
  "shadow",
  "troubadour",
  "censor",
  "elementalist",
  "extras",
];

export const maps = {
  abilities: Object.assign({}, ...CLASS_MAPS.map(readMap), readMap("kits")),
  classFeatures: Object.assign({}, ...CLASS_MAPS.map(readMap), readMap("unmapped-features")),
  ancestryFeatures: Object.assign(
    {},
    readMap("ancestry-features"),
    readMap("unmapped-ancestry-features"),
  ),
  kits: readMap("kits"),
  perks: readMap("perks"),
  ancestries: Object.assign({}, readMap("ancestries"), readMap("unmapped-builder")),
  cultures: readMap("cultures"),
  careers: readMap("careers"),
  classes: readMap("classes"),
  complications: readMap("complications"),
  catalog: readMap("catalog"),
  subclasses: readMap("subclasses"),
  conditions: readMap("conditions"),
  skills: readMap("skills"),
};

const STORMWIGHT_KIT_ID = "kit-5b78887af5df";

export function compactId(scc) {
  return String(scc)
    .replace(/^mcdm\.[^/]+\//, "")
    .replace(/^scc\.v1:mcdm\.[^/]+\//, "")
    .replace(/\//g, ".")
    .replace(/#/g, ".");
}

export function cleanOriginal(text) {
  return String(text ?? "").replace(/\[([^\]]+)\]\([^)]*\.md[^)]*\)/g, "$1");
}

export function originalFor(scc) {
  const entry = reference[scc];
  if (!entry) return null;
  return {
    originalId: scc,
    originalName: entry.name ?? "",
    originalDescription: cleanOriginal(entry.description),
  };
}

function englishIdFor(scc, kind = "") {
  const id = compactId(scc);
  if (kind === "catalog") return id.replace(/^(project|treasure|title)\./, "");
  return id;
}

function decorateWithScc(record, scc, { kind = "", newId } = {}) {
  const original = originalFor(scc);
  if (!original) return false;
  const legacyId = record.legacyId ?? record.id;
  const id = newId ?? englishIdFor(scc, kind);
  Object.assign(record, original);
  if (id !== legacyId) {
    record.legacyId = legacyId;
    record.id = id;
  }
  return true;
}

function decorateByMap(record, map, { idOf = (value) => value, kind = "", newId } = {}) {
  if (!record || typeof record !== "object") return record;
  const oldId = record.legacyId ?? record.id;
  const value = map[oldId];
  if (!value) {
    record.originalName = record.originalName ?? "";
    record.originalDescription = record.originalDescription ?? "";
    return record;
  }
  if (typeof value === "string") {
    decorateWithScc(record, value, { kind, newId });
  } else if (value.id) {
    const legacyId = oldId;
    record.originalName = value.originalName ?? "";
    record.originalDescription = value.originalDescription ?? "";
    record.originalId = value.originalId ?? "";
    if (value.id !== legacyId) {
      record.legacyId = legacyId;
      record.id = value.id;
    }
  }
  return record;
}

export function decorateAbility(record) {
  return decorateByMap(record, maps.abilities);
}

export function decorateKit(record) {
  if (!record) return record;
  if (record.legacyId === STORMWIGHT_KIT_ID || record.id === STORMWIGHT_KIT_ID) {
    const legacyId = record.legacyId ?? record.id;
    record.legacyId = legacyId;
    record.id = "kit.stormwight";
    record.originalId = "mcdm.heroes.v1/feature.fury.stormwight-kits/kit-features";
    record.originalName = "Stormwight Kits";
    record.originalDescription = cleanOriginal(
      reference["mcdm.heroes.v1/feature.fury.stormwight-kits/kit-features"]
        ?.description ?? "",
    );
    return record;
  }
  return decorateByMap(record, maps.kits, { kind: "kit" });
}

export function decoratePerk(record) {
  return decorateByMap(record, maps.perks, { kind: "perk" });
}

export function decorateFeature(record) {
  const map =
    record?.kind === "ancestry" ? maps.ancestryFeatures : maps.classFeatures;
  return decorateByMap(record, map);
}

export function decorateCatalog(record) {
  return decorateByMap(record, maps.catalog, { kind: "catalog" });
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function decorateGlossary(record) {
  if (!record) return record;
  const english = String(record.english ?? "").trim();
  record.originalName = english;
  record.originalDescription = "";
  if (english) {
    const legacyId = record.legacyId ?? record.id;
    const id = `glossary.${slug(english)}`;
    if (id !== legacyId) {
      record.legacyId = legacyId;
      record.id = id;
    }
  }
  return record;
}

function builderMap(kind) {
  if (kind === "ancestry") return maps.ancestries;
  if (kind === "culture") return maps.cultures;
  if (kind === "career") return maps.careers;
  if (kind === "class") return maps.classes;
  if (kind === "complication") return maps.complications;
  return {};
}

export function decorateBuilderEntry(record, kind) {
  const map = builderMap(kind);
  const value = map[record?.name];
  if (!value) {
    record.originalName = record.originalName ?? "";
    record.originalDescription = record.originalDescription ?? "";
    return record;
  }
  if (typeof value === "string") {
    const original = originalFor(value);
    if (!original) return record;
    Object.assign(record, original);
    record.id = record.id ?? compactId(value);
  } else {
    record.originalName = value.originalName ?? "";
    record.originalDescription = value.originalDescription ?? "";
    record.originalId = value.originalId ?? "";
    record.id = record.id ?? value.id;
  }
  return record;
}

function key(...parts) {
  return parts.map((part) => String(part ?? "").trim().toLowerCase()).join("|");
}

export function decorateConsumerProjections({
  abilities,
  library,
  kits,
  perks,
  features,
  levelUp,
  builder,
}) {
  const abilityRecords = abilities?.abilities ?? [];
  const featureRecords = features?.features ?? [];
  const classFeaturesByName = new Map();
  for (const feature of featureRecords) {
    if (feature.kind !== "class") continue;
    classFeaturesByName.set(
      key(feature.className, feature.level, feature.name),
      feature,
    );
  }

  for (const record of abilityRecords) decorateAbility(record);
  for (const record of library?.catalog ?? []) decorateCatalog(record);
  for (const record of library?.glossary ?? []) decorateGlossary(record);
  for (const record of kits?.kits ?? []) decorateKit(record);
  for (const record of perks?.perks ?? []) decoratePerk(record);
  for (const record of featureRecords) decorateFeature(record);

  for (const rule of levelUp?.rules ?? []) {
    for (const feature of rule.features ?? []) {
      const match = classFeaturesByName.get(
        key(rule.className, rule.level, feature.name),
      );
      if (match) {
        feature.originalId = match.originalId;
        feature.originalName = match.originalName;
        feature.originalDescription = match.originalDescription;
      } else {
        feature.originalName = feature.originalName ?? "";
        feature.originalDescription = feature.originalDescription ?? "";
      }
    }
    for (const choice of rule.abilityChoices ?? []) {
      choice.abilityIds = (choice.abilityIds ?? []).map(
        (id) => maps.abilities[id] ? englishIdFor(maps.abilities[id]) : id,
      );
    }
    for (const grant of rule.grantedAbilities ?? []) {
      grant.abilityIds = (grant.abilityIds ?? []).map(
        (id) => maps.abilities[id] ? englishIdFor(maps.abilities[id]) : id,
      );
    }
  }

  if (builder) {
    for (const record of builder.ancestries ?? []) {
      decorateBuilderEntry(record, "ancestry");
      for (const trait of record.traits ?? []) {
        const feature = featureRecords.find(
          (item) =>
            key(item.ancestryName, item.name) === key(record.name, trait.name),
        );
        if (feature) {
          trait.id = feature.id;
          trait.originalId = feature.originalId;
          trait.originalName = feature.originalName;
          trait.originalDescription = feature.originalDescription;
        }
      }
    }
    for (const record of Object.values(builder.cultures ?? {}).flat()) {
      decorateBuilderEntry(record, "culture");
    }
    for (const record of builder.careers ?? []) decorateBuilderEntry(record, "career");
    for (const record of builder.classes ?? []) {
      decorateBuilderEntry(record, "class");
      for (const subclass of record.subclasses ?? []) {
        const english = maps.subclasses[subclass.name];
        if (english) subclass.originalName = english;
      }
    }
    for (const record of builder.complications ?? []) {
      decorateBuilderEntry(record, "complication");
    }
  }

  return { abilities, library, kits, perks, features, levelUp, builder };
}

export function decorateRulesPack(pack) {
  for (const article of pack.articles ?? []) {
    const index = codexArticleMap[article.id];
    const section = Number.isInteger(index) ? codexSections[index] : undefined;
    if (!section) continue;
    article.originalId =
      section.scc ||
      `${section.chapterScc || "mcdm.heroes.v1/chapter/" + section.file}#${slug(section.name)}`;
    article.originalName = section.name;
    article.originalDescription = cleanOriginal(section.description);
  }
  for (const entity of pack.entities ?? []) {
    if (entity.kind === "ability" && entity.ability) {
      decorateAbility(entity.ability);
    }
    const map =
      entity.kind === "ability"
        ? maps.abilities
        : entity.kind === "feature"
          ? maps.classFeatures
          : entity.kind === "kit"
            ? maps.kits
            : entity.kind === "perk"
              ? maps.perks
              : null;
    if (!map) continue;
    const legacyId = entity.legacyIds?.[0] ?? entity.id;
    const value = map[legacyId];
    if (!value || typeof value !== "string") continue;
    const original = originalFor(value);
    if (!original) continue;
    Object.assign(entity, original);
    if (entity.ability) Object.assign(entity.ability, original);
  }
  return pack;
}
