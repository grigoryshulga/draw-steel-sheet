import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { resourceSpecFor } from "../src/data/class-features/class-resources";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import {
  FEATURE_MECHANICS,
  NOT_YET,
  TEXT_ONLY,
  TROUBADOUR_RESOURCE,
  mechanicsFor,
} from "../src/data/class-features/mechanics";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "../src/lib/class-features";
import {
  classFeatureChoicesForSheet,
  classFeatureGiftsAtLevel,
  classFeatureGroupsForSheet,
  featureSheetChoiceState,
  withClassFeatureSelection,
} from "../src/lib/class-feature-view";
import {
  buildCharacter,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import {
  getLevelUpPlan,
  previewLevelUp,
  type LevelUpPreview,
  type LevelUpRequest,
} from "../src/lib/level-up";
import {
  resolvedEpicResourceGains,
  resolvedResourceGains,
} from "../src/lib/resources";
import type { Character } from "../src/types";

const TROUBADOUR_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Трубадур",
);

const TROUPE_OPTIONS = ["Автор", "Дуэлянт", "Виртуоз"];

/** Keyed-записи амплуа по уровню. */
const TROUPE_KEYED: Record<string, Record<number, string[]>> = {
  Автор: {
    1: [
      "feature.troubadour.level-1.blocking",
      "feature.troubadour.level-1.dramatic-monologue",
      "feature.ability.troubadour.level-1.turnabout-is-fair-play",
    ],
    3: ["feature.troubadour.level-3.missed-cue"],
    8: ["feature.troubadour.level-8.deleted-scene"],
  },
  Дуэлянт: {
    1: [
      "feature.troubadour.level-1.acrobatics",
      "feature.troubadour.level-1.star-power",
      "feature.ability.troubadour.level-1.riposte",
    ],
    3: ["feature.troubadour.level-3.foil"],
    8: ["feature.troubadour.level-8.masterwork"],
  },
  Виртуоз: {
    1: [
      "feature.troubadour.level-1.power-chord",
      "feature.troubadour.level-1.virtuoso-performances",
      "feature.ability.troubadour.level-1.harmonize",
    ],
    3: ["feature.troubadour.level-3.second-album"],
    8: ["feature.troubadour.level-8.crowd-favorites"],
  },
};

/** Особенности 5-го уровня амплуа: контейнер, группа выбора и два варианта. */
const TROUPE_LEVEL_FIVE: Record<
  string,
  { group: string; children: [string, string] }
> = {
  Автор: {
    group: "troubadour.feature.5.avtor",
    children: [
      "feature.troubadour.level-5.fix-it-in-post",
      "feature.ability.troubadour.level-5.take-two",
    ],
  },
  Дуэлянт: {
    group: "troubadour.feature.5.duelyant",
    children: [
      "feature.troubadour.level-5.verbal-duel",
      "feature.ability.troubadour.level-5.we-cant-be-upstaged",
    ],
  },
  Виртуоз: {
    group: "troubadour.feature.5.virtuoz",
    children: [
      "feature.troubadour.level-5.bolstering-banter",
      "feature.troubadour.level-5.medley",
    ],
  },
};

const LEVEL_FIVE_CONTAINERS: Record<string, string> = {
  Автор: "feature.troubadour.level-5.auteur-features",
  Дуэлянт: "feature.troubadour.level-5.duelist-features",
  Виртуоз: "feature.troubadour.level-5.virtuoso-features",
};

const LEVEL_FIVE_CHILD_IDS = Object.values(TROUPE_LEVEL_FIVE).flatMap(
  (entry) => entry.children,
);

/** Контейнеры способностей амплуа 2/6/9 уровней. */
const ABILITY_CONTAINERS: Record<string, Record<number, string>> = {
  Автор: {
    2: "feature.troubadour.level-2.auteur-ability",
    6: "feature.troubadour.level-6.auteur-abilities",
    9: "feature.troubadour.level-9.auteur-abilities",
  },
  Дуэлянт: {
    2: "feature.troubadour.level-2.duelist-ability",
    6: "feature.troubadour.level-6.duelist-abilities",
    9: "feature.troubadour.level-9.duelist-abilities",
  },
  Виртуоз: {
    2: "feature.troubadour.level-2.virtuoso-ability",
    6: "feature.troubadour.level-6.virtuoso-abilities",
    9: "feature.troubadour.level-9.virtuoso-abilities",
  },
};

