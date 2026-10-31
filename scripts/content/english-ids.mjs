import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compactId, maps, originalFor } from "./lib/originals.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

function walkJson(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJson(full, out);
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

// `readdirSync` is imported lazily to keep the module small in generated code.
import { readdirSync } from "node:fs";

const KIND_PREFIX = {
  ability: "ability",
  feature: "feature",
  kit: "kit",
  perk: "perk",
  ancestry: "ancestry",
  culture: "culture",
  career: "career",
  class: "class",
  complication: "complication",
  item: "treasure",
  project: "project",
  title: "title",
};

/** Карта `kind|имя` -> scc из уже собранного каталога. */
function catalogNameMap() {
  const map = {};
  try {
    const library = readJson(
      path.join(REPO_ROOT, "src/generated/consumers/library.json"),
    );
    for (const entry of library.catalog ?? []) {
      if (entry.name && entry.originalId) {
        map[`${entry.kind}|${entry.name}`] = entry.originalId;
      }
    }
  } catch {
    /* каталог ещё не собран — импорт всё равно должен работать */
  }
  return map;
}

function targetFromValue(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const original = originalFor(value);
    if (!original) return null;
    return { id: compactId(value), ...original };
  }
  if (typeof value === "object" && value.id) {
    return {
      id: value.id,
      originalId: value.originalId ?? "",
      originalName: value.originalName ?? "",
      originalDescription: value.originalDescription ?? "",
    };
  }
  return null;
}

export function createEnglishIdMap(contentDir) {
  const files = walkJson(path.join(contentDir, "entities"));
  const entities = files.map((file) => ({ file, data: readJson(file) }));
  const catalogByName = catalogNameMap();
  const resolved = [];

  for (const { data: entity } of entities) {
    const legacy =
      entity.legacyIds?.[0] ?? entity.ability?.id ?? entity.id;
    let value = null;
    if (entity.kind === "ability") {
      value = maps.abilities[legacy] ?? maps.abilities[entity.ability?.id];
    } else if (entity.kind === "feature") {
      value = maps.classFeatures[legacy] ?? maps.ancestryFeatures[legacy];
    } else if (entity.kind === "kit") {
      value = maps.kits[legacy];
    } else if (entity.kind === "perk") {
      value = maps.perks[legacy];
    } else if (entity.kind === "project") {
      value = maps.catalog[legacy] ?? catalogByName[`project|${entity.name}`];
    } else if (entity.kind === "item") {
      value = catalogByName[`treasure|${entity.name}`] ?? maps.catalog[legacy];
    } else if (entity.kind === "title") {
      value = catalogByName[`title|${entity.name}`] ?? maps.catalog[legacy];
    } else {
      const mapName = {
        ancestry: "ancestries",
        culture: "cultures",
        career: "careers",
        class: "classes",
        complication: "complications",
      }[entity.kind];
      value = maps[mapName]?.[entity.name];
    }

    let target = targetFromValue(value);
    if (entity.kind === "kit" && entity.name === "Буревестник") {
      target = {
        id: "kit.stormwight",
        originalId:
          "mcdm.heroes.v1/feature.fury.stormwight-kits/kit-features",
        originalName: "Stormwight Kits",
        originalDescription: "",
      };
    }
    if (target) resolved.push({ entity, target });
  }

  // Одна и та же английская способность может быть и отдельной сущностью
  // `ability`, и классовой особенностью, которая её повторяет. Разводим их
  // разными id: способность получает `feature.ability.*`, особенность —
  // `feature.*`.
  const groups = new Map();
  for (const item of resolved) {
    const list = groups.get(item.target.id) ?? [];
    list.push(item);
    groups.set(item.target.id, list);
  }
  for (const [id, list] of groups) {
    if (list.length === 1) continue;
    const abilities = list.filter((item) => item.entity.kind === "ability");
    const features = list.filter((item) => item.entity.kind === "feature");
    for (const item of abilities) {
      item.target.id = id.startsWith("feature.ability.")
        ? id
        : id.replace(/^feature\./, "feature.ability.");
    }
    for (const item of features) {
      item.target.id = id.startsWith("feature.ability.")
        ? id.replace("feature.ability.", "feature.")
        : id;
    }
    const used = new Set();
    for (const item of list) {
      let candidate = item.target.id;
      let suffix = 2;
      while (used.has(candidate)) candidate = `${item.target.id}.${suffix++}`;
      used.add(candidate);
      item.target.id = candidate;
    }
  }

  const oldToTarget = new Map();
  const oldToNew = new Map();
  for (const { entity, target } of resolved) {
    oldToTarget.set(entity.id, target);
    oldToNew.set(entity.id, target.id);
    for (const legacyId of entity.legacyIds ?? []) {
      oldToNew.set(legacyId, target.id);
    }
    if (entity.ability?.id) oldToNew.set(entity.ability.id, target.id);
  }

  return { files: entities, oldToTarget, oldToNew, catalogByName };
}

