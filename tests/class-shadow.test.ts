import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { resourceSpecFor } from "../src/data/class-features/class-resources";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import {
  NOT_YET,
  SHADOW_RESOURCE,
  TEXT_ONLY,
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

const SHADOW_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Тень",
);

const COLLEGE_OPTIONS = [
  "Коллегия Черного Пепла",
  "Коллегия Едкой Алхимии",
  "Коллегия Маски Арлекина",
];

/** Записи коллегии по уровню и короткому имени из скелета. */
const COLLEGE_KEYED: Record<string, Record<number, string[]>> = {
  "Коллегия Черного Пепла": {
    1: [
      "shadow.college.1.teleportatsiya-chernogo-pepla",
      "shadow.college.1.vo-vsey-etoy-nerazberikhe",
    ],
    2: ["shadow.college.2.goryashchiy-pepel"],
    5: ["shadow.college.5.sled-pepla"],
    8: ["shadow.college.8.pepelnyy-shag"],
  },
  "Коллегия Едкой Алхимии": {
    1: [
      "shadow.college.1.smazat-klinok",
      "shadow.college.1.dymovaya-bomba",
      "shadow.college.1.zashchitnyy-perekat",
    ],
    2: ["shadow.college.2.obuchennyy-ubiytsa"],
    5: ["shadow.college.5.nestabilnye-reagenty"],
    8: ["shadow.college.8.bomba-zamedlennogo-deystviya"],
  },
  "Коллегия Маски Арлекина": {
    1: [
      "shadow.college.1.ya-ne-ugroza",
      "shadow.college.1.umnyy-tryuk",
    ],
    2: ["shadow.college.2.drug"],
    5: ["shadow.college.5.gambit-arlekina"],
    8: ["shadow.college.8.parkur"],
  },
};

const SHORT_COLLEGE: Record<string, string> = {
  "Коллегия Черного Пепла": "Черный Пепел",
  "Коллегия Едкой Алхимии": "Едкая Алхимия",
  "Коллегия Маски Арлекина": "Маска Арлекина",
};

/** Контейнеры способностей коллегии 2/6/9 уровней. */
const ABILITY_CONTAINERS: Record<string, Record<number, string>> = {
  "Коллегия Черного Пепла": {
    2: "shadow.feature.2.sposobnost-chernogo-pepla-2-go-urovnya",
    6: "shadow.feature.6.sposobnosti-chernogo-pepla-6-go-urovnya",
    9: "shadow.feature.9.sposobnosti-chernogo-pepla-9-go-urovnya",
  },
  "Коллегия Едкой Алхимии": {
    2: "shadow.feature.2.sposobnost-edkoy-alkhimii-2-go-urovnya",
    6: "shadow.feature.6.sposobnosti-edkoy-alkhimii-6-go-urovnya",
    9: "shadow.feature.9.sposobnosti-edkoy-alkhimii-9-go-urovnya",
  },
  "Коллегия Маски Арлекина": {
    2: "shadow.feature.2.sposobnost-maski-arlekina-2-go-urovnya",
    6: "shadow.feature.6.sposobnosti-maski-arlekina-6-go-urovnya",
    9: "shadow.feature.9.sposobnosti-maski-arlekina-9-go-urovnya",
  },
};

const TEXT_ONLY_IDS = [
  "shadow.feature.2.perk",
  "shadow.feature.4.navyk",
  "shadow.feature.4.perk",
  "shadow.feature.6.perk",
  "shadow.feature.7.navyk",
  "shadow.feature.8.perk",
  "shadow.feature.10.navyk",
  "shadow.feature.10.perk",
].sort();