const CALLINGS = [
  "Позвольте представить сегодняшних актеров",
  "Официальные представления",
  "Моя репутация опережает меня",
];

const CALLING_IDS = [
  "feature.troubadour.level-2.allow-me-to-introduce-tonights-players",
  "feature.troubadour.level-2.formal-introductions",
  "feature.troubadour.level-2.my-reputation-precedes-me",
];

const TEXT_ONLY_IDS = [
  "feature.troubadour.level-2.perk",
  "feature.troubadour.level-4.skill",
  "feature.troubadour.level-4.perk",
  "feature.troubadour.level-6.perk",
  "feature.troubadour.level-7.skill",
  "feature.troubadour.level-8.perk",
  "feature.troubadour.level-10.skill",
  "feature.troubadour.level-10.perk",
].sort();

function troubadour(
  level = 1,
  selections: Record<string, string> = {},
  overrides: Partial<Character> = {},
): Character {
  const hero = createCharacter({ className: "Трубадур", level });
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: selections,
  };
  return { ...hero, ...overrides };
}

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

const troupeFeatures = (hero: Character) =>
  activeClassFeatures(hero).filter((feature) => feature.keyedBy === "troupe");

const troupeIds = (hero: Character, level: number) =>
  troupeFeatures(hero)
    .filter((feature) => feature.level === level)
    .map((feature) => feature.id);

const keyedTroupeIds = (hero: Character) =>
  troupeFeatures(hero).map((feature) => feature.id);

const levelFiveIds = (hero: Character) =>
  activeIds(hero).filter((id) => LEVEL_FIVE_CHILD_IDS.includes(id));

const callingIds = (hero: Character) =>
  activeIds(hero).filter((id) => CALLING_IDS.includes(id));

const sheetNames = (hero: Character) =>
  classFeatureGroupsForSheet(hero)
    .flatMap((group) => group.features)
    .map((feature) => feature.name);

describe("Трубадур: production-реестры", () => {
  it("ресурс Драма зарегистрирован, NOT_YET класс больше не держит", () => {
    expect(resourceSpecFor("Трубадур")).toBe(TROUBADOUR_RESOURCE);
    expect(resourceSpecFor("  трубадур ")).toBe(TROUBADOUR_RESOURCE);
    expect(NOT_YET["Трубадур"]).toBeUndefined();
  });

  it("все 84 записи покрыты механикой или прозой: 76 + 8", () => {
    expect(TROUBADOUR_FEATURES).toHaveLength(84);

    const covered = TROUBADOUR_FEATURES.filter(
      (feature) => mechanicsFor(feature.id) || TEXT_ONLY[feature.id],
    );
    expect(covered).toHaveLength(84);

    const mechanicsCount = TROUBADOUR_FEATURES.filter((feature) =>
      mechanicsFor(feature.id),
    ).length;
    const textOnlyIds = TROUBADOUR_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id),
    ).map((feature) => feature.id);

    expect(mechanicsCount).toBe(76);
    expect(textOnlyIds.sort()).toEqual(TEXT_ONLY_IDS);
    expect(
      textOnlyIds.every((id) => (TEXT_ONLY[id] ?? "").trim().length > 10),
    ).toBe(true);

    // Инвентарь сворачивает часть записей (75), скелет считает их отдельно
    // (84): 9 контейнеров способностей 2/6/9 и раздельные записи «Драмы».
    const skeletonIds = new Set(TROUBADOUR_FEATURES.map((feature) => feature.id));
    const orphanMechanics = Object.keys(FEATURE_MECHANICS).filter(
      (id) => id.startsWith("troubadour.") && !skeletonIds.has(id),
    );
    const orphanText = Object.keys(TEXT_ONLY).filter(
      (id) => id.startsWith("troubadour.") && !skeletonIds.has(id),
    );
    expect(orphanMechanics).toEqual([]);
    expect(orphanText).toEqual([]);
  });

  it("скелет держит 15 keyed-записей амплуа и 9 контейнеров способностей", () => {
    expect(
      TROUBADOUR_FEATURES.filter((feature) => feature.keyedBy === "troupe"),
    ).toHaveLength(15);

    const containers = TROUBADOUR_FEATURES.filter((feature) =>
      /^feature\.troubadour\.level-(2|6|9)\.(auteur|duelist|virtuoso)-abilit(y|ies)$/.test(
        feature.id,
      ),
    );
    expect(containers).toHaveLength(9);
    expect(
      containers.filter((feature) => mechanicsFor(feature.id)?.when?.keyValue),
    ).toHaveLength(9);

    const fiveChildren = TROUBADOUR_FEATURES.filter((feature) =>
      LEVEL_FIVE_CHILD_IDS.includes(feature.id),
    );
    expect(fiveChildren).toHaveLength(6);
    expect(
      fiveChildren.filter((feature) => mechanicsFor(feature.id)?.when?.keyValue),
    ).toHaveLength(6);
  });

  it("механика без чисел, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = TROUBADOUR_FEATURES.map((feature) => ({
      feature,
      mechanics: mechanicsFor(feature.id),
    })).filter(({ mechanics }) => {
      if (!mechanics) return false;
      if (
        mechanics.effects?.length ||
        mechanics.trigger ||
        mechanics.choice ||
        mechanics.resource
      ) {
        return false;
      }
      return !mechanics.notes?.trim();
    });
    expect(silent.map(({ feature }) => feature.name)).toEqual([]);
  });
});

