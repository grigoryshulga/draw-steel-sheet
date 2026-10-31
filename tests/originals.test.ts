import { describe, expect, it } from "vitest";
import abilities from "../src/data/abilities.generated.json";
import classFeatures from "../src/data/class-features.generated.json";
import ancestryFeatures from "../src/data/ancestry-features.generated.json";
import kits from "../src/data/kits.generated.json";
import perks from "../src/data/perks.generated.json";
import legacy from "../src/data/legacy-ids.generated.json";
import { perkById } from "../src/data/perks";
import { ancestryFeatureById } from "../src/data/ancestry-features/skeleton";
import { mechanicsFor } from "../src/data/class-features/mechanics";
import { ancestryMechanicsFor } from "../src/data/ancestry-features/mechanics";
import { canonicalAbilityId } from "../src/data/originals";

const originalFields = (entry: Record<string, unknown>) => {
  expect(entry).toHaveProperty("originalName");
  expect(entry).toHaveProperty("originalDescription");
};

describe("английские оригиналы компендиума", () => {
  it("каждая способность хранит оригинал и канонический английский id", () => {
    for (const ability of abilities) {
      originalFields(ability);
      expect(ability.originalName.length).toBeGreaterThan(0);
      expect(ability.id).toMatch(/^[a-z0-9.-]+$/);
    }
  });

  it("классовые и происхожденческие особенности хранят оригинал", () => {
    for (const feature of classFeatures) {
      originalFields(feature);
      expect(feature.originalName.length).toBeGreaterThan(0);
    }
    for (const feature of ancestryFeatures) {
      originalFields(feature);
      expect(feature.originalName.length).toBeGreaterThan(0);
    }
  });

  it("комплекты и перки хранят оригинал", () => {
    for (const kit of kits) {
      originalFields(kit);
      expect(kit.originalName.length).toBeGreaterThan(0);
    }
    for (const perk of perks.perks) {
      originalFields(perk);
      expect(perk.originalName.length).toBeGreaterThan(0);
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

  it("старые id способностей канонизируются и не остаются в данных", () => {
    const oldAbilityId = Object.keys(legacy.abilities)[0];
    expect(canonicalAbilityId(oldAbilityId)).toBe(legacy.abilities[oldAbilityId]);
    expect(abilities.some((ability) => ability.id === oldAbilityId)).toBe(false);
  });
});