export function applyEnglishIds({
  contentDir = path.join(REPO_ROOT, "content/rules"),
  identityPath = path.join(
    REPO_ROOT,
    "scripts/content/lib/consumer-identity.json",
  ),
  updateIdentity = true,
} = {}) {
  const { files, oldToTarget, oldToNew } = createEnglishIdMap(contentDir);
  const refChanges = 0;

  for (const { file, data: entity } of files) {
    const target = oldToTarget.get(entity.id);
    if (!target) continue;
    entity.id = target.id;
    Object.assign(entity, {
      originalId: target.originalId,
      originalName: target.originalName,
      originalDescription: target.originalDescription,
    });
    delete entity.legacyIds;
    if (entity.ability) {
      entity.ability.id = target.id;
      Object.assign(entity.ability, {
        originalId: target.originalId,
        originalName: target.originalName,
        originalDescription: target.originalDescription,
      });
      delete entity.ability.legacyId;
    }
    writeJson(file, entity);
  }

  const articleFiles = walkJson(path.join(contentDir, "articles"));
  for (const file of articleFiles) {
    const article = readJson(file);
    let changed = false;
    for (const block of article.blocks ?? []) {
      if (block.type === "entity" && oldToNew.has(block.ref)) {
        block.ref = oldToNew.get(block.ref);
        changed = true;
      }
    }
    if (changed) writeJson(file, article);
  }

  // Идентичность хранит порядок; переводим её на английские id.
  if (updateIdentity) {
  const identity = readJson(identityPath);
  identity.note =
    "Persisted consumer identity: keeps catalogue/glossary/ability/kit/perk/feature/level-up IDs and builder entity order stable across canonical title edits. Do not regenerate names casually.";
  identity.abilityOrder = (identity.abilityOrder ?? []).map(
    (id) => oldToNew.get(id) ?? id,
  );
  const catalog = {};
  for (const [articleId, ids] of Object.entries(identity.catalog ?? {})) {
    catalog[articleId] = ids.map((id) => {
      const value = maps.catalog[id];
      if (typeof value === "string") {
        return compactId(value).replace(/^(project|treasure|title)\./, "");
      }
      if (value && typeof value === "object" && value.id) return value.id;
      return oldToNew.get(id) ?? id;
    });
  }
  identity.catalog = catalog;
  const glossaryMap = new Map();
  try {
    const library = readJson(
      path.join(REPO_ROOT, "src/generated/consumers/library.json"),
    );
    for (const entry of library.glossary ?? []) {
      if (entry.legacyId && entry.id) glossaryMap.set(entry.legacyId, entry.id);
    }
  } catch {
    /* нет проекции — оставляем прежние значения */
  }
  identity.glossary = (identity.glossary ?? []).map(
    (id) => glossaryMap.get(id) ?? id,
  );
  for (const key of ["kits", "perks", "ancestryFeatures", "classFeatures"]) {
    identity[key] = (identity[key] ?? []).map((id) => oldToNew.get(id) ?? id);
  }
  const mapBuilder = (value) => {
    if (Array.isArray(value)) return value.map((id) => oldToNew.get(id) ?? id);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, mapBuilder(child)]),
      );
    }
    return value;
  };
  identity.builder = mapBuilder(identity.builder ?? {});
  writeJson(identityPath, identity);
  }

  const reportPath = path.join(contentDir, "migration-report.json");
  try {
    const report = readJson(reportPath);
    const translate = (value) => {
      if (Array.isArray(value)) return value.map(translate);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, translate(child)]),
        );
      }
      if (typeof value === "string" && oldToNew.has(value)) {
        return oldToNew.get(value);
      }
      return value;
    };
    writeJson(reportPath, translate(report));
  } catch {
    /* отчёт может отсутствовать в песочнице импорта */
  }

  return {
    entities: files.length,
    renamed: oldToNew.size,
    refChanges,
  };
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = applyEnglishIds();
  console.log(
    `English ids applied: ${result.renamed} identities, ${result.entities} entity files.`,
  );
}
