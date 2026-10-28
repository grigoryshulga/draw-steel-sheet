import { describe, expect, it } from "vitest";
import { resourceSpecFor } from "../src/data/class-features/class-resources";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import {
  NOT_YET,
  TACTICIAN_RESOURCE,
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
  featureSheetChoiceState,
  withClassFeatureSelection,
} from "../src/lib/class-feature-view";
import {
  buildCharacter,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import { changeKit } from "../src/lib/equipment";
import { calculatedValues, kitBonus } from "../src/lib/character-calculations";
import { featureStatContributions } from "../src/lib/feature-modifiers";
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

const TACTICIAN_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Тактик",
);

function tactician(
  level = 1,
  selections: Record<string, string> = {},
  overrides: Partial<Character> = {},
): Character {
  const hero = createCharacter({ className: "Тактик", level });
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

const doctrineIds = (hero: Character, level: number) =>
  activeIds(hero).filter((id) => id.startsWith(`tactician.doctrine.${level}.`));

const sheetNames = (hero: Character) =>
  classFeatureGroupsForSheet(hero)
    .flatMap((group) => group.features)
    .map((feature) => feature.name);

const DOCTRINE_OPTIONS = ["Повстанец", "Воевода", "Авангард"];

describe("Тактик: production-реестры", () => {
  it("ресурс Фокус зарегистрирован, NOT_YET класс больше не держит", () => {
    expect(resourceSpecFor("Тактик")).toBe(TACTICIAN_RESOURCE);
    expect(resourceSpecFor("  тактик ")).toBe(TACTICIAN_RESOURCE);
    expect(NOT_YET["Тактик"]).toBeUndefined();
  });

  it("все 75 записей покрыты механикой или прозой: 67 + 8", () => {
    expect(TACTICIAN_FEATURES).toHaveLength(75);

    const covered = TACTICIAN_FEATURES.filter(
      (feature) => mechanicsFor(feature.id) || TEXT_ONLY[feature.id],
    );
    expect(covered).toHaveLength(75);

    const mechanicsCount = TACTICIAN_FEATURES.filter((feature) =>
      mechanicsFor(feature.id),
    ).length;
    const textOnlyIds = TACTICIAN_FEATURES.filter(
      (feature) => !mechanicsFor(feature.id),
    ).map((feature) => feature.id);

    expect(mechanicsCount).toBe(67);
    expect(textOnlyIds.sort()).toEqual(
      [
        "tactician.feature.10.navyk",
        "tactician.feature.10.perk",
        "tactician.feature.2.perk",
        "tactician.feature.4.navyk",
        "tactician.feature.4.perk",
        "tactician.feature.6.perk",
        "tactician.feature.7.navyk",
        "tactician.feature.8.perk",
      ].sort(),
    );
    expect(
      textOnlyIds.every((id) => (TEXT_ONLY[id] ?? "").trim().length > 10),
    ).toBe(true);
  });

  it("«Метка» не переворачивает сторону преимущества", () => {
    const note = mechanicsFor("tactician.feature.1.metka")?.notes ?? "";
    expect(note).toContain("против него");
    expect(note).not.toContain("Отмеченное существо получает преимущество");
  });

  it("механика без чисел, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = TACTICIAN_FEATURES.map((feature) => ({
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

describe("Тактик: ресурс Фокус и замены 4/7/10 уровней", () => {
  it("1/3 — четыре книжные прибавки, по одной на тег", () => {
    for (const level of [1, 3]) {
      const gains = resolvedResourceGains(tactician(level));
      expect(gains.map((gain) => gain.tag)).toEqual([
        "combat-start",
        "start-of-turn",
        "marked-damage",
        "ally-heroic",
      ]);
      expect(gains.map((gain) => gain.amount)).toEqual([
        "= Победы",
        "2",
        "1",
        "1",
      ]);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(4);
      expect(gains.every((gain) => gain.sourceId === "class:тактик")).toBe(true);
    }
  });

  it("4-й уровень: урон по отмеченному даёт 2 фокуса вместо 1", () => {
    const gains = resolvedResourceGains(tactician(4));
    const marked = gains.filter((gain) => gain.tag === "marked-damage");
    expect(marked).toHaveLength(1);
    expect(marked[0].amount).toBe("2");
    expect(marked[0].sourceId).toBe(
      "tactician.feature.4.fokus-na-ikh-slabosti",
    );
    expect(gains.filter((gain) => gain.tag === "start-of-turn")[0].amount).toBe(
      "2",
    );
  });

  it("7-й уровень: начало хода — 3 фокуса, 10-й — 4", () => {
    const seventh = resolvedResourceGains(tactician(7));
    const sevenStart = seventh.filter((gain) => gain.tag === "start-of-turn");
    expect(sevenStart).toHaveLength(1);
    expect(sevenStart[0].amount).toBe("3");
    expect(sevenStart[0].sourceId).toBe("tactician.feature.7.povyshennyy-fokus");

    const tenth = resolvedResourceGains(tactician(10));
    const tenStart = tenth.filter((gain) => gain.tag === "start-of-turn");
    expect(tenStart).toHaveLength(1);
    expect(tenStart[0].amount).toBe("4");
    expect(tenStart[0].sourceId).toBe("tactician.feature.10.istinnyy-fokus");
    expect(new Set(tenth.map((gain) => gain.tag)).size).toBe(tenth.length);
  });

  it("эпическое «Командование» открывается только на 10-м уровне", () => {
    expect(resolvedEpicResourceGains(tactician(9))).toEqual([]);
    const epic = resolvedEpicResourceGains(tactician(10));
    expect(epic).toHaveLength(1);
    expect(epic[0].amount).toBe("= Опыт");
    expect(epic[0].event).toBe("respite");
    expect(epic[0].frequency).toBe("respite");
    expect(TACTICIAN_RESOURCE.epic?.name).toBe("Командование");
    expect(TACTICIAN_RESOURCE.epic?.level).toBe(10);
  });

  it("записи «Фокус», «Фокус в бою» и «Фокус вне боя» не начисляют ресурс повторно", () => {
    for (const id of [
      "tactician.feature.1.fokus",
      "tactician.feature.1.fokus-v-boyu",
      "tactician.feature.1.fokus-vne-boya",
    ]) {
      const mechanics = mechanicsFor(id);
      expect(mechanics?.kinds, id).toContain("resource");
      expect(mechanics?.resource, id).toBeUndefined();
      expect(mechanics?.notes?.trim(), id).toBeTruthy();
    }
    const command = mechanicsFor("tactician.feature.10.komandovanie");
    expect(command?.kinds).toContain("resource");
    expect(command?.resource).toBeUndefined();
    expect(command?.notes).toContain("Командование");
  });
});

describe("Тактик: доктрина", () => {
  it("Авангард включает только свои keyed-записи 1/2/5/7/8", () => {
    const hero = tactician(8, {}, { subclass: "Авангард" });

    expect(doctrineIds(hero, 1).sort()).toEqual([
      "tactician.doctrine.1.komandirskoe-prisutstvie",
      "tactician.doctrine.1.parirovanie",
    ]);
    expect(doctrineIds(hero, 2)).toEqual([
      "tactician.doctrine.2.prevoskhodstvo-v-blizhnem-boyu",
    ]);
    expect(doctrineIds(hero, 5).sort()).toEqual([
      "tactician.doctrine.5.stryakhnut",
      "tactician.doctrine.5.takticheskoe-nastuplenie",
    ]);
    expect(doctrineIds(hero, 7)).toEqual([
      "tactician.doctrine.7.shok-i-trepet",
    ]);
    expect(doctrineIds(hero, 8)).toEqual([
      "tactician.doctrine.8.videt-kak-vragi-begut-pered-toboy",
    ]);

    const all = activeIds(hero);
    for (const foreign of [
      "tactician.doctrine.1.sekretnye-operatsii",
      "tactician.doctrine.1.prodvinutaya-taktika",
      "tactician.doctrine.2.sprovotsirovannyy",
      "tactician.doctrine.5.zamysel",
      "tactician.doctrine.7.grand-strategiya",
      "tactician.doctrine.8.kleshchevoy-manevr",
    ]) {
      expect(all, foreign).not.toContain(foreign);
    }
  });

  it("пустой подкласс: панель предлагает доктрину, keyed-записи не активны", () => {
    const hero = tactician(8);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "tactician.doctrine",
    );
    expect(choice?.options).toEqual(DOCTRINE_OPTIONS);
    expect(choice?.label).toBe("Доктрина");
    expect(
      activeIds(hero).filter((id) => id.startsWith("tactician.doctrine.")),
    ).toEqual([]);
  });

  it("выбор в панели пишет подкласс и включает только свою доктрину", () => {
    const hero = tactician(8);
    const selected = withClassFeatureSelection(
      hero,
      "tactician.doctrine",
      "Воевода",
    );
    expect(selected.subclass).toBe("Воевода");
    expect(doctrineIds(selected, 1).sort()).toEqual([
      "tactician.doctrine.1.obrazovannyy-komandir",
      "tactician.doctrine.1.prikrytie",
    ]);
    expect(doctrineIds(selected, 7)).toEqual([
      "tactician.doctrine.7.grand-strategiya",
    ]);
    expect(activeIds(selected)).not.toContain(
      "tactician.doctrine.7.shok-i-trepet",
    );
    // Панель больше не предлагает выбор, когда доктрина уже записана.
    expect(
      classFeatureChoicesForSheet(selected).some(
        (item) => item.group === "tactician.doctrine",
      ),
    ).toBe(false);
  });

  it("две доктрины в одном подклассе не активируют ни одной записи", () => {
    const hero = tactician(8, {}, { subclass: "Воевода, Авангард" });
    expect(
      activeIds(hero).filter((id) => id.startsWith("tactician.doctrine.")),
    ).toEqual([]);
    expect(doctrineIds(hero, 5)).toEqual([]);
    // Известное ограничение общего level-up: план может предложить обе
    // способности, но лист не активирует ни одну доктрину. Выбор в панели
    // заменяет значение на одну известную доктрину.
  });

  it("неизвестная доктрина не активирует ни одной вложенной записи", () => {
    const hero = tactician(8, { "tactician.doctrine": "Неизвестная доктрина" });
    hero.subclass = "Неизвестная доктрина";
    expect(
      activeIds(hero).filter((id) => id.startsWith("tactician.doctrine.")),
    ).toEqual([]);
    expect(doctrineIds(hero, 1)).toEqual([]);
  });

  it("подписи доктринных записей читаются по-русски и без внутренних имён", () => {
    const hero = tactician(8, {}, { subclass: "Повстанец" });
    const groups = classFeatureGroupsForSheet(hero);
    const names = groups.flatMap((group) => group.features.map((item) => item.name));
    expect(names).toContain("Секретные операции");
    expect(names).toContain("Продвинутая тактика");
    const badge = groups
      .flatMap((group) => group.features)
      .find((item) => item.name === "Секретные операции")
      ?.badges.find((item) => item.kind === "choice");
    expect(badge?.label).toBe("доктрина: Повстанец");
  });
});

describe("Тактик: контейнеры способностей 2/6/9 уровней", () => {
  const containers = (level: number) => {
    const noun = level === 2 ? "sposobnost" : "sposobnosti";
    return [
      ["Повстанец", `tactician.feature.${level}.${noun}-povstantsa-${level}-go-urovnya`],
      ["Воевода", `tactician.feature.${level}.${noun}-voevody-${level}-go-urovnya`],
      ["Авангард", `tactician.feature.${level}.${noun}-avangarda-${level}-go-urovnya`],
    ] as const;
  };

  it("каждый уровень показывает контейнер только своей доктрине", () => {
    for (const level of [2, 6, 9]) {
      for (const [doctrine, own] of containers(level)) {
        const ids = activeIds(tactician(9, {}, { subclass: doctrine }));
        expect(ids, `${doctrine} ${level}`).toContain(own);
        for (const [other, foreign] of containers(level)) {
          if (other === doctrine) continue;
          expect(ids, `${doctrine} ${level} / ${other}`).not.toContain(foreign);
        }
      }
    }
  });

  it("условие контейнера — название доктрины, а не номер уровня", () => {
    for (const level of [2, 6, 9]) {
      for (const [doctrine, id] of containers(level)) {
        expect(mechanicsFor(id)?.when?.keyValue, id).toEqual([doctrine]);
      }
    }
  });

  it("выбор одной способности ведёт повышение уровня по доктрине", () => {
    const level2 = getLevelUpPlan(tactician(1, {}, { subclass: "Авангард" }));
    const choice2 = level2.choices.find((choice) =>
      choice.label.includes("Авангард"),
    );
    expect(choice2?.count).toBe(1);
    expect(choice2?.options).toHaveLength(2);

    const level6 = getLevelUpPlan(tactician(5, {}, { subclass: "Воевода" }));
    const choice6 = level6.choices.find((choice) =>
      choice.label.includes("Воевода"),
    );
    expect(choice6?.count).toBe(1);
    expect(choice6?.options).toHaveLength(2);

    const level9 = getLevelUpPlan(tactician(8, {}, { subclass: "Повстанец" }));
    const choice9 = level9.choices.find((choice) =>
      choice.label.includes("Повстанец"),
    );
    expect(choice9?.count).toBe(1);
    expect(choice9?.options).toHaveLength(2);
  });
});

describe("Тактик: повышение уровня", () => {
  const ENOUGH_XP = 160;

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

  function expectOk(result: LevelUpPreview): LevelUpPreview & { ok: true } {
    expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
    if (!result.ok) throw new Error(result.issues.join("; "));
    return result;
  }

  const selections = { "tactician.doctrine": "Авангард" };

  function baseHero(level: number): Character {
    return tactician(level, selections, {
      subclass: "Авангард",
      xp: ENOUGH_XP,
    });
  }

  it("1→2 сохраняет доктрину и выборы, ресурс остаётся четырёхстрочным", () => {
    const hero = baseHero(1);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(2);
    expect(result.next.subclass).toBe("Авангард");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);
    expect(resolvedResourceGains(result.next)).toHaveLength(4);
    expect(result.next.abilities.length).toBeGreaterThan(hero.abilities.length);
  });

  it("3→4 сохраняет выборы и включает замену урона по отмеченному", () => {
    const hero = baseHero(3);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(4);
    expect(result.next.subclass).toBe("Авангард");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);
    const marked = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "marked-damage",
    );
    expect(marked).toHaveLength(1);
    expect(marked[0].amount).toBe("2");
  });

  it("6→7 сохраняет выборы и усиливает начало хода до 3", () => {
    const hero = baseHero(6);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(7);
    expect(result.next.subclass).toBe("Авангард");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);
    const start = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "start-of-turn",
    );
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("3");
  });

  it("9→10 сохраняет выборы, даёт 4 фокуса и «Командование»", () => {
    const hero = baseHero(9);
    const result = expectOk(previewLevelUp(hero, request(hero)));
    expect(result.next.level).toBe(10);
    expect(result.next.subclass).toBe("Авангард");
    expect(result.next.automation?.classFeatureSelections).toEqual(selections);
    const start = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "start-of-turn",
    );
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("4");
    expect(resolvedEpicResourceGains(result.next).map((gain) => gain.amount)).toEqual([
      "= Опыт",
    ]);
  });

  it("подарки уровней 3/4/5/7/8/10 не пусты", () => {
    const expected: Record<number, string> = {
      3: "Вне позиции",
      4: "Увеличение характеристик",
      5: "Стряхнуть",
      7: "Повышенный фокус",
      8: "Видеть, как враги бегут перед тобой",
      10: "Истинный фокус",
    };
    for (const [level, name] of Object.entries(expected)) {
      const hero = baseHero(Number(level) - 1);
      const gifts = classFeatureGiftsAtLevel(hero, Number(level)).map(
        (feature) => feature.name,
      );
      expect(gifts, `уровень ${level}`).toContain(name);
      expect(gifts.length, `уровень ${level}`).toBeGreaterThan(0);
    }
  });
});

