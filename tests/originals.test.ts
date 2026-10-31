import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { CATALOG, GLOSSARY } from "../src/data/library";
import { KIT_COMPENDIUM } from "../src/data/kits";
import { PERK_COMPENDIUM, perkById } from "../src/data/perks";
import { ancestryFeatureById } from "../src/data/ancestry-features/skeleton";
import { mechanicsFor } from "../src/data/class-features/mechanics";
import { ancestryMechanicsFor } from "../src/data/ancestry-features/mechanics";
import {
  CONSUMER_ANCESTRY_FEATURES,
  CONSUMER_CLASS_FEATURES,
} from "../src/rules/consumer-features";
import legacy from "../src/generated/legacy-ids.json";
import { canonicalAbilityId } from "../src/data/originals";

const hasOriginal = (entry: Record<string, unknown>) => {
  expect(entry).toHaveProperty("originalName");
  expect(entry).toHaveProperty("originalDescription");
};

describe("английские оригиналы компендиума", () => {
  it("способности хранят оригинал и канонический английский id", () => {
    for (const ability of ABILITY_COMPENDIUM) {
      hasOriginal(ability);
      expect(ability.originalName?.length ?? 0).toBeGreaterThan(0);
      expect(ability.id).toMatch(/^[a-z0-9.-]+$/);
    }
  });

  it("классовые и происхожденческие особенности хранят оригинал", () => {
    for (const feature of [
      ...CONSUMER_ANCESTRY_FEATURES,
      ...CONSUMER_CLASS_FEATURES,
    ]) {
      hasOriginal(feature);
      expect(feature.originalName?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("комплекты, перки, каталог и глоссарий хранят оригинал", () => {
    for (const kit of KIT_COMPENDIUM) {
      hasOriginal(kit);
      expect(kit.originalName?.length ?? 0).toBeGreaterThan(0);
    }
    for (const perk of PERK_COMPENDIUM) {
      hasOriginal(perk);
      expect(perk.originalName?.length ?? 0).toBeGreaterThan(0);
    }
    for (const entry of CATALOG) {
      hasOriginal(entry);
      if (entry.originalId) {
        expect(entry.originalName?.length ?? 0).toBeGreaterThan(0);
      }
    }
    for (const entry of GLOSSARY) {
      hasOriginal(entry);
    }
  });

  it("старые id перков и черт происхождения разрешаются в новые записи", () => {
    const oldPerkId = Object.keys(legacy.perks)[0];
    expect(perkById(oldPerkId)?.id).toBe(legacy.perks[oldPerkId]);

    const oldFeatureId = Object.keys(legacy.ancestryFeatures)[0];
    expect(ancestryFeatureById(oldFeatureId)?.id).toBe(
      legacy.ancestryFeatures[oldFeatureId],
    );
  });

  it("старые id классовых особенностей и происхождений находят механику", () => {
    const oldFeatureId = Object.keys(legacy.classFeatures).find((id) =>
      mechanicsFor(legacy.classFeatures[id]),
    );
    expect(oldFeatureId).toBeTruthy();
    expect(mechanicsFor(oldFeatureId!)).toBe(
      mechanicsFor(legacy.classFeatures[oldFeatureId!]),
    );

    const oldAncestryId = Object.keys(legacy.ancestryFeatures).find((id) =>
      ancestryMechanicsFor(legacy.ancestryFeatures[id]),
    );
    expect(oldAncestryId).toBeTruthy();
    expect(ancestryMechanicsFor(oldAncestryId!)).toBe(
      ancestryMechanicsFor(legacy.ancestryFeatures[oldAncestryId!]),
    );
  });

  it("старые id способностей канонизируются и не остаются в проекции", () => {
    const oldAbilityId = Object.keys(legacy.abilities)[0];
    expect(canonicalAbilityId(oldAbilityId)).toBe(legacy.abilities[oldAbilityId]);
    expect(ABILITY_COMPENDIUM.some((ability) => ability.id === oldAbilityId)).toBe(
      false,
    );
  });
});
