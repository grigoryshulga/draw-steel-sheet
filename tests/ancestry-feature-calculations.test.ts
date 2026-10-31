import { describe, expect, it } from "vitest";
import {
  ANCESTRY_FEATURE_RULES,
  type AncestryFeatureRule,
} from "../src/data/ancestry-feature-rules";
import type { FeatureStat } from "../src/data/feature-effects";
import {
  BUILDER_DATA,
  buildCharacter,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";
import {
  calculatedValues,
  characterStatBreakdown,
  recalculateCharacter,
} from "../src/lib/character-calculations";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import {
  featureStatBonus,
  featureStatContributions,
} from "../src/lib/feature-modifiers";
import type { Character } from "../src/types";

/** Translation values of the seven historically supported ancestry traits. */
const EXPECTED: Record<
  string,
  { stat: Exclude<FeatureStat, "save">; value: number }
> = {
  "Звериные ноги": { stat: "speed", value: 1 },
  Заземленность: { stat: "stability", value: 1 },
  "Искра с твоей кожи": { stat: "stamina", value: 6 },
  Стремительный: { stat: "speed", value: 1 },
  "Грациозное отступление": { stat: "disengage", value: 1 },
  "Запас прочности": { stat: "recoveries", value: 2 },
  "Молниеносная ловкость": { stat: "speed", value: 2 },
};

const STATS = [
  "stamina",
  "recoveries",
  "speed",
  "stability",
  "disengage",
] as const;

function ancestryHero(
  ancestry: string,
  traits: string[],
  level = 1,
  ids?: string[],
): Character {
  const character = createCharacter({ ancestry, className: "Тактик", level });
  character.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [...traits],
    ...(ids ? { ancestryTraitIds: [...ids] } : {}),
  };
  return character;
}

function ruleFor(ancestry: string, name: string): AncestryFeatureRule {
  const rule = ANCESTRY_FEATURE_RULES.find(
    (candidate) =>
      candidate.ancestryName === ancestry && candidate.name === name,
  );
  if (!rule) throw new Error(`Нет черты «${name}» у ${ancestry}`);
  return rule;
}

function subclassOf(className: string): string {
  return (
    BUILDER_DATA.classes.find((entry) => entry.name === className)
      ?.subclasses[0]?.name ?? ""
  );
}

describe("Ancestry feature registry coverage", () => {
  it("covers every builder ancestry/name combination for the supported traits", () => {
    expect(ANCESTRY_FEATURE_RULES).toHaveLength(11);
    expect(new Set(ANCESTRY_FEATURE_RULES.map((rule) => rule.name)).size).toBe(7);
    for (const rule of ANCESTRY_FEATURE_RULES) {
      const ancestry = BUILDER_DATA.ancestries.find(
        (entry) => entry.name === rule.ancestryName,
      );
      expect(
        ancestry?.traits.some((trait) => trait.name === rule.name),
      ).toBe(true);
    }
  });

  it.each(
    ANCESTRY_FEATURE_RULES.map((rule) => [
      rule.ancestryName,
      rule.name,
      rule.id,
    ]),
  )(
    "%s / %s resolves to its named source through legacy names",
    (ancestry, name, id) => {
      const expected = EXPECTED[name];
      const character = ancestryHero(ancestry, [name]);

      expect(featureStatContributions(character, expected.stat)).toEqual([
        { sourceId: id, sourceName: name, value: expected.value },
      ]);
      expect(featureStatBonus(character, expected.stat)).toBe(expected.value);
      for (const other of STATS.filter((stat) => stat !== expected.stat)) {
        expect(featureStatContributions(character, other)).toEqual([]);
      }
    },
  );
});

