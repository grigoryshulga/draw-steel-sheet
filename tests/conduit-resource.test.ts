import { afterEach, beforeEach, describe, expect, it } from "vitest";
import generated from "../src/data/class-features.generated.json";
import { CLASS_RESOURCES } from "../src/data/class-features/class-resources";
import { NOT_YET, TEXT_ONLY } from "../src/data/class-features/mechanics/exceptions";
import { normalizeFeatureText } from "../src/lib/utils";
import { CONDUIT_DOMAIN_PRAYERS } from "../src/data/class-features/mechanics/conduit-domains";
import { CONDUIT_DOMAIN_MECHANICS } from "../src/data/class-features/mechanics/conduit-domains";
import { CONDUIT_BASE_MECHANICS, CONDUIT_BASE_TEXT_ONLY } from "../src/data/class-features/mechanics/conduit-base";
import { CONDUIT_LEVEL_TEXT_ONLY } from "../src/data/class-features/mechanics/conduit-levels";
import { FEATURE_MECHANICS, mechanicsFor } from "../src/data/class-features/mechanics";
import { CONDUIT_LEVEL_MECHANICS } from "../src/data/class-features/mechanics/conduit-levels";
import { CONDUIT_RESOURCE, CONDUIT_RESOURCE_MECHANICS } from "../src/data/class-features/mechanics/conduit-resource";
import { canonicalClassFeatureId } from "../src/data/originals";
import { invalidateClassFeatureRegistry } from "../src/lib/class-features";
import { createCharacter } from "../src/lib/defaults";
import { resolvedEpicResourceGains, resolvedResourceGains, resourceGainLabels } from "../src/lib/resources";
import { markTrigger } from "../src/lib/runtime";
import { BUILDER_DATA, buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { classFeatureGroupsForSheet } from "../src/lib/class-feature-view";
import { featureDamageImmunities } from "../src/lib/feature-modifiers";

let originalMechanics: typeof FEATURE_MECHANICS;
let originalResources: typeof CLASS_RESOURCES;

function restoreRegistry(mechanics = originalMechanics, resources = originalResources) {
  for (const id of Object.keys(FEATURE_MECHANICS)) delete FEATURE_MECHANICS[id];
  Object.assign(FEATURE_MECHANICS, mechanics);
  for (const id of Object.keys(CLASS_RESOURCES)) delete CLASS_RESOURCES[id];
  Object.assign(CLASS_RESOURCES, resources);
  invalidateClassFeatureRegistry();
}

beforeEach(() => {
  originalMechanics = { ...FEATURE_MECHANICS };
  originalResources = { ...CLASS_RESOURCES };
});

function installTemporaryData() {
  Object.assign(FEATURE_MECHANICS, CONDUIT_RESOURCE_MECHANICS, CONDUIT_LEVEL_MECHANICS);
  for (const [id, mechanic] of Object.entries(CONDUIT_DOMAIN_PRAYERS)) FEATURE_MECHANICS[id] = mechanic;
  CLASS_RESOURCES["проводник"] = CONDUIT_RESOURCE;
  invalidateClassFeatureRegistry();
}

afterEach(() => {
  restoreRegistry();
});

function hero(level: number, domains = "Жизнь, Солнце", enabled = true) {
  const character = createCharacter({ className: "Проводник", level });
  character.victories = 3;
  character.experience = 5;
  character.automation = { enabled, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": domains } };
  return character;
}

const gains = (level: number, domains?: string, enabled?: boolean) => {
  installTemporaryData();
  return resolvedResourceGains(hero(level, domains, enabled));
};

describe("Проводник: Благочестие и Божественная сила", () => {
  it("проверяет подключённое production wiring через настоящую сборку и старый лист", () => {
    const conduitIds = generated.filter((feature) => feature.className === "Проводник").map((feature) => feature.id);
    expect(conduitIds).toHaveLength(141);
    expect(new Set(conduitIds).size).toBe(141);
    for (const id of conduitIds) {
      const mechanic = mechanicsFor(id);
      const reason = TEXT_ONLY[id];
      expect(Boolean(mechanic) !== Boolean(reason)).toBe(true);
      if (reason !== undefined) expect(reason.trim().length).toBeGreaterThan(0);
    }
    expect(NOT_YET["Проводник"]).toBeUndefined();
    expect(CLASS_RESOURCES[normalizeFeatureText("Проводник")]).toBe(CONDUIT_RESOURCE);

    // Явная допустимая пара: не полагаться на порядок списка доменов в builder.
    const domains = ["Жизнь", "Солнце"];
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Проводник production wiring",
      className: "Проводник",
      subclass: domains.join(", "),
      conduitDomainFeature: domains[0],
      level: 7,
      characteristics: startingCharacteristics("Проводник"),
    });
    // Старые листы хранят пару доменов в subclass; подтверждаем сохраненные выборы
    // особенностей на 1, 4 и 7 уровнях (на 4 и 7 можно выбрать любой из пары).
    const legacy = {
      ...built,
      level: 7,
      automation: {
        ...built.automation!,
        classFeatureSelections: {
          ...built.automation?.classFeatureSelections,
          "conduit.domain.4": "Жизнь",
          "conduit.domain.7": "Солнце",
        },
      },
    };
    expect(legacy.automation?.classFeatureSelections?.["conduit.domain"]).toBe(domains.join(", "));
    const groups = classFeatureGroupsForSheet(legacy);
    const featureIds = groups.flatMap(({ features }) => features.map(({ id }) => id));
    const selectedDomainFeatures = [
      generated.find((feature) => feature.id === "feature.conduit.level-1.revitalizing-ritual"),
      generated.find((feature) => feature.id === "feature.conduit.level-4.4th-level-domain-feature.life"),
      generated.find((feature) => feature.id === "feature.conduit.level-7.light-of-the-burning-sun"),
    ];
    expect(selectedDomainFeatures.every(Boolean)).toBe(true);
    for (const feature of selectedDomainFeatures) expect(featureIds).toContain(feature!.id);
    const gains = resolvedResourceGains(legacy);
    expect(gains.filter(({ tag }) => tag === "start-of-turn").map(({ amount }) => amount)).toEqual(["1d3 + 1"]);
    expect(gains.filter(({ tag }) => tag.startsWith("conduit-piety-domain-")).map(({ amount }) => amount)).toEqual(["3", "3"]);
    const domainLabels = resourceGainLabels(legacy).filter(({ tag }) => tag.startsWith("conduit-piety-domain-")).map(({ label }) => label);
    expect(domainLabels).toHaveLength(2);
    for (const domain of domains) expect(domainLabels).toContainEqual(expect.stringContaining(`Домен ${domain}:`));

    // При миграции старого листа выборы особенностей могут отсутствовать:
    // пара из subclass всё равно задаёт ровно два доменных gain.
    const legacyWithoutSelections = {
      ...legacy,
      automation: { ...legacy.automation!, classFeatureSelections: undefined },
    };
    const fallbackGains = resolvedResourceGains(legacyWithoutSelections);
    expect(fallbackGains.filter(({ tag }) => tag.startsWith("conduit-piety-domain-")).map(({ tag }) => tag)).toEqual([
      "conduit-piety-domain-жизнь", "conduit-piety-domain-солнце",
    ]);
    const fallbackFeatureIds = classFeatureGroupsForSheet(legacyWithoutSelections).flatMap(({ features }) => features.map(({ id }) => id));
    for (const feature of selectedDomainFeatures) expect(fallbackFeatureIds).not.toContain(feature!.id);

    const selected = { ...legacy, automation: { ...legacy.automation!, classFeatureSelections: { ...legacy.automation?.classFeatureSelections, "conduit.blooming-saint-immunity": "corruption" } } };
    expect(featureDamageImmunities(selected).some(({ value }) => value === 10)).toBe(true);
    const disabled = { ...selected, automation: { ...selected.automation!, enabled: false } };
    expect(resolvedResourceGains(disabled)).toEqual(gains);
    expect(resourceGainLabels(disabled).filter(({ tag }) => tag.startsWith("conduit-piety-domain-")).map(({ amount }) => amount)).toEqual(["3", "3"]);
    expect(featureDamageImmunities(disabled)).toEqual([]);
    expect(disabled.automation?.enabled).toBe(false);
  });

  it("разбивает все 141 записи Проводника на непересекающиеся авторские разделы", () => {
    const partitions = [
      Object.keys(CONDUIT_BASE_MECHANICS), Object.keys(CONDUIT_BASE_TEXT_ONLY),
      Object.keys(CONDUIT_RESOURCE_MECHANICS), Object.keys(CONDUIT_LEVEL_MECHANICS),
      Object.keys(CONDUIT_LEVEL_TEXT_ONLY), Object.keys(CONDUIT_DOMAIN_MECHANICS),
      Object.keys(CONDUIT_DOMAIN_PRAYERS),
    ];
    const ids = partitions.flat().map(canonicalClassFeatureId);
    expect(new Set(ids).size).toBe(ids.length);
    const conduitIds = generated.filter((feature) => feature.className === "Проводник").map((feature) => feature.id);
    expect(conduitIds).toHaveLength(141);
    expect([...ids].sort()).toEqual(conduitIds.sort());
  });

  it("describes all four base skeleton entries without turning optional prayer into automatic gains", () => {
    const ids = [
      "feature.conduit.level-1.piety",
      "feature.conduit.level-1.piety-in-combat",
      "feature.conduit.level-1.piety-outside-of-combat",
      "feature.conduit.level-1.domain-piety-and-effects",
    ];
    for (const id of ids) expect(generated.find((feature) => feature.id === id)).toBeTruthy();
    expect(Object.keys(CONDUIT_RESOURCE_MECHANICS).map(canonicalClassFeatureId)).toEqual(ids);
    expect(mechanicsFor(ids[0])!.notes).toContain("в количестве Побед");
    expect(mechanicsFor(ids[0])!.notes).not.toContain("получает Победы");
    expect(mechanicsFor(ids[3])!.notes).toContain("одно событие может активировать оба");
    const prayer = mechanicsFor(ids[1])!.trigger!;
    expect(prayer.event).toBe("start-of-turn");
    expect(prayer.frequency).toBe("turn");
    expect(prayer.detail).toContain("молиться");
    expect(prayer.detail).toContain("решите, молиться ли");
    expect(prayer.detail).toContain("один бросок 1d3");
    expect(prayer.detail).toContain("отдельного броска для молитвы нет");
    expect(prayer.detail).toContain("не выполняются автоматически");
    expect(prayer.detail).toContain("1d6 + уровень");
    expect(prayer.detail).toContain("на 1");
    expect(prayer.detail).toContain("на 2");
    expect(prayer.detail).toContain("на 3");
    expect(CONDUIT_RESOURCE.gains.map(({ tag, event, amount, frequency }) => ({ tag, event, amount, frequency }))).toEqual([
      { tag: "combat-start", event: "combat-start", amount: "= Победы", frequency: "encounter" },
      { tag: "start-of-turn", event: "start-of-turn", amount: "1d3", frequency: "turn" },
    ]);
    expect(CONDUIT_RESOURCE.gains.some((gain) => /prayer|молитв/i.test(gain.tag))).toBe(false);
    expect(CONDUIT_RESOURCE_MECHANICS[ids[0]].resource).toBeUndefined();
    expect(CONDUIT_RESOURCE_MECHANICS[ids[0]].kinds).toEqual(["situational"]);
    expect(mechanicsFor(ids[1])!.trigger?.event).toBe("start-of-turn");
  });

  it("restores a pre-existing record at a domain ID after temporary installation", () => {
    const id = Object.keys(CONDUIT_DOMAIN_PRAYERS)[0];
    const record = { kinds: ["situational" as const], notes: "existing domain record" };
    FEATURE_MECHANICS[id] = record;
    const snapshot = { ...FEATURE_MECHANICS };
    installTemporaryData();
    expect(FEATURE_MECHANICS[id]).not.toBe(record);

    restoreRegistry(snapshot, { ...CLASS_RESOURCES });
    expect(FEATURE_MECHANICS[id]).toBe(record);
  });

  it.each([
    [1, "1d3", "start-of-turn"],
    [4, "1d3", "start-of-turn"],
    [7, "1d3 + 1", "start-of-turn"],
    [10, "1d3 + 1", "start-of-turn"],
  ] as const)("resolves the complete level %i gain list through the real resource resolver", (level, amount, tag) => {
    const resolved = gains(level);
    const level10 = level === 10;
    expect(resolved.map(({ tag: gainTag, event, amount: gainAmount, frequency, sourceId }) => ({
      tag: gainTag, event, amount: gainAmount, frequency, sourceId,
    }))).toEqual([
      { tag: "combat-start", event: "combat-start", amount: "= Победы", frequency: "encounter", sourceId: "class:проводник" },
      ...(level < 7 ? [{ tag, event: "start-of-turn", amount, frequency: "turn", sourceId: "class:проводник" }] : []),
      { tag: "conduit-piety-domain-жизнь", event: "spend-recovery", amount: level >= 4 ? "3" : "2", frequency: "encounter", sourceId: "feature.conduit.level-1.domain-piety-and-effects.life" },
      { tag: "conduit-piety-domain-солнце", event: "deal-damage", amount: level >= 4 ? "3" : "2", frequency: "encounter", sourceId: "feature.conduit.level-1.domain-piety-and-effects.sun" },
      ...(level >= 7 ? [{ tag, event: "start-of-turn", amount, frequency: "turn", sourceId: "feature.conduit.level-7.faithfuls-reward" }] : []),
      ...(level10 ? [{ tag: "prayer-bonus", event: "start-of-turn", amount: "1", frequency: "turn", sourceId: "feature.conduit.level-10.most-pious" }] : []),
    ]);
    expect(resolved.filter((gain) => gain.tag === "combat-start")).toHaveLength(1);
    expect(resolved.filter((gain) => gain.tag === "start-of-turn")).toHaveLength(1);
    expect(resolved.filter((gain) => gain.tag === "prayer-bonus")).toHaveLength(level10 ? 1 : 0);
    expect(resolved.filter((gain) => gain.tag.startsWith("conduit-piety-domain-")).map((gain) => gain.tag)).toEqual([
      "conduit-piety-domain-жизнь", "conduit-piety-domain-солнце",
    ]);
  });

  it.each([1, 3, 4, 7, 10] as const)("resolves domain piety as 2 through level 3 and 3 from level 4 (level %i)", (level) => {
    const resolved = gains(level, "Жизнь, Солнце").filter((gain) => gain.tag.startsWith("conduit-piety-domain-"));
    expect(resolved).toHaveLength(2);
    expect(resolved.every((gain) => gain.tag === "conduit-piety-domain-жизнь" || gain.tag === "conduit-piety-domain-солнце")).toBe(true);
    expect(resolved.map((gain) => gain.amount)).toEqual(level < 4 ? ["2", "2"] : ["3", "3"]);
    const labels = resourceGainLabels(hero(level, "Жизнь, Солнце"));
    expect(labels.filter((gain) => gain.tag.startsWith("conduit-piety-domain-")).map((gain) => gain.amount)).toEqual(level < 4 ? ["2", "2"] : ["3", "3"]);
  });

  it("replaces the level 1 turn tag at level 7 and exposes the level 10 prayer reminder", () => {
    const level7 = gains(7);
    expect(level7.filter((gain) => gain.tag === "start-of-turn")).toHaveLength(1);
    expect(level7.filter((gain => gain.tag === "start-of-turn")).map((gain) => gain.sourceId)).toEqual(["feature.conduit.level-7.faithfuls-reward"]);
    expect(level7.some((gain) => gain.tag === "prayer-bonus")).toBe(false);
    const level10 = gains(10);
    expect(level10.filter((gain) => gain.tag === "start-of-turn")).toHaveLength(1);
    expect(level10.filter((gain) => gain.tag === "prayer-bonus").map(({ amount, event, frequency }) => ({ amount, event, frequency }))).toEqual([{ amount: "1", event: "start-of-turn", frequency: "turn" }]);
    expect(CONDUIT_LEVEL_MECHANICS["feature.conduit.level-10.most-pious"].notes).toContain("если молишься");
  });

  it("resolves only the two selected domain gains, with book events and encounter frequency", () => {
    const resolved = gains(1, "Созидание, Солнце").filter((gain) => gain.tag.startsWith("conduit-piety-domain-"));
    expect(resolved.map(({ tag, event, amount, frequency, label, sourceId }) => ({ tag, event, amount, frequency, label, sourceId }))).toEqual([
      { tag: "conduit-piety-domain-созидание", event: "use-ability", amount: "2", frequency: "encounter", label: expect.stringContaining("Домен Созидание:"), sourceId: "feature.conduit.level-1.domain-piety-and-effects.creation" },
      { tag: "conduit-piety-domain-солнце", event: "deal-damage", amount: "2", frequency: "encounter", label: expect.stringContaining("Домен Солнце:"), sourceId: "feature.conduit.level-1.domain-piety-and-effects.sun" },
    ]);
    const invalid = gains(1, "Созидание, Фейковый домен");
    expect(invalid.filter((gain) => gain.tag.startsWith("conduit-piety-domain-")).map((gain) => gain.tag)).toEqual([]);
    expect(gains(1, "Жизнь, Солнце").filter((gain) => gain.tag.startsWith("conduit-piety-domain-")).map((gain) => gain.tag)).toEqual(["conduit-piety-domain-жизнь", "conduit-piety-domain-солнце"]);
    const level4 = gains(4, "Созидание, Солнце").filter((gain) => gain.tag.startsWith("conduit-piety-domain-"));
    expect(level4.map((gain) => gain.amount)).toEqual(["3", "3"]);
    for (const mechanic of Object.values(CONDUIT_DOMAIN_PRAYERS)) {
      if (mechanic.resource?.gains.some((gain) => gain.amountByLevel?.some((step) => step.level === 4))) {
        expect(mechanic.trigger?.detail).not.toMatch(/добавляет 1 благочестие/i);
      }
    }
  });

  it("показывает combat-start в панели как равенство Побед", () => {
    installTemporaryData();
    expect(resourceGainLabels(hero(1)).find((gain) => gain.tag === "combat-start")?.amount).toBe("= Победы");
  });

  it("keeps the epic pool closed below 10 and grants experience at respite from level 10", () => {
    installTemporaryData();
    expect(resolvedEpicResourceGains(hero(9))).toEqual([]);
    expect(resolvedEpicResourceGains(hero(10)).map(({ tag, event, amount, frequency, sourceId, sourceName }) => ({ tag, event, amount, frequency, sourceId, sourceName }))).toEqual([
      { tag: "divine-power-respite", event: "respite", amount: "= Опыт", frequency: "respite", sourceId: "class:проводник", sourceName: "Божественная сила" },
    ]);
    expect(CONDUIT_LEVEL_MECHANICS["feature.conduit.level-10.divine-power"].notes).toContain("в количестве Опыта, полученного после этого отдыха");
    expect(CONDUIT_LEVEL_MECHANICS["feature.conduit.level-10.divine-power"].notes).toContain("сохраняется, пока вы его не потратите");
  });

  it("keeps the gains visible with automation disabled and preserves saved usage state", () => {
    installTemporaryData();
    const saved = markTrigger(hero(10, "Жизнь, Солнце", false), "start-of-turn", true, "turn");
    saved.runtime!.resources["Благочестие"] = 6;
    const resourceLabels = resourceGainLabels(saved);
    expect(resourceLabels.find((gain) => gain.tag === "start-of-turn")?.used).toBe(true);
    expect(resourceLabels.filter((gain) => gain.tag.startsWith("conduit-piety-domain-")).map((gain) => gain.amount)).toEqual(["3", "3"]);
    expect(resolvedResourceGains(saved).some((gain) => gain.tag === "combat-start")).toBe(true);
    expect(saved.runtime?.resources["Благочестие"]).toBe(6);
    expect(saved.automation?.enabled).toBe(false);
  });
});
