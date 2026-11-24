import { describe, expect, it } from "vitest";
import pack from "../src/generated/rules/packs/chapter-09.json";
import { stormwightEnglishForm } from "../src/views/sheet/stormwightEnglish";

describe("stormwight English source", () => {
  it("extracts each form from the matching canonical kit without crossing headings", () => {
    const source = pack.entities.find(item => item.id === "kit.stormwight")!.originalDescription!;
    for (const [kit, animal] of [["Boren", "bear"], ["Corven", "crow"], ["Raden", "rat"], ["Vuken", "wolf"]]) {
      const animalText = stormwightEnglishForm(source, kit, "animal");
      const hybridText = stormwightEnglishForm(source, kit, "hybrid");
      expect(animalText?.toLowerCase()).toContain(animal);
      expect(hybridText?.toLowerCase()).toContain("hybrid");
      expect(animalText).not.toContain("###");
      expect(hybridText).not.toContain("###");
    }
    expect(stormwightEnglishForm(source, "unknown", "animal")).toBeUndefined();
    expect(stormwightEnglishForm(source, "Boren", "true")).toBeUndefined();
  });
});