describe("Ancestry stat integration", () => {
  it("keeps the 5-speed base and shows ancestry speed as a contribution", () => {
    const beast = ancestryHero("Таурус", ["Звериные ноги"]);
    expect(calculatedValues(beast).speed).toBe(6);
    expect(characterStatBreakdown(beast, "speed")).toEqual({
      base: 5,
      contributions: [
        {
          sourceId: ruleFor("Таурус", "Звериные ноги").id,
          sourceName: "Звериные ноги",
          value: 1,
        },
      ],
      adjustment: 0,
      total: 6,
    });

    const lightning = ancestryHero("Меманек", ["Молниеносная ловкость"]);
    expect(calculatedValues(lightning).speed).toBe(7);
    expect(characterStatBreakdown(lightning, "speed").base).toBe(5);
  });

  it("never adds alternative base-speed traits together", () => {
    // Hand-written JSON may name several known base-speed IDs at once.
    const memanek = ancestryHero("Меманек", [], 1, [
      "ancestry.memanek.lightning-agility",
      "ancestry.devil.beast-legs",
      "ancestry.taurus.beast-legs",
    ]);
    expect(featureStatContributions(memanek, "speed")).toEqual([
      {
        sourceId: "ancestry.memanek.lightning-agility",
        sourceName: "Молниеносная ловкость",
        value: 2,
      },
    ]);
    expect(calculatedValues(memanek).speed).toBe(7);

    const taurus = ancestryHero("Таурус", [], 1, [
      "ancestry.taurus.beast-legs",
      "ancestry.memanek.lightning-agility",
    ]);
    expect(calculatedValues(taurus).speed).toBe(6);
  });

  it("adds class and ancestry speed separately, once each", () => {
    const character = ancestryHero("Меманек", ["Молниеносная ловкость"]);
    character.className = "Талант";
    character.automation = {
      ...character.automation!,
      classFeatureSelections: {
        "talent.augmentation": "talent.augmentation.speed",
      },
    };

    expect(featureStatContributions(character, "speed")).toEqual([
      {
        sourceId: "ancestry.memanek.lightning-agility",
        sourceName: "Молниеносная ловкость",
        value: 2,
      },
      {
        sourceId: "talent.feature.1.augmentatsiya-skorosti",
        sourceName: "Аугментация скорости",
        value: 1,
      },
    ]);
    expect(calculatedValues(character).speed).toBe(8);
  });

  it("scales the Dwarf spark by echelon and adds grounded once", () => {
    for (const [level, stamina] of [
      [1, 6],
      [3, 6],
      [4, 12],
      [7, 18],
      [10, 24],
    ] as const) {
      const character = ancestryHero(
        "Дварф",
        ["Заземленность", "Искра с твоей кожи"],
        level,
      );
      expect(featureStatContributions(character, "stamina")).toEqual([
        {
          sourceId: ruleFor("Дварф", "Искра с твоей кожи").id,
          sourceName: "Искра с твоей кожи",
          value: stamina,
        },
      ]);
      expect(featureStatContributions(character, "stability")).toEqual([
        {
          sourceId: ruleFor("Дварф", "Заземленность").id,
          sourceName: "Заземленность",
          value: 1,
        },
      ]);
      expect(calculatedValues(character).stamina).toBe(
        21 + 9 * (level - 1) + stamina,
      );
      expect(calculatedValues(character).stability).toBe(1);
    }
  });

  it("adds Human recoveries and Elf/Polder disengage without touching others", () => {
    const human = ancestryHero("Человек", ["Запас прочности"]);
    expect(featureStatContributions(human, "recoveries")).toEqual([
      {
        sourceId: ruleFor("Человек", "Запас прочности").id,
        sourceName: "Запас прочности",
        value: 2,
      },
    ]);
    expect(calculatedValues(human).recoveries).toBe(12);

    for (const ancestry of ["Высший Эльф", "Полдер"]) {
      const character = ancestryHero(ancestry, ["Грациозное отступление"]);
      expect(featureStatContributions(character, "disengage")).toEqual([
        {
          sourceId: ruleFor(ancestry, "Грациозное отступление").id,
          sourceName: "Грациозное отступление",
          value: 1,
        },
      ]);
      expect(calculatedValues(character).disengage).toBe(2);
      expect(featureStatBonus(character, "speed")).toBe(0);
    }
  });

  it("counts class, kit, ancestry and manual adjustment exactly once", () => {
    const character = ancestryHero("Дварф", ["Искра с твоей кожи"], 4);
    character.kit = "Беглый Огонь"; // +3 stamina per echelon

    const calculated = recalculateCharacter(character, character);
    // 48 class + 6 kit + 12 spark
    expect(calculated.stamina.max).toBe(66);
    expect(calculated.stamina.current).toBe(48); // a growing maximum never heals

    const adjusted = recalculateCharacter(character, {
      ...character,
      stamina: { ...character.stamina, max: 71 },
    });
    expect(adjusted.automation?.adjustments.stamina).toBe(5);
    expect(adjusted.stamina.max).toBe(71);
    expect(characterStatBreakdown(adjusted, "stamina")).toEqual({
      base: 54, // 48 class + 6 kit
      contributions: [
        {
          sourceId: ruleFor("Дварф", "Искра с твоей кожи").id,
          sourceName: "Искра с твоей кожи",
          value: 12,
        },
      ],
      adjustment: 5,
      total: 71,
    });
  });
});

