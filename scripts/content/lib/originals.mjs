import { compilePrintedAbility } from "./printed-ability.mjs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const monsterSnapshot = JSON.parse(readFileSync(path.join(REPO_ROOT, "content/monsters/source.json"), "utf8"));
const monsterOriginals = new Map(monsterSnapshot.records.map((record) => [record.id, record.markdown]));
const monsterArticleOriginals = new Map(monsterSnapshot.records.map((record) => [record.articleId, record.markdown]));
const normalizeWhitespace = (text) => String(text ?? "").trim().replace(/\s+/g, " ");
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

const heroCompositeBodies = readJson(path.join(REFERENCE_DIR, "hero-composite-bodies.json")).bodies;
const heroesNested = readJson(path.join(REFERENCE_DIR, "heroes-nested-ids.json")).references;
const heroesHashes = readJson(path.join(REFERENCE_DIR, "heroes-source-hashes.json")).hashes;
const chapterIntros = readJson(path.join(REFERENCE_DIR, "chapter-introductions.json")).introductions;
const ancestryIntroduction = readJson(path.join(REFERENCE_DIR, "ancestry-introduction.json"));
const summonerLevels = readJson(path.join(REFERENCE_DIR, "summoner-levels.json"));
const codexSections = readJson(path.join(REFERENCE_DIR, "codex-sections.json"));
const proseSections = readMap("prose-sections");
const boundedProse = readMap("bounded-prose");
const assembledProse = readMap("assembled-prose");
const entitySections = readMap("entity-sections");
const entityLeaves = readMap("entity-leaves");
const entityIntros = readMap("entity-intros");
const markdownBlocks = readMap("markdown-blocks");
const classLevels = readMap("class-levels");
const classAggregates = readMap("class-aggregates");
const ancestryArticles = readMap("ancestry-articles");
const ancestryIntros = readMap("ancestry-intros");
const sectionArticles = readMap("section-articles");
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
  catalog: Object.assign({}, readMap("catalog"), readMap("unmapped-catalog")),
  subclasses: readMap("subclasses"),
  conditions: readMap("conditions"),
  skills: readMap("skills"),
};

const STORMWIGHT_KIT_ID = "kit-5b78887af5df";

/** Добавляет к карте английские id, чтобы декоратор работал и после миграции. */
function withEnglishKeys(map, kind = "") {
  const out = { ...map };
  for (const value of Object.values(map)) {
    if (typeof value === "string") {
      let id = compactId(value);
      if (kind === "catalog") id = id.replace(/^(project|treasure|title)\./, "");
      out[id] = value;
    } else if (value && value.id) {
      out[value.id] = value;
    }
  }
  return out;
}

maps.abilities = withEnglishKeys(maps.abilities);
maps.classFeatures = withEnglishKeys(maps.classFeatures);
maps.ancestryFeatures = withEnglishKeys(maps.ancestryFeatures);
maps.kits = withEnglishKeys(maps.kits);
maps.perks = withEnglishKeys(maps.perks);
maps.catalog = withEnglishKeys(maps.catalog, "catalog");
maps.ancestries = withEnglishKeys(maps.ancestries);
maps.cultures = withEnglishKeys(maps.cultures);
maps.careers = withEnglishKeys(maps.careers);
maps.classes = withEnglishKeys(maps.classes);
maps.complications = withEnglishKeys(maps.complications);

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
  const id = newId ?? englishIdFor(scc, kind);
  Object.assign(record, original);
  record.id = id;
  delete record.legacyId;
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
    record.originalName = value.originalName ?? "";
    record.originalDescription = value.originalDescription ?? "";
    record.originalId = value.originalId ?? "";
    record.id = value.id;
    delete record.legacyId;
  }
  return record;
}

export function decorateAbility(record) {
  return decorateByMap(record, maps.abilities);
}