describe("Трубадур: ресурс Драма и замена 7-го уровня", () => {
  it("1/3 — шесть книжных прибавок, по одной на тег", () => {
    for (const level of [1, 3]) {
      const gains = resolvedResourceGains(troubadour(level));
      expect(gains.map((gain) => gain.tag)).toEqual([
        "combat-start",
        "start-of-turn",
        "three-heroes",
        "hero-winded",
        "natural-19-20",
        "hero-dies",
      ]);
      expect(gains.map((gain) => gain.amount)).toEqual([
        "= Победы",
        "1d3",
        "2",
        "2",
        "3",
        "10",
      ]);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(6);
      expect(gains.every((gain) => gain.sourceId === "class:трубадур")).toBe(
        true,
      );
    }
  });

  it("первый раз за встречу и постоянные события имеют книжную частоту", () => {
    const gains = resolvedResourceGains(troubadour(3));
    const byTag = new Map(gains.map((gain) => [gain.tag, gain]));
    expect(byTag.get("three-heroes")?.frequency).toBe("encounter");
    expect(byTag.get("hero-winded")?.frequency).toBe("encounter");
    expect(byTag.get("natural-19-20")?.frequency).toBe("always");
    expect(byTag.get("hero-dies")?.frequency).toBe("always");
    expect(byTag.get("natural-19-20")?.event).toBe("crit");
    expect(byTag.get("hero-dies")?.event).toBe("passive");
  });

  it("7-й уровень: начало хода — 1d3 + 1, других замен нет", () => {
    const gains = resolvedResourceGains(troubadour(7));
    const start = gains.filter((gain) => gain.tag === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("1d3 + 1");
    expect(start[0].sourceId).toBe("feature.troubadour.level-7.a-muses-muse");
    expect(gains).toHaveLength(6);
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
  });

  it("эпические «Аплодисменты» открываются только на 10-м уровне", () => {
    expect(resolvedEpicResourceGains(troubadour(9))).toEqual([]);
    const epic = resolvedEpicResourceGains(troubadour(10));
    expect(epic).toHaveLength(1);
    expect(epic[0].amount).toBe("= Опыт");
    expect(epic[0].event).toBe("respite");
    expect(epic[0].frequency).toBe("respite");
    expect(TROUBADOUR_RESOURCE.epic?.name).toBe("Аплодисменты");
    expect(TROUBADOUR_RESOURCE.epic?.level).toBe(10);
  });

  it("записи «Драма», «Драма в бою», «Драма вне боя» и «Аплодисменты» не начисляют ресурс повторно", () => {
    for (const id of [
      "feature.troubadour.level-1.drama",
      "feature.troubadour.level-1.drama-in-combat",
      "feature.troubadour.level-1.drama-outside-of-combat",
      "feature.troubadour.level-10.applause",
    ]) {
      const mechanics = mechanicsFor(id);
      expect(mechanics?.kinds, id).toContain("resource");
      expect(mechanics?.resource, id).toBeUndefined();
      expect(mechanics?.notes?.trim(), id).toBeTruthy();
    }
  });
});

describe("Трубадур: амплуа", () => {
  it("полный подкласс активирует только свои keyed-записи 1/3/8", () => {
    for (const [troupe, byLevel] of Object.entries(TROUPE_KEYED)) {
      const hero = troubadour(8, {}, { subclass: troupe });
      for (const [level, ids] of Object.entries(byLevel)) {
        expect(troupeIds(hero, Number(level)).sort(), `${troupe} ${level}`).toEqual(
          [...ids].sort(),
        );
      }
    }
  });

  it("особенности 5-го уровня: выбор одной из двух на амплуа", () => {
    for (const [troupe, entry] of Object.entries(TROUPE_LEVEL_FIVE)) {
      const hero = troubadour(5, {}, { subclass: troupe });
      // Пока выбор не сделан, ни одна из двух особенностей не активна,
      // но контейнер и группа выбора доступны.
      expect(levelFiveIds(hero), troupe).toEqual([]);
      expect(activeIds(hero), troupe).toContain(LEVEL_FIVE_CONTAINERS[troupe]);
      const choice = classFeatureChoicesForSheet(hero).find(
        (item) => item.group === entry.group,
      );
      expect(choice?.options, troupe).toHaveLength(2);

      for (const [index, featureId] of entry.children.entries()) {
        const option = choice?.options[index];
        expect(option, `${troupe} ${index}`).toBeTruthy();
        const selected = troubadour(
          5,
          { [entry.group]: option! },
          { subclass: troupe },
        );
        expect(levelFiveIds(selected), `${troupe} ${featureId}`).toEqual([
          featureId,
        ]);
      }
    }

    // Старое значение Автора не должно оставаться активным после смены амплуа.
    const stale = troubadour(
      5,
      { "troubadour.feature.5.avtor": "Поправим на постпродакшене" },
      { subclass: "Автор" },
    );
    const switched = withClassFeatureSelection(
      stale,
      "troubadour.troupe",
      "Дуэлянт",
    );
    expect(levelFiveIds(switched)).toEqual([]);
  });

  it("чужая, неизвестная и составная амплуа не активируют записи", () => {
    for (const hero of [
      troubadour(8, {}, { subclass: "Неизвестное амплуа" }),
      troubadour(8, {}, { subclass: "Автор, Дуэлянт" }),
    ]) {
      expect(keyedTroupeIds(hero)).toEqual([]);
      expect(levelFiveIds(hero)).toEqual([]);
    }

    const author = troubadour(8, {}, { subclass: "Автор" });
    expect(troupeIds(author, 1)).not.toContain(
      "feature.troubadour.level-1.acrobatics",
    );
    expect(levelFiveIds(author)).not.toContain(
      "feature.troubadour.level-5.medley",
    );
  });

  it("пустой подкласс: панель предлагает амплуа, keyed-записи не активны", () => {
    const hero = troubadour(8);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "troubadour.troupe",
    );
    expect(choice?.options).toEqual(TROUPE_OPTIONS);
    expect(choice?.label).toBe("Труппа");
    expect(keyedTroupeIds(hero)).toEqual([]);
    expect(levelFiveIds(hero)).toEqual([]);
  });

  it("выбор в панели пишет подкласс и включает только своё амплуа", () => {
    const hero = troubadour(8);
    const selected = withClassFeatureSelection(
      hero,
      "troubadour.troupe",
      "Дуэлянт",
    );
    expect(selected.subclass).toBe("Дуэлянт");
    expect(
      selected.automation?.classFeatureSelections?.["troubadour.troupe"],
    ).toBe("Дуэлянт");
    expect(troupeIds(selected, 1).sort()).toEqual(
      [...TROUPE_KEYED["Дуэлянт"][1]].sort(),
    );
    expect(troupeIds(selected, 8)).toEqual(["feature.troubadour.level-8.masterwork"]);
    expect(
      classFeatureChoicesForSheet(selected).some(
        (item) => item.group === "troubadour.troupe",
      ),
    ).toBe(false);
  });

  it("контейнеры способностей 2/6/9 уровней видны только своему амплуа", () => {
    for (const troupe of TROUPE_OPTIONS) {
      const ids = activeIds(troubadour(9, {}, { subclass: troupe }));
      for (const level of [2, 6, 9]) {
        expect(ids, `${troupe} ${level}`).toContain(
          ABILITY_CONTAINERS[troupe][level],
        );
        for (const other of TROUPE_OPTIONS) {
          if (other === troupe) continue;
          expect(ids, `${troupe} / ${other} ${level}`).not.toContain(
            ABILITY_CONTAINERS[other][level],
          );
        }
      }
    }
  });

  it("условие контейнера — название амплуа", () => {
    for (const troupe of TROUPE_OPTIONS) {
      for (const level of [2, 6, 9]) {
        expect(
          mechanicsFor(ABILITY_CONTAINERS[troupe][level])?.when?.keyValue,
          `${troupe} ${level}`,
        ).toEqual([troupe]);
      }
    }
  });

  it("триггеры амплуа имеют книжные событие, частоту и подпись", () => {
    const cases = [
      ["Автор", "feature.ability.troubadour.level-1.turnabout-is-fair-play"],
      ["Дуэлянт", "feature.ability.troubadour.level-1.riposte"],
      ["Виртуоз", "feature.ability.troubadour.level-1.harmonize"],
    ] as const;

    for (const [troupe, featureId] of cases) {
      const triggers = classFeatureTriggers(
        troubadour(1, {}, { subclass: troupe }),
      ).filter((trigger) => trigger.featureId === featureId);
      expect(triggers, featureId).toHaveLength(1);
      expect(triggers[0].event, featureId).toBe("use-ability");
      expect(triggers[0].frequency, featureId).toBe("always");
      expect(triggers[0].label.trim(), featureId).not.toBe("");
      expect(triggers[0].detail.trim(), featureId).not.toBe("");
    }
  });
});

