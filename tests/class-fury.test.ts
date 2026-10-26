import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics/index";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import {
  calculatedValues,
  characterStatBreakdown,
} from "../src/lib/character-calculations";
import { classFeatureTriggers } from "../src/lib/class-features";
import { createCharacter } from "../src/lib/defaults";
import { featureFieldBonus } from "../src/lib/feature-modifiers";
import {
  resolvedEpicResourceGains,
  resolvedResourceGains,
} from "../src/lib/resources";
import type { Ability, Character } from "../src/types";

/**
 * Герой Неистового нужного уровня. Авторасчёт включён: без него движок
 * модификаторов не берёт эффекты классовых особенностей. Аспект пишется
 * в `automation.classFeatureSelections` названием, как в приложении.
 */
function fury(level = 1, aspect?: string): Character {
  const hero = createCharacter({ className: "Неистовый", level });
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    ...(aspect ? { classFeatureSelections: { "fury.aspect": aspect } } : {}),
  };
  return hero;
}

/** Обычный удар оружием: нужен там, где бонус идёт к способности. */
function weaponAbility(): Ability {
  return {
    id: "test-weapon-strike",
    name: "Тестовый удар",
    flavor: "",
    actionType: "main",
    kind: "signature",
    keywords: ["Ближний", "Удар", "Оружие"],
    distance: "Ближний 1",
    target: "Одно существо",
    rollCharacteristics: ["might"],
    preferredCharacteristic: "might",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "2 + М", effect: "" },
      { damage: "5 + М", effect: "" },
      { damage: "7 + М", effect: "" },
    ],
    effect: "",
    source: "",
    notes: "",
  };
}

const FURY_FEATURES = GENERATED_CLASS_FEATURES.filter(
  (feature) => feature.className === "Неистовый",
);

describe("Свирепость", () => {
  it("базовые прибавки 1-го уровня — из книги", () => {
    const gains = resolvedResourceGains(fury(1)).map(
      (gain) => `${gain.event}:${gain.amount}:${gain.frequency}`,
    );
    // Начало боевой встречи — свирепость, равная Победам.
    // Начало каждого своего хода — 1d3 («Свирепость в бою»).
    // Первый раз за раунд, когда получаешь урон — 1.
    // Первый раз за бой входишь в утомление или при смерти — 1d3.
    expect(gains).toEqual([
      "combat-start:= Победы:encounter",
      "start-of-turn:1d3:turn",
      "take-damage:1:round",
      "winded:1d3:encounter",
    ]);
  });

  it("4-й уровень заменяет урон на 2, старый тег не остаётся", () => {
    const gains = resolvedResourceGains(fury(4));
    const damage = gains.filter((gain) => gain.tag === "take-damage");
    expect(damage).toHaveLength(1);
    expect(damage[0].amount).toBe("2");
    expect(damage[0].sourceId).toBe("fury.feature.4.uron-ot-svireposti");
    expect(gains.find((gain) => gain.tag === "start-of-turn")!.amount).toBe("1d3");
  });

  it("7-й уровень делает начало хода 1d3 + 1", () => {
    const gains = resolvedResourceGains(fury(7));
    const start = gains.filter((gain) => gain.event === "start-of-turn");
    expect(start).toHaveLength(1);
    expect(start[0].amount).toBe("1d3 + 1");
    expect(start[0].sourceId).toBe("fury.feature.7.velikaya-svirepost");
  });

  it("10-й уровень делает урон 3, теги остаются уникальными", () => {
    const gains = resolvedResourceGains(fury(10));
    const damage = gains.filter((gain) => gain.tag === "take-damage");
    expect(damage).toHaveLength(1);
    expect(damage[0].amount).toBe("3");
    expect(damage[0].sourceId).toBe(
      "fury.feature.10.pervozdannaya-svirepost",
    );
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(gains.length);
  });

  it("эпический ресурс 10-го уровня отдельным пулом", () => {
    const hero = fury(10);
    const main = resolvedResourceGains(hero).map((gain) => gain.tag);
    expect(main).not.toContain("epic-respite");
    const epic = resolvedEpicResourceGains(hero);
    expect(epic.map((gain) => `${gain.event}:${gain.amount}`)).toEqual([
      "respite:= Опыт",
    ]);
    expect(epic[0].sourceName).toBe("Первозданная сила");
  });
});