describe("Тактик: создание героя с двумя комплектами", () => {
  function draft() {
    return {
      ...emptyBuilderDraft(),
      name: "Тестовый тактик",
      ancestry: "Дварф",
      traits: ["Заземленность", "Искра с твоей кожи"],
      className: "Тактик",
      subclass: "Авангард",
      characteristics: startingCharacteristics("Тактик"),
      kit: "Сияющие Доспехи",
      secondaryKit: "Снайпер",
      meleeDamageKit: "Сияющие Доспехи",
      rangedDamageKit: "Снайпер",
    };
  }

  it("сохраняет доктрину и оба комплекта, выдаёт обе знаковые способности", () => {
    const hero = buildCharacter(draft());
    expect(hero.subclass).toBe("Авангард");
    expect(hero.kit).toBe("Сияющие Доспехи");
    expect(hero.secondaryKit).toBe("Снайпер");
    const kitSources = new Set(
      hero.abilities
        .map((ability) => ability.source)
        .filter((source) => source.startsWith("Комплект:")),
    );
    expect(kitSources).toEqual(
      new Set(["Комплект: Сияющие Доспехи", "Комплект: Снайпер"]),
    );
  });

  it("лист показывает доктринные записи героя, но не чужие", () => {
    const hero = buildCharacter(draft());
    const names = sheetNames(hero);
    expect(names).toContain("Парирование");
    expect(names).toContain("Командирское присутствие");
    expect(names).not.toContain("Прикрытие");
    expect(names).not.toContain("Секретные операции");
  });

  it("смена комплектов сохраняет доктрину и не удваивает бонус", () => {
    const hero = buildCharacter(draft());
    const doctrineIds = activeIds(hero).filter((id) =>
      id.startsWith("tactician.doctrine."),
    );
    const switched = changeKit(
      changeKit(hero, "Мастер Боевых Искусств"),
      "Гора",
      true,
    );
    expect(switched.subclass).toBe("Авангард");
    expect(
      activeIds(switched).filter((id) => id.startsWith("tactician.doctrine.")),
    ).toEqual(doctrineIds);
    const doubled = changeKit(switched, switched.kit, true);
    expect(doubled.secondaryKit).toBe(doubled.kit);
    const stamina = calculatedValues(doubled).stamina;
    const once =
      calculatedValues({ ...doubled, secondaryKit: "" }).stamina;
    expect(stamina).toBe(once);
    expect(kitBonus(doubled, "выносливости")).toBe(
      kitBonus({ ...doubled, secondaryKit: "" }, "выносливости"),
    );
  });

  it("«Полевой арсенал» не дублирует бонусы комплектов", () => {
    const hero = buildCharacter(draft());
    expect(mechanicsFor("tactician.feature.1.polevoy-arsenal")?.effects).toBeUndefined();
    const stamina = featureStatContributions(hero, "stamina");
    expect(
      stamina.some(
        (contribution) =>
          contribution.sourceId === "tactician.feature.1.polevoy-arsenal",
      ),
    ).toBe(false);
  });
});