describe("Трубадур: Призвание 2-го уровня", () => {
  it("панель предлагает три варианта русскими подписями", () => {
    const choice = classFeatureChoicesForSheet(troubadour(2)).find(
      (item) => item.group === "troubadour.calling",
    );
    expect(choice?.label).toBe("Призвание");
    expect(choice?.options).toEqual(CALLINGS);
    expect(choice?.optionLabels).toEqual(
      Object.fromEntries(CALLINGS.map((name) => [name, name])),
    );
    expect(choice?.selected).toBeUndefined();
  });

  it("выбор пишет значение группы и активирует ровно одну запись", () => {
    const hero = withClassFeatureSelection(
      troubadour(2),
      "troubadour.calling",
      CALLINGS[0],
    );
    expect(
      hero.automation?.classFeatureSelections?.["troubadour.calling"],
    ).toBe(CALLINGS[0]);
    expect(hero.subclass).toBe("");

    for (const [index, name] of CALLINGS.entries()) {
      const selected = withClassFeatureSelection(
        troubadour(2),
        "troubadour.calling",
        name,
      );
      expect(callingIds(selected), name).toEqual([CALLING_IDS[index]]);
    }
  });

  it("без выбора ни одна запись не активна", () => {
    expect(callingIds(troubadour(10))).toEqual([]);
  });

  it("смена выбора переносит активность на другую запись", () => {
    const first = withClassFeatureSelection(
      troubadour(2),
      "troubadour.calling",
      CALLINGS[0],
    );
    const second = withClassFeatureSelection(
      first,
      "troubadour.calling",
      CALLINGS[2],
    );
    expect(callingIds(first)).toEqual([CALLING_IDS[0]]);
    expect(callingIds(second)).toEqual([CALLING_IDS[2]]);
    expect(
      featureSheetChoiceState(
        classFeatureChoicesForSheet(second).find(
          (item) => item.group === "troubadour.calling",
        )!,
      ).selectedOption,
    ).toBe(CALLINGS[2]);
  });

  it("панель сохраняет выбор между перерисовками (лист и повышение)", () => {
    const hero = withClassFeatureSelection(
      troubadour(3),
      "troubadour.calling",
      CALLINGS[1],
    );
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "troubadour.calling",
    );
    expect(choice?.selected).toBe(CALLINGS[1]);
    expect(featureSheetChoiceState(choice!).selectedOption).toBe(CALLINGS[1]);
    expect(featureSheetChoiceState(choice!).warning).toBeUndefined();
  });
});