describe("особенности аспектов", () => {
  it("Неизбежный гнев даёт скорость, равную Ловкости", () => {
    const hero = fury(2, "Разоритель");
    hero.characteristics.agility = 3;
    expect(featureFieldBonus(hero, "speed")).toBe(3);
    expect(calculatedValues(hero).speed).toBe(8); // 5 + 3, комплекта нет
  });

  it("Недвижимый объект добавляет устойчивость, равную Мощи", () => {
    const hero = fury(3, "Берсерк");
    hero.characteristics.might = 2;
    const breakdown = characterStatBreakdown(hero, "stability");
    expect(
      breakdown.contributions.map(
        (contribution) => `${contribution.sourceName}:${contribution.value}`,
      ),
    ).toEqual(["Недвижимый объект:2"]);
    expect(breakdown.total).toBe(2);
    expect(calculatedValues(hero).stability).toBe(2);
  });

  it("Сильнейший добавляет к толчку Мощь, На шаг впереди — Ловкость к отходу", () => {
    const berserker = fury(8, "Берсерк");
    berserker.characteristics.might = 4;
    expect(featureFieldBonus(berserker, "push")).toBe(4);

    const raider = fury(8, "Разоритель");
    raider.characteristics.agility = 4;
    expect(featureFieldBonus(raider, "disengage")).toBe(4);
  });
});

describe("Растущая свирепость", () => {
  it("бонус толчка включается только на пороге ресурса", () => {
    const hero = fury(1, "Берсерк");
    hero.characteristics.might = 2;
    hero.heroicResource.current = 1;
    expect(featureFieldBonus(hero, "push", weaponAbility())).toBe(0);
    hero.heroicResource.current = 2;
    expect(featureFieldBonus(hero, "push", weaponAbility())).toBe(2);
  });

  it("порог ресурса без выбранного аспекта ничего не даёт", () => {
    const hero = fury(1);
    hero.characteristics.might = 2;
    hero.heroicResource.current = 5;
    expect(featureFieldBonus(hero, "push", weaponAbility())).toBe(0);
  });

  it("порог аспекта своего показателя: у Разорителя бонус равен Ловкости", () => {
    const hero = fury(1, "Разоритель");
    hero.characteristics.might = 2;
    hero.characteristics.agility = 3;
    hero.heroicResource.current = 2;
    expect(featureFieldBonus(hero, "push", weaponAbility())).toBe(3);
  });
});

describe("триггеры Неистового", () => {
  it("Буревестник видит конец хода и потерю выносливости", () => {
    const triggers = classFeatureTriggers(fury(4, "Буревестник")).map(
      (trigger) => `${trigger.event}:${trigger.frequency}`,
    );
    expect(triggers).toContain("end-of-turn:turn"); // Зуб и коготь
    expect(triggers).toContain("lose-stamina:always"); // Яростное изменение
  });

  it("Разоритель видит получение урона и начало хода", () => {
    const triggers = classFeatureTriggers(fury(5, "Разоритель")).map(
      (trigger) => `${trigger.event}:${trigger.frequency}`,
    );
    expect(triggers).toContain("take-damage:always"); // Неземные рефлексы
    expect(triggers).toContain("start-of-turn:turn"); // Раскованный
  });

  it("пороги Берсерка дают триггер принудительного движения", () => {
    const triggers = classFeatureTriggers(fury(4, "Берсерк"));
    const thresholds = triggers.filter(
      (trigger) =>
        trigger.event === "forced-movement" && trigger.frequency === "turn",
    );
    expect(thresholds.map((trigger) => trigger.name)).toEqual([
      "Растущая свирепость Берсерка: 4",
      "Растущая свирепость Берсерка: 8 (4-й уровень)",
    ]);
    expect(thresholds.every((trigger) => trigger.detail.trim() !== "")).toBe(true);
  });

  it("у каждого триггера есть русские подпись и подробность", () => {
    for (const trigger of classFeatureTriggers(fury(10, "Берсерк"))) {
      expect(trigger.label.trim()).not.toBe("");
      expect(trigger.detail.trim()).not.toBe("");
    }
  });
});

describe("покрытие записей Неистового", () => {
  it("каждая запись получила механику или прозу с причиной", () => {
    const uncovered = FURY_FEATURES.filter((feature) => {
      const reason = TEXT_ONLY[feature.id];
      if (mechanicsFor(feature.id)) return false;
      return typeof reason !== "string" || reason.trim() === "";
    });
    expect(uncovered.map((feature) => `${feature.name} (ур. ${feature.level})`)).toEqual(
      [],
    );
  });

  it("прозаическая причина — русский текст, а не заглушка", () => {
    for (const feature of FURY_FEATURES) {
      if (!TEXT_ONLY[feature.id]) continue;
      expect(TEXT_ONLY[feature.id].trim().length).toBeGreaterThan(10);
    }
  });

  it("выборы способностей ссылаются на существующие записи справочника", () => {
    const known = new Set(ABILITY_COMPENDIUM.map((ability) => ability.id));
    const dangling: string[] = [];
    for (const feature of FURY_FEATURES) {
      const options = mechanicsFor(feature.id)?.choice?.options ?? [];
      for (const option of options) {
        if (!option.id.startsWith("neistovyy-")) continue;
        if (!known.has(option.id)) dangling.push(`${feature.name}: ${option.id}`);
      }
    }
    expect(dangling).toEqual([]);
  });
});
