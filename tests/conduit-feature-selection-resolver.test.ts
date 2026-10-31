import { describe, expect, it } from "vitest";
import { BUILDER_DATA, buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { activeClassFeatureEffects, activeClassFeatures } from "../src/lib/class-features";
import { classFeatureGroupsForSheet } from "../src/lib/class-feature-view";
import { featureStatBonus } from "../src/lib/feature-modifiers";
import type { Character } from "../src/types";

const choices = [
  ["conduit.prayer.destruction", "feature.conduit.level-1.prayer-of-destruction", "Молитва о разрушении", "conduit.prayer"],
  ["conduit.prayer.distance", "feature.conduit.level-1.prayer-of-distance", "Молитва о дистанции", "conduit.prayer"],
  ["conduit.prayer.soldier", "feature.conduit.level-1.prayer-of-soldiers-skill", "Молитва о мастерстве солдата", "conduit.prayer"],
  ["conduit.prayer.speed", "feature.conduit.level-1.prayer-of-speed", "Молитва о скорости", "conduit.prayer"],
  ["conduit.prayer.steel", "feature.conduit.level-1.prayer-of-steel", "Молитва о стали", "conduit.prayer"],
  ["conduit.sanctuary.bastion", "feature.conduit.level-1.bastion-ward", "Оберег бастиона", "conduit.sanctuary"],
  ["conduit.sanctuary.reaction", "feature.conduit.level-1.quickness-ward", "Оберег реакции", "conduit.sanctuary"],
  ["conduit.sanctuary.refuge", "feature.conduit.level-1.sanctuary-ward", "Оберег святилища", "conduit.sanctuary"],
  ["conduit.sanctuary.spirits", "feature.conduit.level-1.spirit-ward", "Оберег духов", "conduit.sanctuary"],
] as const;

function build(): Character {
  const conduit = BUILDER_DATA.classes.find(({ name }) => name === "Проводник")!;
  return buildCharacter({
    ...emptyBuilderDraft(), name: "Тестовый проводник", className: conduit.name,
    subclass: conduit.subclasses[0].name, characteristics: startingCharacteristics(conduit.name),
  });
}
function select(hero: Character, group: string, value: string): Character {
  return { ...hero, automation: { ...hero.automation!, classFeatureSelections: { ...hero.automation?.classFeatureSelections, [group]: value } } };
}

describe("conduit prayer and sanctuary selection aliases", () => {
  it.each(choices)("activates exactly one record for legacy, canonical, and localized alias: %s", (legacyId, featureId, name, group) => {
    for (const alias of [legacyId, featureId, name]) {
      const active = activeClassFeatures(select(build(), group, alias));
      const selectedRecords = active.filter(({ id }) => choices.some(([, candidateId,, choiceGroup]) => choiceGroup === group && id === candidateId));
      expect(selectedRecords.map(({ id }) => id)).toEqual([featureId]);
    }
  });

  it("normalizes localized names, rejects unknown values, and keeps other classes clear", () => {
    const hero = build();
    const localized = select(hero, "conduit.prayer", "  МОЛИТВА О СТАЛИ ");
    expect(activeClassFeatures(localized).filter(({ id }) => id.includes("prayer-of-")).map(({ id }) => id)).toEqual([choices[4][1]]);
    expect(classFeatureGroupsForSheet(localized).flatMap(({ features }) => features).filter(({ id }) => id === choices[4][1])).toHaveLength(1);
    const diaeresis = select(hero, "conduit.sanctuary", "Оберег святилища".replace("е", "ё"));
    expect(activeClassFeatures(diaeresis).filter(({ id }) => id.endsWith("-ward")).map(({ id }) => id)).toContain(choices[7][1]);
    expect(activeClassFeatures(select(hero, "conduit.prayer", "conduit.prayer.unknown")).some(({ id }) => id.includes("prayer-of-"))).toBe(false);
    expect(activeClassFeatures(select(hero, "conduit.prayer", "conduit.prayer.steel, conduit.prayer.speed")).some(({ id }) => id.includes("prayer-of-"))).toBe(false);
    const otherClass = { ...select(hero, "conduit.prayer", choices[4][1]), className: "Воин" };
    expect(activeClassFeatures(otherClass).some(({ id }) => id === choices[4][1])).toBe(false);
  });

  it("uses one steel or bastion effect source and gates effects when automation is disabled", () => {
    for (const [level, stamina] of [[1, 6], [4, 12], [7, 18], [10, 24]] as const) {
      const steel = { ...select(build(), "conduit.prayer", choices[4][1]), level };
      expect(featureStatBonus(steel, "stamina")).toBe(stamina);
      expect(activeClassFeatureEffects(steel).filter(({ sourceId }) => sourceId === choices[4][1])).toHaveLength(1);
      expect(activeClassFeatureEffects(steel).filter(({ sourceId }) => sourceId === "conduit.prayer.steel")).toHaveLength(0);
    }
    const bastion = select(build(), "conduit.sanctuary", choices[5][2]);
    expect(featureStatBonus(bastion, "save")).toBe(1);
    const disabled = { ...bastion, automation: { ...bastion.automation!, enabled: false } };
    expect(activeClassFeatures(disabled).some(({ id }) => id === choices[5][1])).toBe(true);
    expect(featureStatBonus(disabled, "save")).toBe(0);
    expect(featureStatBonus(disabled, "stamina")).toBe(0);
    const steel = select(build(), "conduit.prayer", choices[4][1]);
    const disabledSteel = { ...steel, automation: { ...steel.automation!, enabled: false } };
    expect(featureStatBonus(disabledSteel, "stamina")).toBe(0);
    expect(featureStatBonus(disabledSteel, "save")).toBe(0);
  });
});
