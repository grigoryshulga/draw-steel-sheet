import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { CATALOG, GLOSSARY } from "../src/data/library";
import { addCatalogEntry } from "../src/lib/catalog-character";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import {
  withPreferredCharacteristic,
  type ConsumerAbilityProjection,
  type ConsumerBuilderProjection,
  type ConsumerFeatureProjection,
  type ConsumerKitProjection,
  type ConsumerLevelUpProjection,
  type ConsumerLibraryProjection,
  type ConsumerPerkProjection,
} from "../src/rules/consumer-data";
import {
  projectCatalog,
  projectGlossary,
} from "../scripts/content/build-consumer-data.mjs";
import { CONSUMER_ANCESTRY_FEATURES } from "../src/rules/consumer-features";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content/rules");
const GENERATOR = path.join(ROOT, "scripts/content/build-consumer-data.mjs");
const IDENTITY = path.join(ROOT, "scripts/content/lib/consumer-identity.json");
const OUT = path.join(ROOT, "src/generated/consumers");

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runGenerator(args: string[]) {
  return execFileSync(process.execPath, [GENERATOR, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function generatorFailure(args: string[]): string {
  try {
    runGenerator(args);
  } catch (error: any) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}${error.message}`;
  }
  throw new Error("ожидалась ошибка генератора проекций");
}

function findJsonFile(
  directory: string,
  predicate: (value: any) => boolean,
): string {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => (left.name < right.name ? -1 : 1),
  )) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findJsonFile(full, predicate);
      if (found) return found;
    } else if (entry.name.endsWith(".json") && predicate(readJson(full))) {
      return full;
    }
  }
  return "";
}

/** Изолированная копия канонического дерева и сопоставления ID. */
function makeSandbox() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "consumer-data-"));
  const content = path.join(directory, "content");
  fs.cpSync(CONTENT, content, { recursive: true });
  const identity = path.join(directory, "identity.json");
  fs.copyFileSync(IDENTITY, identity);
  const out = path.join(directory, "out");
  return { directory, content, identity, out };
}

function sandboxArgs(sandbox: ReturnType<typeof makeSandbox>) {
  return [
    "--content",
    sandbox.content,
    "--identity",
    sandbox.identity,
    "--out",
    sandbox.out,
  ];
}

function editJson(file: string, edit: (value: any) => void) {
  const value = readJson(file);
  edit(value);
  fs.writeFileSync(file, JSON.stringify(value));
}

function generatedAbilities(sandbox: ReturnType<typeof makeSandbox>) {
  return readJson(path.join(sandbox.out, "abilities.json")) as ConsumerAbilityProjection;
}

function generatedLibrary(sandbox: ReturnType<typeof makeSandbox>) {
  return readJson(path.join(sandbox.out, "library.json")) as ConsumerLibraryProjection;
}

function articleFile(content: string, id: string) {
  return findJsonFile(path.join(content, "articles"), (value) => value?.id === id);
}

/**
 * Правит реконструированный текст статьи: сначала markdown-блоки, затем
 * сущности по ссылкам. Канонические статьи могут держать заголовки как в
 * блоках, так и в сущностях, поэтому тест не зависит от их расположения.
 */
function editRenderedArticle(
  content: string,
  articleId: string,
  edit: (text: string) => string,
) {
  const file = articleFile(content, articleId);
  if (!file) throw new Error(`статья ${articleId} не найдена`);
  const article = readJson(file);
  for (let index = 0; index < article.blocks.length; index += 1) {
    const block = article.blocks[index];
    if (block.type === "markdown") {
      const next = edit(block.text);
      if (next !== block.text) {
        article.blocks[index] = { ...block, text: next };
        fs.writeFileSync(file, JSON.stringify(article));
        return;
      }
      continue;
    }
    const entityFile = findJsonFile(
      path.join(content, "entities"),
      (value) => value?.id === block.ref,
    );
    if (!entityFile) continue;
    const entity = readJson(entityFile);
    const next = edit(entity.markdown);
    if (next !== entity.markdown) {
      entity.markdown = next;
      fs.writeFileSync(entityFile, JSON.stringify(entity));
      return;
    }
  }
  throw new Error(`в статье ${articleId} не найден текст для правки`);
}

function appendArticleMarkdown(content: string, articleId: string, text: string) {
  const file = articleFile(content, articleId);
  if (!file) throw new Error(`статья ${articleId} не найдена`);
  const article = readJson(file);
  article.blocks.push({ type: "markdown", text: `\n\n${text}\n` });
  fs.writeFileSync(file, JSON.stringify(article));
}

/**
 * Собирает статический граф относительных импортов и возвращает достижимые
 * сгенерированные JSON. Служит проверкой разделения наборов данных.
 */
function reachableGeneratedJson(entry: string): string[] {
  const seen = new Set<string>();
  const generated = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!fs.existsSync(file)) return;
    const source = fs
      .readFileSync(file, "utf8")
      .replace(/import\s+type\s+[^;]*?from\s*["'][^"']+["'];?/g, "")
      .replace(/export\s+type\s+[^;]*?from\s*["'][^"']+["'];?/g, "");
    for (const match of source.matchAll(/from\s*["'](\.[^"']+)["']/g)) {
      const base = path.resolve(path.dirname(file), match[1]);
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.json`,
        path.join(base, "index.ts"),
      ];
      const resolved = candidates.find((candidate) => fs.existsSync(candidate));
      if (!resolved) continue;
      const relative = path.relative(ROOT, resolved).replaceAll(path.sep, "/");
      if (relative.startsWith("src/generated/")) generated.add(relative);
      visit(resolved);
    }
  };
  visit(entry);
  return [...generated].sort();
}