describe("Трубадур: создание героя", () => {
  const signature = ABILITY_COMPENDIUM.find(
    (ability) =>
      ability.className === "Трубадур" &&
      ability.name === "Остроумная Перепалка",
  );
  const heroic = ABILITY_COMPENDIUM.find(
    (ability) =>
      ability.className === "Трубадур" && ability.name === "Суровый Критик",
  );

  function draft() {
    return {
      ...emptyBuilderDraft(),
      name: "Тестовый трубадур",
      ancestry: "Дварф",
      traits: ["Заземленность", "Искра с твоей кожи"],
      className: "Трубадур",
      subclass: "Виртуоз",
      characteristics: startingCharacteristics("Трубадур"),
      kit: "Головорез",
      abilityIds: [signature?.id, heroic?.id].filter(
        (id): id is string => !!id,
      ),
    };
  }

  it("выдаёт навык амплуа, его способности и выбранные знаковую и героическую", () => {
    const hero = buildCharacter(draft());
    expect(hero.subclass).toBe("Виртуоз");
    expect(hero.skills).toContain("Музыка");

    const names = hero.abilities.map((ability) => ability.name);
    expect(names).toContain("Хореография");
    expect(names).toContain("Живительный Лимерик");
    expect(names).toContain("Мощный Аккорд");
    expect(names).toContain("Гармонизация");
    expect(names).toContain('"Громовая Мать"');
    expect(names).toContain('"Баллада о Звере"');
    expect(names).toContain("Остроумная Перепалка");
    expect(names).toContain("Суровый Критик");
  });

  it("лист показывает записи своего амплуа, но не чужие", () => {
    const hero = buildCharacter(draft());
    const names = sheetNames(hero);
    expect(names).toContain("Мощный аккорд");
    expect(names).toContain("Выступления виртуоза");
    expect(names).toContain("Гармонизация");
    expect(names).not.toContain("Акробатика");
    expect(names).not.toContain("Рипост");
  });

  it("выступления Виртуоза на 3 и 8 уровнях приходят повышением", () => {
    const hero3 = troubadour(
      2,
      { "troubadour.troupe": "Виртуоз" },
      { subclass: "Виртуоз", xp: 160 },
    );
    const level3 = previewLevelUp(hero3, levelUpRequest(hero3));
    expect(level3.ok).toBe(true);
    if (level3.ok) {
      const names = level3.next.abilities.map((ability) => ability.name);
      expect(names).toContain('"Зажги Эту Ночь"');
      expect(names).toContain('"Неустанный Герой"');
    }

    const hero8 = troubadour(
      7,
      { "troubadour.troupe": "Виртуоз" },
      { subclass: "Виртуоз", xp: 160 },
    );
    const level8 = previewLevelUp(hero8, levelUpRequest(hero8));
    expect(level8.ok).toBe(true);
    if (level8.ok) {
      const names = level8.next.abilities.map((ability) => ability.name);
      expect(names).toContain("Лунная Соната");
      expect(names).toContain("Радикальная Фантазия");
    }
  });

  it("выборы и подкласс переживают экспорт и импорт JSON", () => {
    const hero = buildCharacter(draft());
    const restored = JSON.parse(JSON.stringify(hero)) as Character;
    expect(restored.subclass).toBe("Виртуоз");
    expect(activeIds(restored)).toEqual(activeIds(hero));
    expect(troupeIds(restored, 1)).toEqual(troupeIds(hero, 1));
  });
});

