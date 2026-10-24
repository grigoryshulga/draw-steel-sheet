#!/usr/bin/env node
/** Build the compact, source-linked level-up rule snapshot from local codex data. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const codex = JSON.parse(readFileSync(join(root, "src/data/codex.generated.json"), "utf8"));
const abilities = JSON.parse(readFileSync(join(root, "src/data/abilities.generated.json"), "utf8"));
const classNames = ["Неистовый", "Нуль", "Проводник", "Тактик", "Талант", "Тень", "Трубадур", "Цензор", "Элементалист"];
const subclassSections = {
  "Неистовый": [["Берсерк", "Берсерка"], ["Разоритель", "Разорителя"], ["Буревестник", "Буревестника"]],
  "Нуль": [["Хронокинетик", "Хронокинетика"], ["Криокинетик", "Криокинетика"], ["Метакинетик", "Метакинетика"]],
  "Тактик": [["Повстанец", "Повстанца"], ["Воевода", "Воеводы"], ["Авангард", "Авангарда"]],
  "Талант": [["Хронопатия", "Хронопатии"], ["Телекинез", "Телекинеза"], ["Телепатия", "Телепатии"]],
  "Тень": [["Коллегия Черного Пепла", "Черного Пепла"], ["Коллегия Едкой Алхимии", "Едкой Алхимии"], ["Коллегия Маски Арлекина", "Маски Арлекина"]],
  "Трубадур": [["Автор", "Автора"], ["Дуэлянт", "Дуэлянта"], ["Виртуоз", "Виртуоза"]],
  "Цензор": [["Экзорцист", "Экзорциста"], ["Оракул", "Оракула"], ["Идеал", "Идеала"]],
};
const characteristicNames = {
  "Мощи": "might", "Мощь": "might", "Ловкости": "agility", "Ловкость": "agility",
  "Разума": "reason", "Разум": "reason", "Интуиции": "intuition", "Интуиция": "intuition",
  "Присутствия": "presence", "Присутствие": "presence",
};
const norm = (text) => text.toLocaleLowerCase("ru").replace(/[её]/g, "е").replace(/[^\p{L}\p{N}]+/gu, "");
const sourceArticles = codex.filter((a) => a.path.startsWith("08. Классы/"));
function articleFor(className, level) {
  return sourceArticles.find((a) => a.path.split("/")[1] === className &&
    new RegExp(`(?:^|/)0*${level}(?:-й|-го)? Уровень`, "i").test(a.title));
}
function characteristicRules(markdown, level) {
  if (![4, 7, 10].includes(level)) return undefined;
  const section = markdown.match(/#### Увеличение характеристик\s*([\s\S]*?)(?=\n#### |$)/i)?.[1] ?? "";
  if (!section) return undefined;
  if (/Каждая из ваших характеристик увеличивается на 1/i.test(section))
    return { increaseAll: { amount: 1, cap: level === 7 ? 4 : 5 } };
  const cap = level === 4 ? 3 : 5;
  const pair = section.match(/показатели\s+([^\n.]+?)\s+и\s+([^\n.]+?)\s+каждый увеличивается до/i);
  if (pair) {
    const left = characteristicNames[pair[1].trim()];
    const right = characteristicNames[pair[2].trim()];
    if (left && right) return { set: { [left]: cap, [right]: cap } };
  }
  const single = section.match(/показатель\s+([^\n.]+?)\s+увеличивается до/i);
  if (single) {
    const key = characteristicNames[single[1].trim()];
    if (key && /увеличить один из ваших показателей характеристик на 1/i.test(section))
      return { set: { [key]: cap }, choice: { amount: 1, cap } };
    if (key) return { set: { [key]: cap } };
  }
  return undefined;
}
function features(article) {
  const lines = article.markdown.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^#### (.+)$/);
    if (!heading) continue;
    let end = i + 1;
    while (end < lines.length && !/^#{1,4} /.test(lines[end])) end++;
    const description = lines.slice(i + 1, end).join("\n").trim();
    out.push({ id: `${article.id}-f${String(out.length + 1).padStart(2, "0")}`, name: heading[1].replace(/\*\*/g, ""), description });
  }
  return out;
}

