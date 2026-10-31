import { describe, expect, it } from "vitest";
import builderData from "../src/data/builder.generated.json";
import {
  GENERATED_ANCESTRY_FEATURES,
  ancestryFeatureByName,
  ancestrySignatureFeatures,
  ancestryTraitFeature,
  ancestryTraitIdsFromNames,
} from "../src/data/ancestry-features/skeleton";

const LEGACY_IDS = [
  "feature.trait.devil.beast-legs",
  "feature.trait.dwarf.grounded",
  "feature.trait.dwarf.spark-off-your-skin",
  "feature.trait.wode-elf.swift",
  "feature.trait.high-elf.graceful-retreat",
  "feature.trait.human.staying-power",
  "feature.trait.memonek.lightning-nimbleness",
  "feature.trait.orc.grounded",
  "feature.trait.polder.graceful-retreat",
  "ancestry.tauros.beast-legs",
  "ancestry.tauros.grounded",
];

describe("скелет особенностей происхождений", () => {
  it("содержит каждую знаковую черту и каждую купленную черту книги", () => {
    for (const ancestry of builderData.ancestries) {
      const signatures = [
        ...ancestry.signature.matchAll(/^####\s+(.+?)\s*$/gm),
      ].map((match) => match[1]);
      expect(ancestrySignatureFeatures(ancestry.name)).toHaveLength(
        signatures.length,
      );
      for (const trait of ancestry.traits) {
        const feature = ancestryTraitFeature(ancestry.name, trait.name);
        expect(feature, `${ancestry.name} / ${trait.name}`).toBeDefined();
        expect(feature?.cost).toBe(trait.cost);
        expect(feature?.description).toBe(trait.text);
      }
    }
  });

  it("не повторяет ID и сохраняет старые ID числовых черт", () => {
    const ids = GENERATED_ANCESTRY_FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of LEGACY_IDS) expect(ids).toContain(id);
  });

  it("разрешает способности по названию черты, а не только числовые", () => {
    expect(
      ancestryTraitIdsFromNames("Рейдер Времени", [
        "Псионический дар",
        "Потустороннее зрение",
      ]),
    ).toEqual([
      "feature.trait.time-raider.psionic-gift",
      "feature.trait.time-raider.beyondsight",
    ]);
    expect(
      ancestryTraitIdsFromNames("Драконий Рыцарь", [
        "Драконья гордость",
        "Драконье дыхание",
      ]),
    ).toEqual([
      "feature.trait.dragon-knight.draconian-pride",
      "feature.trait.dragon-knight.dragon-breath",
    ]);
    expect(ancestryFeatureByName("Дьявол", "Светящиеся глаза")?.id).toBe(
      "feature.trait.devil.glowing-eyes",
    );
    expect(ancestryFeatureByName("Дьявол", "светящиеся глаза")?.id).toBe(
      "feature.trait.devil.glowing-eyes",
    );
  });
});