describe("Трубадур: повышение уровня", () => {
  const ENOUGH_XP = 160;

  function firstChoices(hero: Character): Record<string, string[]> {
    const plan = getLevelUpPlan(hero);
    const choices: Record<string, string[]> = {};
    for (const choice of plan.choices) {
      choices[choice.id] = choice.options
        .slice(0, choice.count)
        .map((option) => option.id);
    }
    return choices;
  }

  function baseHero(level: number, troupe = "Виртуоз"): Character {
    return troubadour(
      level,
      { "troubadour.troupe": troupe },
      { subclass: troupe, xp: ENOUGH_XP },
    );
  }

  function expectOk(result: LevelUpPreview): LevelUpPreview & { ok: true } {
    expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
    if (!result.ok) throw new Error(result.issues.join("; "));
    return result;
  }

  it("1→2 сохраняет амплуа и выборы, ресурс остаётся шестистрочным", () => {
    const hero = baseHero(1);
    const result = expectOk(previewLevelUp(hero, levelUpRequest(hero)));
    expect(result.next.level).toBe(2);
    expect(result.next.subclass).toBe("Виртуоз");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      "troubadour.troupe": "Виртуоз",
    });
    expect(resolvedResourceGains(result.next)).toHaveLength(6);
  });

  it("3→4 сохраняет выборы и не добавляет ресурсных замен", () => {
    const hero = baseHero(3);
    const result = expectOk(previewLevelUp(hero, levelUpRequest(hero)));
    expect(result.next.level).toBe(4);
    expect(result.next.subclass).toBe("Виртуоз");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      "troubadour.troupe": "Виртуоз",
    });
    expect(resolvedResourceGains(result.next)).toHaveLength(6);
    expect(
      resolvedResourceGains(result.next).filter(
        (gain) => gain.tag === "start-of-turn",
      )[0].amount,
    ).toBe("1d3");
  });

  it("6→7 сохраняет выборы и усиливает начало хода до 1d3 + 1", () => {
    const hero = baseHero(6);
    const result = expectOk(previewLevelUp(hero, levelUpRequest(hero)));
    expect(result.next.level).toBe(7);
    expect(result.next.subclass).toBe("Виртуоз");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      "troubadour.troupe": "Виртуоз",
    });
    const start = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "start-of-turn",
    );
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("1d3 + 1");
  });

  it("9→10 сохраняет выборы, даёт шесть прибавок и «Аплодисменты»", () => {
    const hero = baseHero(9);
    const result = expectOk(previewLevelUp(hero, levelUpRequest(hero)));
    expect(result.next.level).toBe(10);
    expect(result.next.subclass).toBe("Виртуоз");
    expect(resolvedResourceGains(result.next)).toHaveLength(6);
    expect(
      resolvedEpicResourceGains(result.next).map((gain) => gain.amount),
    ).toEqual(["= Опыт"]);
  });

  it("гранты 3/6/8 уровней приходят по амплуа", () => {
    const two = baseHero(2);
    const toThree = expectOk(previewLevelUp(two, levelUpRequest(two)));
    const threeNames = toThree.next.abilities.map((ability) => ability.name);
    expect(threeNames).toContain('"Зажги Эту Ночь"');
    expect(threeNames).toContain('"Неустанный Герой"');

    const five = baseHero(5);
    const toSix = expectOk(previewLevelUp(five, levelUpRequest(five)));
    expect(toSix.next.abilities.map((ability) => ability.name)).toContain(
      "В лучах Прожектора",
    );

    const seven = baseHero(7);
    const toEight = expectOk(previewLevelUp(seven, levelUpRequest(seven)));
    const eightNames = toEight.next.abilities.map((ability) => ability.name);
    expect(eightNames).toContain("Лунная Соната");
    expect(eightNames).toContain("Радикальная Фантазия");
  });

  it("выборы 2/6/9 уровней берутся из пар способностей амплуа", () => {
    for (const level of [2, 6, 9]) {
      const hero = baseHero(level - 1);
      const plan = getLevelUpPlan(hero);
      const choice = plan.choices.find((item) =>
        item.label.includes("Виртуоз"),
      );
      expect(choice, `уровень ${level}`).toBeDefined();
      expect(choice?.count, `уровень ${level}`).toBe(1);
      expect(choice?.options, `уровень ${level}`).toHaveLength(2);
    }
  });

  it("подарки уровней 2/3/4/7/8/9/10 не пусты", () => {
    for (const level of [2, 3, 4, 7, 8, 9, 10]) {
      const hero = baseHero(level - 1);
      const gifts = classFeatureGiftsAtLevel(hero, level).map(
        (feature) => feature.name,
      );
      expect(gifts.length, `уровень ${level}`).toBeGreaterThan(0);
    }
    // 5-й уровень — выбор одной из двух особенностей в панели листа, поэтому
    // до выбора подарков нет. 6-й — грант карточки «В лучах прожектора» и
    // TEXT_ONLY-перк; отдельных подарочных строк нет.
    expect(classFeatureGiftsAtLevel(baseHero(4), 5)).toEqual([]);
    expect(classFeatureGiftsAtLevel(baseHero(5), 6)).toEqual([]);
  });
});