const legacyAbilities = readJson(
  path.join(ROOT, "src/data/abilities.generated.json"),
) as any[];
const legacyLibrary = readJson(
  path.join(ROOT, "src/data/library-articles.generated.json"),
) as any[];
const legacyKits = readJson(
  path.join(ROOT, "src/data/kits.generated.json"),
) as any[];
const legacyPerks = readJson(
  path.join(ROOT, "src/data/perks.generated.json"),
) as any;
const legacyAncestryFeatures = readJson(
  path.join(ROOT, "src/data/ancestry-features.generated.json"),
) as any[];
const legacyClassFeatures = readJson(
  path.join(ROOT, "src/data/class-features.generated.json"),
) as any[];
const legacyLevelUp = readJson(
  path.join(ROOT, "src/data/level-up.generated.json"),
) as any[];
const legacyBuilder = readJson(
  path.join(ROOT, "src/data/builder.generated.json"),
) as any;
const identity = readJson(IDENTITY) as any;
const legacyIdMap = readJson(
  path.join(ROOT, "src/generated/legacy-ids.json"),
) as {
  abilities: Record<string, string>;
  classFeatures: Record<string, string>;
  ancestryFeatures: Record<string, string>;
  kits: Record<string, string>;
  perks: Record<string, string>;
  catalog: Record<string, string>;
};

/**
 * Поля идентичности, добавленные миграцией на английские scc-id. Контент
 * сравнивается без них, а сами ID проверяются отдельно: `legacyId` — с
 * прежним снапшотом, `id` — с английской проекцией из карты legacy-ID.
 */
const IDENTITY_FIELDS = new Set([
  "id",
  "legacyId",
  "originalId",
  "originalName",
  "originalDescription",
]);

/** Английский термин глоссария превращается в `glossary.<slug>`. */
function glossarySlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripIdentity(value: any): any {
  if (Array.isArray(value)) return value.map(stripIdentity);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !IDENTITY_FIELDS.has(key))
        .map(([key, item]) => [key, stripIdentity(item)]),
    );
  }
  return value;
}

/**
 * Проверяет порядок и идентичность записей проекции: `legacyId` совпадает с
 * прежним снапшотом, а `id` — с ожидаемым английским ID из карты миграции.
 */
function expectProjectionIdentity(
  records: ReadonlyArray<{ id: string; legacyId?: string }>,
  legacyIds: string[],
  englishIds: string[],
) {
  expect(records.map((record) => record.legacyId ?? record.id)).toEqual(
    legacyIds,
  );
  expect(records.map((record) => record.id)).toEqual(englishIds);
}

const kitsProjection = readJson(
  path.join(OUT, "kits.json"),
) as ConsumerKitProjection;
const perksProjection = readJson(
  path.join(OUT, "perks.json"),
) as ConsumerPerkProjection;
const featuresProjection = readJson(
  path.join(OUT, "features.json"),
) as ConsumerFeatureProjection;
const levelUpProjection = readJson(
  path.join(OUT, "level-up.json"),
) as ConsumerLevelUpProjection;
const builderProjection = readJson(
  path.join(OUT, "builder.json"),
) as ConsumerBuilderProjection;

/**
 * Каноническая миграция убрала восклицательные знаки в названиях двух
 * знаковых черт происхождений. ID и текст сохранены, поэтому проекция берёт
 * каноническое имя, а прежний вариант зафиксирован здесь как известное отличие.
 */
const ANCESTRY_CANONICAL_NAMES: Record<string, string> = {
  "feature.trait.hakaan.big": "Большой",
  "feature.trait.polder.small": "Маленький",
};

/**
 * Legacy `scripts/build-class-features.mjs` дополнительно разворачивал строки
 * таблиц в отдельные записи (`keyValue`/`parentId`): пороги свирепости, строки
 * доменов Проводника, доктрины Тактика и т. п. Каноническая миграция оставила
 * особенностями только заголовки `####`/`#####`; тексты этих строк живут в
 * Markdown родительских особенностей, поэтому это не потеря контента.
 */
