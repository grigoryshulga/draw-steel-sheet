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
  "ancestry.devil.beast-legs",
  "ancestry.dwarf.grounded",
  "ancestry.dwarf.spark-from-your-skin",
  "ancestry.forest-elf.swift",
  "ancestry.high-elf.graceful-retreat",
  "ancestry.human.reserve-of-strength",
  "ancestry.memanek.lightning-agility",
  "ancestry.orc.grounded",
  "ancestry.polder.graceful-retreat",
  "ancestry.taurus.beast-legs",
  "ancestry.taurus.grounded",
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
      "ancestry.time-raider.psionic-gift",
      "ancestry.time-raider.beyondsight",
    ]);
    expect(
      ancestryTraitIdsFromNames("Драконий Рыцарь", [
        "Драконья гордость",
        "Драконье дыхание",
      ]),
    ).toEqual([
      "ancestry.dragon-knight.draconic-pride",
      "ancestry.dragon-knight.dragon-breath",
    ]);
    expect(ancestryFeatureByName("Дьявол", "Светящиеся глаза")?.id).toBe(
      "ancestry.devil.glowing-eyes",
    );
    expect(ancestryFeatureByName("Дьявол", "светящиеся глаза")?.id).toBe(
      "ancestry.devil.glowing-eyes",
    );
  });
});