describe("Трубадур: старый и частичный лист", () => {
  it("без подкласса панель просит амплуа и призвание, keyed-записи не активны", () => {
    const hero = troubadour(8);
    const groups = classFeatureChoicesForSheet(hero).map(
      (choice) => choice.group,
    );
    expect(groups).toContain("troubadour.troupe");
    expect(groups).toContain("troubadour.calling");
    expect(troupeIds(hero, 1)).toEqual([]);
    expect(levelFiveIds(hero)).toEqual([]);
  });

  it("составное амплуа снова предлагается в панели с предупреждением", () => {
    const hero = troubadour(8, {}, { subclass: "Автор, Дуэлянт" });
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "troubadour.troupe",
    );
    expect(choice).toBeDefined();
    expect(choice?.selected).toBe("Автор, Дуэлянт");
    expect(featureSheetChoiceState(choice!).warning).toContain("Сохранено");
  });

  it("после выбора активируется ровно своё амплуа", () => {
    const hero = withClassFeatureSelection(
      troubadour(8),
      "troubadour.troupe",
      "Автор",
    );
    expect(troupeIds(hero, 1).sort()).toEqual(
      [...TROUPE_KEYED["Автор"][1]].sort(),
    );
    expect(levelFiveIds(hero)).toEqual([]);
    const selected = withClassFeatureSelection(
      hero,
      "troubadour.feature.5.avtor",
      "Поправим на постпродакшене",
    );
    expect(levelFiveIds(selected)).toEqual([
      "feature.troubadour.level-5.fix-it-in-post",
    ]);
    expect(troupeIds(hero, 1)).not.toContain(
      "feature.troubadour.level-1.acrobatics",
    );
  });

  it("выключение и включение автоматизации сохраняет выборы и записи", () => {
    const hero = troubadour(
      8,
      { "troubadour.troupe": "Дуэлянт", "troubadour.calling": CALLINGS[0] },
      { subclass: "Дуэлянт" },
    );
    const off: Character = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    const on: Character = {
      ...off,
      automation: { ...off.automation!, enabled: true },
    };
    expect(activeIds(off)).toEqual(activeIds(hero));
    expect(activeIds(on)).toEqual(activeIds(hero));
    expect(
      off.automation?.classFeatureSelections?.["troubadour.troupe"],
    ).toBe("Дуэлянт");
    expect(on.subclass).toBe("Дуэлянт");
    expect(callingIds(on)).toEqual([CALLING_IDS[0]]);
  });
});

