import { describe, expect, it } from "vitest";
import { ancestryTraitIdsFromNames } from "../src/data/ancestry-feature-rules";
import { ANCESTRY_FEATURE_MECHANICS } from "../src/data/ancestry-features/mechanics";
import { GENERATED_ANCESTRY_FEATURES } from "../src/data/ancestry-features/skeleton";
import { ancestryAbilitySource, ancestryAbilitySources } from "../src/lib/ability-origin";
import { abilityFilterOptions } from "../src/lib/ability-sheet-groups";
import { previewGameAction } from "../src/lib/game-actions";
import {
  ancestryAbilityEntries,
  ancestryFeatureChoicesForSheet,
  withAncestryFeatureSelection,
} from "../src/lib/ancestry-features";
import {
  builderStepIssues,
  buildCharacter,
  emptyBuilderDraft,
} from "../src/lib/character-builder";
import { recalculateCharacter } from "../src/lib/character-calculations";
import { parseCharacterImport } from "../src/lib/character-import";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import type { Character } from "../src/types";

function hero(
  ancestry: string,
  traits: string[] = [],
  selections?: Record<string, string>,
): Character {
  const character = createCharacter({ ancestry, className: "Тактик" });
  character.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [...traits],
    ancestryTraitIds: ancestryTraitIdsFromNames(ancestry, traits),
    ...(selections ? { ancestryFeatureSelections: selections } : {}),
  };
  return character;
}

function names(character: Character): string[] {
  return ancestryAbilityEntries(character).map((entry) => entry.ability.name);
}

