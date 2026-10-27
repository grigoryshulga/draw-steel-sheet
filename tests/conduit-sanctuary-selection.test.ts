import { describe, expect, it } from "vitest";
import { CLASS_FEATURE_GROUPS } from "../src/data/class-feature-rules";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import { activeClassFeatures } from "../src/lib/class-features";
import type { Character } from "../src/types";

const choices = [
  ["conduit.sanctuary.bastion", "Оберег бастиона", "conduit.feature.1.obereg-bastiona"],
  ["conduit.sanctuary.reaction", "Оберег реакции", "conduit.feature.1.obereg-reaktsii"],
  ["conduit.sanctuary.refuge", "Оберег святилища", "conduit.feature.1.obereg-svyatilishcha"],
  ["conduit.sanctuary.spirits", "Оберег духов", "conduit.feature.1.obereg-dukhov"],
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

  it("keeps the legacy bonus registry intact while selecting one skeleton record", () => {
    const group = CLASS_FEATURE_GROUPS.find(({ id }) => id === "conduit.sanctuary")!;
    expect(group.options.map(({ id }) => id)).toEqual(choices.map(([id]) => id));
    expect(group.options[0].effects).toEqual([{ kind: "field", field: "save", value: 1 }]);
    for (const [, , id] of choices.slice(1)) {
      expect(group.options.find((option) => option.id === choices.find((entry) => entry[2] === id)![0])?.effects).toEqual([]);
    }
    // The bonus remains in the old registry; this compatibility mapping does not
    // add or connect mechanics to the skeleton.
    expect(GENERATED_CLASS_FEATURES.find(({ id }) => id === "conduit.feature.1.obereg-bastiona")).toBeDefined();
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
    expect(activeSanctuaries(disabled)).toEqual(["conduit.feature.1.obereg-dukhov"]);
    expect(activeSanctuaries({ ...hero, className: "Тактик" })).toEqual([]);
  });

  it("keeps unrelated skeleton records visible alongside the chosen sanctuary", () => {
    const hero = built("Оберег реакции");
    const allIds = activeClassFeatures(hero).map(({ id }) => id);
    expect(allIds).toContain("conduit.feature.1.obereg-reaktsii");
    const otherConduitRecord = GENERATED_CLASS_FEATURES.find((feature) =>
      feature.className === "Проводник" && feature.level <= 1 && !sanctuaryIds.includes(feature.id),
    );
    expect(otherConduitRecord).toBeDefined();
    expect(allIds).toContain(otherConduitRecord!.id);
    expect(activeSanctuaries(hero)).toHaveLength(1);
  });
});