const CLASS_FEATURE_LEGACY_SYNTHETIC_ROWS = [
  "feature.fury.level-1.growing-ferocity-berserker-2",
  "feature.fury.level-1.growing-ferocity-berserker-4",
  "feature.fury.level-1.growing-ferocity-berserker-6",
  "feature.fury.level-4.growing-ferocity-berserker-8",
  "feature.fury.level-7.growing-ferocity-berserker-10",
  "feature.fury.level-10.growing-ferocity-berserker-12",
  "feature.fury.level-1.growing-ferocity-reaver-2",
  "feature.fury.level-1.growing-ferocity-reaver-4",
  "feature.fury.level-1.growing-ferocity-reaver-6",
  "feature.fury.level-4.growing-ferocity-reaver-8",
  "feature.fury.level-7.growing-ferocity-reaver-10",
  "feature.fury.level-10.growing-ferocity-reaver-12",
  "feature.ability.fury.level-1.lines-of-force",
  "feature.ability.fury.level-1.unearthly-reflexes",
  "feature.ability.fury.level-1.furious-change",
  "feature.null.level-1.chronokinetic-mastery-2",
  "feature.null.level-1.chronokinetic-mastery-4",
  "feature.null.level-1.chronokinetic-mastery-6",
  "feature.null.level-4.chronokinetic-mastery-8",
  "feature.null.level-7.chronokinetic-mastery-10",
  "feature.null.level-10.chronokinetic-mastery-12",
  "feature.null.level-1.cryokinetic-mastery-2",
  "feature.null.level-1.cryokinetic-mastery-4",
  "feature.null.level-1.cryokinetic-mastery-6",
  "feature.null.level-4.cryokinetic-mastery-8",
  "feature.null.level-7.cryokinetic-mastery-10",
  "feature.null.level-10.cryokinetic-mastery-12",
  "feature.null.level-1.metakinetic-mastery-2",
  "feature.null.level-1.metakinetic-mastery-4",
  "feature.null.level-1.metakinetic-mastery-6",
  "feature.null.level-4.metakinetic-mastery-8",
  "feature.null.level-7.metakinetic-mastery-10",
  "feature.null.level-10.metakinetic-mastery-12",
  "feature.ability.tactician.level-1.advanced-tactics",
  "feature.ability.tactician.level-1.overwatch",
  "feature.ability.tactician.level-1.parry",
  "feature.ability.shadow.level-1.in-all-this-confusion",
  "feature.ability.shadow.level-1.defensive-roll",
  "feature.ability.shadow.level-1.clever-trick",
  "feature.ability.troubadour.level-1.turnabout-is-fair-play",
  "feature.ability.troubadour.level-1.riposte",
  "feature.ability.troubadour.level-1.harmonize",
  "feature.ability.elementalist.level-1.skin-like-castle-walls",
  "feature.ability.elementalist.level-1.explosive-assistance",
  "feature.ability.elementalist.level-1.breath-of-dawn-remembered",
  "feature.ability.elementalist.level-1.subtle-relocation",
  "feature.ability.conduit.level-2.statue-of-power",
  "feature.ability.conduit.level-2.reap",
  "feature.ability.conduit.level-2.blessing-of-fate-and-destiny",
  "feature.ability.conduit.level-2.the-gods-command-you-obey",
  "feature.ability.conduit.level-2.wellspring-of-grace",
  "feature.ability.conduit.level-2.our-hearts-your-strength",
  "feature.ability.conduit.level-2.nature-judges-thee",
  "feature.ability.conduit.level-2.sacred-bond",
  "feature.ability.conduit.level-2.saints-tempest",
  "feature.ability.conduit.level-2.morning-light",
  "feature.ability.conduit.level-2.divine-comedy",
  "feature.ability.conduit.level-2.blessing-of-insight",
  "feature.ability.conduit.level-6.gods-machine",
  "feature.ability.conduit.level-6.aura-of-souls",
  "feature.ability.conduit.level-6.your-story-ends-here",
  "feature.ability.conduit.level-6.invocation-of-undoing",
  "feature.ability.conduit.level-6.revitalizing-grace",
  "feature.ability.conduit.level-6.lauded-by-god",
  "feature.ability.conduit.level-6.spirit-stampede",
  "feature.ability.conduit.level-6.cuirass-of-the-gods",
  "feature.ability.conduit.level-6.lightning-lord",
  "feature.ability.conduit.level-6.blessing-of-the-midday-sun",
  "feature.ability.conduit.level-6.invocation-of-mystery",
  "feature.ability.conduit.level-6.blade-of-the-heavens",
  "feature.ability.conduit.level-9.divine-dragon",
  "feature.ability.conduit.level-9.word-of-final-redemption",
  "feature.ability.conduit.level-9.bend-fate",
  "feature.ability.conduit.level-9.word-of-weakening",
  "feature.ability.conduit.level-9.radiance-of-grace",
  "feature.ability.conduit.level-9.alacrity-of-the-heart",
  "feature.ability.conduit.level-9.thorn-cage",
  "feature.ability.conduit.level-9.blessing-of-the-fortress",
  "feature.ability.conduit.level-9.godstorm",
  "feature.ability.conduit.level-9.solar-flare",
  "feature.ability.conduit.level-9.night-falls",
  "feature.ability.conduit.level-9.righteous-phalanx",
];

