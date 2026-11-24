// Small display projections so browsing a list never downloads all of the rulebooks.
import { readFileSync, writeFileSync } from "node:fs";

import { createDirectorLinkResolver } from "./content/lib/director-content.mjs";
import { walkJson } from "./content/lib/common.mjs";

const read = path => JSON.parse(readFileSync(path, "utf8"));
const consumer = name => read(`src/generated/consumers/${name}.json`);
const output = (name, data) => {
  const path = `src/generated/consumers/${name}.json`;
  const text = JSON.stringify(data, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (text !== readFileSync(path, "utf8")) throw new Error(`Regenerate ${path} with npm run content:build`);
  } else writeFileSync(path, text);
};

// Both readers receive the same compiled edition. The sheet downloads only
// ability cards, independently of the full class and chapter packs.
const manifest = read("src/generated/rules/manifest.json");
const abilityIds = consumer("abilities").abilities.filter(ability => ability.originalDescription).map(ability => ability.id);
const cards = new Map();
for (const packId of new Set(abilityIds.map(id => manifest.entities[id].packId))) {
  const pack = read(`src/generated/rules/packs/${packId}.json`);
  for (const entity of pack.entities) {
    if (entity.printedAbility) cards.set(entity.id, entity.printedAbility);
  }
}
const sheetCards = Object.fromEntries(abilityIds.map(id => {
  if (!cards.has(id)) throw new Error(`Missing English ability card: ${id}`);
  return [id, cards.get(id)];
}));
const basicActions = {};
for (const [articleId, definitions] of [
  ["1309", [
    ["Помощь в атаке", "Aid Attack", "Maneuver", "Melee 1", "One adjacent enemy"],
    ["Передышка", "Catch Breath", "Maneuver", "Self", "Self"],
    ["Ускользание", "Escape Grab"], ["Захват", "Grab"], ["Отталкивание", "Knockback"],
  ]],
  ["1310", [
    ["Рывок", "Charge", "Main action", "Your speed", "Self", ["Charge"]],
    ["Защита", "Defend", "Main action", "Self", "Self"],
    ["Лечение", "Heal", "Main action", "Melee 1", "One adjacent creature"],
  ]],
  ["1311", [
    ["Свободный удар ближнего боя", "Melee Weapon Free Strike"],
    ["Свободный удар дальнего боя", "Ranged Weapon Free Strike"],
    ["Атака по возможности", "Opportunity Attack", "Free triggered action", "Melee 1", "One creature", ["Melee", "Strike", "Weapon"]],
  ]],
]) {
  const { articles: [article], entities } = read(`src/generated/rules/articles/${articleId}.json`);
  const sections = (article.englishEdition?.blocks.map(block => block.text ?? "").join("\n\n") ?? article.originalDescription).split(/^## /m);
  for (const [ru, name, action, distance, target, keywords = []] of definitions) {
    const entity = entities.find(entry => entry.originalName === name);
    let id = entity?.id, description = entity?.originalDescription;
    if (!entity) {
      const heading = name === "Opportunity Attack" ? "Opportunity Attacks" : name;
      const section = sections.find(text => text.startsWith(heading + "\n"));
      if (!section || !action) throw new Error(`Missing basic action source: ${articleId} / ${name}`);
      description = section.slice(heading.length).trim();
      id = `basic.${name.toLowerCase().replaceAll(" ", "-")}`;
      sheetCards[id] = { facts: { action, distance: [distance], target, keywords }, effect: description, blocks: [] };
    }
    const { facts, roll } = sheetCards[id];
    basicActions[ru] = { id, name, description, action: facts.action,
      distance: facts.distance.map(part => typeof part === "string" ? part : part.value).join(""),
      summary: roll?.title ?? description.split("\n\n")[0] };
  }
}
output("basic-actions-en", basicActions);
output("ability-cards-en", sheetCards);

const builder = consumer("builder");
const lexicon = read("content/monsters/glossary.json");
const labels = Object.fromEntries([...lexicon.terms, ...lexicon.groups, ...lexicon.keywords].map(({ ru, en }) => [ru, en]));
const articles = manifest.articles;
const source = new Map(read("content/monsters/source.json").records.map(r => [r.articleId, r]));
for (const { id, director } of articles) {
  const stats = source.get(id)?.stats;
  const size = stats?.size ?? stats?.terrainStats?.find(s => s.name === "Size")?.value;
  if (director?.size && size && /[а-яё]/i.test(director.size)) labels[director.size] = String(size);
}

function excerpt(markdown = "") {
  const paragraph = markdown.split(/\n\s*\n/).find(p => p.trim() && !/^(?:#{1,6} |\||\*\*[^*]+:\*\*)/.test(p.trim()));
  if (!paragraph) return "";
  const plain = paragraph.replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > 180 ? plain.slice(0, 180).replace(/\s+\S*$/, "") + "…" : plain;
}

const summaries = {};
for (const items of [builder.ancestries, builder.careers, builder.classes, consumer("kits").kits, consumer("perks").perks, consumer("library").catalog]) {
  for (const entry of items) {
    if (entry.originalId && entry.originalDescription) summaries[entry.originalId] = excerpt(entry.originalDescription);
  }
}
const signatures = {};
const translatedTraits = {};
for (const { articleId } of builder.ancestries) {
  const { entities } = read(`src/generated/rules/articles/${articleId}.json`);
  const signatureTraits = entities.filter(e => /^Signature Trait:/i.test(e.originalName) || (e.englishEdition && e.id.includes(".signature.")));
  signatures[articleId] = signatureTraits.map(e => {
    const name = e.englishEdition?.name ?? e.originalName.replace(/^Signature Trait:\s*/i, "");
    const text = e.englishEdition?.text.replace(/^\*\*Signature trait\.\*\*\s*/i, "") ?? e.originalDescription;
    return `**${name}.** ${text}`;
  }).join("\n\n");
  for (const entity of entities.filter(e => e.englishEdition)) {
    translatedTraits[entity.id] = entity.englishEdition.text;
    if (entity.kind === "ancestry") summaries[articleId] = excerpt(entity.englishEdition.text);
  }
}
const canonical = directory => walkJson(`content/rules/${directory}`).map(read);
const canonicalArticles = canonical("articles");
const canonicalEntities = canonical("entities");
const resolveSourceLinks = createDirectorLinkResolver(canonicalArticles, canonicalEntities);
const links = {};
for (const entry of [...canonicalArticles, ...canonicalEntities]) {
  for (const match of (entry.originalDescription ?? "").matchAll(/\]\((scc\.v1:[^)]+)\)/g)) {
    if (!links[match[1]]) {
      const href = resolveSourceLinks(`[link](${match[1]})`).slice(7, -1);
      links[match[1]] = href.replace("#/catalog/glossary#term-", "#/catalog/glossary/");
    }
  }
}
output("english-reference", { labels, summaries, links });
// Exact options from each class's own first-level pack. Identical names in
// different classes may describe different mechanics.
const classOptions = {};
for (const heroClass of builder.classes) {
  const { entities } = read(`src/generated/rules/articles/${heroClass.articleId}.json`);
  const options = {};
  for (const group of heroClass.featureChoices) {
    for (const choice of [group, ...group.options]) {
      const en = choice.name.match(/\(([a-zA-Z -]+)\)$/)?.[1];
      const entity = entities.find(e => e.name === choice.name || (en && e.originalName === en));
      if (entity?.originalName) options[choice.name] = { name: entity.originalName, text: entity.originalDescription ?? "" };
    }
  }
  for (const option of heroClass.subclasses) {
    if (!option.originalName) continue;
    const name = option.originalName;
    const line = entities.flatMap(e => (e.originalDescription ?? "").split("\n"))
      .find(line => {
        const clean = line.replaceAll("**", "");
        return [`- ${name}:`, `- ${name} `].some(prefix => clean.startsWith(prefix));
      });
    const domain = entities.find(e => e.originalName === `Domain Piety and Effects: ${name}`);
    options[option.name] = { name, text: line?.replace(/^- /, "") ?? domain?.originalDescription ?? "" };
  }
  classOptions[heroClass.name] = options;
}
output("ancestry-signatures-en", { signatures, translatedTraits });
output("builder-options-en", classOptions);
// The sheet header only needs identity labels. Keep rule prose off its startup path.
const identityNames = Object.fromEntries([...builder.ancestries, ...builder.careers]
  .filter(entry => entry.originalName).map(entry => [entry.name, entry.originalName]));
const subclasses = Object.fromEntries(builder.classes.map(entry => [entry.name,
  Object.fromEntries(entry.subclasses.filter(option => option.originalName).map(option => [option.name, option.originalName]))]));
const titles = {};
for (const entry of consumer("library").catalog.filter(entry => entry.kind === "title" && entry.originalName)) {
  for (const id of [entry.id, entry.legacyId].filter(Boolean)) titles[id] = { name: entry.name, originalName: entry.originalName };
}
output("sheet-identity-en", { names: identityNames, subclasses, titles });
