import { describe, expect, it } from "vitest";
import builderData from "../src/data/builder.generated.json";
import {
  ANCESTRY_FEATURE_RULES,
  ancestryTraitIdsFromNames,
} from "../src/data/ancestry-feature-rules";

const expected = [
  ["feature.trait.devil.beast-legs", "Дьявол", "Звериные ноги", [{ kind: "field", field: "speed", value: 1, stackingGroup: "ancestry.base-speed" }]],
  ["feature.trait.dwarf.grounded", "Дварф", "Заземленность", [{ kind: "field", field: "stability", value: 1 }]],
  ["feature.trait.dwarf.spark-off-your-skin", "Дварф", "Искра с твоей кожи", [{ kind: "field", field: "stamina", value: 0, perEchelon: 6 }]],
  ["feature.trait.wode-elf.swift", "Лесной Эльф", "Стремительный", [{ kind: "field", field: "speed", value: 1, stackingGroup: "ancestry.base-speed" }]],
  ["feature.trait.high-elf.graceful-retreat", "Высший Эльф", "Грациозное отступление", [{ kind: "field", field: "disengage", value: 1 }]],
  ["feature.trait.human.staying-power", "Человек", "Запас прочности", [{ kind: "field", field: "recoveries", value: 2 }]],
  ["feature.trait.memonek.lightning-nimbleness", "Меманек", "Молниеносная ловкость", [{ kind: "field", field: "speed", value: 2, stackingGroup: "ancestry.base-speed" }]],
  ["feature.trait.orc.grounded", "Орк", "Заземленность", [{ kind: "field", field: "stability", value: 1 }]],
  ["feature.trait.polder.graceful-retreat", "Полдер", "Грациозное отступление", [{ kind: "field", field: "disengage", value: 1 }]],
  ["ancestry.tauros.beast-legs", "Таурус", "Звериные ноги", [{ kind: "field", field: "speed", value: 1, stackingGroup: "ancestry.base-speed" }]],
  ["ancestry.tauros.grounded", "Таурус", "Заземленность", [{ kind: "field", field: "stability", value: 1 }]],
] as const;

describe("ancestry feature registry", () => {
  it("contains every supported ancestry/name mapping with explicit IDs and correct effects", () => {
    expect(ANCESTRY_FEATURE_RULES).toHaveLength(11);
    expect(ANCESTRY_FEATURE_RULES.map(({ id, ancestryName, name, effects }) => [id, ancestryName, name, effects]))
      .toEqual(expected);
    const ids = ANCESTRY_FEATURE_RULES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z]+(?:-[a-z]+)*(?:\.[a-z]+(?:-[a-z]+)*)+$/.test(id))).toBe(true);
  });

  it("keeps each description verbatim from the generated builder translation", () => {
    for (const rule of ANCESTRY_FEATURE_RULES) {
      const ancestry = builderData.ancestries.find((candidate) => candidate.name === rule.ancestryName);
      const trait = ancestry?.traits.find((candidate) => candidate.name === rule.name);
      expect(trait, `${rule.ancestryName}: ${rule.name} exists in builder.generated.json`).toBeDefined();
      expect(rule.description).toBe(trait?.text);
      expect(rule.description.trim()).not.toBe("");
    }
  });

  it("maps exact names for only the requested ancestry, without duplicate IDs", () => {
    expect(ancestryTraitIdsFromNames("Таурус", ["Звериные ноги", "Заземленность", "Звериные ноги"]))
      .toEqual(["ancestry.tauros.beast-legs", "ancestry.tauros.grounded"]);
    expect(ancestryTraitIdsFromNames("Таурус", ["звериные ноги", "Стремительный", "unknown"]))
      .toEqual([]);
    expect(ancestryTraitIdsFromNames("Орк", ["Заземленность", "Искра с твоей кожи"]))
      .toEqual(["feature.trait.orc.grounded"]);
    expect(ancestryTraitIdsFromNames("Неизвестное происхождение", ["Заземленность"]))
      .toEqual([]);
  });
});