describe("проекции канонических правил для потребителей", () => {
  it("сохраняет прежние идентификаторы и количество записей каталога", () => {
    expect(CATALOG.filter((entry) => entry.kind === "treasure")).toHaveLength(
      100,
    );
    expect(CATALOG.filter((entry) => entry.kind === "title")).toHaveLength(59);
    expect(CATALOG.filter((entry) => entry.kind === "project")).toHaveLength(
      19,
    );
    expect(new Set(CATALOG.map((entry) => entry.id)).size).toBe(CATALOG.length);
    expect(GLOSSARY).toHaveLength(234);
    expect(new Set(GLOSSARY.map((entry) => entry.id)).size).toBe(
      GLOSSARY.length,
    );
    expect(GLOSSARY.find((entry) => entry.name === "Ясность")?.english).toBe(
      "Clarity",
    );
    expect(GLOSSARY.find((entry) => entry.name === "d10")).toBeDefined();
    expect(readJson(path.join(OUT, "library.json")).catalog).toHaveLength(
      CATALOG.length,
    );
  });

  it("сохраняет прежний порядок и поля карточек способностей", () => {
    const expected = legacyAbilities.map((entry) => ({
      ...entry,
      preferredCharacteristic:
        entry.preferredCharacteristic &&
        entry.rollCharacteristics.includes(entry.preferredCharacteristic)
          ? entry.preferredCharacteristic
          : (entry.rollCharacteristics[0] ?? ""),
    }));
    expect(ABILITY_COMPENDIUM).toHaveLength(512);
    expectProjectionIdentity(
      ABILITY_COMPENDIUM,
      legacyAbilities.map((entry) => entry.id),
      legacyAbilities.map((entry) => legacyIdMap.abilities[entry.id]),
    );
    expect(stripIdentity(ABILITY_COMPENDIUM)).toEqual(stripIdentity(expected));
    expect(readJson(path.join(OUT, "abilities.json")).abilities).toHaveLength(
      ABILITY_COMPENDIUM.length,
    );
  });

  it("совпадает с прежним выводом библиотеки при том же исходном Markdown", () => {
    const catalog = projectCatalog(legacyLibrary, identity.catalog);
    expect(catalog.entries.map((entry) => entry.id)).toEqual(
      CATALOG.map((entry) => entry.legacyId ?? entry.id),
    );
    expect(CATALOG.map((entry) => entry.id)).toEqual(
      catalog.entries.map((entry) => legacyIdMap.catalog[entry.id] ?? entry.id),
    );
    expect(stripIdentity(CATALOG)).toEqual(stripIdentity(catalog.entries));

    const glossary = projectGlossary(legacyLibrary, identity.glossary);
    expect(glossary.entries.map((entry) => entry.id)).toEqual(
      GLOSSARY.map((entry) => entry.legacyId ?? entry.id),
    );
    expect(GLOSSARY.map((entry) => entry.id)).toEqual(
      glossary.entries.map((entry) =>
        entry.english ? `glossary.${glossarySlug(entry.english)}` : entry.id,
      ),
    );
    expect(stripIdentity(GLOSSARY)).toEqual(stripIdentity(glossary.entries));
  });

  it("собирается детерминированно и проверяется без записи", () => {
    const first = makeSandbox();
    const second = makeSandbox();
    runGenerator(sandboxArgs(first));
    runGenerator(sandboxArgs(second));
    for (const name of [
      "abilities.json",
      "library.json",
      "kits.json",
      "perks.json",
      "features.json",
      "level-up.json",
      "builder.json",
    ]) {
      expect(fs.readFileSync(path.join(first.out, name), "utf8")).toBe(
        fs.readFileSync(path.join(second.out, name), "utf8"),
      );
    }
    expect(() => runGenerator(["--check"])).not.toThrow();
  });

  it("переносит правку полей канонической способности в проекцию", () => {
    const sandbox = makeSandbox();
    const file = findJsonFile(
      path.join(sandbox.content, "entities"),
      (value) => value?.ability?.name === "Маневр Захвата",
    );
    expect(file).not.toBe("");
    editJson(file, (value) => {
      value.ability.name = "Маневр Захвата (проверка)";
      value.ability.effect = "Проверочный эффект.";
      value.markdown = value.markdown.replace(
        "**Маневр Захвата**",
        "**Маневр Захвата (проверка)**",
      );
    });
    runGenerator(sandboxArgs(sandbox));
    const record = generatedAbilities(sandbox).abilities.find(
      (entry) => entry.name === "Маневр Захвата (проверка)",
    );
    expect(record).toMatchObject({
      effect: "Проверочный эффект.",
      id: "feature.ability.common.grab",
    });
    expect(withPreferredCharacteristic(record!).name).toBe(
      "Маневр Захвата (проверка)",
    );
  });

  it("переносит правку канонической статьи в каталог и глоссарий", () => {
    const sandbox = makeSandbox();
    appendArticleMarkdown(sandbox.content, "1608", "Проверка проекта.");
    editRenderedArticle(sandbox.content, "0102", (text) =>
      text.replace(
        "довод, который герои",
        "проверенный довод, который герои",
      ),
    );
    runGenerator(sandboxArgs(sandbox));
    const library = generatedLibrary(sandbox);
    const project = library.catalog.find((entry) => entry.id === "learn-new-language");
    expect(project?.markdown).toContain("Проверка проекта.");
    const term = library.glossary.find((entry) =>
      entry.markdown.includes("проверенный довод"),
    );
    expect(term).toBeDefined();
    expect(term?.id).toBe(GLOSSARY.find((entry) => entry.name === "Аргумент")?.id);
  });

  it("сохраняет ID при переименовании заголовка и отвергает неоднозначность", () => {
    const renamed = makeSandbox();
    editRenderedArticle(renamed.content, "1802", (text) =>
      text.replace(
        "#### Цветной плащ (синий)",
        "#### Цветной плащ цвета морской волны",
      ),
    );
    runGenerator(sandboxArgs(renamed));
    const renamedEntries = generatedLibrary(renamed).catalog.filter(
      (entry) => entry.articleId === "1802",
    );
    expect(renamedEntries[0].name).toBe("Цветной плащ цвета морской волны");
    expect(renamedEntries[0].legacyId).toBe(identity.catalog["1802"][0]);
    expect(renamedEntries[0].id).toBe(
      legacyIdMap.catalog[identity.catalog["1802"][0]],
    );

    const swapped = makeSandbox();
    editRenderedArticle(swapped.content, "1802", (text) =>
      text.replace("#### Цветной плащ (синий)", "#### ВРЕМЕННЫЙ"),
    );
    editRenderedArticle(swapped.content, "1802", (text) =>
      text.replace("#### Цветной плащ (красный)", "#### Цветной плащ (синий)"),
    );
    editRenderedArticle(swapped.content, "1802", (text) =>
      text.replace("#### ВРЕМЕННЫЙ", "#### Цветной плащ (красный)"),
    );
    expect(generatorFailure(sandboxArgs(swapped))).toContain(
      "порядок записей изменился",
    );

    const missing = makeSandbox();
    editJson(missing.identity, (value) => {
      delete value.catalog["1801"];
    });
    expect(generatorFailure(sandboxArgs(missing))).toContain(
      "нет записи сопоставления",
    );
  });

  it("дополняет сопоставление новой записью только явной командой", () => {
    const sandbox = makeSandbox();
    appendArticleMarkdown(
      sandbox.content,
      "1802",
      "#### Добавочное сокровище\n\n**Эффект:** Проверка.",
    );
    expect(generatorFailure(sandboxArgs(sandbox))).toContain(
      "в сопоставлении",
    );
    runGenerator([...sandboxArgs(sandbox), "--update-identity"]);
    const library = generatedLibrary(sandbox);
    const added = library.catalog.filter(
      (entry) => entry.articleId === "1802",
    );
    const existing = added.slice(0, identity.catalog["1802"].length);
    expect(existing.map((entry) => entry.legacyId)).toEqual(
      identity.catalog["1802"],
    );
    expect(existing.map((entry) => entry.id)).toEqual(
      identity.catalog["1802"].map(
        (legacyId: string) => legacyIdMap.catalog[legacyId],
      ),
    );
    expect(added[added.length - 1].name).toBe("Добавочное сокровище");
  });

  it("не меняет сохранённых героев и пользовательские правки", () => {
    const treasure = CATALOG.find((entry) => entry.name === "Зелье исцеления")!;
    let hero = createCharacter({ name: "Проверка проекций" });
    hero = addCatalogEntry(hero, treasure, "one");
    hero.abilities.push({
      ...ABILITY_COMPENDIUM[0],
      id: "custom-ability",
      name: "Моё заклинание",
      effect: "Мой эффект.",
      notes: "Моя заметка.",
    });
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(hero)));
    expect(restored.inventory).toEqual(hero.inventory);
    expect(restored.inventory[0].catalogId).toBe(treasure.id);
    expect(CATALOG.some((entry) => entry.id === restored.inventory[0].catalogId)).toBe(
      true,
    );
    expect(restored.abilities.find((ability) => ability.id === "custom-ability")).toMatchObject(
      {
        name: "Моё заклинание",
        effect: "Мой эффект.",
        notes: "Моя заметка.",
      },
    );
  });

  it("не смешивает наборы способностей и библиотеки в графе импортов", () => {
    expect(reachableGeneratedJson(path.join(ROOT, "src/data/compendium.ts"))).toEqual(
      ["src/generated/consumers/abilities.json"],
    );
    expect(reachableGeneratedJson(path.join(ROOT, "src/data/library.ts"))).toEqual(
      ["src/generated/consumers/library.json"],
    );
  });
});

