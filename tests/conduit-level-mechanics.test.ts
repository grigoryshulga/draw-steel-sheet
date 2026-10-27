import { afterEach, describe, expect, it } from "vitest";
import inventory from "../docs/superpowers/specs/class-inventory/group1.json";
import { CLASS_RESOURCES } from "../src/data/class-features/class-resources";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import {
  CONDUIT_LEVEL_MECHANICS,
  CONDUIT_LEVEL_TEXT_ONLY,
} from "../src/data/class-features/mechanics/conduit-levels";
import type { FeatureMechanics } from "../src/data/class-features/types";
import { createCharacter } from "../src/lib/defaults";
import { classFeatureTriggers, invalidateClassFeatureRegistry } from "../src/lib/class-features";
import { featureDamageImmunities } from "../src/lib/feature-modifiers";
import { resolvedResourceGains } from "../src/lib/resources";

const scope = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Проводник" && feature.level >= 2 && feature.level <= 10 && feature.keyedBy !== "domain",
);
const conduit = inventory.classes.find((entry) => entry.class === "Проводник")!;
const inventoryFeature = (name: string) => conduit.features.find((feature) => feature.name === name)!;
const originalMechanics = new Map<string, FeatureMechanics | undefined>();
const originalResource = CLASS_RESOURCES["проводник"];

function registerLevelMechanics(): void {
  for (const [id, mechanics] of Object.entries(CONDUIT_LEVEL_MECHANICS)) {
    originalMechanics.set(id, FEATURE_MECHANICS[id]);
    FEATURE_MECHANICS[id] = mechanics;
  }
  CLASS_RESOURCES["проводник"] = {
    name: "Благочестие",
    gains: [
      { tag: "combat-start", event: "combat-start", amount: "= Победы", frequency: "encounter" },
      { tag: "start-of-turn", event: "start-of-turn", amount: "1d3", frequency: "turn" },
    ],
  };
  invalidateClassFeatureRegistry();
}

afterEach(() => {
  for (const [id, mechanics] of originalMechanics) {
    if (mechanics) FEATURE_MECHANICS[id] = mechanics;
    else delete FEATURE_MECHANICS[id];
  }
  originalMechanics.clear();
  if (originalResource) CLASS_RESOURCES["проводник"] = originalResource;
  else delete CLASS_RESOURCES["проводник"];
  invalidateClassFeatureRegistry();
});

describe("механики уровней Проводника", () => {
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

  it("согласует доменные выборы с level-up и не объявляет отсутствующие группы способностей", () => {
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.4.osobennost-domena-4-go-urovnya"].choice?.group).toBe("conduit.domain.4");
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.7.osobennost-domena-7-go-urovnya"].choice?.group).toBe("conduit.domain.7");
    for (const level of [2, 6, 9]) {
      expect(CONDUIT_LEVEL_MECHANICS[`conduit.feature.${level}.sposobnost-domena-${level}-go-urovnya`].choice?.group).toBe(`conduit.ability.domain.${level}`);
    }
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.2.osobennost-domena-2-go-urovnya"].kinds).toContain("grant");
    expect(CONDUIT_LEVEL_TEXT_ONLY["conduit.feature.3.maloe-chudo-minor-miracle"]).toContain("половину своих Восстановлений");
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.9.mech-very-faith-s-sword"].trigger?.detail).toContain("1 очко его Героического Ресурса за каждые 2");
    for (const id of ["conduit.feature.3.sposobnost-za-7-blagochestiya", "conduit.feature.5.sposobnost-za-9-blagochestiya", "conduit.feature.8.sposobnost-za-11-blagochestiya"]) {
      expect(CONDUIT_LEVEL_MECHANICS[id].notes).toContain("нет группы");
    }
    expect(CONDUIT_LEVEL_MECHANICS["conduit.feature.10.bozhestvennaya-sila"].notes).toContain("подключается отдельно");
  });
});
