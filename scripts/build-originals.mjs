#!/usr/bin/env node
/**
 * Добавляет к сущностям компендиума английские оригиналы из SteelCompendium
 * и заменяет транслитерированные id на канонические английские scc-id.
 *
 * Источники:
 *  - scripts/originals/reference/*.json — выгрузка SteelCompendium data-unified
 *  - scripts/originals/maps/*.json     — сопоставление русских записей с scc
 *
 * Выход:
 *  - обновлённые src/data/*.generated.json
 *  - src/data/legacy-ids.generated.json — старые id для чтения сохранённых героев
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const DATA = join(ROOT, "src", "data");
const REF_DIR = join(SCRIPT_DIR, "originals", "reference");
const MAP_DIR = join(SCRIPT_DIR, "originals", "maps");

const warnings = [];
const warn = (message) => warnings.push(message);

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Английские оригиналы: относительные ссылки на .md в приложении не работают. */
const cleanOriginal = (text) =>
  String(text ?? "").replace(/\[([^\]]+)\]\([^)]*\.md[^)]*\)/g, "$1");
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

function readReference(name) {
  const file = join(REF_DIR, name);
  return existsSync(file) ? readJson(file) : [];
}

const reference = {};
for (const name of [
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
]) {
  const list = readReference(`${name}.json`);
  for (const entry of list) {
    if (!entry.scc) continue;
    reference[entry.scc] = { ...entry, kind: name };
  }
}

function readMap(name) {
  const file = join(MAP_DIR, `${name}.json`);
  if (!existsSync(file)) return {};
  const raw = readJson(file);
  return raw.map ?? raw;
}