export function decorateKit(record) {
  if (!record) return record;
  if (
    record.legacyId === STORMWIGHT_KIT_ID ||
    record.id === STORMWIGHT_KIT_ID ||
    record.id === "kit.stormwight"
  ) {
    record.id = "kit.stormwight";
    delete record.legacyId;
    record.originalId = "mcdm.heroes.v1/feature.fury.stormwight-kits/kit-features";
    record.originalName = "Stormwight Kits";
    record.originalDescription = cleanOriginal(
      reference["mcdm.heroes.v1/feature.fury.stormwight-kits/kit-features"]
        ?.description ?? "",
    );
    for (const variant of record.variants ?? []) {
      decorateWithScc(variant, `mcdm.heroes.v1/${variant.id.replace(".", "/")}`, { kind: "kit" });
    }
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

// The Heroes glossary uses one bold term and its definition per paragraph.
const glossaryDefinitions = new Map();
const glossaryIndex = codexSections[codexArticleMap["0102"]];
for (const paragraph of cleanOriginal(glossaryIndex?.description).split(/\n\s*\n/)) {
  const entry = /^\*\*(.+?):\*\*\s+([\s\S]+)$/.exec(paragraph);
  if (entry) glossaryDefinitions.set(entry[1].toLowerCase(), entry[2].trim());
}

export function decorateGlossary(record) {
  if (!record) return record;
  const english = String(record.english ?? "").trim();
  record.originalName = english;
  const extraSections = { recovery: 2946, experience: 2944,
    d3: 2915, d6: 2914, d10: 2914, d100: 2916 };
  const extra = extraSections[english.toLowerCase()] ?? extraSections[record.id];
  record.originalDescription = glossaryDefinitions.get(english.toLowerCase()) ??
    (Number.isInteger(extra) ? cleanOriginal(codexSections[extra].description) : "");
  if (english.toLowerCase() === "summoner") record.originalDescription = cleanOriginal(summonerLevels.classIntroduction);
  if (english) {
    const id = `glossary.${slug(english)}`;
    record.id = id;
    delete record.legacyId;
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
    article.blocks.forEach((block, index) => {
      const mapping = markdownBlocks[`${article.id}:${index}`];
      if (!mapping) return;
      if (block.type !== "markdown" || createHash("sha256").update(block.text).digest("hex") !== mapping.blockHash) throw new Error(`Changed mapped block ${article.id}:${index}`);
      block.originalText = mapping.parts.map((item) => {
        const source = codexSections[item.index];
        if (!source || source.name !== item.name || source.file !== item.file || source.level !== item.level) throw new Error(`Invalid mapped block source ${article.id}:${index}`);
        return `## ${source.name}\n\n${cleanOriginal(source.description)}`;
      }).join("\n\n");
    });
    if (article.id === "0401") {
      const selected = [[1, "Names by Ancestry"], [3, "Names and Gender"], [4, "Authentic or Comedic?"], [20, "Starting Size and Speed"], [21, "Ancestry Traits"]];
      article.originalName = "Ancestries";
      article.originalId = "mcdm.heroes.v1/chapter/ancestries";
      article.originalDescription = [cleanOriginal(ancestryIntroduction.description), ...selected.map(([index, name]) => {
        const section = codexSections[index];
        if (section?.file !== "ancestries.md" || section.name !== name) throw new Error(`Invalid ancestry overview section ${name}`);
        return `## ${name}\n\n${cleanOriginal(section.description)}`;
      })].join("\n\n");
      article.originalCoverage = { status: "complete" };
      continue;
    }
    const summonerMatch = /^(082[1-9]|0830)$/.exec(article.id);
    if (summonerMatch) {
      const level = Number(article.id) - 820;
      const original = summonerLevels.levels[String(level)];
      if (!original || article.blocks.length !== 0) throw new Error(`Invalid Summoner placeholder ${article.id}`);
      article.originalId = `mcdm.summoner.v1/class/summoner#level-${level}`;
      article.originalName = original.title;
      article.originalDescription = cleanOriginal(original.description);
      article.originalCoverage = { status: "complete" };
      continue;
    }
    const index = codexArticleMap[article.id];
    const section = Number.isInteger(index) ? codexSections[index] : undefined;
    if (!section) continue;
    article.originalId =
      section.scc ||
      `${section.chapterScc || "mcdm.heroes.v1/chapter/" + section.file}#${slug(section.name)}`;
    article.originalName = section.name;
    article.originalDescription = cleanOriginal(section.description);
    // Explicitly audited article-local descendants only. Source sections are
    // split at headings, so the parent's description is only its introduction.
    const assembled = assembledProse[article.id];
    if (assembled) {
      if (article.blocks.some((block) => block.type !== "markdown")) throw new Error(`Invalid assembled prose ${article.id}`);
      const intro = assembled.intro ? chapterIntros[assembled.intro] : "";
      if (assembled.intro && !intro) throw new Error(`Missing chapter introduction ${article.id}`);
      let previous = -1;
      const parts = assembled.parts.map((item) => {
        const source = codexSections[item.index];
        if (item.index <= previous || !source || source.file !== item.file || source.name !== item.name || source.level !== item.level) throw new Error(`Invalid assembled section ${article.id}:${item.index}`);
        previous = item.index;
        return `## ${source.name}\n\n${cleanOriginal(source.description)}`;
      });
      article.originalDescription = [cleanOriginal(intro), ...parts].filter(Boolean).join("\n\n");
      article.originalCoverage = article.id === "1102" ? { status: "excerpt", reason: "table-order-differs" } : { status: "complete" };
    }
    const bounded = boundedProse[article.id];
    if (bounded && !assembled) {
      if (article.blocks.some((block) => block.type !== "markdown") || bounded.index !== index || bounded.file !== section.file || bounded.name !== section.name || bounded.level !== section.level) throw new Error(`Invalid bounded prose mapping ${article.id}`);
      let previous = index;
      const parts = bounded.sections.map((item) => {
        const child = codexSections[item.index];
        if (item.index <= previous || !child || child.file !== bounded.file || child.name !== item.name || child.level !== item.level || Object.values(codexArticleMap).includes(item.index)) throw new Error(`Invalid bounded prose section ${article.id}:${item.index}`);
        previous = item.index;
        const level = Math.max(2, Math.min(6, child.level - bounded.level + 1));
        return `${"#".repeat(level)} ${child.name}\n\n${cleanOriginal(child.description)}`;
      });
      if (article.id === "0301") {
        const intro = codexSections[2437];
        if (intro.file !== "making-a-hero.md" || intro.name !== "Your First Session") throw new Error("Invalid first session source");
        article.originalDescription = [`## ${intro.name}\n\n${cleanOriginal(intro.description)}`, `## ${section.name}\n\n${article.originalDescription}`, ...parts].join("\n\n");
      } else article.originalDescription = [article.originalDescription, ...parts].filter(Boolean).join("\n\n");
    }
    const full = assembled ? undefined : proseSections[article.id];
    if (full) {
      if (article.blocks.some((block) => block.type !== "markdown") ||
          full.index !== index || full.file !== section.file ||
          full.name !== section.name || full.level !== section.level) {
        throw new Error(`Invalid audited prose mapping for ${article.id}`);
      }
      const descendants = full.sections.map((item, offset) => {
        const child = codexSections[item.index];
        if (item.index !== index + offset + 1 || !child || child.file !== full.file || child.name !== item.name ||
            child.level !== item.level || child.level <= full.level ||
            Object.values(codexArticleMap).includes(item.index)) {
          throw new Error(`Invalid audited prose section ${article.id}:${item.index}`);
        }
        const heading = "#".repeat(Math.min(6, child.level - full.level + 1));
        return `${heading} ${child.name}\n\n${cleanOriginal(child.description)}`;
      });
      const after = codexSections[index + full.sections.length + 1];
      if (after && after.file === full.file && after.level > full.level) {
        throw new Error(`Incomplete audited prose boundary for ${article.id}`);
      }
      article.originalDescription = [article.originalDescription, ...descendants].filter(Boolean).join("\n\n");
    }
  }
  for (const entity of pack.entities ?? []) {
    const composite = heroCompositeBodies[entity.originalId];
    if (composite) {
      if (!composite.nestedIds?.length) throw new Error(`Invalid composite body ${entity.id}`);
      // Reject duplication if the canonical article later gains a nested ability.
      const article = (pack.articles ?? []).find((item) => item.id === entity.source.articleId);
      if (!article) throw new Error(`Missing composite article ${entity.id}`);
      const refs = new Set(article.blocks.filter((block) => block.type === "entity").map((block) => block.ref));
      if ((pack.entities ?? []).some((item) => refs.has(item.id) && composite.nestedIds.includes(item.originalId))) throw new Error(`Duplicate composite ability ${entity.id}`);
      entity.originalDescription = cleanOriginal(composite.body);
    }
    const audited = entitySections[entity.id];
    if (audited) {
      const source = codexSections[audited.index];
      if (!source || source.file !== audited.file || source.name !== audited.name || source.level !== audited.level) {
        throw new Error(`Invalid audited entity mapping ${entity.id}`);
      }
      const descendants = audited.sections.map((item, offset) => {
        const child = codexSections[item.index];
        if (item.index !== audited.index + offset + 1 || !child || child.file !== audited.file ||
            child.name !== item.name || child.level !== item.level || child.level <= audited.level) {
          throw new Error(`Invalid audited entity section ${entity.id}:${item.index}`);
        }
        return `${"#".repeat(Math.min(6, child.level - audited.level + 1))} ${child.name}\n\n${cleanOriginal(child.description)}`;
      });
      const after = codexSections[audited.index + audited.sections.length + 1];
      if (after && after.file === audited.file && after.level > audited.level) throw new Error(`Incomplete entity boundary ${entity.id}`);
      entity.originalDescription = [cleanOriginal(source.description), ...descendants].filter(Boolean).join("\n\n");
      entity.originalCoverage = { status: "complete" };
    }
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
  // Reconstruct level articles in SCC order. A source section is represented
  // by an entity only when that entity's complete text is identical; otherwise
  // render the source section once as Markdown, avoiding nested duplication.
  const plainSource = (text) => cleanOriginal(text).replace(/^#{1,6}\s+/gm, "").trim().replace(/\s+/g, " ");
  for (const article of pack.articles ?? []) {
    const mapping = classLevels[article.id] ?? ancestryArticles[article.id] ?? sectionArticles[article.id];
    if (!mapping || article.englishEdition) continue;
    const root = codexSections[mapping.index];
    if (!root || root.file !== mapping.file || root.name !== mapping.name || root.level !== mapping.level) throw new Error(`Invalid class level source ${article.id}`);
    const blocks = [];
    if (root.description?.trim()) blocks.push({ type: "markdown", text: cleanOriginal(root.description) });
    const originalRefs = new Set(article.blocks.filter((block) => block.type === "entity").map((block) => block.ref));
    const candidates = (pack.entities ?? []).filter((entity) => originalRefs.has(entity.id));
    for (const [offset, part] of mapping.sections.entries()) {
      const section = codexSections[part.index];
      if (part.index !== mapping.index + offset + 1 || !section || section.file !== mapping.file || section.name !== part.name || section.level !== part.level || (section.scc ?? "") !== part.scc || section.level <= mapping.level) throw new Error(`Invalid class level section ${article.id}:${part.index}`);
      const candidate = part.scc && candidates.find((entity) => entity.originalId === part.scc && plainSource(entity.originalDescription ?? "") === plainSource(section.description ?? ""));
      if (candidate) blocks.push({ type: "entity", ref: candidate.id });
      else {
        const level = Math.min(6, Math.max(2, part.level - mapping.level + 1));
        blocks.push({ type: "markdown", text: `${"#".repeat(level)} ${section.name}\n\n${cleanOriginal(section.description)}` });
      }
    }
    const after = codexSections[mapping.index + mapping.sections.length + 1];
    if (after && after.file === mapping.file && after.level > mapping.level) throw new Error(`Incomplete class level boundary ${article.id}`);
    article.englishEdition = { kind: "source", title: root.name, blocks };
    article.originalCoverage = { status: "complete" };
  }

  const articleReason = (article) => {
    if (["0414", "0415"].includes(article.id)) return "homebrew";
    if (["0902", "2101", "2102", "monsters.guide.retainer-advancement"].includes(article.id)) return "editorial";
    return "source-unavailable";
  };
  for (const article of pack.articles ?? []) {
    if (article.originalCoverage) continue;
    if (!article.originalDescription?.trim()) article.originalCoverage = { status: "missing", reason: articleReason(article) };
    else if (monsterArticleOriginals.has(article.id) && normalizeWhitespace(article.originalDescription) === normalizeWhitespace(monsterArticleOriginals.get(article.id))) article.originalCoverage = { status: "complete" };
    else if (["0102", "0303", "1206", "1210", "1212", "1503", "1505", "2003"].includes(article.id)) {
      const index = codexArticleMap[article.id];
      const source = codexSections[index];
      const after = codexSections[index + 1];
      if (!source || (after && after.file === source.file && after.level > source.level) || normalizeWhitespace(cleanOriginal(source.description)) !== normalizeWhitespace(article.originalDescription)) throw new Error(`Invalid leaf article ${article.id}`);
      article.originalCoverage = { status: "complete" };
    }
    else if (boundedProse[article.id]) article.originalCoverage = { status: "complete" };
    else if (proseSections[article.id] && article.id !== "1408") article.originalCoverage = { status: "complete" };
    else article.originalCoverage = { status: "excerpt", reason: "unverified-boundary" };
  }
  for (const entity of pack.entities ?? []) {
    if (entity.id === "project.imbue-treasure") {
      const source = codexSections[2007];
      if (entity.source?.articleId !== "1616" || entity.originalId !== "mcdm.heroes.v1/project/imbue-treasure" ||
          createHash("sha256").update(entity.markdown).digest("hex") !== "4a430e72fd31c03bf30e4cc7fad84e0ef18cfb2299fe22c784d75317982ef5e0" ||
          source?.file !== "downtime-projects.md" || source.name !== "Imbue Treasure") throw new Error("Invalid Imbue Treasure entity overview");
      entity.originalDescription = cleanOriginal(source.description);
      entity.originalCoverage = { status: "complete" };
    }
    const aggregate = classAggregates[entity.id];
    if (aggregate) {
      if (entity.kind !== "class" || entity.source?.articleId !== aggregate.articleId ||
          createHash("sha256").update(entity.markdown).digest("hex") !== aggregate.markdownHash ||
          createHash("sha256").update(entity.originalDescription).digest("hex") !== aggregate.introHash) {
        throw new Error(`Invalid class aggregate introduction ${entity.id}`);
      }
      let levelText;
      if (entity.id === "class.summoner") {
        const level = summonerLevels.levels["1"];
        if (level?.title !== "1st-Level Features") throw new Error("Invalid Summoner first level");
        levelText = `## ${level.title}\n\n${cleanOriginal(level.description)}`;
      } else {
        const mapping = classLevels[aggregate.articleId];
        const root = codexSections[mapping?.index];
        if (!root || root.name !== "1st-Level Features" || root.file !== mapping.file || root.level !== mapping.level) throw new Error(`Invalid class aggregate level ${entity.id}`);
        const parts = mapping.sections.map((part, offset) => {
          const source = codexSections[part.index];
          if (part.index !== mapping.index + offset + 1 || !source || source.file !== root.file || source.name !== part.name || source.level !== part.level || source.level <= root.level || (source.scc ?? "") !== part.scc) throw new Error(`Invalid class aggregate section ${entity.id}:${part.index}`);
          return `${"#".repeat(Math.min(6, source.level - root.level + 2))} ${source.name}\n\n${cleanOriginal(source.description)}`;
        });
        const after = codexSections[mapping.index + mapping.sections.length + 1];
        if (after && after.file === root.file && after.level > root.level) throw new Error(`Incomplete class aggregate ${entity.id}`);
        levelText = [`## ${root.name}\n\n${cleanOriginal(root.description)}`, ...parts].join("\n\n");
      }
      entity.originalDescription = `${entity.originalDescription}\n\n${levelText}`;
      entity.originalCoverage = { status: "complete" };
    }
    const ancestry = ancestryIntros[entity.id];
    if (ancestry) {
      const mapping = ancestryArticles[ancestry.articleId];
      const root = codexSections[ancestry.index];
      const trait = codexSections[ancestry.traitIndex];
      if (entity.kind !== "ancestry" || entity.source?.articleId !== ancestry.articleId ||
          createHash("sha256").update(entity.markdown).digest("hex") !== ancestry.markdownHash ||
          mapping?.index !== ancestry.index || !root || root.scc !== entity.originalId ||
          !mapping.sections.some((part) => part.index === ancestry.traitIndex && part.name === ancestry.traitName && part.level === 3) ||
          !trait || trait.file !== root.file || trait.name !== ancestry.traitName || trait.level !== 3) {
        throw new Error(`Invalid audited ancestry introduction ${entity.id}`);
      }
      entity.originalDescription = `${cleanOriginal(root.description)}\n\n## ${trait.name}\n\n${cleanOriginal(trait.description)}`;
      entity.originalCoverage = { status: "complete" };
    }
    const leaf = entityLeaves[entity.id];
    if (leaf) {
      const level = classLevels[leaf.articleId];
      const source = codexSections[leaf.index];
      const after = codexSections[leaf.index + 1];
      if (entity.source?.articleId !== leaf.articleId || entity.kind !== "feature" ||
          createHash("sha256").update(entity.markdown).digest("hex") !== leaf.markdownHash ||
          !level?.sections.some((part) => part.index === leaf.index && part.name === leaf.name && part.level === leaf.level) ||
          !source || source.file !== leaf.file || source.name !== leaf.name || source.level !== leaf.level ||
          (after && after.file === source.file && after.level > source.level)) {
        throw new Error(`Invalid audited entity leaf ${entity.id}`);
      }
      entity.originalDescription = cleanOriginal(source.description);
      entity.originalCoverage = { status: "complete" };
    }
    const intro = entityIntros[entity.id];
    if (intro) {
      const level = classLevels[intro.articleId];
      const source = codexSections[intro.index];
      if (entity.kind !== "feature" || entity.source?.articleId !== intro.articleId ||
          createHash("sha256").update(entity.markdown).digest("hex") !== intro.markdownHash ||
          !level?.sections.some((part) => part.index === intro.index && part.name === intro.name && part.level === intro.level && part.scc === intro.scc) ||
          !source || source.file !== intro.file || source.name !== intro.name || source.level !== intro.level || (source.scc ?? "") !== intro.scc) throw new Error(`Invalid audited entity introduction ${entity.id}`);
      let text = cleanOriginal(source.description);
      if (intro.table) {
        const table = codexSections[intro.table.index];
        if (intro.table.index !== intro.index + 1 || !table || table.file !== source.file || table.name !== intro.table.name || table.level !== 6 || !table.description.startsWith("|")) throw new Error(`Invalid audited entity table ${entity.id}`);
        text += `\n\n###### ${table.name}\n\n${cleanOriginal(table.description)}`;
      }
      entity.originalDescription = text;
      entity.originalCoverage = { status: "complete" };
    }
    if (entity.originalCoverage) continue;
    const normalized = cleanOriginal(entity.originalDescription).replace(/\s*\{data-[^}\n]*\}/g, "").replace(/^#{1,6}\s+/gm, "").trim().replace(/\s+/g, " ");
    const heroesHash = entity.originalId && heroesHashes[entity.originalId];
    if (heroesHash && createHash("sha256").update(normalized).digest("hex") === heroesHash) {
      entity.originalCoverage = { status: "complete" };
      continue;
    }
    // Some class features consist of an introduction and a table; SCC puts
    // the table under a level-six heading before the separately modelled
    // subclass features. Verify both the source text and the Russian shape.
    if (entity.kind === "feature" && entity.originalId && classLevels[entity.source?.articleId] &&
        (entity.markdown.match(/^#{1,6}\s+/gm) ?? []).length === 2 &&
        (entity.markdown.match(/^\|/gm) ?? []).length >= 2) {
      const matches = codexSections.flatMap((section, index) => section.scc === entity.originalId ? [index] : []);
      if (matches.length === 1) {
        const index = matches[0];
        const root = codexSections[index];
        const table = codexSections[index + 1];
        const after = codexSections[index + 2];
        const plain = (text) => normalizeWhitespace(cleanOriginal(text).replace(/^#{1,6}\s+/gm, ""));
        if (table?.file === root.file && table.level === 6 && table.name.endsWith(" Table") &&
            table.description.startsWith("|") &&
            (!after || after.file !== root.file || after.level <= root.level || after.level === 5) &&
            plain(`${root.description}\n\n${table.name}\n\n${table.description}`) === plain(entity.originalDescription)) {
          entity.originalCoverage = { status: "complete" };
          continue;
        }
      }
    }
    // A structural feature may have no SCC ID of its own. Match its unique
    // named source section within its own verified level article, but only
    // when the Russian entity is a single prose block (no nested cards/tables).
    const level = classLevels[entity.source?.articleId];
    if (level && entity.kind === "feature" && entity.originalName && entity.originalDescription &&
        (entity.markdown.match(/^#{1,6}\s+/gm) ?? []).length === 1 && !/^\s*[>|]/m.test(entity.markdown)) {
      const matches = level.sections.filter((part) => part.name.toLocaleLowerCase("en") === entity.originalName.toLocaleLowerCase("en") &&
        normalizeWhitespace(cleanOriginal(codexSections[part.index]?.description)) === normalizeWhitespace(entity.originalDescription));
      if (matches.length === 1) {
        entity.originalCoverage = { status: "complete" };
        continue;
      }
    }
    const monsterOriginal = monsterOriginals.get(entity.id);
    if (monsterOriginal && normalizeWhitespace(monsterOriginal) === normalizeWhitespace(entity.originalDescription)) {
      entity.originalCoverage = { status: "complete" };
      continue;
    }
    if (!entity.originalDescription?.trim()) entity.originalCoverage = {
      status: "missing", reason: /^(ancestry|feature)\.(lizardfolk|tauros)(\.|$)/.test(entity.id) ? "homebrew" : "source-unavailable",
    };
    else entity.originalCoverage = { status: "excerpt", reason: "unverified-boundary" };
  }
  // A single-entity article is complete when its one displayed entity is
  // independently verified complete; ignore whitespace-only separators.
  for (const article of pack.articles ?? []) {
    if (article.originalCoverage?.status !== "excerpt") continue;
    const meaningful = article.blocks.filter((block) => block.type === "entity" || block.text.trim());
    if (meaningful.length !== 1 || meaningful[0].type !== "entity") continue;
    const entity = (pack.entities ?? []).find((item) => item.id === meaningful[0].ref);
    if (entity?.originalCoverage?.status === "complete") article.originalCoverage = { status: "complete" };
  }
  // The Russian project overview is only the lead of SCC's larger project;
  // its armor, implement and weapon sections are separate articles here.
  const imbue = (pack.articles ?? []).find((article) => article.id === "1616");
  if (imbue) {
    const source = codexSections[2007];
    if (source?.file !== "downtime-projects.md" || source.name !== "Imbue Treasure") throw new Error("Invalid Imbue Treasure overview");
    imbue.englishEdition = { kind: "source", title: source.name, blocks: [{ type: "markdown", text: cleanOriginal(source.description) }] };
    imbue.originalCoverage = { status: "complete" };
  }

  // Entity-only reference lists are complete if every individual source is
  // verified. Render their SCC order; omit nested abilities already contained
  // in a complete parent (notably kit signature abilities).
  const sourceOrder = new Map(codexSections.map((section, index) => [section.scc, index]).filter(([id]) => id));
  for (const article of pack.articles ?? []) {
    if (article.originalCoverage?.status !== "excerpt" || article.englishEdition) continue;
    const meaningful = article.blocks.filter((block) => block.type === "entity" || /[\p{L}\p{N}]/u.test(block.text));
    if (meaningful.length < 2 || meaningful.some((block) => block.type !== "entity")) continue;
    const entities = meaningful.map((block) => (pack.entities ?? []).find((item) => item.id === block.ref));
    if (entities.some((entity) => !entity || entity.originalCoverage?.status !== "complete" || !sourceOrder.has(entity.originalId))) continue;
    const nested = new Set(entities.flatMap((entity) => heroesNested[entity.originalId] ?? []));
    const ordered = entities.filter((entity) => !nested.has(entity.originalId))
      .sort((a, b) => sourceOrder.get(a.originalId) - sourceOrder.get(b.originalId));
    const complicationTitles = { "1103": "Complications 1–25", "1104": "Complications 26–50", "1105": "Complications 51–75", "1106": "Complications 76–100" };
    article.englishEdition = { kind: "source", title: complicationTitles[article.id] ?? article.originalName ?? article.title,
      blocks: ordered.map((entity) => ({ type: "entity", ref: entity.id })) };
    article.originalCoverage = { status: "complete" };
  }
  for (const entity of pack.entities ?? []) {
    const source = entity.englishEdition?.text ?? entity.originalDescription;
    if (entity.ability && source) entity.printedAbility = compilePrintedAbility(source);
  }
  // Kit chapters print the same signature inside the kit and as a standalone
  // ability. Keep the source verbatim and render that span with the canonical ID.
  const abilities = (pack.entities ?? []).filter(entity => entity.printedAbility);
  for (const kit of (pack.entities ?? []).filter(entity => entity.kind === "kit")) {
    const nested = new Set(heroesNested[kit.originalId] ?? []);
    const variants = new Set(kit.kitVariants?.map(variant => variant.signatureAbilityId));
    const source = kit.originalDescription ?? "";
    const signatures = [];
    for (const ability of abilities.filter(item => nested.has(item.originalId) || variants.has(item.id))) {
      const heading = [...source.matchAll(/^#{1,6} (.+)$/gm)].find(match => match[1] === ability.originalName);
      if (!heading) continue;
      const body = heading.index + heading[0].length + 2;
      if (!source.startsWith(ability.originalDescription, body)) throw new Error(`Kit signature differs from source: ${ability.id}`);
      signatures.push({ ref: ability.id, start: heading.index, end: body + ability.originalDescription.length });
    }
    if (signatures.length) kit.englishSignatures = signatures.sort((a, b) => a.start - b.start);
  }
  return pack;
}