describe("способности происхождений", () => {
  it("держит каждую механику на записи скелета и не повторяет id", () => {
    const featureIds = new Set(
      GENERATED_ANCESTRY_FEATURES.map((feature) => feature.id),
    );
    const abilityIds = new Set<string>();
    let abilityCount = 0;

    for (const [featureId, mechanics] of Object.entries(
      ANCESTRY_FEATURE_MECHANICS,
    )) {
      expect(featureIds.has(featureId), featureId).toBe(true);
      const abilities = [
        ...(mechanics.abilities ?? []),
        ...(mechanics.choice?.options.map((option) => option.ability) ?? []),
      ];
      for (const ability of abilities) {
        expect(abilityIds.has(ability.id), ability.id).toBe(false);
        abilityIds.add(ability.id);
        abilityCount += 1;
        expect(ability.source).toMatch(/^Происхождение · /);
        expect(ability.tiers).toHaveLength(3);
        if (ability.rollCharacteristics.length > 0) {
          expect(ability.rollCharacteristics).toContain(
            ability.preferredCharacteristic,
          );
        } else {
          expect(ability.preferredCharacteristic).toBe("");
        }
      }
      if (mechanics.choice) {
        const options = mechanics.choice.options;
        expect(options.length).toBeGreaterThan(1);
        expect(new Set(options.map((option) => option.id)).size).toBe(
          options.length,
        );
      }
    }

    expect(abilityCount).toBe(21);
  });

  it("выдаёт каждую механику через её настоящую черту", () => {
    for (const feature of GENERATED_ANCESTRY_FEATURES) {
      const mechanics = ANCESTRY_FEATURE_MECHANICS[feature.id];
      if (!mechanics) continue;
      const character = hero(
        feature.ancestryName,
        feature.kind === "trait" ? [feature.name] : [],
      );
      for (const ability of mechanics.abilities ?? []) {
        expect(names(character), feature.id).toContain(ability.name);
      }
      if (mechanics.choice) {
        for (const option of mechanics.choice.options) {
          const selected = withAncestryFeatureSelection(
            character,
            mechanics.choice.group,
            option.id,
          );
          expect(names(selected), `${feature.id} / ${option.id}`).toContain(
            option.ability.name,
          );
        }
      }
    }
  });

  it("выдаёт знаковую способность без купленных черт", () => {
    expect(names(hero("Полдер"))).toEqual(["Слияние С Тенью"]);
    expect(names(hero("Человек"))).toEqual(["Видение Сверхъестественного"]);
    expect(names(hero("Дварф"))).toEqual([]);

    const sources = ancestryAbilitySources(hero("Полдер"));
    const ability = ancestryAbilityEntries(hero("Полдер"))[0].ability;
    expect(ancestryAbilitySource(sources, ability)).toMatchObject({
      label: "Происхождение",
      value: "Полдер",
      text: "Происхождение · Слияние С Тенью",
    });
  });

  it("показывает способность выбранной черты и убирает её без черты", () => {
    expect(hero("Дьявол", ["Светящиеся глаза"]).automation).toBeDefined();
    expect(names(hero("Дьявол", ["Светящиеся глаза"]))).toEqual([
      "Светящиеся Глаза",
    ]);
    expect(names(hero("Дьявол", ["Адское зрение"]))).toEqual([]);
    expect(names(hero("Дьявол", ["Звериные ноги"]))).toEqual([]);
  });

  it("понимает лист, который сохранил только названия черт", () => {
    const legacy = hero("Дьявол", ["Светящиеся глаза"]);
    delete legacy.automation?.ancestryTraitIds;
    expect(names(legacy)).toEqual(["Светящиеся Глаза"]);
  });

  it("читает ручной текст старого листа без автоматизации", () => {
    const legacy = createCharacter({ ancestry: "Дьявол" });
    legacy.ancestryTraits =
      "#### Знаковая Черта: Серебряный Язык\nТекст.\n\n" +
      "Светящиеся глаза (1): ваши глаза сплошного, яркого цвета.";
    expect(names(legacy)).toEqual(["Светящиеся Глаза"]);

    legacy.ancestryTraits =
      "#### Знаковая Черта: Серебряный Язык\nТекст про Светящиеся глаза.";
    expect(names(legacy)).toEqual([]);
  });

  it("не выдаёт способности чужой черты", () => {
    expect(names(hero("Орк", ["Молниеносная ловкость"]))).toEqual([]);
  });

  it("показывает карточки и при выключенном авторасчёте", () => {
    const character = hero("Дьявол", ["Светящиеся глаза"]);
    character.automation = { ...character.automation!, enabled: false };
    expect(names(character)).toEqual(["Светящиеся Глаза"]);
  });

  it("ждёт выбор способности для «Псионического дара»", () => {
    const before = hero("Рейдер Времени", ["Псионический дар"]);
    expect(names(before)).toEqual([]);
    expect(ancestryFeatureChoicesForSheet(before)).toEqual([
      {
        group: "feature.trait.time-raider.psionic-gift",
        label: "Псионический дар: знаковая способность",
        options: [
          {
            id: "feature.trait.time-raider.psionic-gift.concussive-slam",
            label: "Сотрясающий Удар",
          },
          {
            id: "feature.trait.time-raider.psionic-gift.psionic-bolt",
            label: "Псионический Заряд",
          },
          {
            id: "feature.trait.time-raider.psionic-gift.minor-acceleration",
            label: "Малая Акселерация",
          },
        ],
        selected: "",
      },
    ]);

    const chosen = withAncestryFeatureSelection(
      before,
      "feature.trait.time-raider.psionic-gift",
      "feature.trait.time-raider.psionic-gift.psionic-bolt",
    );
    expect(names(chosen)).toEqual(["Псионический Заряд"]);
    expect(ancestryFeatureChoicesForSheet(chosen)[0].selected).toBe(
      "feature.trait.time-raider.psionic-gift.psionic-bolt",
    );

    const switched = withAncestryFeatureSelection(
      chosen,
      "feature.trait.time-raider.psionic-gift",
      "feature.trait.time-raider.psionic-gift.minor-acceleration",
    );
    expect(names(switched)).toEqual(["Малая Акселерация"]);

    const cleared = withAncestryFeatureSelection(
      switched,
      "feature.trait.time-raider.psionic-gift",
      "",
    );
    expect(cleared.automation?.ancestryFeatureSelections).toEqual({});
    expect(names(cleared)).toEqual([]);
  });

  it("не подставляет вариант из испорченного сохранения", () => {
    const broken = hero("Рейдер Времени", ["Псионический дар"], {
      "feature.trait.time-raider.psionic-gift": "unknown-option",
    });
    expect(names(broken)).toEqual([]);
    expect(
      ancestryFeatureChoicesForSheet(broken)[0],
    ).toMatchObject({ selected: "" });
    expect(ancestryFeatureChoicesForSheet(broken)[0].warning).toContain(
      "unknown-option",
    );
  });

  it("добавляет фильтр «Происхождение» со счётчиком", () => {
    const character = hero("Драконий Рыцарь", [
      "Драконья гордость",
      "Драконье дыхание",
    ]);
    const entries = ancestryAbilityEntries(character);
    const options = abilityFilterOptions(
      entries.map((entry) => entry.ability),
      undefined,
      ancestryAbilitySources(character),
    );
    expect(options.find((option) => option.key === "ancestry")).toMatchObject({
      label: "Происхождение",
      count: 2,
    });
  });

  it("применяет способность происхождения через журнал игры", () => {
    const character = hero("Дьявол", ["Светящиеся глаза"]);
    const applied = previewGameAction(character, {
      kind: "ability",
      abilityId: "feature.trait.devil.glowing-eyes",
      surges: 0,
      result: "15",
    });
    expect(applied.ok).toBe(true);
    if (applied.ok) expect(applied.label).toBe("Светящиеся Глаза");
  });

  it("переживает сохранение и очищается при смене происхождения", () => {
    const chosen = withAncestryFeatureSelection(
      hero("Рейдер Времени", ["Псионический дар"]),
      "feature.trait.time-raider.psionic-gift",
      "feature.trait.time-raider.psionic-gift.psionic-bolt",
    );
    const stored = normalizeCharacter(JSON.parse(JSON.stringify(chosen)));
    expect(stored.automation?.ancestryFeatureSelections).toEqual({
      "feature.trait.time-raider.psionic-gift":
        "feature.trait.time-raider.psionic-gift.psionic-bolt",
    });
    expect(names(stored)).toEqual(["Псионический Заряд"]);

    const switched = recalculateCharacter(stored, {
      ...stored,
      ancestry: "Орк",
      automation: {
        ...stored.automation!,
        ancestryTraits: [],
        ancestryTraitIds: [],
      },
    });
    expect(switched.automation?.ancestryFeatureSelections).toEqual({});
    expect(names(switched)).toEqual([]);
  });

  it("проводит выбор через импорт персонажа", async () => {
    const chosen = withAncestryFeatureSelection(
      hero("Рейдер Времени", ["Псионический дар"]),
      "feature.trait.time-raider.psionic-gift",
      "feature.trait.time-raider.psionic-gift.psionic-bolt",
    );
    const text = JSON.stringify(chosen);
    const imported = await parseCharacterImport({
      size: new TextEncoder().encode(text).byteLength,
      text: async () => text,
    });
    expect(imported.automation?.ancestryFeatureSelections).toEqual({
      "feature.trait.time-raider.psionic-gift":
        "feature.trait.time-raider.psionic-gift.psionic-bolt",
    });
    expect(names(imported)).toEqual(["Псионический Заряд"]);
  });
});