/** mcdm.heroes.v1/feature.ability.fury.level-1/back -> feature.ability.fury.level-1.back */
function compactId(scc) {
  return scc
    .replace(/^mcdm\.[^/]+\//, "")
    .replace(/^scc\.v1:mcdm\.[^/]+\//, "")
    .replace(/\//g, ".")
    .replace(/#/g, ".");
}

function originalFields(scc) {
  const ref = reference[scc];
  if (!ref) {
    warn(`Нет английской записи для ${scc}`);
    return { originalId: scc, originalName: "", originalDescription: "" };
  }
  return {
    originalId: scc,
    originalName: ref.name ?? "",
    originalDescription: cleanOriginal(ref.description),
  };
}

function applyId(entity, scc, legacySink) {
  const newId = compactId(scc);
  const oldId = entity.legacyId ?? entity.id;
  Object.assign(entity, originalFields(scc));
  if (newId !== oldId) {
    entity.legacyId = oldId;
    legacySink[oldId] = newId;
  }
  entity.id = newId;
}

function applyFields(entity, scc, short = false) {
  const fields = originalFields(scc);
  if (short) {
    const ref = reference[scc];
    fields.originalDescription = cleanOriginal(ref?.flavor || ref?.description || "");
  }
  Object.assign(entity, fields);
}

// ---------- способности ----------
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
];
const abilityMaps = {};
for (const name of [...CLASS_MAPS, "extras"]) {
  Object.assign(abilityMaps, readMap(name));
}

const abilities = readJson(join(DATA, "abilities.generated.json"));
const legacy = {
  abilities: {},
  classFeatures: {},
  ancestryFeatures: {},
  kits: {},
  perks: {},
  catalog: {},
};

let abilityMapped = 0;
for (const ability of abilities) {
  const oldId = ability.legacyId ?? ability.id;
  const scc = abilityMaps[oldId];
  if (!scc) {
    ability.originalName = ability.originalName ?? "";
    ability.originalDescription = ability.originalDescription ?? "";
    continue;
  }
  applyId(ability, scc, legacy.abilities);
  abilityMapped++;
}
writeJson(join(DATA, "abilities.generated.json"), abilities);
console.log(`abilities: ${abilityMapped}/${abilities.length}`);

// ---------- классовые особенности ----------
const featureMaps = {};
for (const name of [...CLASS_MAPS, "extras"]) {
  Object.assign(featureMaps, readMap(name));
}

const classFeatures = readJson(join(DATA, "class-features.generated.json"));
const syntheticFeatureMap = readMap("unmapped-features");
let featureMapped = 0;
for (const feature of classFeatures) {
  const oldId = feature.legacyId ?? feature.id;
  const scc = featureMaps[oldId];
  if (!scc) {
    const synthetic = syntheticFeatureMap[oldId];
    if (synthetic && typeof synthetic === "object" && synthetic.id) {
      feature.originalName = synthetic.originalName ?? "";
      feature.originalDescription = synthetic.originalDescription ?? "";
      if (synthetic.id !== oldId) {
        feature.legacyId = oldId;
        legacy.classFeatures[oldId] = synthetic.id;
      }
      feature.id = synthetic.id;
      featureMapped++;
      continue;
    }
    feature.originalName = feature.originalName ?? "";
    feature.originalDescription = feature.originalDescription ?? "";
    continue;
  }
  const ref = reference[scc];
  if (!ref) {
    warn(`Нет английской записи для ${scc} (${oldId})`);
    continue;
  }
  applyId(feature, scc, legacy.classFeatures);
  featureMapped++;
}
for (const feature of classFeatures) {
  if (feature.parentId && legacy.classFeatures[feature.parentId]) {
    feature.parentId = legacy.classFeatures[feature.parentId];
  }
}
writeJson(join(DATA, "class-features.generated.json"), classFeatures);
console.log(`class features: ${featureMapped}/${classFeatures.length}`);

// ---------- особенности происхождений ----------
const ancestryFeatureMap = readMap("ancestry-features");
const syntheticAncestryMap = readMap("unmapped-ancestry-features");
const ancestryFeatures = readJson(join(DATA, "ancestry-features.generated.json"));
let ancestryMapped = 0;
for (const feature of ancestryFeatures) {
  const oldId = feature.legacyId ?? feature.id;
  const scc = ancestryFeatureMap[oldId];
  if (!scc) {
    const synthetic = syntheticAncestryMap[oldId];
    if (synthetic && typeof synthetic === "object" && synthetic.id) {
      feature.originalName = synthetic.originalName ?? "";
      feature.originalDescription = synthetic.originalDescription ?? "";
      if (synthetic.id !== oldId) {
        feature.legacyId = oldId;
        legacy.ancestryFeatures[oldId] = synthetic.id;
      }
      feature.id = synthetic.id;
      ancestryMapped++;
      continue;
    }
    feature.originalName = feature.originalName ?? "";
    feature.originalDescription = feature.originalDescription ?? "";
    continue;
  }
  applyId(feature, scc, legacy.ancestryFeatures);
  ancestryMapped++;
}
writeJson(join(DATA, "ancestry-features.generated.json"), ancestryFeatures);
console.log(`ancestry features: ${ancestryMapped}/${ancestryFeatures.length}`);

// ---------- комплекты ----------
const kitMap = readMap("kits");
const kits = readJson(join(DATA, "kits.generated.json"));
let kitMapped = 0;
for (const kit of kits) {
  const oldId = kit.legacyId ?? kit.id;
  const scc = kitMap[oldId];
  if (!scc) {
    kit.originalName = kit.originalName ?? "";
    kit.originalDescription = kit.originalDescription ?? "";
    continue;
  }
  applyId(kit, scc, legacy.kits);
  kitMapped++;
}
// «Буревестник» — сводная русская подача четырёх штормовых комплектов.
// Единого английского kit-а у неё нет, поэтому id синтетический, а оригинал
// указывает на раздел Stormwight Kits.
const stormwightKit = kits.find((kit) => kit.name === "Буревестник");
if (stormwightKit) {
  const scc = "mcdm.heroes.v1/feature.fury.stormwight-kits/kit-features";
  const oldId = stormwightKit.legacyId ?? stormwightKit.id;
  stormwightKit.id = "kit.stormwight";
  stormwightKit.originalId = scc;
  stormwightKit.originalName = "Stormwight Kits";
  stormwightKit.originalDescription = cleanOriginal(reference[scc]?.description ?? "");
  stormwightKit.legacyId = oldId;
  legacy.kits[oldId] = stormwightKit.id;
}
writeJson(join(DATA, "kits.generated.json"), kits);
console.log(`kits: ${kitMapped}/${kits.length}`);

// kit abilities reuse the same map
for (const ability of abilities) {
  const oldId = ability.legacyId ?? ability.id;
  const scc = kitMap[oldId];
  if (!scc) continue;
  applyId(ability, scc, legacy.abilities);
}
writeJson(join(DATA, "abilities.generated.json"), abilities);

// ---------- перки ----------
const perkMap = readMap("perks");
const perksFile = readJson(join(DATA, "perks.generated.json"));
let perkMapped = 0;
for (const perk of perksFile.perks) {
  const oldId = perk.legacyId ?? perk.id;
  const scc = perkMap[oldId];
  if (!scc) {
    perk.originalName = perk.originalName ?? "";
    perk.originalDescription = perk.originalDescription ?? "";
    continue;
  }
  applyId(perk, scc, legacy.perks);
  perkMapped++;
}
writeJson(join(DATA, "perks.generated.json"), perksFile);
console.log(`perks: ${perkMapped}/${perksFile.perks.length}`);

// ---------- билдер: происхождения, культуры, карьеры, классы, осложнения ----------
const builder = readJson(join(DATA, "builder.generated.json"));

const syntheticBuilderMap = readMap("unmapped-builder");
function applyNamed(entries, mapName, label, short = false) {
  const map = readMap(mapName);
  let mapped = 0;
  for (const entry of entries) {
    const scc = map[entry.name];
    if (!scc) {
      const synthetic = syntheticBuilderMap[entry.name];
      if (synthetic && typeof synthetic === "object" && synthetic.id) {
        entry.originalName = synthetic.originalName ?? "";
        entry.originalDescription = synthetic.originalDescription ?? "";
        entry.id = entry.id ?? synthetic.id;
        mapped++;
        continue;
      }
      entry.originalName = entry.originalName ?? "";
      entry.originalDescription = entry.originalDescription ?? "";
      continue;
    }
    applyFields(entry, scc, short);
    entry.id = entry.id ?? compactId(scc);
    mapped++;
  }
  console.log(`${label}: ${mapped}/${entries.length}`);
  return mapped;
}

applyNamed(builder.ancestries, "ancestries", "ancestries", true);
applyNamed(Object.values(builder.cultures).flat(), "cultures", "cultures", true);
applyNamed(builder.careers, "careers", "careers", true);
applyNamed(builder.classes, "classes", "classes", true);
applyNamed(builder.complications, "complications", "complications");

// Черты происхождений внутри builder-а — те же записи, что в
// ancestry-features.generated.json. Переносим им оригинал и канонический id.
const subclassMap = readMap("subclasses");
for (const classData of builder.classes) {
  for (const subclass of classData.subclasses ?? []) {
    const english = subclassMap[subclass.name];
    if (english) subclass.originalName = english;
  }
}

const ancestryFeatureByKey = new Map(
  ancestryFeatures.map((feature) => [
    `${feature.ancestryName.trim().toLowerCase()}|${feature.name.trim().toLowerCase()}`,
    feature,
  ]),
);
for (const ancestry of builder.ancestries) {
  for (const trait of ancestry.traits ?? []) {
    const feature = ancestryFeatureByKey.get(
      `${ancestry.name.trim().toLowerCase()}|${trait.name.trim().toLowerCase()}`,
    );
    if (!feature) continue;
    trait.id = feature.id;
    trait.originalId = feature.originalId;
    trait.originalName = feature.originalName;
    trait.originalDescription = feature.originalDescription;
  }
}

writeJson(join(DATA, "builder.generated.json"), builder);

// ---------- повышение уровня ----------
const levelUp = readJson(join(DATA, "level-up.generated.json"));
const featureByName = new Map();
for (const feature of classFeatures) {
  if (!feature.originalName) continue;
  const key = `${feature.className}|${feature.level}|${feature.name.trim().toLowerCase()}`;
  featureByName.set(key, feature);
}
let levelUpFeatures = 0;
function replaceLegacyAbilityIds(value) {
  if (Array.isArray(value)) return value.map(replaceLegacyAbilityIds);
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      value[key] = replaceLegacyAbilityIds(child);
    }
    return value;
  }
  if (typeof value === "string" && legacy.abilities[value]) return legacy.abilities[value];
  return value;
}
for (const rule of replaceLegacyAbilityIds(levelUp)) {
  for (const feature of rule.features ?? []) {
    const match = featureByName.get(
      `${rule.className}|${rule.level}|${String(feature.name).trim().toLowerCase()}`,
    );
    if (!match) {
      feature.originalName = feature.originalName ?? "";
      feature.originalDescription = feature.originalDescription ?? "";
      continue;
    }
    feature.originalId = match.originalId;
    feature.originalName = match.originalName;
    feature.originalDescription = match.originalDescription;
    levelUpFeatures++;
  }
}
writeJson(join(DATA, "level-up.generated.json"), levelUp);
console.log(`level-up features: ${levelUpFeatures}/${levelUp.reduce((n, rule) => n + (rule.features?.length ?? 0), 0)}`);

// ---------- каталог сокровищ, титулов и проектов ----------
const catalogMap = readMap("catalog");
const catalogOriginals = {};
for (const [localId, scc] of Object.entries(catalogMap)) {
  if (!scc) {
    catalogOriginals[localId] = {
      originalName: "",
      originalDescription: "",
    };
    continue;
  }
  const ref = reference[scc];
  if (!ref) {
    warn(`Нет английской записи для ${scc} (${localId})`);
    continue;
  }
  const newId = compactId(scc).replace(/^(project|treasure|title)\./, "");
  catalogOriginals[localId] = {
    id: newId,
    originalId: scc,
    originalName: ref.name ?? "",
    originalDescription: cleanOriginal(ref.description),
  };
  if (newId !== localId) legacy.catalog[localId] = newId;
}
writeJson(join(DATA, "catalog-originals.generated.json"), catalogOriginals);

// ---------- состояния и навыки: отдельные справочники ----------
function buildOriginalsMap(mapName, keyFromScc) {
  const map = readMap(mapName);
  const result = {};
  for (const [localName, scc] of Object.entries(map)) {
    const ref = reference[scc];
    if (!ref) {
      warn(`Нет английской записи для ${scc} (${localName})`);
      continue;
    }
    result[keyFromScc(localName, scc)] = {
      originalId: scc,
      originalName: ref.name ?? "",
      originalDescription: cleanOriginal(ref.description),
    };
  }
  return result;
}

writeJson(
  join(DATA, "conditions-originals.generated.json"),
  buildOriginalsMap("conditions", (_name, scc) => scc.split("/").pop() ?? scc),
);
writeJson(
  join(DATA, "skills-originals.generated.json"),
  buildOriginalsMap("skills", (name) => name),
);

// ---------- Кодекс ----------
const codexSections = readReference("codex-sections.json");
const codexArticleMap = {};
for (const file of readdirSync(MAP_DIR)) {
  if (!file.startsWith("codex-") || !file.endsWith(".json")) continue;
  Object.assign(codexArticleMap, readMap(file.replace(/\.json$/, "")));
}
const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const codex = readJson(join(DATA, "codex.generated.json"));
const syntheticCodexMap = readMap("unmapped-codex");
const complicationSections = codexSections.filter(
  (section) => section.file === "complications.md" && section.level === 4,
);
let codexMapped = 0;
for (const article of codex) {
  const range = String(article.title).match(/^Нюансы (\d+)-(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    article.originalName = `Complications ${start}–${end}`;
    article.originalId = `mcdm.heroes.v1/chapter/complications#complications-${start}-${end}`;
    article.originalDescription = cleanOriginal(
      complicationSections
        .slice(start - 1, end)
        .map((section) => `#### ${section.name}\n\n${section.description}`)
        .join("\n\n"),
    );
    codexMapped++;
    continue;
  }
  const synthetic = syntheticCodexMap[article.id];
  if (synthetic && typeof synthetic === "object") {
    article.originalName = synthetic.originalName ?? "";
    article.originalId = synthetic.originalId ?? "";
    article.originalDescription = synthetic.originalDescription ?? "";
    codexMapped++;
    continue;
  }
  const index = codexArticleMap[article.id];
  const section = Number.isInteger(index) ? codexSections[index] : undefined;
  if (!section) {
    article.originalName = article.originalName ?? "";
    article.originalDescription = article.originalDescription ?? "";
    continue;
  }
  article.originalId =
    section.scc || `${section.chapterScc || "mcdm.heroes.v1/chapter/" + section.file}#${slug(section.name)}`;
  article.originalName = section.name;
  article.originalDescription = cleanOriginal(section.description);
  codexMapped++;
}
writeJson(join(DATA, "codex.generated.json"), codex);
console.log(`codex: ${codexMapped}/${codex.length}`);

const codexById = new Map(codex.map((article) => [article.id, article]));
const codexIndex = readJson(join(DATA, "codex-index.generated.json"));
for (const entry of codexIndex) {
  const article = codexById.get(entry.id);
  if (!article) continue;
  entry.originalId = article.originalId;
  entry.originalName = article.originalName;
  delete entry.originalDescription;
}
writeJson(join(DATA, "codex-index.generated.json"), codexIndex);

const library = readJson(join(DATA, "library-articles.generated.json"));
for (const entry of library) {
  const article = codexById.get(entry.id);
  if (!article) continue;
  entry.originalId = article.originalId;
  entry.originalName = article.originalName;
  entry.originalDescription = article.originalDescription;
}
writeJson(join(DATA, "library-articles.generated.json"), library);

writeJson(join(DATA, "legacy-ids.generated.json"), legacy);

if (warnings.length) {
  console.warn(`\n${warnings.length} предупреждений:`);
  for (const message of warnings.slice(0, 20)) console.warn(`- ${message}`);
  if (warnings.length > 20) console.warn(`…ещё ${warnings.length - 20}`);
}
console.log("\nГотово.");
