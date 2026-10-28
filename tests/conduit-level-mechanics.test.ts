import { afterEach, describe, expect, it } from "vitest";
import inventory from "../docs/superpowers/specs/class-inventory/group1.json";
import { CLASS_RESOURCES } from "../src/data/class-features/class-resources";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { levelUpRule } from "../src/data/level-up-rules";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import {
  CONDUIT_LEVEL_MECHANICS,
  CONDUIT_LEVEL_TEXT_ONLY,
} from "../src/data/class-features/mechanics/conduit-levels";
import { CONDUIT_RESOURCE } from "../src/data/class-features/mechanics/conduit-resource";
import type { FeatureMechanics } from "../src/data/class-features/types";
import { createCharacter } from "../src/lib/defaults";
import { classFeatureTriggers, invalidateClassFeatureRegistry } from "../src/lib/class-features";
import { featureDamageImmunities } from "../src/lib/feature-modifiers";
import { resolvedResourceGains } from "../src/lib/resources";
import { getLevelUpPlan, previewLevelUp } from "../src/lib/level-up";

const scope = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Проводник" && feature.level >= 2 && feature.level <= 10 && feature.keyedBy !== "domain",
);
const conduit = inventory.classes.find((entry) => entry.class === "Проводник")!;
const inventoryFeature = (name: string) => conduit.features.find((feature) => feature.name === name)!;
const originalMechanics = new Map<string, FeatureMechanics | undefined>();
let originalResource: (typeof CLASS_RESOURCES)["проводник"] | undefined;
let resourceSnapshotTaken = false;

function registerLevelMechanics(): void {
  for (const [id, mechanics] of Object.entries(CONDUIT_LEVEL_MECHANICS)) {
    if (!originalMechanics.has(id)) originalMechanics.set(id, FEATURE_MECHANICS[id]);
    FEATURE_MECHANICS[id] = mechanics;
  }
  if (!resourceSnapshotTaken) {
    originalResource = CLASS_RESOURCES["проводник"];
    resourceSnapshotTaken = true;
  }
  CLASS_RESOURCES["проводник"] = CONDUIT_RESOURCE;
  invalidateClassFeatureRegistry();
}

afterEach(() => {
  for (const [id, mechanics] of originalMechanics) {
    if (mechanics) FEATURE_MECHANICS[id] = mechanics;
    else delete FEATURE_MECHANICS[id];
  }
  originalMechanics.clear();
  if (resourceSnapshotTaken) {
    if (originalResource) CLASS_RESOURCES["проводник"] = originalResource;
    else delete CLASS_RESOURCES["проводник"];
    originalResource = undefined;
    resourceSnapshotTaken = false;
  }
  invalidateClassFeatureRegistry();
});

