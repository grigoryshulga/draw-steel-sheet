import { describe, expect, it } from "vitest";
import {
  FEATURE_MECHANICS,
  TEXT_ONLY,
  mechanicsFor,
} from "../src/data/class-features/mechanics";
import { resourceSpecFor } from "../src/data/class-features/class-resources";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { CLASS_FEATURE_GROUPS } from "../src/data/class-feature-rules";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "../src/lib/class-features";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
  withClassFeatureSelection,
} from "../src/lib/class-feature-view";
import {
  buildCharacter,
  emptyBuilderDraft,
  selectableClassAbilities,
  startingCharacteristics,
} from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import {
  featureAbilityDamageBonus,
  featureAbilityDamageContributions,
  featureAbilityDistanceContributions,
  featureDamageImmunities,
  featureStatBonus,
  featureStatContributions,
} from "../src/lib/feature-modifiers";
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
import type { Ability, Character } from "../src/types";

/** Элементалист с выбранными опциями; значения — как их пишет билдер. */
function elementalist(
  level = 1,
  selections: Record<string, string> = {},
  overrides: Partial<Character> = {},
): Character {
  const hero = createCharacter({ className: "Элементалист", level });
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: selections,
  };
  return { ...hero, ...overrides };
}

const BATTLE = { "elementalist.enchantment": "Зачарование битвы" };
const SPEED = { "elementalist.enchantment": "Зачарование быстроты" };
const DESTRUCTION = { "elementalist.enchantment": "Зачарование разрушения" };
const DISTANCE = { "elementalist.enchantment": "Зачарование дистанции" };
const CONSTANCY = { "elementalist.enchantment": "Зачарование постоянства" };
const SUPERIOR = { "elementalist.sanctuary": "Оберег превосходной защиты" };

function ability(
  keywords: string[],
  overrides: Partial<Ability> = {},
): Ability {
  return {
    id: `test-${keywords.join("-")}`,
    name: "Тестовая способность",
    flavor: "",
    actionType: "main",
    kind: "signature",
    keywords,
    distance: "Дальний 10",
    target: "Одно существо",
    rollCharacteristics: ["reason"],
    preferredCharacteristic: "reason",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "3 + Р", effect: "" },
      { damage: "5 + Р", effect: "" },
      { damage: "7 + Р", effect: "" },
    ],
    effect: "",
    source: "",
    notes: "",
    ...overrides,
  };
}

const magicAbility = () => ability(["Магия"]);
const rangedMagic = () => ability(["Магия", "Дальний"], { weaponMode: "ranged" });
const weaponAbility = () => ability(["Оружие"]);
const fireAbility = () => ability(["Огонь", "Магия"]);

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

const ELEMENTALIST_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Элементалист",
);
const STAGE_ONE = ELEMENTALIST_FEATURES.filter((feature) => feature.level <= 4);