describe("Ancestry selection resolution", () => {
  it("treats canonical IDs as authoritative, including an explicit empty list", () => {
    const legacyNames = ["Заземленность", "Искра с твоей кожи"];

    const canonical = ancestryHero("Дварф", legacyNames, 1, [
      "ancestry.dwarf.spark-from-your-skin",
    ]);
    expect(featureStatBonus(canonical, "stamina")).toBe(6);
    expect(featureStatContributions(canonical, "stability")).toEqual([]);

    const refused = ancestryHero("Дварф", legacyNames, 1, []);
    expect(featureStatBonus(refused, "stamina")).toBe(0);
    expect(featureStatBonus(refused, "stability")).toBe(0);

    const legacy = ancestryHero("Дварф", legacyNames);
    expect(featureStatBonus(legacy, "stamina")).toBe(6);
    expect(featureStatBonus(legacy, "stability")).toBe(1);
  });

  it("ignores unknown, foreign and duplicate IDs", () => {
    const character = ancestryHero("Дварф", [], 1, [
      "ancestry.dwarf.spark-from-your-skin",
      "ancestry.dwarf.spark-from-your-skin",
      "ancestry.devil.beast-legs",
      "unknown.trait",
      "ancestry.dwarf.grounded",
    ]);

    expect(featureStatContributions(character, "stamina")).toHaveLength(1);
    expect(featureStatContributions(character, "stability")).toHaveLength(1);
    expect(featureStatContributions(character, "speed")).toEqual([]);
    expect(calculatedValues(character).speed).toBe(5);

    // Unknown IDs are preserved by recalculation and simply ignored by the evaluator.
    const stored = recalculateCharacter(character, character);
    expect(stored.automation?.ancestryTraitIds).toContain("unknown.trait");
    expect(featureStatBonus(stored, "stamina")).toBe(6);

    const foreign = ancestryHero("Орк", [], 1, ["ancestry.taurus.beast-legs"]);
    expect(featureStatContributions(foreign, "speed")).toEqual([]);
  });

  it("does nothing through ancestry traits while automation is disabled", () => {
    const character = ancestryHero("Меманек", ["Молниеносная ловкость"]);
    character.automation = { ...character.automation!, enabled: false };

    expect(featureStatContributions(character, "speed")).toEqual([]);
    expect(characterStatBreakdown(character, "speed")).toEqual({
      base: 5,
      contributions: [],
      adjustment: 0,
      total: 5,
    });
  });
});

