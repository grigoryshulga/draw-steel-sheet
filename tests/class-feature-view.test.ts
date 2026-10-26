import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import type {
  FeatureMechanics,
  GeneratedClassFeature,
} from "../src/data/class-features/types";
import type { Character } from "../src/types";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
  triggerBadgeCounts,
  type FeatureSheetItem,
} from "../src/lib/class-feature-view";
import { classFeatureTriggers } from "../src/lib/class-features";
import { previewGameAction } from "../src/lib/game-actions";
import { beginEncounter, beginRound } from "../src/lib/runtime";

/**
 * Герой Неистового нужного уровня. Аспект пишется туда же, куда его пишет
 * приложение, — в `automation.classFeatureSelections`.
 */
function fury(level: number, aspect?: string): Character {
  const hero = createCharacter({ className: "Неистовый", level });
  hero.characteristics = { ...hero.characteristics, might: 2, agility: 3 };
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    ...(aspect ? { classFeatureSelections: { "fury.aspect": aspect } } : {}),
  };
  return hero;
}

/** Все записи панели одним списком — по ним ищем фичу по `id`. */
function itemsOf(hero: Character): FeatureSheetItem[] {
  return classFeatureGroupsForSheet(hero).flatMap((group) => group.features);
}

function itemOf(hero: Character, id: string): FeatureSheetItem {
  const item = itemsOf(hero).find((feature) => feature.id === id);
  if (!item) throw new Error(`В панели нет фичи ${id}`);
  return item;
}

const TEST_ID = "fury.feature.1.test-characteristic";

/** Временная запись реестра: снимается в `finally`, даже если тест упал. */
function withFeature<T>(
  record: Partial<GeneratedClassFeature>,
  mechanics: FeatureMechanics,
  run: () => T,
): T {
  GENERATED_CLASS_FEATURES.push({
    id: TEST_ID,
    className: "Неистовый",
    level: 1,
    name: "Тестовая фича",
    articleId: "test",
    description: "",
    ...record,
  });
  FEATURE_MECHANICS[TEST_ID] = mechanics;
  try {
    return run();
  } finally {
    const index = GENERATED_CLASS_FEATURES.findIndex(
      (feature) => feature.id === TEST_ID,
    );
    if (index >= 0) GENERATED_CLASS_FEATURES.splice(index, 1);
    delete FEATURE_MECHANICS[TEST_ID];
  }
}

const ASPECT_GATE = "fury.feature.1.rastushchaya-svirepost-berserka-2";
const SPEED_FEATURE = "fury.aspect.2.neizbezhnyy-gnev";
const CHAOS_IMMUNITY = "fury.feature.10.voploshchenie-khaosa";
const ENCOUNTER_TRIGGER = "fury.feature.10.voploshchenie-khaosa";

describe("classFeatureGroupsForSheet", () => {
  it("группирует фичи по уровню и не показывает будущие уровни", () => {
    const hero = fury(3, "Берсерк");
    const groups = classFeatureGroupsForSheet(hero);

    expect(groups.map((group) => group.level)).toEqual([1, 2, 3]);
    for (const group of groups) {
      expect(group.features.length).toBeGreaterThan(0);
      expect(group.features.every((feature) => feature.level === group.level)).toBe(
        true,
      );
      expect(group.title).toContain(String(group.level));
    }
    // Уровень героя выше — будущие группы 4-го уровня не появляются.
    expect(classFeatureGroupsForSheet(fury(2, "Берсерк")).map((g) => g.level)).toEqual([
      1, 2,
    ]);
  });

  it("подставляет числа в описание эффекта: скорость равна Ловкости", () => {
    const hero = fury(2, "Разоритель");
    const speed = itemOf(hero, SPEED_FEATURE);
    // Ловкость 3 у героя выше — «скорость +3 (Ловкость)».
    expect(speed.summary).toContain("скорость +3");
    expect(speed.summary).toContain("Ловкость");
  });

  it("показывает устойчивость и порог тира бонуса характеристики", () => {
    const hero = fury(3, "Берсерк");
    const stability = itemOf(hero, "fury.aspect.3.nedvizhimyy-obekt");
    expect(stability.summary).toContain("устойчивость +2");
    expect(stability.summary).toContain("Мощь");

    // +1 к Мощи 3 даёт эффективную 4 — порог третьего тира 17 − 4 = 13.
    const withBonus = { ...hero, characteristics: { ...hero.characteristics, might: 3 } };
    withFeature({}, { kinds: ["characteristic"], effects: [{ kind: "characteristic", key: "might", value: 1 }] }, () => {
      expect(itemOf(withBonus, TEST_ID).summary).toBe("Мощь +1, порог тира 13");
    });
  });

  it("показывает бейдж порога ресурса, но не прячет фичу", () => {
    const hero = fury(2, "Берсерк");
    const item = itemOf(hero, ASPECT_GATE);
    const threshold = item.badges.find((badge) => badge.kind === "threshold");
    expect(threshold?.label).toContain("нужно 2");
    expect(threshold?.label).toContain("Свирепость");
    // Свирепости на листе нет — порог не выполнен.
    expect(threshold?.active).toBe(false);

    const withResource: Character = {
      ...hero,
      heroicResource: { ...hero.heroicResource, current: 2 },
    };
    const met = itemOf(withResource, ASPECT_GATE).badges.find(
      (badge) => badge.kind === "threshold",
    );
    expect(met?.active).toBe(true);
  });

  it("показывает бейдж аспекта и приглушает его у чужого аспекта", () => {
    const berserker = itemOf(fury(2, "Берсерк"), ASPECT_GATE);
    const aspect = berserker.badges.find((badge) => badge.kind === "choice");
    expect(aspect?.label).toContain("Берсерк");
    expect(aspect?.active).toBe(true);
  });

  it("разрешает множитель иммунитета: удвоенная Мощь", () => {
    const hero = fury(10, "Берсерк");
    const item = itemOf(hero, CHAOS_IMMUNITY);
    // Мощь 2, множитель ×2 — иммунитет 4 к семи типам урона.
    expect(item.summary).toContain("иммунитет 4");
    expect(item.summary).toContain("огонь");
  });

  it("пишет иммунитет к одному типу по-русски с числом", () => {
    const hero = fury(1, "Берсерк");
    withFeature(
      {},
      {
        kinds: ["immunity"],
        effects: [
          {
            kind: "damageImmunity",
            types: ["огонь"],
            value: { characteristic: "might" },
            multiplier: 2,
            when: { keyValue: ["Берсерк"] },
          },
        ],
      },
      () => {
        // Мощь 2 × 2 = 4.
        expect(itemOf(hero, TEST_ID).summary).toBe("иммунитет к огню 4");
        // Чужой аспект не получает чужого иммунитета в описание.
        expect(itemOf(fury(1, "Буревестник"), TEST_ID).summary).toBe("");
      },
    );
  });

  it("показывает у фичи с триггером бейдж «сработает» и кнопку отметки", () => {
    const hero = fury(2, "Буревестник");
    const item = itemOf(hero, "fury.aspect.2.zub-i-kogot");
    expect(item.trigger?.frequency).toBe("turn");
    expect(item.trigger?.used).toBe(false);
    expect(
      item.badges.some(
        (badge) =>
          badge.kind === "trigger" && badge.label.startsWith("сработает: "),
      ),
    ).toBe(true);
  });

  it("при выключенном авторасчёте показывает фичи и не трогает лист", () => {
    const hero = fury(4, "Берсерк");
    hero.automation = { ...hero.automation!, enabled: false };
    const snapshot = JSON.stringify(hero);

    const groups = classFeatureGroupsForSheet(hero);
    expect(groups.length).toBeGreaterThan(0);
    expect(itemsOf(hero).length).toBeGreaterThan(0);
    // Числа-описания считаются и без авторасчёта.
    expect(itemOf(hero, ASPECT_GATE).badges.length).toBeGreaterThan(0);
    // Сохранённые значения листа не изменились.
    expect(JSON.stringify(hero)).toBe(snapshot);
  });
});