// These are source-backed exceptions: they are explicit grants or bounded
// subclass selections and must not be inferred from resource cost or keywords.
const exceptions = {
  "Неистовый:2": { subclassGroups: {
    "Берсерк": ["neistovyy-osobaya-dostavka-f71cbdccc0", "neistovyy-tarannyy-shar-5aecde78f8"],
    "Разоритель": ["neistovyy-smert-smert-61a8e0d162", "neistovyy-razrushitel-falang-5c4d3b0d58"],
    "Буревестник": ["neistovyy-vysshiy-hischnik-373d249741", "neistovyy-vnutrenniy-rev-04d333351c"],
  } },
  "Элементалист:2": { grantItems: [{ abilityIds: ["elementalist-mezhdu-nami-net-prostranstva-603bea008c"], subclasses: ["Пустота"] }],
    choiceIds: ["elementalist-o-cvetok-pomogi-o-zemlya-zaschiti-d5889806f1", "elementalist-obyatiya-vulkana-3acba82839", "elementalist-perenesennyy-cherez-plamya-402569297d", "elementalist-podchinit-zelen-vnutri-69079b517c"] },
  "Талант:8": { grantItems: [
    { abilityIds: ["talant-pole-levitacii-c51c097676"], subclasses: ["Телекинез"] },
    { abilityIds: ["talant-stazisnyy-schit-b4f19a14ce"], subclasses: ["Хронопатия"] },
  ], choiceIds: ["talant-omolozhenie-76cce55c24", "talant-predubezhdenie-b1aab277a4", "talant-stal-8f6e7fcb00", "talant-stiranie-pamyati-01c3ae771b"] },
  "Тень:4": { grantIds: ["ten-nochnoy-dozor-ae28536624"] },
  "Тень:3": { grantIds: ["ten-vnimatelnoe-nablyudenie-0e1275c4b7"] },
  "Тень:8": { grantItems: [{ abilityIds: ["ten-bomba-zamedlennogo-deystviya-3b731f7d34"], subclasses: ["Коллегия Едкой Алхимии"] }] },
  "Трубадур:3": { grantItems: [{ abilityIds: ["trubadur-zazhgi-etu-noch-7913c15e2d", "trubadur-neustannyy-geroy-091a644e8b"], subclasses: ["Виртуоз"] }] },
  "Трубадур:6": { grantIds: ["trubadur-v-luchah-prozhektora-e05dc6a432"] },
  "Трубадур:8": { grantItems: [
    { abilityIds: ["trubadur-lunnaya-sonata-07f21e5507", "trubadur-radikalnaya-fantaziya-e273b724c7"], subclasses: ["Виртуоз"] },
  ] },
  "Элементалист:3": { grantItems: [
    { abilityIds: ["elementalist-zemlya-prinimaet-menya-ccc45de0e7"], subclasses: ["Земля"] },
    { abilityIds: ["elementalist-vspomni-rost-solnce-i-dozhd-d2229ae702"], subclasses: ["Зелень"] },
  ] },
  "Элементалист:6": { previousChoiceLevel: 5, choiceCost: 9 },
  "Элементалист:9": { previousChoiceLevel: 8, choiceCost: 11 },
  "Элементалист:8": { grantItems: [{ abilityIds: ["elementalist-prizyv-istochnika-zemli-c9679a42db"], subclasses: ["Земля"] }] },
};