describe("проекции комплектов, перков, особенностей и повышения уровня", () => {
  it("проецирует все комплекты с legacy-ID, полями и порядком", () => {
    // Включая составной 0924 «Буревестник»: его карточки хранятся прямо в
    // Markdown сущности, а не отдельными сущностями `ability`.
    expect(kitsProjection.kits).toHaveLength(22);
    expectProjectionIdentity(
      kitsProjection.kits,
      legacyKits.map((kit) => kit.id),
      legacyKits.map((kit) => legacyIdMap.kits[kit.id]),
    );
    expect(stripIdentity(kitsProjection.kits)).toEqual(
      stripIdentity(legacyKits),
    );
    expect(
      kitsProjection.kits.find((kit) => kit.id === "kit.stormwight"),
    ).toMatchObject({
      name: "Буревестник",
      signatureAbility: "Сносящая Атака",
    });
    for (const kit of kitsProjection.kits) {
      expect(kit.signatureAbility).not.toBe("");
    }
  });

  it("проецирует перки, типы карьер и ограничения классов", () => {
    expect(perksProjection.perks).toHaveLength(47);
    expectProjectionIdentity(
      perksProjection.perks,
      legacyPerks.perks.map((perk: any) => perk.id),
      legacyPerks.perks.map((perk: any) => legacyIdMap.perks[perk.id]),
    );
    for (const legacy of legacyPerks.perks) {
      const perk = perksProjection.perks.find(
        (entry) => entry.legacyId === legacy.id,
      );
      expect(perk).toMatchObject({
        id: legacyIdMap.perks[legacy.id],
        name: legacy.name,
        type: legacy.type,
        summary: legacy.summary,
      });
    }
    expect(perksProjection.careerPerkTypes).toEqual(legacyPerks.careerPerkTypes);
    expect(perksProjection.classPerkRestrictions).toEqual(
      legacyPerks.classPerkRestrictions,
    );
  });

  it("проецирует данные конструктора из канонических сущностей", () => {
    expect(stripIdentity(builderProjection)).toEqual({
      schemaVersion: 1,
      ...stripIdentity(legacyBuilder),
    });
    // Английские ID появились у записей конструктора и черт происхождений;
    // они должны быть заполнены, уникальны и совпадать с проекцией особенностей.
    const builderEntries = [
      ...builderProjection.ancestries,
      ...builderProjection.careers,
      ...builderProjection.classes,
      ...builderProjection.complications,
      ...Object.values(builderProjection.cultures).flat(),
    ];
    expect(builderEntries.every((entry) => entry.id)).toBe(true);
    expect(new Set(builderEntries.map((entry) => entry.id)).size).toBe(
      builderEntries.length,
    );
    const projectedFeatureIds = new Set(
      featuresProjection.features.map((feature) => feature.id),
    );
    for (const ancestry of builderProjection.ancestries) {
      for (const trait of ancestry.traits) {
        expect(trait.id, `${ancestry.name}: ${trait.name}`).toBeDefined();
        expect(projectedFeatureIds.has(trait.id!)).toBe(true);
      }
    }
    expect(builderProjection.ancestries).toHaveLength(14);
    expect(
      Object.values(builderProjection.cultures).flat(),
    ).toHaveLength(13);
    expect(builderProjection.careers).toHaveLength(18);
    expect(builderProjection.classes).toHaveLength(10);
    expect(builderProjection.complications).toHaveLength(100);
    // У Призывателя статьи пусты: запись остаётся, но без особенностей.
    expect(
      builderProjection.classes.find((entry) => entry.articleId === "0821"),
    ).toMatchObject({
      name: "Призыватель",
      summary: "",
      basics: "",
      features: "",
      featureChoices: [],
      subclasses: [],
    });
  });

  it("проецирует особенности происхождений и классов с legacy-ID", () => {
    const ancestry = featuresProjection.features.filter(
      (feature) => feature.kind === "ancestry",
    );
    const classes = featuresProjection.features.filter(
      (feature) => feature.kind === "class",
    );
    expectProjectionIdentity(
      ancestry,
      legacyAncestryFeatures.map((feature) => feature.id),
      legacyAncestryFeatures.map(
        (feature) => legacyIdMap.ancestryFeatures[feature.id],
      ),
    );
    // Legacy-скелет происхождений не хранил level; канон трактует все черты
    // происхождения как выбранные на 1-м уровне, поэтому проекция ставит 1.
    expect(ancestry.every((feature) => feature.level === 1)).toBe(true);
    for (const legacy of legacyAncestryFeatures) {
      const feature = ancestry.find((entry) => entry.legacyId === legacy.id);
      const englishId = legacyIdMap.ancestryFeatures[legacy.id];
      expect(feature).toMatchObject({
        id: englishId,
        name: ANCESTRY_CANONICAL_NAMES[englishId] ?? legacy.name,
        ancestryKind: legacy.kind,
        ancestryName: legacy.ancestryName,
        articleId: legacy.articleId,
        description: legacy.description,
      });
    }
    // Убеждаемся, что список известных отличий имён не разошёлся с данными.
    const actualNameDifferences = legacyAncestryFeatures
      .filter(
        (legacy) =>
          ancestry.find((entry) => entry.legacyId === legacy.id)?.name !==
          legacy.name,
      )
      .map((legacy) => legacyIdMap.ancestryFeatures[legacy.id])
      .sort();
    expect(actualNameDifferences).toEqual(
      Object.keys(ANCESTRY_CANONICAL_NAMES).sort(),
    );

    // features.json не хранит стоимость черты: она восстанавливается джойном
    // с данными конструктора в src/rules/consumer-features.ts. Переименование
    // черты или происхождения в каноне молча потеряло бы цену, поэтому каждая
    // нестандартная (≠ 2) стоимость обязана приходить из явного попадания
    // джойна, а все цены — совпадать с legacy.
    const projectedCosts = new Map(
      CONSUMER_ANCESTRY_FEATURES.map((feature) => [feature.id, feature]),
    );
    for (const legacy of legacyAncestryFeatures) {
      if (legacy.cost === undefined) continue;
      const feature = projectedCosts.get(
        legacyIdMap.ancestryFeatures[legacy.id],
      );
      expect(feature, legacy.id).toBeDefined();
      if (legacy.cost !== 2) {
        expect("cost" in feature, `${legacy.id}: явный джойн стоимости`).toBe(
          true,
        );
      }
      expect(feature?.cost ?? 2, legacy.id).toBe(legacy.cost);
    }

    const projectedLegacyIds = new Set(
      classes.map((feature) => feature.legacyId),
    );
    const projectedLegacyOrder = legacyClassFeatures
      .map((feature) => feature.id)
      .filter((id) => projectedLegacyIds.has(id));
    expectProjectionIdentity(
      classes,
      projectedLegacyOrder,
      projectedLegacyOrder.map((id) => legacyIdMap.classFeatures[id]),
    );
    const missing = legacyClassFeatures
      .filter((feature) => !projectedLegacyIds.has(feature.id))
      .map((feature) => legacyIdMap.classFeatures[feature.id])
      .sort();
    expect(missing).toEqual([...CLASS_FEATURE_LEGACY_SYNTHETIC_ROWS].sort());
    // `description` включает карточки способностей, на которые статья
    // ссылается сразу после особенности: проекция вклеивает их так же, как
    // legacy-скелет. Расхождений текста нет, поэтому сравнение полное.
    for (const legacy of legacyClassFeatures) {
      const feature = classes.find((entry) => entry.legacyId === legacy.id);
      if (!feature) continue;
      expect(feature).toMatchObject({
        id: legacyIdMap.classFeatures[legacy.id],
        name: legacy.name,
        className: legacy.className,
        level: legacy.level,
        articleId: legacy.articleId,
        description: legacy.description,
      });
    }
    // D1 добавляет особенности Призывателя; любые новые записи должны быть его.
    const legacyEnglishIds = new Set(Object.values(legacyIdMap.classFeatures));
    const extras = classes.filter(
      (feature) => !legacyEnglishIds.has(feature.id),
    );
    expect(extras.every((feature) => feature.className === "Призыватель")).toBe(
      true,
    );
  });

  it("портирует правила повышения уровня из статей 08xx", () => {
    expect(levelUpProjection.rules).toHaveLength(81);
    expect(levelUpProjection.rules.map((rule) => rule.articleId)).toEqual(
      legacyLevelUp.map((rule: any) => rule.articleId),
    );
    // ID карточек остаются прежними (`0802-f01`), а ссылки на способности
    // переводятся в английские ID через карту миграции.
    expect(
      levelUpProjection.rules.map((rule) =>
        rule.features.map((feature) => feature.id),
      ),
    ).toEqual(
      legacyLevelUp.map((rule: any) =>
        rule.features.map((feature: any) => feature.id),
      ),
    );
    expect(
      levelUpProjection.rules.map((rule) =>
        rule.abilityChoices.map((choice) => choice.id),
      ),
    ).toEqual(
      legacyLevelUp.map((rule: any) =>
        rule.abilityChoices.map((choice: any) => choice.id),
      ),
    );
    const translateAbilityIds = (ids: string[]) =>
      ids.map((id) => legacyIdMap.abilities[id] ?? id);
    const expected = legacyLevelUp.map((rule: any) => ({
      ...rule,
      abilityChoices: rule.abilityChoices.map((choice: any) => ({
        ...choice,
        abilityIds: translateAbilityIds(choice.abilityIds),
      })),
      grantedAbilities: rule.grantedAbilities.map((grant: any) => ({
        ...grant,
        abilityIds: translateAbilityIds(grant.abilityIds),
      })),
    }));
    expect(stripIdentity(levelUpProjection.rules)).toEqual(
      stripIdentity(expected),
    );
  });

  it("хранит в сопоставлении legacy-порядок новых наборов", () => {
    const canonicalClassIds = new Set(
      featuresProjection.features.map((feature) => feature.legacyId),
    );
    expect(identity.kits).toEqual(legacyKits.map((kit) => kit.id));
    expect(identity.perks).toEqual(
      legacyPerks.perks.map((perk: any) => perk.id),
    );
    expect(identity.ancestryFeatures).toEqual(
      legacyAncestryFeatures.map((feature) => feature.id),
    );
    expect(identity.classFeatures).toEqual(
      legacyClassFeatures
        .map((feature) => feature.id)
        .filter((id) => canonicalClassIds.has(id)),
    );
    // Сопоставление по-прежнему хранит legacy-ID, поэтому английский ID
    // каждой записанной особенности сверяем с картой миграции.
    const classFeatureIds = new Map(
      featuresProjection.features.map((feature) => [
        feature.legacyId,
        feature.id,
      ]),
    );
    expect(
      identity.classFeatures.map((id: string) => classFeatureIds.get(id)),
    ).toEqual(
      identity.classFeatures.map((id: string) => legacyIdMap.classFeatures[id]),
    );
    expect(identity.levelUp).toEqual(
      legacyLevelUp.map((rule) => rule.articleId),
    );
    // Порядок конструктора закреплён каноническими ID сущностей и совпадает
    // с legacy-снапшотом.
    expect(identity.builder.ancestries).toEqual(
      builderProjection.ancestries.map((entry) => `ancestry.${entry.articleId}`),
    );
    expect(identity.builder.careers).toEqual(
      builderProjection.careers.map((entry) => `career.${entry.articleId}`),
    );
    expect(identity.builder.classes).toEqual(
      builderProjection.classes.map((entry) => `class.${entry.articleId}`),
    );
    expect(identity.builder.cultures.environment).toEqual(
      builderProjection.cultures.environment.map(
        (_entry, index) => `culture.0502.${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(identity.builder.cultures.organization).toEqual(
      builderProjection.cultures.organization.map(
        (_entry, index) => `culture.0503.${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(identity.builder.cultures.upbringing).toEqual(
      builderProjection.cultures.upbringing.map(
        (_entry, index) => `culture.0504.${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(identity.builder.complications).toHaveLength(100);
  });

  it("подхватывает новые комплекты и особенности без --update-identity", () => {
    const sandbox = makeSandbox();
    const kitFile = findJsonFile(
      path.join(sandbox.content, "entities"),
      (value) => value?.kind === "kit" && value.name === "Ретиарий",
    );
    expect(kitFile).not.toBe("");
    const kit = readJson(kitFile);
    kit.id = "kit.test-burevestnik";
    kit.name = "Буревестник (проверка)";
    kit.legacyIds = ["kit-test-burevestnik"];
    fs.writeFileSync(
      path.join(path.dirname(kitFile), "kit.test-burevestnik.json"),
      JSON.stringify(kit),
    );

    const featureFile = findJsonFile(
      path.join(sandbox.content, "entities"),
      (value) => value?.kind === "feature" && value.name === "Свирепость",
    );
    expect(featureFile).not.toBe("");
    const feature = readJson(featureFile);
    feature.id = "feature.summoner.test";
    feature.name = "Испытание Призывателя";
    feature.legacyIds = ["summoner.test.feature"];
    feature.source = {
      articleId: "0821",
      path: "08. Классы/Призыватель/0821. 1-й Уровень Призывателя.md",
    };
    fs.writeFileSync(
      path.join(path.dirname(featureFile), "feature.summoner.test.json"),
      JSON.stringify(feature),
    );

    runGenerator(sandboxArgs(sandbox));
    const kits = readJson(
      path.join(sandbox.out, "kits.json"),
    ) as ConsumerKitProjection;
    expect(kits.kits.map((entry) => entry.id)).toContain(
      "kit-test-burevestnik",
    );
    expect(
      kits.kits.find((entry) => entry.id === "kit-test-burevestnik")?.name,
    ).toBe("Буревестник (проверка)");

    const features = readJson(
      path.join(sandbox.out, "features.json"),
    ) as ConsumerFeatureProjection;
    expect(
      features.features.find(
        (entry) => entry.id === "summoner.test.feature",
      ),
    ).toMatchObject({
      kind: "class",
      className: "Призыватель",
      level: 1,
      name: "Испытание Призывателя",
    });
  });

  it("переносит правки Markdown сущностей в комплекты и перки", () => {
    const sandbox = makeSandbox();
    const kitFile = findJsonFile(
      path.join(sandbox.content, "entities"),
      (value) => value?.kind === "kit" && value.name === "Ретиарий",
    );
    expect(kitFile).not.toBe("");
    const kit = readJson(kitFile);
    kit.markdown = kit.markdown.replace(
      "Вы носите легкие доспехи",
      "Вы носите тяжелые доспехи",
    );
    fs.writeFileSync(kitFile, JSON.stringify(kit));

    const perkFile = findJsonFile(
      path.join(sandbox.content, "entities"),
      (value) =>
        value?.kind === "perk" && value.name === "Странствующий мастер",
    );
    expect(perkFile).not.toBe("");
    const perk = readJson(perkFile);
    perk.markdown = perk.markdown.replace(
      "В любой день",
      "В каждый день",
    );
    fs.writeFileSync(perkFile, JSON.stringify(perk));

    runGenerator(sandboxArgs(sandbox));
    const kits = readJson(
      path.join(sandbox.out, "kits.json"),
    ) as ConsumerKitProjection;
    expect(
      kits.kits.find((entry) => entry.name === "Ретиарий")?.equipment,
    ).toContain("тяжелые доспехи");
    const perks = readJson(
      path.join(sandbox.out, "perks.json"),
    ) as ConsumerPerkProjection;
    expect(
      perks.perks.find((entry) => entry.name === "Странствующий мастер")
        ?.summary,
    ).toContain("В каждый день");
  });

  it("переносит правки сущностей в данные конструктора", () => {
    const sandbox = makeSandbox();
    const classFile = findJsonFile(
      path.join(sandbox.content, "entities"),
      (value) => value?.kind === "class" && value.name === "Неистовый",
    );
    expect(classFile).not.toBe("");
    const classEntity = readJson(classFile);
    classEntity.markdown = classEntity.markdown.replace(
      "Вы не усмиряете пыл битвы внутри себя",
      "Вы сдерживаете пыл битвы внутри себя",
    );
    fs.writeFileSync(classFile, JSON.stringify(classEntity));

    const traitFile = findJsonFile(
      path.join(sandbox.content, "entities"),
      (value) => value?.kind === "feature" && value.name === "Колючий хвост",
    );
    expect(traitFile).not.toBe("");
    const trait = readJson(traitFile);
    trait.markdown = trait.markdown.replace(
      "ваш заостренный хвост",
      "ваш проверочный хвост",
    );
    fs.writeFileSync(traitFile, JSON.stringify(trait));

    runGenerator(sandboxArgs(sandbox));
    const builder = readJson(
      path.join(sandbox.out, "builder.json"),
    ) as ConsumerBuilderProjection;
    expect(
      builder.classes.find((entry) => entry.articleId === "0801")?.summary,
    ).toContain("Вы сдерживаете пыл битвы");
    expect(
      builder.ancestries
        .find((entry) => entry.articleId === "0402")
        ?.traits.find((entry) => entry.name === "Колючий хвост")?.text,
    ).toContain("проверочный хвост");
  });

  it("требует --update-identity для нового набора", () => {
    const sandbox = makeSandbox();
    editJson(sandbox.identity, (value) => {
      delete value.kits;
    });
    expect(generatorFailure(sandboxArgs(sandbox))).toContain(
      "нет записи сопоставления для комплектов",
    );
    runGenerator([...sandboxArgs(sandbox), "--update-identity"]);
    const updated = readJson(sandbox.identity) as any;
    expect(updated.kits).toHaveLength(kitsProjection.kits.length);
  });
});