describe("Элементалист: production-реестры", () => {
  it("ресурс Эссенция и эпическое Веяние заданы", () => {
    const spec = resourceSpecFor("Элементалист");
    expect(spec?.name).toBe("Эссенция");
    expect(spec?.canBeNegative).toBeUndefined();
    expect(spec?.epic?.name).toBe("Веяние");
    expect(spec?.epic?.level).toBe(10);
  });

  it("уровни 1–4 покрыты механикой или прозой с причиной", () => {
    expect(STAGE_ONE).toHaveLength(59);
    const uncovered = STAGE_ONE.filter((feature) => {
      if (mechanicsFor(feature.id)) return false;
      const reason = TEXT_ONLY[feature.id];
      return typeof reason !== "string" || reason.trim() === "";
    });
    expect(
      uncovered.map((feature) => `${feature.name} (ур. ${feature.level})`),
    ).toEqual([]);
  });

  it("механика без эффектов, триггера, выбора и ресурса объяснена в notes", () => {
    const silent = STAGE_ONE.map((feature) => ({
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

describe("Элементалист: Эссенция", () => {
  it("на 1-м и 3-м уровнях три прибавки из книги", () => {
    for (const level of [1, 3]) {
      const gains = resolvedResourceGains(elementalist(level));
      expect(
        gains.map(
          (gain) =>
            `${gain.tag}:${gain.event}:${gain.amount}:${gain.frequency}`,
        ),
      ).toEqual([
        "combat-start:combat-start:= Победы:encounter",
        "start-of-turn:start-of-turn:2:turn",
        "damage-nearby:take-damage:1:round",
      ]);
      expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
      expect(gains.every((gain) => gain.sourceId === "class:элементалист")).toBe(
        true,
      );
    }
  });

  it("4-й уровень заменяет урон рядом на 2 эссенции", () => {
    const gains = resolvedResourceGains(elementalist(4));
    const nearby = gains.filter((gain) => gain.tag === "damage-nearby");
    expect(nearby).toHaveLength(1);
    expect(nearby[0].amount).toBe("2");
    expect(nearby[0].sourceId).toBe(
      "feature.elementalist.level-4.font-of-essence",
    );
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
  });

  it("записи Эссенции не дублируют прибавки", () => {
    for (const id of [
      "feature.elementalist.level-1.essence",
      "feature.elementalist.level-1.essence-in-combat",
      "feature.elementalist.level-1.essence-outside-of-combat",
    ]) {
      expect(mechanicsFor(id)?.resource, id).toBeUndefined();
      expect(mechanicsFor(id)?.kinds, id).toContain("resource");
    }
  });

  it("до 10-го уровня эпического пула нет, на 10-м он «Веяние»", () => {
    expect(resolvedEpicResourceGains(elementalist(9))).toEqual([]);
    expect(
      resolvedEpicResourceGains(elementalist(10)).map(
        (gain) => `${gain.event}:${gain.amount}:${gain.frequency}`,
      ),
    ).toEqual(["respite:= Опыт:respite"]);
  });
});

describe("Элементалист: миграция старого реестра", () => {
  const ENCHANTMENTS = [
    ["elementalist.enchantment.battle", "Зачарование битвы"],
    ["elementalist.enchantment.speed", "Зачарование быстроты"],
    ["elementalist.enchantment.destruction", "Зачарование разрушения"],
    ["elementalist.enchantment.distance", "Зачарование дистанции"],
    ["elementalist.enchantment.constancy", "Зачарование постоянства"],
  ] as const;
  const SANCTUARIES = [
    [
      "elementalist.sanctuary.delightful",
      "Оберег восхитительных последствий",
      "feature.elementalist.level-1.ward-of-delightful-consequences",
    ],
    [
      "elementalist.sanctuary.superior",
      "Оберег превосходной защиты",
      "feature.elementalist.level-1.ward-of-excellent-protection",
    ],
    [
      "elementalist.sanctuary.nature",
      "Оберег привязанности природы",
      "feature.elementalist.level-1.ward-of-natures-affection",
    ],
    [
      "elementalist.sanctuary.reactivity",
      "Оберег удивительной реактивности",
      "feature.elementalist.level-1.ward-of-surprising-reactivity",
    ],
  ] as const;

  it("эффектов в опциях старого реестра не осталось", () => {
    const options = CLASS_FEATURE_GROUPS.filter(
      (group) => group.className === "Элементалист",
    ).flatMap((group) => group.options);
    expect(options).toHaveLength(9);
    for (const option of options) {
      expect("effects" in option, option.id).toBe(false);
      expect("manualReason" in option, option.id).toBe(false);
    }
  });

  it("старый ID и русское имя активируют ровно одно зачарование", () => {
    const childIds = [
      "feature.elementalist.level-1.enchantment-of-battle",
      "feature.elementalist.level-1.enchantment-of-celerity",
      "feature.elementalist.level-1.enchantment-of-destruction",
      "feature.elementalist.level-1.enchantment-of-distance",
      "feature.elementalist.level-1.enchantment-of-permanence",
    ];
    for (const [index, [id, name]] of ENCHANTMENTS.entries()) {
      for (const value of [id, name]) {
        const hero = elementalist(1, { "elementalist.enchantment": value });
        const active = activeIds(hero).filter((featureId) =>
          childIds.includes(featureId),
        );
        expect(active, value).toEqual([childIds[index]]);
      }
    }
  });

  it("старый ID и русское имя активируют ровно один оберег", () => {
    for (const [id, name, childId] of SANCTUARIES) {
      for (const value of [id, name]) {
        const hero = elementalist(1, { "elementalist.sanctuary": value });
        const active = activeIds(hero).filter((featureId) =>
          [
            "feature.elementalist.level-1.ward-of-delightful-consequences",
            "feature.elementalist.level-1.ward-of-excellent-protection",
            "feature.elementalist.level-1.ward-of-natures-affection",
            "feature.elementalist.level-1.ward-of-surprising-reactivity",
          ].includes(featureId),
        );
        expect(active, value).toEqual([childId]);
      }
    }
  });

  it("битва: 3 выносливости и 1 урона, с комплектом и без флагов — 0", () => {
    const equipped = elementalist(1, BATTLE, {
      automation: {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        classFeatureSelections: BATTLE,
        equipment: { lightArmor: true, lightWeapon: true },
      },
    });
    expect(featureStatContributions(equipped, "stamina")).toEqual([
      {
        sourceId: "feature.elementalist.level-1.enchantment-of-battle",
        sourceName: "Зачарование битвы",
        value: 3,
      },
    ]);
    expect(featureAbilityDamageContributions(weaponAbility(), equipped)).toEqual([
      {
        sourceId: "feature.elementalist.level-1.enchantment-of-battle",
        sourceName: "Зачарование битвы",
        value: 1,
      },
    ]);
    expect(featureStatBonus({ ...equipped, level: 4 }, "stamina")).toBe(6);

    expect(
      featureStatContributions({ ...equipped, kit: "Воинский комплект" }, "stamina"),
    ).toEqual([]);
    expect(
      featureAbilityDamageBonus(weaponAbility(), {
        ...equipped,
        kit: "Воинский комплект",
      }),
    ).toBe(0);

    const withoutFlags = elementalist(1, BATTLE);
    expect(featureStatContributions(withoutFlags, "stamina")).toEqual([]);
    expect(featureAbilityDamageBonus(weaponAbility(), withoutFlags)).toBe(0);
  });

  it("быстрота: +1 скорость и +1 отход на всех уровнях", () => {
    for (const level of [1, 4, 10]) {
      const hero = elementalist(level, SPEED);
      expect(featureStatContributions(hero, "speed"), String(level)).toEqual([
        {
          sourceId: "feature.elementalist.level-1.enchantment-of-celerity",
          sourceName: "Зачарование быстроты",
          value: 1,
        },
      ]);
      expect(featureStatBonus(hero, "disengage")).toBe(1);
    }
  });

  it("разрушение: +1 только магическим способностям", () => {
    const hero = elementalist(1, DESTRUCTION);
    expect(featureAbilityDamageContributions(magicAbility(), hero)).toEqual([
      {
        sourceId: "feature.elementalist.level-1.enchantment-of-destruction",
        sourceName: "Зачарование разрушения",
        value: 1,
      },
    ]);
    expect(featureAbilityDamageContributions(weaponAbility(), hero)).toEqual([]);
  });

  it("дистанция: +2 только дальнобойной магии", () => {
    const hero = elementalist(1, DISTANCE);
    expect(featureAbilityDistanceContributions(rangedMagic(), hero)).toEqual([
      {
        sourceId: "feature.elementalist.level-1.enchantment-of-distance",
        sourceName: "Зачарование дистанции",
        value: 2,
      },
    ]);
    expect(
      featureAbilityDistanceContributions(
        ability(["Магия", "Дальний"], { weaponMode: "melee" }),
        hero,
      ),
    ).toEqual([]);
  });

  it("постоянство: 6 выносливости и 1 устойчивость, на 4-м уровне 12", () => {
    const hero = elementalist(1, CONSTANCY);
    expect(featureStatContributions(hero, "stamina")).toEqual([
      {
        sourceId: "feature.elementalist.level-1.enchantment-of-permanence",
        sourceName: "Зачарование постоянства",
        value: 6,
      },
    ]);
    expect(featureStatContributions(hero, "stability")).toEqual([
      {
        sourceId: "feature.elementalist.level-1.enchantment-of-permanence",
        sourceName: "Зачарование постоянства",
        value: 1,
      },
    ]);
    expect(featureStatBonus({ ...hero, level: 4 }, "stamina")).toBe(12);
  });

  it("превосходная защита: иммунитет к семи типам равен Разуму", () => {
    const hero = elementalist(1, SUPERIOR);
    const immunity = featureDamageImmunities(hero);
    expect(immunity).toHaveLength(1);
    expect(immunity[0].sourceId).toBe(
      "feature.elementalist.level-1.ward-of-excellent-protection",
    );
    expect(immunity[0].types).toEqual([
      "кислота",
      "холод",
      "порча",
      "огонь",
      "молния",
      "яд",
      "звук",
    ]);
    expect(immunity[0].value).toBe(hero.characteristics.reason);
  });

  it("реактивные обереги дают точные события и частоты", () => {
    const cases = [
      [
        "Оберег восхитительных последствий",
        "take-damage",
        "round",
        "Первый раз за раунд: ты получаешь урон",
      ],
      [
        "Оберег привязанности природы",
        "take-damage",
        "always",
        "Существо в пределах Разума наносит тебе урон",
      ],
      [
        "Оберег удивительной реактивности",
        "adjacent-enemy-damages-you",
        "always",
        "Смежное существо наносит тебе урон",
      ],
    ] as const;
    for (const [name, event, frequency, label] of cases) {
      const hero = elementalist(1, { "elementalist.sanctuary": name });
      const triggers = classFeatureTriggers(hero).filter((trigger) =>
        trigger.featureId.startsWith("feature.elementalist.level-1.ward-of-"),
      );
      expect(triggers, name).toHaveLength(1);
      expect(triggers[0].event).toBe(event);
      expect(triggers[0].frequency).toBe(frequency);
      expect(triggers[0].label).toBe(label);
      expect(triggers[0].detail.trim()).not.toBe("");
    }
  });
});

describe("Элементалист: специализация как подкласс", () => {
  const SPECIALIZATIONS = {
    Земля: [
      "feature.elementalist.level-1.earth-acolyte-of-earth",
      "feature.elementalist.level-1.motivate-earth",
      "feature.ability.elementalist.level-1.skin-like-castle-walls",
      "feature.elementalist.level-2.disciple-of-earth",
      "feature.elementalist.level-3.earth-accepts-me",
      "feature.elementalist.level-4.quaking-earth",
    ],
    Огонь: [
      "feature.elementalist.level-1.fire-acolyte-of-fire",
      "feature.elementalist.level-1.return-to-formlessness",
      "feature.ability.elementalist.level-1.explosive-assistance",
      "feature.elementalist.level-2.disciple-of-fire",
      "feature.elementalist.level-3.a-conversation-with-fire",
      "feature.elementalist.level-4.burning-grounds",
    ],
    Зелень: [
      "feature.elementalist.level-1.green-acolyte-of-the-green",
      "feature.elementalist.level-1.it-is-the-soul-which-hears",
      "feature.ability.elementalist.level-1.breath-of-dawn-remembered",
      "feature.elementalist.level-2.disciple-of-the-green",
      "feature.elementalist.level-3.remember-growth-and-sun-and-rain",
      "feature.elementalist.level-4.flowering-bed",
    ],
    Пустота: [
      "feature.elementalist.level-1.void-acolyte-of-the-mystery",
      "feature.elementalist.level-1.a-beyonding-of-vision",
      "feature.ability.elementalist.level-1.subtle-relocation",
      "feature.elementalist.level-2.there-is-no-space-between",
      "feature.elementalist.level-3.distance-is-only-memory",
      "feature.elementalist.level-4.veiling-bed",
    ],
  } as const;

  it("каждая специализация включает только свои записи", () => {
    const allIds = Object.values(SPECIALIZATIONS).flat();
    for (const [subclass, ownIds] of Object.entries(SPECIALIZATIONS)) {
      const ids = activeIds(elementalist(4, {}, { subclass }));
      for (const ownId of ownIds) {
        expect(ids, `${subclass}: ${ownId}`).toContain(ownId);
      }
      const foreign = allIds.filter((id) => !ownIds.includes(id));
      expect(
        ids.filter((id) => foreign.includes(id)),
        subclass,
      ).toEqual([]);
    }
  });

  it("чужая, неизвестная и двойная специализация не включают записи", () => {
    const specializationIds = Object.values(SPECIALIZATIONS).flat();
    for (const subclass of ["Воздух", "Гниль", "Вода", "Земля, Огонь", ""]) {
      const ids = activeIds(elementalist(4, {}, { subclass }));
      expect(
        ids.filter((id) => specializationIds.includes(id)),
        subclass || "пусто",
      ).toEqual([]);
    }
  });

  it("пустой подкласс: панель предлагает выбор и пишет его в subclass", () => {
    const hero = elementalist(4);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "elementalist.specialization",
    );
    expect(choice?.options).toEqual(["Земля", "Огонь", "Зелень", "Пустота"]);
    expect(choice?.selected).toBeUndefined();

    const selected = withClassFeatureSelection(
      hero,
      "elementalist.specialization",
      "Огонь",
    );
    expect(selected.subclass).toBe("Огонь");
    expect(
      selected.automation?.classFeatureSelections?.[
        "elementalist.specialization"
      ],
    ).toBe("Огонь");
    expect(activeIds(selected)).toContain(
      "feature.elementalist.level-2.disciple-of-fire",
    );
    expect(activeIds(selected)).not.toContain(
      "feature.elementalist.level-2.disciple-of-earth",
    );
  });
});

describe("Элементалист: числа уровня", () => {
  it("Ученик Земли: 6/9/30 выносливости на 2/3/10 уровнях", () => {
    for (const [level, value] of [
      [2, 6],
      [3, 9],
      [10, 30],
    ] as const) {
      const hero = elementalist(level, {}, { subclass: "Земля" });
      expect(featureStatContributions(hero, "stamina"), String(level)).toEqual([
        {
          sourceId: "feature.elementalist.level-2.disciple-of-earth",
          sourceName: "Ученик Земли",
          value,
        },
      ]);
    }
  });

  it("Ученик Огня: иммунитет 7/12 на 2/7 уровнях", () => {
    for (const [level, value] of [
      [2, 7],
      [7, 12],
    ] as const) {
      const hero = elementalist(level, {}, { subclass: "Огонь" });
      const immunity = featureDamageImmunities(hero);
      expect(immunity).toHaveLength(1);
      expect(immunity[0].types).toEqual(["огонь"]);
      expect(immunity[0].value).toBe(value);
    }
  });

  it("Аколит Огня даёт +1 огненной магии", () => {
    const hero = elementalist(1, {}, { subclass: "Огонь" });
    expect(featureAbilityDamageContributions(fireAbility(), hero)).toEqual([
      {
        sourceId: "feature.elementalist.level-1.fire-acolyte-of-fire",
        sourceName: "Огонь: Аколит Огня",
        value: 1,
      },
    ]);
    expect(featureAbilityDamageBonus(magicAbility(), hero)).toBe(0);
  });

  it("иммунитет к урону читается строкой, а не внутренним типом", () => {
    const id = "feature.elementalist.level-1.ward-of-excellent-protection";
    const saved = FEATURE_MECHANICS[id];
    FEATURE_MECHANICS[id] = {
      kinds: ["bonus", "immunity"],
      when: saved.when,
      effects: [
        { kind: "damageImmunity", types: ["урон"], value: 5 },
      ],
    };
    try {
      const hero = elementalist(1, SUPERIOR);
      const item = classFeatureGroupsForSheet(hero)
        .flatMap((group) => group.features)
        .find((feature) => feature.name === "Оберег превосходной защиты");
      expect(item?.summary).toContain("иммунитет к урону 5");
      expect(item?.summary).not.toContain("(урон)");
      expect(item?.summary).not.toContain("damageImmunity");
    } finally {
      FEATURE_MECHANICS[id] = saved;
    }
  });
});

describe("Элементалист: контейнеры способностей 2–4 уровней", () => {
  it("выборы способностей видны независимо от специализации", () => {
    for (const subclass of ["Земля", "Огонь", "Зелень", "Пустота"]) {
      const hero = elementalist(4, {}, { subclass });
      const ids = activeIds(hero);
      expect(ids).toContain(
        "feature.elementalist.level-2.new-5-essence-ability",
      );
      expect(ids).toContain("feature.elementalist.level-3.7-essence-ability");
      expect(mechanicsFor("feature.elementalist.level-2.new-5-essence-ability")?.kinds).toEqual([
        "choice",
        "grant",
      ]);
      expect(mechanicsFor("feature.elementalist.level-3.7-essence-ability")?.kinds).toEqual([
        "choice",
        "grant",
      ]);
    }
  });
});

describe("Элементалист: создание героя и старый лист", () => {
  it("buildCharacter пишет старые ID, подкласс и способности", () => {
    const hero = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Земляной маг",
      className: "Элементалист",
      subclass: "Земля",
      characteristics: startingCharacteristics("Элементалист"),
      featureChoices: {
        "Зачарование": "Зачарование битвы",
        "Оберег элементалиста": "Оберег превосходной защиты",
      },
    });
    expect(hero.subclass).toBe("Земля");
    expect(hero.automation?.classFeatureSelections).toEqual({
      "elementalist.enchantment": "elementalist.enchantment.battle",
      "elementalist.sanctuary": "elementalist.sanctuary.superior",
    });
    const ids = activeIds(hero);
    expect(ids).toContain("feature.elementalist.level-1.enchantment-of-battle");
    expect(ids).toContain(
      "feature.elementalist.level-1.ward-of-excellent-protection",
    );
    expect(ids).toContain("feature.elementalist.level-1.earth-acolyte-of-earth");
    expect(ids).not.toContain("feature.elementalist.level-1.fire-acolyte-of-fire");

    const reloaded = JSON.parse(JSON.stringify(hero)) as Character;
    expect(reloaded.subclass).toBe("Земля");
    expect(reloaded.automation?.classFeatureSelections).toEqual(
      hero.automation?.classFeatureSelections,
    );
  });

  it("каждая специализация выдаёт свои способности 1-го уровня", () => {
    const expected: Record<string, string[]> = {
      Земля: ["Побудить Землю", "Кожа Как Стены Замка"],
      Огонь: ["Возврат к Бесформенности", "Взрывная Помощь"],
      Зелень: ["Воспоминание о Дыхании Рассвета"],
      Пустота: ["Незаметное Перемещение", "Разделенное Чувство Пустоты"],
    };
    for (const [subclass, names] of Object.entries(expected)) {
      const draft = {
        ...emptyBuilderDraft(),
        name: `Маг ${subclass}`,
        className: "Элементалист",
        subclass,
        characteristics: startingCharacteristics("Элементалист"),
      };
      const hero = buildCharacter(draft);
      const grantedNames = hero.abilities
        .filter((ability) => ability.source === "Элементалист")
        .map((ability) => ability.name);
      for (const name of names) expect(grantedNames).toContain(name);
      expect(grantedNames.filter((name) => name === "Разделенное Чувство Пустоты"))
        .toHaveLength(subclass === "Пустота" ? 1 : 0);
      const selectable = selectableClassAbilities({
        ...draft,
        abilityIds: [],
      });
      if (subclass === "Пустота") {
        expect(
          selectable.some(
            (ability) => ability.name === "Разделенное Чувство Пустоты",
          ),
        ).toBe(false);
      }
    }
  });

  it("старый лист без выбора получает панель и ноль бонусов", () => {
    const hero = elementalist(1);
    expect(featureStatBonus(hero, "stamina")).toBe(0);
    expect(featureAbilityDamageBonus(weaponAbility(), hero)).toBe(0);

    const choices = classFeatureChoicesForSheet(hero);
    const enchantment = choices.find(
      (choice) => choice.group === "elementalist.enchantment",
    );
    expect(enchantment?.options).toEqual([
      "elementalist.enchantment.battle",
      "elementalist.enchantment.speed",
      "elementalist.enchantment.destruction",
      "elementalist.enchantment.distance",
      "elementalist.enchantment.constancy",
    ]);
    expect(enchantment?.optionLabels?.["elementalist.enchantment.battle"]).toBe(
      "Зачарование битвы",
    );
    const sanctuary = choices.find(
      (choice) => choice.group === "elementalist.sanctuary",
    );
    expect(sanctuary?.options).toEqual([
      "elementalist.sanctuary.delightful",
      "elementalist.sanctuary.superior",
      "elementalist.sanctuary.nature",
      "elementalist.sanctuary.reactivity",
    ]);

    const selected = withClassFeatureSelection(
      hero,
      "elementalist.enchantment",
      "elementalist.enchantment.destruction",
    );
    expect(featureAbilityDamageContributions(magicAbility(), selected)).toEqual([
      {
        sourceId: "feature.elementalist.level-1.enchantment-of-destruction",
        sourceName: "Зачарование разрушения",
        value: 1,
      },
    ]);
  });

  it("сохранённое русское имя показывается как ID без предупреждения", () => {
    const hero = elementalist(1, CONSTANCY);
    const choice = classFeatureChoicesForSheet(hero).find(
      (item) => item.group === "elementalist.enchantment",
    );
    expect(choice?.selected).toBe("elementalist.enchantment.constancy");
    expect(featureStatBonus(hero, "stamina")).toBe(6);
  });

  it("выключенная автоматизация сохраняет фичи и выборы, но не числа", () => {
    const hero = elementalist(4, CONSTANCY);
    expect(featureStatBonus(hero, "stamina")).toBe(12);
    const off = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(activeIds(off)).toContain(
      "feature.elementalist.level-1.enchantment-of-permanence",
    );
    expect(
      classFeatureChoicesForSheet(off).some(
        (choice) => choice.group === "elementalist.enchantment",
      ),
    ).toBe(true);
    expect(featureStatBonus(off, "stamina")).toBe(0);
    expect(off.automation?.classFeatureSelections).toEqual(CONSTANCY);
  });
});

describe("Элементалист: повышение уровня 1→2 и 3→4", () => {
  const ENOUGH_XP = 1000;

  function request(
    hero: Character,
    choices: Record<string, string[]> = {},
  ): LevelUpRequest {
    return {
      characterId: hero.id,
      fromLevel: hero.level,
      className: hero.className,
      subclass: hero.subclass,
      choices,
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

  function expectOk(result: LevelUpPreview) {
    expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
    if (!result.ok) throw new Error(result.issues.join("; "));
    return result;
  }

  function earthHero(level: number): Character {
    const hero = elementalist(level, { ...BATTLE, ...SUPERIOR }, {
      subclass: "Земля",
      xp: ENOUGH_XP,
    });
    return {
      ...hero,
      automation: {
        ...hero.automation!,
        equipment: { lightArmor: true, lightWeapon: true },
      },
    };
  }

  it("1→2 сохраняет выборы и включает Ученика Земли", () => {
    const hero = earthHero(1);
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(2);
    expect(result.next.subclass).toBe("Земля");
    expect(result.next.automation?.classFeatureSelections).toEqual({
      ...BATTLE,
      ...SUPERIOR,
    });
    expect(featureStatBonus(result.next, "stamina")).toBe(9); // 3 битвы + 6 ученика
    expect(activeIds(result.next)).toContain(
      "feature.elementalist.level-2.disciple-of-earth",
    );
    expect(resolvedResourceGains(result.next)).toHaveLength(3);
  });

  it("3→4 сохраняет выборы и усиливает ресурс и постоянство", () => {
    const hero = earthHero(3);
    const result = expectOk(
      previewLevelUp(hero, request(hero, firstChoices(hero))),
    );
    expect(result.next.level).toBe(4);
    expect(result.next.automation?.classFeatureSelections).toEqual({
      ...BATTLE,
      ...SUPERIOR,
    });
    const nearby = resolvedResourceGains(result.next).filter(
      (gain) => gain.tag === "damage-nearby",
    );
    expect(nearby).toHaveLength(1);
    expect(nearby[0].amount).toBe("2");
    expect(nearby[0].sourceId).toBe(
      "feature.elementalist.level-4.font-of-essence",
    );
    expect(activeIds(result.next)).toContain(
      "feature.elementalist.level-4.mantle-of-essence",
    );
    // 12 Ученика Земли на 4-м уровне + 6 битвы.
    expect(featureStatBonus(result.next, "stamina")).toBe(18);
  });
});