function shadow(
  level = 1,
  selections: Record<string, string> = {},
  overrides: Partial<Character> = {},
): Character {
  const hero = createCharacter({ className: "Тень", level });
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

const collegeIds = (hero: Character, level: number) =>
  activeIds(hero).filter((id) => id.startsWith(`shadow.college.${level}.`));

const sheetNames = (hero: Character) =>
  classFeatureGroupsForSheet(hero)
    .flatMap((group) => group.features)
    .map((feature) => feature.name);

describe("Тень: production-реестры", () => {
  it("ресурс Прозрение зарегистрирован, NOT_YET класс больше не держит", () => {
    expect(resourceSpecFor("Тень")).toBe(SHADOW_RESOURCE);
    expect(resourceSpecFor("  тень ")).toBe(SHADOW_RESOURCE);
    expect(NOT_YET["Тень"]).toBeUndefined();
  });

  it("все 71 запись покрыты механикой или прозой: 63 + 8", () => {
    expect(SHADOW_FEATURES).toHaveLength(71);

    const covered = SHADOW_FEATURES.filter(
      (feature) => mechanicsFor(feature.id) || TEXT_ONLY[feature.id],
    );
    expect(covered).toHaveLength(71);

    const mechanicsCount = SHADOW_FEATURES.filter((feature) =>
      mechanicsFor(feature.id),
    ).length;
    const textOnlyIds = SHADOW_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id),
    ).map((feature) => feature.id);

    expect(mechanicsCount).toBe(63);
    expect(textOnlyIds.sort()).toEqual(TEXT_ONLY_IDS);
    expect(
      textOnlyIds.every((id) => (TEXT_ONLY[id] ?? "").trim().length > 10),
    ).toBe(true);
  });

  it("скелет держит 16 keyed-записей коллегии и 9 контейнеров способностей", () => {
    expect(
      SHADOW_FEATURES.filter((feature) => feature.keyedBy === "college"),
    ).toHaveLength(16);

    const containers = SHADOW_FEATURES.filter((feature) =>
      /^shadow\.feature\.(2|6|9)\.sposobnost(i)?-/.test(feature.id),
    );
    expect(containers).toHaveLength(12);
    expect(
      containers.filter((feature) => mechanicsFor(feature.id)?.when?.keyValue),
    ).toHaveLength(9);
  });

  it("механика без чисел, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = SHADOW_FEATURES.map((feature) => ({
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

describe("Тень: ресурс Прозрение и замены 4/7/10 уровней", () => {
  it("1/3 — три книжные прибавки, по одной на тег", () => {
    for (const level of [1, 3]) {
      const gains = resolvedResourceGains(shadow(level));
      expect(gains.map((gain) => gain.tag)).toEqual([
        "combat-start",
        "start-of-turn",
        "damage-surge",
      ]);
      expect(gains.map((gain) => gain.amount)).toEqual([
        "= Победы",
        "1d3",
        "1",
      ]);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(3);
      expect(gains.every((gain) => gain.sourceId === "class:тень")).toBe(true);
    }
  });

  it("4-й уровень: урон со всплесками даёт 2 прозрения вместо 1", () => {
    const gains = resolvedResourceGains(shadow(4));
    const surge = gains.filter((gain) => gain.tag === "damage-surge");
    expect(surge).toHaveLength(1);
    expect(surge[0].amount).toBe("2");
    expect(surge[0].sourceId).toBe(
      "shadow.feature.4.vsplesk-prozreniya",
    );
    expect(gains.filter((gain) => gain.tag === "start-of-turn")[0].amount).toBe(
      "1d3",
    );
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
  });

  it("7-й уровень: начало хода — 1d3 + 1", () => {
    const gains = resolvedResourceGains(shadow(7));
    const start = gains.filter((gain) => gain.tag === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("1d3 + 1");
    expect(start[0].sourceId).toBe("shadow.feature.7.ostroe-prozrenie");
    expect(gains.filter((gain) => gain.tag === "damage-surge")[0].amount).toBe(
      "2",
    );
  });

  it("10-й уровень: урон со всплесками даёт 3, начало хода не теряется", () => {
    const gains = resolvedResourceGains(shadow(10));
    const surge = gains.filter((gain) => gain.tag === "damage-surge");
    expect(surge).toHaveLength(1);
    expect(surge[0].amount).toBe("3");
    expect(surge[0].sourceId).toBe("shadow.feature.10.resurs-smerti");
    expect(gains.filter((gain) => gain.tag === "start-of-turn")[0].amount).toBe(
      "1d3 + 1",
    );
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
  });

  it("эпическая «Уловка» открывается только на 10-м уровне", () => {
    expect(resolvedEpicResourceGains(shadow(9))).toEqual([]);
    const epic = resolvedEpicResourceGains(shadow(10));
    expect(epic).toHaveLength(1);
    expect(epic[0].amount).toBe("= Опыт");
    expect(epic[0].event).toBe("respite");
    expect(epic[0].frequency).toBe("respite");
    expect(SHADOW_RESOURCE.epic?.name).toBe("Уловка");
    expect(SHADOW_RESOURCE.epic?.level).toBe(10);
  });

  it("записи «Прозрение», «Прозрение в бою» и «Прозрение вне боя» не начисляют ресурс повторно", () => {
    for (const id of [
      "shadow.feature.1.prozrenie",
      "shadow.feature.1.prozrenie-v-boyu",
      "shadow.feature.1.prozrenie-vne-boya",
    ]) {
      const mechanics = mechanicsFor(id);
      expect(mechanics?.kinds, id).toContain("resource");
      expect(mechanics?.resource, id).toBeUndefined();
      expect(mechanics?.notes?.trim(), id).toBeTruthy();
    }
    const trick = mechanicsFor("shadow.feature.10.ulovka");
    expect(trick?.kinds).toContain("resource");
    expect(trick?.resource).toBeUndefined();
    expect(trick?.notes).toContain("Уловка");
  });
});

describe("Тень: коллегии", () => {
  it("полный подкласс активирует короткие keyed-записи своей коллегии", () => {
    for (const [college, byLevel] of Object.entries(COLLEGE_KEYED)) {
      const hero = shadow(8, {}, { subclass: college });
      for (const [level, ids] of Object.entries(byLevel)) {
        expect(collegeIds(hero, Number(level)).sort(), `${college} ${level}`).toEqual(
          [...ids].sort(),
        );
      }
    }
  });

  it("короткое значение в выборах тоже работает", () => {
    for (const [college, short] of Object.entries(SHORT_COLLEGE)) {
      const hero = shadow(8, { "shadow.college": short });
      expect(hero.subclass).toBeFalsy();
      for (const [level, ids] of Object.entries(COLLEGE_KEYED[college])) {
        expect(
          collegeIds(hero, Number(level)).sort(),
          `${short} ${level}`,
        ).toEqual([...ids].sort());
      }
    }
  });

  it("чужая, неизвестная и составная коллегия не активируют чужие записи", () => {
    const ash = shadow(8, {}, { subclass: "Коллегия Черного Пепла" });
    expect(collegeIds(ash, 1).sort()).toEqual(
      [...COLLEGE_KEYED["Коллегия Черного Пепла"][1]].sort(),
    );

    // Чужая коллегия активирует только свои записи.
    const caustic = shadow(8, {}, { subclass: "Коллегия Едкой Алхимии" });
    expect(collegeIds(caustic, 1).sort()).toEqual(
      [...COLLEGE_KEYED["Коллегия Едкой Алхимии"][1]].sort(),
    );
    expect(collegeIds(caustic, 1)).not.toContain(
      "shadow.college.1.teleportatsiya-chernogo-pepla",
    );
    expect(collegeIds(caustic, 8)).toEqual([
      "shadow.college.8.bomba-zamedlennogo-deystviya",
    ]);

    // Неизвестное и составное значение не активируют ни одной записи.
    for (const hero of [
      shadow(8, { "shadow.college": "Неизвестная коллегия" }),
      shadow(8, {}, { subclass: "Коллегия Черного Пепла, Коллегия Едкой Алхимии" }),
    ]) {
      expect(
        activeIds(hero).filter((id) => id.startsWith("shadow.college.")),
      ).toEqual([]);
    }
  });

  it("пустой подкласс: панель предлагает полные названия, keyed-записи не активны", () => {
    const hero = shadow(8);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "shadow.college",
    );
    expect(choice?.options).toEqual(COLLEGE_OPTIONS);
    expect(choice?.label).toBe("Коллегия");
    expect(
      activeIds(hero).filter((id) => id.startsWith("shadow.college.")),
    ).toEqual([]);
  });

  it("выбор в панели пишет полный подкласс и включает только свою коллегию", () => {
    const hero = shadow(8);
    const selected = withClassFeatureSelection(
      hero,
      "shadow.college",
      "Коллегия Едкой Алхимии",
    );
    expect(selected.subclass).toBe("Коллегия Едкой Алхимии");
    expect(selected.automation?.classFeatureSelections?.["shadow.college"]).toBe(
      "Коллегия Едкой Алхимии",
    );
    expect(collegeIds(selected, 1).sort()).toEqual(
      [...COLLEGE_KEYED["Коллегия Едкой Алхимии"][1]].sort(),
    );
    expect(collegeIds(selected, 8)).toEqual([
      "shadow.college.8.bomba-zamedlennogo-deystviya",
    ]);
    expect(
      classFeatureChoicesForSheet(selected).some(
        (item) => item.group === "shadow.college",
      ),
    ).toBe(false);
  });

  it("контейнеры способностей 2/6/9 уровней видны только своей коллегии", () => {
    for (const college of COLLEGE_OPTIONS) {
      const ids = activeIds(shadow(9, {}, { subclass: college }));
      for (const level of [2, 6, 9]) {
        const own = ABILITY_CONTAINERS[college][level];
        expect(ids, `${college} ${level}`).toContain(own);
        for (const other of COLLEGE_OPTIONS) {
          if (other === college) continue;
          expect(ids, `${college} / ${other} ${level}`).not.toContain(
            ABILITY_CONTAINERS[other][level],
          );
        }
      }
    }
  });

  it("условие контейнера — короткое название коллегии", () => {
    for (const college of COLLEGE_OPTIONS) {
      for (const level of [2, 6, 9]) {
        expect(
          mechanicsFor(ABILITY_CONTAINERS[college][level])?.when?.keyValue,
          `${college} ${level}`,
        ).toEqual([SHORT_COLLEGE[college]]);
      }
    }
  });
});

describe("Тень: создание героя", () => {
  const signature = ABILITY_COMPENDIUM.find(
    (ability) =>
      ability.className === "Тень" &&
      ability.name === "Для Командной Работы Есть Свое Место",
  );

  function draft() {
    return {
      ...emptyBuilderDraft(),
      name: "Тестовая тень",
      ancestry: "Дварф",
      traits: ["Заземленность", "Искра с твоей кожи"],
      className: "Тень",
      subclass: "Коллегия Едкой Алхимии",
      characteristics: startingCharacteristics("Тень"),
      kit: "Плащ и Кинжал",
      abilityIds: signature ? [signature.id] : [],
    };
  }

  it("выдаёт навык коллегии, её способности и выбранную знаковую", () => {
    const hero = buildCharacter(draft());
    expect(hero.subclass).toBe("Коллегия Едкой Алхимии");
    expect(hero.skills).toContain("Алхимия");
    const names = hero.abilities.map((ability) => ability.name);
    expect(names).toContain("Смазать Клинок");
    expect(names).toContain("Защитный Перекат");
    expect(names).toContain("Для Командной Работы Есть Свое Место");
  });

  it("лист показывает keyed-записи коллегии, но не чужие", () => {
    const hero = buildCharacter(draft());
    const names = sheetNames(hero);
    expect(names).toContain("Смазать клинок");
    expect(names).toContain("Дымовая бомба");
    expect(names).toContain("Защитный перекат");
    expect(names).not.toContain("Телепортация Черного Пепла");
    expect(names).not.toContain("Я не угроза");
  });

  it("выборы и подкласс переживают экспорт и импорт JSON", () => {
    const hero = buildCharacter(draft());
    const restored = JSON.parse(JSON.stringify(hero)) as Character;
    expect(restored.subclass).toBe("Коллегия Едкой Алхимии");
    expect(activeIds(restored)).toEqual(activeIds(hero));
    expect(collegeIds(restored, 1)).toEqual(collegeIds(hero, 1));
  });
});

describe("Тень: повышение уровня", () => {
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

  function request(hero: Character): LevelUpRequest {
    return {
      characterId: hero.id,
      fromLevel: hero.level,
      className: hero.className,
      subclass: hero.subclass,
      mode: "milestone",
      choices: firstChoices(hero),
      reviewedRules: true,
    };
  }

  function expectOk(result: LevelUpPreview): LevelUpPreview & { ok: true } {
    expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
    if (!result.ok) throw new Error(result.issues.join("; "));
    return result;
  }

  function baseHero(level: number, college = "Коллегия Черного Пепла"): Character {
    return shadow(
      level,
      { "shadow.college": college },
      { subclass: college, xp: ENOUGH_XP },
    );
  }

  it("1→2 сохраняет коллегию и выборы, ресурс остаётся трёхстрочным", () => {
    const hero = baseHero(1);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(2);
    expect(result.next.subclass).toBe("Коллегия Черного Пепла");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      "shadow.college": "Коллегия Черного Пепла",
    });
    expect(resolvedResourceGains(result.next)).toHaveLength(3);
    expect(
      result.next.abilities.some(
        (ability) => ability.id === "ten-v-oblake-pepla-630cf9f29c",
      ),
    ).toBe(true);
  });

  it("2→3 выдаёт «Внимательное наблюдение» и сохраняет коллегию", () => {
    const hero = baseHero(2);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(3);
    expect(result.next.subclass).toBe("Коллегия Черного Пепла");
    expect(
      result.next.abilities.some(
        (ability) => ability.id === "ten-vnimatelnoe-nablyudenie-0e1275c4b7",
      ),
    ).toBe(true);
  });

  it("3→4 сохраняет выборы, включает замену всплеска и «Ночной дозор»", () => {
    const hero = baseHero(3);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(4);
    expect(result.next.subclass).toBe("Коллегия Черного Пепла");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      "shadow.college": "Коллегия Черного Пепла",
    });
    const surge = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "damage-surge",
    );
    expect(surge).toHaveLength(1);
    expect(surge[0].amount).toBe("2");
    expect(result.next.abilities.map((ability) => ability.name)).toContain(
      "Ночной Дозор",
    );
  });

  it("6→7 сохраняет выборы и усиливает начало хода до 1d3 + 1", () => {
    const hero = baseHero(6);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(7);
    expect(result.next.subclass).toBe("Коллегия Черного Пепла");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      "shadow.college": "Коллегия Черного Пепла",
    });
    const start = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "start-of-turn",
    );
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("1d3 + 1");
  });

  it("7→8 выдаёт «Бомбу замедленного действия» коллегии Едкой Алхимии", () => {
    const hero = baseHero(7, "Коллегия Едкой Алхимии");
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(8);
    expect(result.next.subclass).toBe("Коллегия Едкой Алхимии");
    expect(result.next.abilities.map((ability) => ability.name)).toContain(
      "Бомба Замедленного Действия",
    );
    expect(collegeIds(result.next, 8)).toEqual([
      "shadow.college.8.bomba-zamedlennogo-deystviya",
    ]);
  });

  it("9→10 сохраняет выборы, даёт 3 прозрения и «Уловку»", () => {
    const hero = baseHero(9);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(10);
    expect(result.next.subclass).toBe("Коллегия Черного Пепла");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      "shadow.college": "Коллегия Черного Пепла",
    });
    const surge = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "damage-surge",
    );
    expect(surge).toHaveLength(1);
    expect(surge[0].amount).toBe("3");
    expect(
      resolvedEpicResourceGains(result.next).map((gain) => gain.amount),
    ).toEqual(["= Опыт"]);
  });

  it("подарки уровней 3/4/5/6/7/8/9/10 не пусты", () => {
    for (const level of [3, 4, 5, 6, 7, 8, 9, 10]) {
      const hero = baseHero(level - 1);
      const gifts = classFeatureGiftsAtLevel(hero, level).map(
        (feature) => feature.name,
      );
      expect(gifts.length, `уровень ${level}`).toBeGreaterThan(0);
    }
  });
});

