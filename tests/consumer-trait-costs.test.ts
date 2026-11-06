import { describe, expect, it } from "vitest";
import { CANONICAL_BUILDER_DATA } from "../src/rules/consumer-builder";
import { CONSUMER_ANCESTRY_FEATURES } from "../src/rules/consumer-features";

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");

describe("precomputed ancestry trait prices", () => {
  it("preserves every canonical builder price in the sheet projection", () => {
    for (const ancestry of CANONICAL_BUILDER_DATA.ancestries) {
      for (const trait of ancestry.traits) {
        const feature = CONSUMER_ANCESTRY_FEATURES.find((feature) =>
          normalize(feature.ancestryName) === normalize(ancestry.name) &&
          normalize(feature.name) === normalize(trait.name) && feature.ancestryKind === "trait");
        expect(feature, `${ancestry.name}: ${trait.name}`).toBeDefined();
        expect(feature?.cost).toBe(trait.cost);
      }
    }
  });

  it("does not attach a purchase price to signature traits", () => {
    for (const feature of CONSUMER_ANCESTRY_FEATURES.filter((feature) => feature.ancestryKind !== "trait")) {
      expect(feature.cost).toBeUndefined();
    }
  });
});
