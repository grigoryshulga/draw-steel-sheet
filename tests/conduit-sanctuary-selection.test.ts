import { describe, expect, it } from "vitest";
import { CLASS_FEATURE_GROUPS } from "../src/data/class-feature-rules";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { mechanicsFor } from "../src/data/class-features/mechanics";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import { activeClassFeatures } from "../src/lib/class-features";
import type { Character } from "../src/types";

const choices = [
  ["conduit.sanctuary.bastion", "Оберег бастиона", "feature.conduit.level-1.bastion-ward"],
  ["conduit.sanctuary.reaction", "Оберег реакции", "feature.conduit.level-1.quickness-ward"],
  ["conduit.sanctuary.refuge", "Оберег святилища", "feature.conduit.level-1.sanctuary-ward"],
  ["conduit.sanctuary.spirits", "Оберег духов", "feature.conduit.level-1.spirit-ward"],
] as const;
const sanctuaryIds = choices.map(([, , stableId]) => stableId);

function built(selection: string): Character {
  return buildCharacter({
    ...emptyBuilderDraft(),
    className: "Проводник",
    level: 1,
    featureChoices: { "Оберег проводника": selection },
    characteristics: startingCharacteristics("Проводник"),
  });
}

function activeSanctuaries(character: Character): string[] {
  return activeClassFeatures(character)
    .map(({ id }) => id)
    .filter((id) => sanctuaryIds.includes(id));
}

describe("legacy conduit sanctuary selection", () => {
  it.each(choices)("buildCharacter maps %s to exactly %s", (legacyId, name, stableId) => {
    const hero = built(name);
    expect(hero.automation?.classFeatureSelections?.["conduit.sanctuary"]).toBe(legacyId);
    expect(activeSanctuaries(hero)).toEqual([stableId]);
  });

  it("removes legacy effects while keeping the choice and its mechanics on canonical records", () => {
    expect(CLASS_FEATURE_GROUPS.find(({ id }) => id === "conduit.sanctuary")).toBeUndefined();
    expect(mechanicsFor("feature.conduit.level-1.bastion-ward")?.effects).toEqual([{ kind: "field", field: "save", value: 1 }]);
    expect(GENERATED_CLASS_FEATURES.find(({ id }) => id === "feature.conduit.level-1.bastion-ward")).toBeDefined();
  });

  it("does not activate any sanctuary for absent, empty or unknown legacy selection", () => {
    const base = createCharacter({ className: "Проводник", level: 1 });
    expect(activeSanctuaries(base)).toEqual([]); // Legacy sheet without automation.
    for (const selection of ["", "conduit.sanctuary.future"]) {
      const hero = { ...base, automation: { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.sanctuary": selection } } };
      expect(activeSanctuaries(hero)).toEqual([]);
    }
  });

  it("honors selection with automation disabled and ignores it for another class", () => {
    const hero = built("Оберег духов");
    const disabled = { ...hero, automation: { ...hero.automation!, enabled: false } };
    expect(activeSanctuaries(disabled)).toEqual(["feature.conduit.level-1.spirit-ward"]);
    expect(activeSanctuaries({ ...hero, className: "Тактик" })).toEqual([]);
  });

  it("keeps unrelated skeleton records visible alongside the chosen sanctuary", () => {
    const hero = built("Оберег реакции");
    const allIds = activeClassFeatures(hero).map(({ id }) => id);
    expect(allIds).toContain("feature.conduit.level-1.quickness-ward");
    const otherConduitRecord = GENERATED_CLASS_FEATURES.find((feature) =>
      feature.className === "Проводник" && feature.level <= 1 && !sanctuaryIds.includes(feature.id),
    );
    expect(otherConduitRecord).toBeDefined();
    expect(allIds).toContain(otherConduitRecord!.id);
    expect(activeSanctuaries(hero)).toHaveLength(1);
  });
});