describe("Тень: старый и частичный лист", () => {
  it("без подкласса панель просит коллегию, keyed-записи не активны", () => {
    const hero = shadow(8);
    expect(
      classFeatureChoicesForSheet(hero).map((choice) => choice.group),
    ).toContain("shadow.college");
    expect(collegeIds(hero, 1)).toEqual([]);
    expect(collegeIds(hero, 5)).toEqual([]);

    const selected = withClassFeatureSelection(
      hero,
      "shadow.college",
      "Коллегия Маски Арлекина",
    );
    expect(selected.subclass).toBe("Коллегия Маски Арлекина");
    expect(collegeIds(selected, 5)).toEqual([
      "shadow.college.5.gambit-arlekina",
    ]);
    expect(collegeIds(selected, 5)).not.toContain(
      "shadow.college.5.sled-pepla",
    );
  });

  it("выключение и включение автоматизации сохраняет выборы и записи", () => {
    const hero = shadow(
      8,
      { "shadow.college": "Коллегия Маски Арлекина" },
      { subclass: "Коллегия Маски Арлекина" },
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
    expect(off.automation?.classFeatureSelections?.["shadow.college"]).toBe(
      "Коллегия Маски Арлекина",
    );
    expect(on.subclass).toBe("Коллегия Маски Арлекина");
  });
});

describe("Тень: видимый текст без внутренних имён", () => {
  const forbidden = [
    "keyValue",
    "keyedBy",
    "when.",
    "subclass",
    "shadow.feature.",
    "shadow.college.",
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

  it("notes, summary, триггеры и бейджи чисты для всех коллегий и уровней", () => {
    const leaks: string[] = [];
    const heroes: Character[] = [
      shadow(10),
      ...COLLEGE_OPTIONS.map((college) =>
        shadow(10, {}, { subclass: college }),
      ),
    ];
    for (const hero of heroes) {
      const text = visibleText(hero);
      for (const token of forbidden) {
        if (text.includes(token)) {
          leaks.push(`${token} у ${hero.subclass || "без коллегии"}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("ни notes, ни причины TEXT_ONLY не содержат технических имён", () => {
    const leaked: string[] = [];
    for (const feature of SHADOW_FEATURES) {
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

  it("«Теневая форма» — точная заметка, а не постоянный иммунитет", () => {
    for (const id of [
      "shadow.feature.6.tenevaya-forma",
      "shadow.feature.10.uluchshennaya-tenevaya-forma",
    ]) {
      const mechanics = mechanicsFor(id);
      expect(mechanics?.effects, id).toBeUndefined();
      expect(mechanics?.notes, id).toBeTruthy();
    }
    expect(mechanicsFor("shadow.feature.6.tenevaya-forma")?.notes).toContain(
      "5 + ваш уровень",
    );
    expect(mechanicsFor("shadow.feature.6.tenevaya-forma")?.notes).toContain(
      "Лист не переключает форму",
    );
    expect(
      mechanicsFor("shadow.feature.10.uluchshennaya-tenevaya-forma")?.notes,
    ).toContain("покров");
  });

  it("триггеры коллегий имеют книжные событие, частоту и подпись", () => {
    const cases = [
      {
        college: "Коллегия Черного Пепла",
        featureId: "shadow.college.1.vo-vsey-etoy-nerazberikhe",
        event: "take-damage",
      },
      {
        college: "Коллегия Едкой Алхимии",
        featureId: "shadow.college.1.zashchitnyy-perekat",
        event: "take-damage",
      },
      {
        college: "Коллегия Маски Арлекина",
        featureId: "shadow.college.1.umnyy-tryuk",
        event: "use-ability",
      },
    ] as const;

    for (const item of cases) {
      const triggers = classFeatureTriggers(
        shadow(1, {}, { subclass: item.college }),
      ).filter((trigger) => trigger.featureId === item.featureId);
      expect(triggers, item.featureId).toHaveLength(1);
      expect(triggers[0].event, item.featureId).toBe(item.event);
      expect(triggers[0].frequency, item.featureId).toBe("always");
      expect(triggers[0].label.trim(), item.featureId).not.toBe("");
      expect(triggers[0].detail.trim(), item.featureId).not.toBe("");
    }
  });
});