describe("triggerBadgeCounts", () => {
  it("уменьшается после отметки триггера в этом раунде", () => {
    const hero = fury(4, "Буревестник");
    const total = triggerBadgeCounts(hero);
    expect(total).toBeGreaterThan(0);

    const first = classFeatureTriggers(hero)[0];
    const marked = previewGameAction(hero, {
      kind: "trigger",
      featureId: first.featureId,
      used: true,
    });
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(triggerBadgeCounts(marked.next)).toBe(total - 1);

    // Новый раунд снимает отметку раунда — триггер снова доступен.
    expect(triggerBadgeCounts(beginRound(marked.next))).toBe(total);
  });

  it("отметка триггера схватки переживает новый раунд", () => {
    const hero = fury(10, "Берсерк");
    const total = triggerBadgeCounts(hero);
    const trigger = classFeatureTriggers(hero).find(
      (item) => item.featureId === ENCOUNTER_TRIGGER,
    );
    expect(trigger?.frequency).toBe("encounter");

    const marked = previewGameAction(hero, {
      kind: "trigger",
      featureId: ENCOUNTER_TRIGGER,
      used: true,
    });
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    // Отметка схватки хранится номером схватки, а не раунда.
    expect(marked.next.runtime!.triggers[ENCOUNTER_TRIGGER]).toEqual({
      encounter: 1,
      count: 1,
    });
    expect(triggerBadgeCounts(marked.next)).toBe(total - 1);

    const nextRound = beginRound(marked.next);
    expect(nextRound.runtime!.round).toBe(2);
    expect(nextRound.runtime!.triggers[ENCOUNTER_TRIGGER]).toEqual({
      encounter: 1,
      count: 1,
    });
    expect(triggerBadgeCounts(nextRound)).toBe(total - 1);
    expect(itemOf(nextRound, ENCOUNTER_TRIGGER).trigger?.used).toBe(true);

    // Новая схватка снимает отметку.
    const nextEncounter = beginEncounter(nextRound);
    expect(nextEncounter.runtime!.triggers[ENCOUNTER_TRIGGER]).toBeUndefined();
    expect(triggerBadgeCounts(nextEncounter)).toBe(total);
  });
});

describe("classFeatureChoicesForSheet", () => {
  it("просит выбрать аспект, пока его нет ни в выборах, ни в подклассе", () => {
    const choices = classFeatureChoicesForSheet(fury(1));
    expect(choices).toHaveLength(1);
    expect(choices[0].group).toBe("fury.aspect");
    expect(choices[0].label).toBe("Аспект");
    expect(choices[0].options).toEqual(["Берсерк", "Разоритель", "Буревестник"]);
  });

  it("не спрашивает выбор, когда аспект уже записан", () => {
    expect(classFeatureChoicesForSheet(fury(1, "Буревестник"))).toEqual([]);

    const subclassHero = fury(1);
    subclassHero.subclass = "Разоритель";
    expect(classFeatureChoicesForSheet(subclassHero)).toEqual([]);
  });

  it("у класса без разобранных выборов ничего не спрашивает", () => {
    const talent = createCharacter({ className: "Талант", level: 3 });
    expect(classFeatureChoicesForSheet(talent)).toEqual([]);
  });
});