describe("Тактик: старый и частичный лист", () => {
  it("без подкласса панель просит доктрину, после выбора — ровно своя", () => {
    const hero = tactician(8);
    expect(
      classFeatureChoicesForSheet(hero).map((choice) => choice.group),
    ).toContain("tactician.doctrine");
    expect(doctrineIds(hero, 5)).toEqual([]);

    const selected = withClassFeatureSelection(
      hero,
      "tactician.doctrine",
      "Повстанец",
    );
    expect(selected.subclass).toBe("Повстанец");
    expect(doctrineIds(selected, 5).sort()).toEqual([
      "tactician.doctrine.5.ne-ostavlyat-sledov",
      "tactician.doctrine.5.otvlechenie",
    ]);
    expect(doctrineIds(selected, 5)).not.toContain(
      "tactician.doctrine.5.zamysel",
    );
  });

  it("выключение и включение автоматизации сохраняет выборы и записи", () => {
    const hero = tactician(8, { "tactician.doctrine": "Воевода" }, {
      subclass: "Воевода",
    });
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
    expect(off.automation?.classFeatureSelections?.["tactician.doctrine"]).toBe(
      "Воевода",
    );
    expect(on.subclass).toBe("Воевода");
  });

  it("неизвестный сохранённый выбор показывает предупреждение без доменов", () => {
    const state = featureSheetChoiceState({
      group: "tactician.doctrine",
      label: "Доктрина",
      options: DOCTRINE_OPTIONS,
      selected: "Неизвестная доктрина",
    });
    expect(state.selectedOption).toBe("");
    expect(state.warning).toContain("не входит в список доступных вариантов");
    expect(state.warning).not.toContain("домен");
  });
});