describe("Ancestry persistence paths", () => {
  it("keeps canonical IDs from the builder through store normalization", () => {
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Быстрый меманек",
      ancestry: "Меманек",
      traits: ["Молниеносная ловкость"],
      className: "Тактик",
      subclass: subclassOf("Тактик"),
      characteristics: startingCharacteristics("Тактик"),
    });

    expect(built.automation?.ancestryTraitIds).toEqual([
      "ancestry.memanek.lightning-agility",
    ]);
    expect(built.automation?.ancestryTraits).toEqual(["Молниеносная ловкость"]);
    expect(built.speed).toBe("7");

    const stored = normalizeCharacter(JSON.parse(JSON.stringify(built)));
    expect(stored.automation?.ancestryTraitIds).toEqual([
      "ancestry.memanek.lightning-agility",
    ]);
    expect(featureStatContributions(stored, "speed")).toEqual([
      {
        sourceId: "ancestry.memanek.lightning-agility",
        sourceName: "Молниеносная ловкость",
        value: 2,
      },
    ]);
    expect(calculatedValues(stored).speed).toBe(7);
  });

  it("keeps legacy name-only sheets working after a store round-trip", () => {
    const legacy = ancestryHero("Человек", ["Запас прочности"]);
    delete legacy.automation?.ancestryTraitIds;

    const stored = normalizeCharacter(JSON.parse(JSON.stringify(legacy)));
    expect(stored.automation?.ancestryTraitIds).toBeUndefined();
    expect(featureStatBonus(stored, "recoveries")).toBe(2);
  });
});

describe("Ancestry invalidation on change", () => {
  function dwarf(): Character {
    return ancestryHero(
      "Дварф",
      ["Заземленность", "Искра с твоей кожи"],
      1,
      ["ancestry.dwarf.spark-from-your-skin", "ancestry.dwarf.grounded"],
    );
  }

  it("clears stale names and IDs even while automation is off", () => {
    const old = dwarf();
    const off = recalculateCharacter(old, {
      ...old,
      automation: { ...old.automation!, enabled: false },
    });
    const switched = recalculateCharacter(off, { ...off, ancestry: "Орк" });

    expect(switched.automation?.ancestryTraits).toEqual([]);
    expect(switched.automation?.ancestryTraitIds).toEqual([]);
    expect(switched.stamina).toEqual(off.stamina); // a disabled sheet keeps its numbers

    const on = recalculateCharacter(switched, {
      ...switched,
      automation: { ...switched.automation!, enabled: true },
    });
    expect(on.stamina.max).toBe(21);
    expect(featureStatBonus(on, "stamina")).toBe(0);
    expect(featureStatBonus(on, "stability")).toBe(0);
    expect(on.stability).toBe("0");
  });

  it("keeps explicitly replaced legacy names and drops the old canonical IDs", () => {
    const old = dwarf();
    const previous = old.automation!;
    const orc = recalculateCharacter(old, {
      ...old,
      ancestry: "Орк",
      automation: { ...previous, ancestryTraits: ["Заземленность"] },
    });

    expect(orc.automation?.ancestryTraits).toEqual(["Заземленность"]);
    expect(orc.automation?.ancestryTraitIds).toBeUndefined();
    expect(featureStatContributions(orc, "stability")).toEqual([
      {
        sourceId: ruleFor("Орк", "Заземленность").id,
        sourceName: "Заземленность",
        value: 1,
      },
    ]);
    expect(featureStatBonus(orc, "stamina")).toBe(0);
    expect(orc.stability).toBe("1");
  });

  it("keeps explicitly replaced canonical IDs and clears stale names", () => {
    const old = dwarf();
    const previous = old.automation!;
    const orc = recalculateCharacter(old, {
      ...old,
      ancestry: "Орк",
      automation: {
        ...previous,
        ancestryTraitIds: ["ancestry.orc.grounded"],
      },
    });

    expect(orc.automation?.ancestryTraitIds).toEqual(["ancestry.orc.grounded"]);
    expect(orc.automation?.ancestryTraits).toEqual([]);
    expect(featureStatBonus(orc, "stability")).toBe(1);
    expect(featureStatBonus(orc, "stamina")).toBe(0);
  });

  it("does not resurrect old ancestry traits after switching back", () => {
    const old = dwarf();
    const switched = recalculateCharacter(old, {
      ...old,
      ancestry: "Орк",
      automation: {
        ...old.automation!,
        ancestryTraits: ["Заземленность"],
      },
    });
    const back = recalculateCharacter(switched, { ...switched, ancestry: "Дварф" });

    expect(back.automation?.ancestryTraits).toEqual([]);
    expect(back.automation?.ancestryTraitIds).toEqual([]);
    expect(featureStatBonus(back, "stamina")).toBe(0);
    expect(featureStatBonus(back, "stability")).toBe(0);
  });
});