describe("Трубадур: видимый текст без внутренних имён", () => {
  const forbidden = [
    "keyValue",
    "keyedBy",
    "when.",
    "subclass",
    "feature.troubadour.",
    "feature.ability.troubadour.",
    "troubadour.troupe.",
    "troubadour.calling",
    "sourceId",
    "generated.json",
    "forced-movement",
  ];

  const visibleText = (hero: Character): string =>
    classFeatureGroupsForSheet(hero)
      .flatMap((group) => group.features)
      .flatMap((feature) => [
        feature.summary,
        feature.notes ?? "",
        feature.detail ?? "",
        feature.trigger?.label ?? "",
        feature.trigger?.detail ?? "",
        ...feature.badges.map((badge) => badge.label),
      ])
      .join(" ");

  const heroes = (): Character[] => [
    troubadour(10),
    ...TROUPE_OPTIONS.map((troupe) =>
      troubadour(
        10,
        { "troubadour.troupe": troupe, "troubadour.calling": CALLINGS[0] },
        { subclass: troupe },
      ),
    ),
  ];

  it("notes, summary, триггеры и бейджи чисты для всех амплуа и уровней", () => {
    const leaks: string[] = [];
    for (const hero of heroes()) {
      const text = visibleText(hero);
      for (const token of forbidden) {
        if (text.includes(token)) {
          leaks.push(`${token} у ${hero.subclass || "без амплуа"}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("ни notes, ни причины TEXT_ONLY не содержат технических имён", () => {
    const leaked: string[] = [];
    for (const feature of TROUBADOUR_FEATURES) {
      const text = [
        mechanicsFor(feature.id)?.notes ?? "",
        TEXT_ONLY[feature.id] ?? "",
      ].join(" ");
      for (const token of forbidden) {
        if (text.includes(token)) leaked.push(`${feature.id}: ${token}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("подписи панели русские", () => {
    const hero = troubadour(10);
    const labels = classFeatureChoicesForSheet(hero).map(
      (choice) => choice.label,
    );
    expect(labels).toContain("Труппа");
    expect(labels).toContain("Призвание");
  });
});

/** Запрос повышения уровня с первыми вариантами каждого выбора. */
function levelUpRequest(hero: Character): LevelUpRequest {
  const plan = getLevelUpPlan(hero);
  const choices: Record<string, string[]> = {};
  for (const choice of plan.choices) {
    choices[choice.id] = choice.options
      .slice(0, choice.count)
      .map((option) => option.id);
  }
  return {
    characterId: hero.id,
    fromLevel: hero.level,
    className: hero.className,
    subclass: hero.subclass,
    mode: "milestone",
    choices,
    reviewedRules: true,
  };
}