function abilityGroups(className, level, article, matching, exception) {
  if (exception.choiceIds) {
    return exception.choiceIds.length ? [{ id: `${article.id}-g01`, label: `Героическая способность ${level}-го уровня`, count: 1, abilityIds: exception.choiceIds }] : [];
  }
  const subclasses = subclassSections[className];
  const sections = article.markdown.split(/(?=^#{3,5} )/m);
  const groups = [];
  if (subclasses) {
    for (const [subclass, headerToken] of subclasses) {
      const section = sections.find((part) => norm(part.split("\n", 1)[0]).includes(norm(headerToken)) && /Выберите одну из следующих(?: героических)? способностей/.test(part));
      if (!section) continue;
      const ids = matching.filter((ability) => norm(section).includes(norm(ability.name))).map((ability) => ability.id).filter((id) => !(exception.grantIds ?? []).includes(id));
      if (ids.length) groups.push({ id: `${article.id}-g${String(groups.length + 1).padStart(2, "0")}`, label: `${subclass}: способность ${level}-го уровня`, count: 1, abilityIds: ids, subclasses: [subclass] });
    }
    if (groups.length) return groups;
  }
  // Domain abilities need one union choice across the hero's selected domains.
  // LevelUpAbilityGroup cannot express per-option domain membership, so these
  // class-specific choices stay in the source features until the contract grows.
  if (/Способность домена \d+-го уровня/.test(article.markdown)) return groups;
  const genericHeader = article.markdown.match(/^#### [^\n]*способность[^\n]*$/im);
  const genericStart = genericHeader ? genericHeader.index + genericHeader[0].length : -1;
  const genericRest = genericStart < 0 ? "" : article.markdown.slice(genericStart);
  const nextSection = genericRest.search(/^#### /m);
  const genericSection = (nextSection < 0 ? genericRest : genericRest.slice(0, nextSection)).trim();
  if (matching.length && /выберите одну героическую способность|выберите одну способность/i.test(genericSection)) {
    const ids = matching.filter((ability) => norm(genericSection).includes(norm(ability.name)) && !(exception.grantIds ?? []).includes(ability.id)).map((ability) => ability.id);
    if (ids.length) groups.push({ id: `${article.id}-g01`, label: `Героическая способность ${level}-го уровня`, count: 1, abilityIds: ids });
  }
  return groups;
}

function genericChoiceIds(className, level, article, matching, grantIds = []) {
  const genericHeader = article.markdown.match(/^#### [^\n]*способность[^\n]*$/im);
  const genericStart = genericHeader ? genericHeader.index + genericHeader[0].length : -1;
  const genericRest = genericStart < 0 ? "" : article.markdown.slice(genericStart);
  const nextSection = genericRest.search(/^#### /m);
  const genericSection = (nextSection < 0 ? genericRest : genericRest.slice(0, nextSection)).trim();
  if (!/выберите одну героическую способность|выберите одну способность/i.test(genericSection)) return [];
  return matching
    .filter((ability) => ability.resourceCost === (level <= 6 ? 9 : 11))
    .filter((ability) => norm(genericSection).includes(norm(ability.name)))
    .map((ability) => ability.id)
    .filter((id) => !grantIds.includes(id));
}
const rules = [];
for (const className of classNames) for (let level = 2; level <= 10; level++) {
  const article = articleFor(className, level);
  if (!article || !article.markdown.trim()) throw new Error(`Missing source article: ${className} ${level}`);
  const matching = abilities.filter((a) => a.sourceKind === "class" && a.className === className && a.level === level);
  const exception = exceptions[`${className}:${level}`] ?? {};
  const grantIds = exception.grantIds ?? (exception.grantItems ?? []).flatMap((g) => g.abilityIds);
  const grants = exception.grantItems ?? grantIds.map((id) => ({ abilityIds: [id] }));
  const abilityChoices = [];
  if (exception.subclassGroups) {
    for (const [subclass, abilityIds] of Object.entries(exception.subclassGroups))
      abilityChoices.push({ id: `${article.id}-g${String(abilityChoices.length + 1).padStart(2, "0")}`, label: `${subclass}: способность ${level}-го уровня`, count: 1, abilityIds, subclasses: [subclass] });
  } else if (exception.previousChoiceLevel) {
    const previousArticle = articleFor(className, exception.previousChoiceLevel);
    const previousMatching = abilities.filter((a) => a.sourceKind === "class" && a.className === className && a.level === exception.previousChoiceLevel);
    const previousGrantIds = exceptions[`${className}:${exception.previousChoiceLevel}`]?.grantIds ??
      (exceptions[`${className}:${exception.previousChoiceLevel}`]?.grantItems ?? []).flatMap((g) => g.abilityIds);
    const ids = [...new Set([
      ...genericChoiceIds(className, exception.previousChoiceLevel, previousArticle, previousMatching, previousGrantIds),
      ...genericChoiceIds(className, level, article, matching, grantIds),
    ])];
    abilityChoices.push({ id: `${article.id}-g01`, label: `Способность за ${exception.choiceCost} эссенции`, count: 1, abilityIds: ids, allowedLevels: [exception.previousChoiceLevel, level] });
  } else abilityChoices.push(...abilityGroups(className, level, article, matching, { ...exception, grantIds }));
  const skillCount = (article.markdown.match(/Вы получаете один навык по вашему выбору/gi) ?? []).length;
  rules.push({ className, level, articleId: article.id, title: article.title, features: features(article),
    characteristics: characteristicRules(article.markdown, level), skillCount, abilityChoices, grantedAbilities: grants });
}
if (rules.length !== 81) throw new Error(`Expected 81 rules; got ${rules.length}`);
const path = join(root, "src/data/level-up.generated.json");
writeFileSync(path, JSON.stringify(rules));
console.log(`Level-up data: ${rules.length} rules from ${classNames.length} classes`);