describe("механики уровней Проводника", () => {
  it.each([
    [2, 3, "0833-g01", "conduit.feature.3.sposobnost-za-7-blagochestiya"],
    [4, 5, "0835-g01", "conduit.feature.5.sposobnost-za-9-blagochestiya"],
    [7, 8, "0838-g01", "conduit.feature.8.sposobnost-za-11-blagochestiya"],
  ] as const)("предлагает и принимает настоящую способность Проводника при переходе %i→%i", (fromLevel, toLevel, groupId, featureId) => {
    const domains = "Жизнь, Защита";
    const selections: Record<string, string> = { "conduit.domain": domains };
    if (fromLevel >= 4) selections["conduit.domain.4"] = "Жизнь";
    if (fromLevel >= 7) selections["conduit.domain.7"] = "Защита";
    const hero = createCharacter({ className: "Проводник", level: fromLevel });
    hero.subclass = domains;
    hero.xp = 160;
    hero.automation = { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: selections };

    const sourceGroup = levelUpRule("Проводник", toLevel)?.abilityChoices.find((group) => group.id === groupId);
    expect(sourceGroup, groupId).toBeDefined();
    const plan = getLevelUpPlan(hero);
    expect(plan.available, plan.reason).toBe(true);
    const choice = plan.choices.find((entry) => entry.id === groupId);
    expect(choice?.options.map((option) => option.id).sort()).toEqual([...sourceGroup!.abilityIds].sort());
    for (const id of sourceGroup!.abilityIds) {
      expect(ABILITY_COMPENDIUM.find((ability) => ability.id === id)).toMatchObject({ className: "Проводник", sourceKind: "class" });
    }

    const picks = Object.fromEntries(plan.choices.map((entry) => [entry.id, entry.options.slice(0, entry.count).map((option) => option.id)]));
    const selectedId = choice!.options[0].id;
    picks[groupId] = [selectedId];
    const preview = previewLevelUp(hero, {
      characterId: hero.id, fromLevel, className: "Проводник", subclass: domains,
      mode: "milestone", choices: picks, reviewedRules: true,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error(preview.issues.join("; "));
    expect(preview.next.level).toBe(toLevel);
    expect(preview.next.abilities.some((ability) => ability.id === selectedId)).toBe(true);
    expect(preview.next.advancements?.[0].choices[groupId]).toEqual([selectedId]);
    expect(CONDUIT_LEVEL_MECHANICS[featureId].notes).not.toContain("нет группы");
  });

  it("покрывает ровно 32 недоменные записи, а текстовые причины даны по-русски", () => {
    const covered = new Set([...Object.keys(CONDUIT_LEVEL_MECHANICS), ...Object.keys(CONDUIT_LEVEL_TEXT_ONLY)]);
    expect(scope).toHaveLength(32);
    expect([...covered].sort()).toEqual(scope.map(({ id }) => id).sort());
    expect(Object.keys(CONDUIT_LEVEL_MECHANICS).filter((id) => id in CONDUIT_LEVEL_TEXT_ONLY)).toEqual([]);
    for (const [id, reason] of Object.entries(CONDUIT_LEVEL_TEXT_ONLY)) {
      expect(CONDUIT_LEVEL_MECHANICS[id], id).toBeUndefined();
      expect(reason.trim(), id).not.toBe("");
      expect(reason, id).toMatch(/[А-Яа-яЁё]/);
    }
  });

  it("сверяет ключевые факты с текстом скелета и group1 inventory", () => {
    expect(CONDUIT_RESOURCE.gains.map(({ label }) => label)).toEqual([
      "Начало боевой встречи или стрессовой ситуации",
      "Начало твоего хода в бою",
    ]);
    expect(CONDUIT_RESOURCE.epic).toMatchObject({
      name: "Божественная сила",
      level: 10,
      gains: [{ amount: "= Опыт", label: "Завершаешь отдых" }],
    });
    const skeleton = (id: string) => scope.find((feature) => feature.id === id)!;
    const faithful = "conduit.feature.7.nagrada-veruyushchego-faithful-s-reward";
    const faithfulText = skeleton(faithful).description;
    const reward = inventoryFeature("Награда верующего (Faithful's Reward)");
    const pietyBase = inventoryFeature("Благочестие");
    const baseTurnGain = pietyBase.resource?.gains.find((gain) => gain.trigger.includes("ход"));
    expect(baseTurnGain).toMatchObject({ amount: "1d3", upgrades: "L7 Награда верующего: 1d3 + 1" });
    expect(faithfulText).toContain("1d3 + 1");
    expect(reward.notes).toContain("1d3 + 1");
    expect(CONDUIT_LEVEL_MECHANICS[faithful].resource?.gains).toEqual([
      { tag: "start-of-turn", event: "start-of-turn", amount: "1d3 + 1", frequency: "turn", replaces: ["start-of-turn"] },
    ]);
    const base = CONDUIT_LEVEL_MECHANICS[faithful].resource!.gains[0];
    expect(base.amount).toBe("1d3 + 1");
    expect(base.replaces).toContain("start-of-turn");
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.10.samyy-blagochestivyy"].resource?.gains[0]).toMatchObject({
      tag: "prayer-bonus", event: "start-of-turn", amount: "1", frequency: "turn",
    });
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.10.samyy-blagochestivyy"].resource?.gains[0].replaces).toBeUndefined();
    expect(skeleton("conduit.feature.10.samyy-blagochestivyy").description).toContain("молитесь");
    expect(inventoryFeature("Самый благочестивый").notes).toContain("при молитве в начале хода +1 благочестие");
    const blessedDomains = inventoryFeature("Благословенные домены (Blessed Domain)");
    expect(blessedDomains.notes).toContain("+1 благочестие при получении благочестия от эффекта домена");
    const blessed = CONDUIT_LEVEL_MECHANICS["conduit.feature.4.blagoslovennye-domeny-blessed-domain"];
    expect(blessed.kinds).not.toContain("resourceGain");
    expect(blessed.resource).toBeUndefined();
    expect(blessed.trigger).toMatchObject({
      event: "passive", frequency: "always", label: "Получаешь Благочестие от эффекта домена",
      detail: "Когда вы получаете Благочестие от эффекта домена, получаете ещё +1 Благочестие.",
    });
    expect(blessed.notes).toContain("не поддерживает событие получения ресурса от эффекта домена");
    expect(blessed.notes).toContain("не включена как постоянное начисление");
    expect(blessed.resource?.gains).toBeUndefined();
    const lists = CONDUIT_LEVEL_MECHANICS["conduit.feature.2.spiski-nebes-the-lists-of-heaven"].trigger!;
    expect(lists.label).toBe("Существо тратит Восстановление");
    expect(lists.detail).toContain("другому существу потратить Восстановление");
    expect(lists.event).toBe("spend-recovery");
    expect(lists.frequency).toBe("always");
  });

  it("реально применяет замену базового броска уровня 7 и сохраняет отдельный бонус уровня 10", () => {
    registerLevelMechanics();
    const hero = createCharacter({ className: "Проводник", level: 10 });
    const gains = resolvedResourceGains(hero);
    expect(gains.filter((gain) => gain.event === "start-of-turn")).toEqual([
      expect.objectContaining({ tag: "start-of-turn", amount: "1d3 + 1", sourceId: "conduit.feature.7.nagrada-veruyushchego-faithful-s-reward" }),
      expect.objectContaining({ tag: "prayer-bonus", amount: "1", sourceId: "conduit.feature.10.samyy-blagochestivyy" }),
    ]);
    expect(gains.filter((gain) => gain.tag === "start-of-turn")).toHaveLength(1);
  });

  it("моделирует Расцветающего святого выбором одного иммунитета и показывает damage-trigger", () => {
    registerLevelMechanics();
    const feature = CONDUIT_LEVEL_MECHANICS["conduit.feature.6.rastsvetayushchiy-svyatoy"];
    const description = scope.find(({ id }) => id === "conduit.feature.6.rastsvetayushchiy-svyatoy")!.description;
    expect(description).toContain("можете потратить Восстановление");
    expect(feature.trigger).toMatchObject({ event: "deal-damage", detail: expect.stringContaining("потратить Восстановление") });
    expect(feature.choice?.options).toEqual([{ id: "corruption", label: "Порча 10" }, { id: "holy", label: "Святой урон 10" }]);
    expect(feature.effects).toHaveLength(2);
    expect(feature.effects?.[0]).toMatchObject({ kind: "damageImmunity", types: ["порча"], value: 10, when: { keyValue: ["corruption"] } });
    expect(feature.effects?.[1]).toMatchObject({ kind: "damageImmunity", types: ["святой"], value: 10, when: { keyValue: ["holy"] } });
    expect(feature.notes).toContain("доступен в интерфейсе классовых особенностей");

    const hero = createCharacter({ className: "Проводник", level: 6 });
    hero.automation = { enabled: true, classFeatureSelections: { "conduit.blooming-saint-immunity": "corruption" } };
    const active = featureDamageImmunities(hero);
    expect(active).toEqual([expect.objectContaining({ types: ["порча"], value: 10 })]);
    hero.automation.classFeatureSelections["conduit.blooming-saint-immunity"] = "holy";
    expect(featureDamageImmunities(hero)).toEqual([expect.objectContaining({ types: ["святой"], value: 10 })]);

    const triggers = classFeatureTriggers(hero);
    expect(triggers).toContainEqual(expect.objectContaining({ featureId: "conduit.feature.6.rastsvetayushchiy-svyatoy", event: "deal-damage" }));
  });

  it("без выбора у Расцветающего святого нет иммунитета, а L4 напоминание есть в триггерах", () => {
    registerLevelMechanics();
    const hero = createCharacter({ className: "Проводник", level: 6 });
    hero.automation = { enabled: true, classFeatureSelections: {} };

    expect(featureDamageImmunities(hero)).toEqual([]);

    const level4Hero = createCharacter({ className: "Проводник", level: 4 });
    const triggers = classFeatureTriggers(level4Hero);
    expect(triggers).toContainEqual(expect.objectContaining({
      featureId: "conduit.feature.4.blagoslovennye-domeny-blessed-domain",
      event: "passive",
      detail: expect.stringContaining("получаете ещё +1 Благочестие"),
    }));
  });

  it("согласует доменные выборы с повышением уровня и проверяет понятные заметки способностей и ресурса", () => {
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.4.osobennost-domena-4-go-urovnya"].choice?.group).toBe("conduit.domain.4");
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.7.osobennost-domena-7-go-urovnya"].choice?.group).toBe("conduit.domain.7");
    for (const level of [2, 6, 9]) {
      expect(CONDUIT_LEVEL_MECHANICS[`conduit.feature.${level}.sposobnost-domena-${level}-go-urovnya`].choice?.group).toBe(`conduit.ability.domain.${level}`);
    }
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.2.osobennost-domena-2-go-urovnya"].kinds).toContain("grant");
    expect(CONDUIT_LEVEL_TEXT_ONLY["conduit.feature.3.maloe-chudo-minor-miracle"]).toContain("половину своих Восстановлений");
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.9.mech-very-faith-s-sword"].trigger?.detail).toContain("1 очко его Героического Ресурса за каждые 2");
    const abilityNotes = [
      ["conduit.feature.3.sposobnost-za-7-blagochestiya", "3-го", "7 Благочестия"],
      ["conduit.feature.5.sposobnost-za-9-blagochestiya", "5-го", "9 Благочестия"],
      ["conduit.feature.8.sposobnost-za-11-blagochestiya", "8-го", "11 Благочестия"],
    ] as const;
    for (const [featureId, level, cost] of abilityNotes) {
      const notes = CONDUIT_LEVEL_MECHANICS[featureId].notes!;
      expect(notes).toContain(`до ${level} уровня`);
      expect(notes).toContain(`стоимостью ${cost}`);
      expect(notes).toContain("выбор доступен в списке способностей");
      expect(notes).toContain("Благочестие тратится отдельно");
      expect(notes).not.toMatch(/083[358]-g01|CONDUIT_RESOURCE|ResourceGain/);
    }
    const divinePowerNotes = CONDUIT_LEVEL_MECHANICS["conduit.feature.10.bozhestvennaya-sila"].notes!;
    expect(divinePowerNotes).toContain("После каждого отдыха");
    expect(divinePowerNotes).toContain("количестве Опыта, полученного после этого отдыха");
    expect(divinePowerNotes).toContain("остаток нужно учитывать вручную");
    expect(divinePowerNotes).toContain("можно тратить как Благочестие");
    expect(divinePowerNotes).not.toMatch(/CONDUIT_RESOURCE|ResourceGain/);
  });
});
