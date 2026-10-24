import { describe, expect, it } from "vitest";
import builderData from "../src/data/builder.generated.json";
import {
  ANCESTRY_FEATURE_RULES,
  ancestryTraitIdsFromNames,
} from "../src/data/ancestry-feature-rules";

const expected = [
  ["ancestry.devil.beast-legs", "Дьявол", "Звериные ноги", [{ kind: "stat", stat: "speed", value: 1, stackingGroup: "ancestry.base-speed" }]],
  ["ancestry.dwarf.grounded", "Дварф", "Заземленность", [{ kind: "stat", stat: "stability", value: 1 }]],
  ["ancestry.dwarf.spark-from-your-skin", "Дварф", "Искра с твоей кожи", [{ kind: "stat", stat: "stamina", value: 0, perEchelon: 6 }]],
  ["ancestry.forest-elf.swift", "Лесной Эльф", "Стремительный", [{ kind: "stat", stat: "speed", value: 1, stackingGroup: "ancestry.base-speed" }]],
  ["ancestry.high-elf.graceful-retreat", "Высший Эльф", "Грациозное отступление", [{ kind: "stat", stat: "disengage", value: 1 }]],
  ["ancestry.human.reserve-of-strength", "Человек", "Запас прочности", [{ kind: "stat", stat: "recoveries", value: 2 }]],
  ["ancestry.memanek.lightning-agility", "Меманек", "Молниеносная ловкость", [{ kind: "stat", stat: "speed", value: 2, stackingGroup: "ancestry.base-speed" }]],
  ["ancestry.orc.grounded", "Орк", "Заземленность", [{ kind: "stat", stat: "stability", value: 1 }]],
  ["ancestry.polder.graceful-retreat", "Полдер", "Грациозное отступление", [{ kind: "stat", stat: "disengage", value: 1 }]],
  ["ancestry.taurus.beast-legs", "Таурус", "Звериные ноги", [{ kind: "stat", stat: "speed", value: 1, stackingGroup: "ancestry.base-speed" }]],
  ["ancestry.taurus.grounded", "Таурус", "Заземленность", [{ kind: "stat", stat: "stability", value: 1 }]],
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
      .toEqual(["ancestry.taurus.beast-legs", "ancestry.taurus.grounded"]);
    expect(ancestryTraitIdsFromNames("Таурус", ["звериные ноги", "Стремительный", "unknown"]))
      .toEqual([]);
    expect(ancestryTraitIdsFromNames("Орк", ["Заземленность", "Искра с твоей кожи"]))
      .toEqual(["ancestry.orc.grounded"]);
    expect(ancestryTraitIdsFromNames("Неизвестное происхождение", ["Заземленность"]))
      .toEqual([]);
  });
});