describe("конструктор и способности происхождения", () => {
  it("сохраняет полный ID черты и выбор способности", () => {
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Дар времени",
      ancestry: "Рейдер Времени",
      traits: ["Псионический дар"],
      ancestryChoices: {
        "feature.trait.time-raider.psionic-gift":
          "feature.trait.time-raider.psionic-gift.concussive-slam",
      },
    });

    expect(built.automation?.ancestryTraitIds).toEqual([
      "feature.trait.time-raider.psionic-gift",
    ]);
    expect(built.automation?.ancestryFeatureSelections).toEqual({
      "feature.trait.time-raider.psionic-gift":
        "feature.trait.time-raider.psionic-gift.concussive-slam",
    });
    expect(names(built)).toEqual(["Сотрясающий Удар"]);
  });

  it("не сохраняет выбор от невыбранной черты", () => {
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Без черты",
      ancestry: "Рейдер Времени",
      traits: [],
      ancestryChoices: {
        "feature.trait.time-raider.psionic-gift":
          "feature.trait.time-raider.psionic-gift.concussive-slam",
      },
    });

    expect(built.automation?.ancestryTraitIds).toEqual([]);
    expect(built.automation?.ancestryFeatureSelections).toBeUndefined();
    expect(names(built)).toEqual([]);
  });

  it("считает выбор обязательным для черты со списком", () => {
    const draft = {
      ...emptyBuilderDraft(),
      name: "Незавершённый герой",
      ancestry: "Рейдер Времени",
      traits: ["Псионический дар", "Потустороннее зрение"],
    };
    const built = buildCharacter(draft);
    expect(built.automation?.ancestryFeatureSelections).toBeUndefined();
    expect(builderStepIssues(draft)["ancestry-options"]).toContain(
      "Псионический дар",
    );
  });
});