describe("Тактик: видимый текст без внутренних имён", () => {
  const forbidden = [
    "keyValue",
    "when.",
    "subclass",
    "secondaryKit",
    "tactician.feature.",
    "tactician.doctrine.",
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

  it("notes, summary, триггеры и бейджи чисты для всех доктрин и уровней", () => {
    const leaks: string[] = [];
    const heroes: Character[] = [
      tactician(10),
      ...DOCTRINE_OPTIONS.map((doctrine) =>
        tactician(10, {}, { subclass: doctrine }),
      ),
    ];
    for (const hero of heroes) {
      const text = visibleText(hero);
      for (const token of forbidden) {
        if (text.includes(token)) {
          leaks.push(`${token} у ${hero.subclass || "без доктрины"}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("ни notes, ни причины TEXT_ONLY не содержат технических имён", () => {
    const leaked: string[] = [];
    for (const feature of TACTICIAN_FEATURES) {
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

  it("триггеры доктрины и уровней имеют книжные событие, частоту и подпись", () => {
    const cases = [
      {
        hero: tactician(8, {}, { subclass: "Повстанец" }),
        featureId: "tactician.feature.3.vne-pozitsii",
        event: "combat-start",
        frequency: "encounter",
      },
      {
        hero: tactician(8, {}, { subclass: "Авангард" }),
        featureId: "tactician.doctrine.5.stryakhnut",
        event: "start-of-turn",
        frequency: "turn",
      },
      {
        hero: tactician(8, {}, { subclass: "Авангард" }),
        featureId: "tactician.feature.7.zakhvat-initsiativy",
        event: "combat-start",
        frequency: "encounter",
      },
    ] as const;

    for (const item of cases) {
      const triggers = classFeatureTriggers(item.hero).filter(
        (trigger) => trigger.featureId === item.featureId,
      );
      expect(triggers, item.featureId).toHaveLength(1);
      expect(triggers[0].event, item.featureId).toBe(item.event);
      expect(triggers[0].frequency, item.featureId).toBe(item.frequency);
      expect(triggers[0].label.trim(), item.featureId).not.toBe("");
      expect(triggers[0].detail.trim(), item.featureId).not.toBe("");
    }
  });
});
