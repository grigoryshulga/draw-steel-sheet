import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { mechanicsFor } from "../src/data/class-features/mechanics";
import type { Ability, Character } from "../src/types";
import {
  activeClassFeatures,
  classFeatureTriggers,
} from "../src/lib/class-features";
import { classFeatureGroupsForSheet, classFeatureChoicesForSheet } from "../src/lib/class-feature-view";
import {
  buildCharacter,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import { getLevelUpPlan } from "../src/lib/level-up";
import {
  featureDamageImmunities,
  featureFieldBonus,
} from "../src/lib/feature-modifiers";
import {
  epicResourceGainLabels,
  epicResourceName,
  resolvedEpicResourceGains,
  resolvedResourceGains,
  resourceGainLabels,
} from "../src/lib/resources";

/**
 * Цензор нужного уровня с выбранными орденом и доменом. Орден приложение
 * хранит подклассом, домен — в `automation.classFeatureSelections`
 * (так его пишет билдер). Авторасчёт включён: без него движок модификаторов
 * не берёт эффекты особенностей.
 */
function censor(
  level = 1,
  order = "Идеал",
  domain = "Война",
): Character {
  const hero = createCharacter({ className: "Цензор", level });
  hero.subclass = order;
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: { "censor.domain": domain },
  };
  return hero;
}

/** Обычный удар оружием: к нему движок применяет бонусы урона. */
function weaponAbility(): Ability {
  return {
    id: "test-censor-weapon-strike",
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

describe("Цензор: гнев", () => {
  it("базовые прибавки совпадают с книгой", () => {
    const gains = resolvedResourceGains(censor(1)).map(
      (gain) => `${gain.tag}:${gain.event}:${gain.amount}:${gain.frequency}`,
    );
    expect(gains).toEqual([
      "combat-start:combat-start:= Победы:encounter",
      "start-of-turn:start-of-turn:2:turn",
      "damage-judged:deal-damage:1:round",
      "judged-damages-you:take-damage:1:round",
    ]);
  });

  it("подписи прибавок объясняют событие, а не только его код", () => {
    const labels = resourceGainLabels(censor(1));
    expect(labels.map((gain) => gain.label)).toEqual([
      "Начало боевой встречи",
      "Начало твоего хода в бою",
      "Первый раз за раунд: наносишь урон осуждённому",
      "Первый раз за раунд: осуждённый наносит тебе урон",
    ]);
    expect(labels.map((gain) => gain.used)).toEqual([false, false, false, false]);
  });

  it("4/7/10-й уровни заменяют прибавку по тегу, а не добавляют вторую", () => {
    const level4 = resolvedResourceGains(censor(4));
    expect(level4.find((gain) => gain.tag === "damage-judged")?.amount).toBe("2");
    expect(level4.filter((gain) => gain.tag === "damage-judged")).toHaveLength(1);
    expect(level4.find((gain) => gain.tag === "start-of-turn")?.amount).toBe("2");

    const level7 = resolvedResourceGains(censor(7));
    expect(level7.find((gain) => gain.tag === "start-of-turn")?.amount).toBe("3");
    expect(level7.filter((gain) => gain.tag === "start-of-turn")).toHaveLength(1);
    expect(level7.find((gain) => gain.tag === "damage-judged")?.amount).toBe("2");

    const level10 = resolvedResourceGains(censor(10));
    expect(level10.find((gain) => gain.tag === "start-of-turn")?.amount).toBe("4");
    expect(level10.filter((gain) => gain.tag === "start-of-turn")).toHaveLength(1);
    expect(level10).toHaveLength(4);
  });

  it("заменённые прибавки сохраняют понятную подпись события", () => {
    const labels = new Map(
      resourceGainLabels(censor(10)).map((gain) => [gain.tag, gain.label]),
    );
    expect(labels.get("start-of-turn")).toBe("Начало твоего хода в бою");
    expect(labels.get("damage-judged")).toBe(
      "Первый раз за раунд: наносишь урон осуждённому",
    );
    expect(labels.get("judged-damages-you")).toBe(
      "Первый раз за раунд: осуждённый наносит тебе урон",
    );
  });

  it("добродетель — эпический пул, который открывается на 10-м уровне", () => {
    expect(resolvedEpicResourceGains(censor(9))).toEqual([]);
    expect(
      resolvedEpicResourceGains(censor(10)).map(
        (gain) => `${gain.tag}:${gain.event}:${gain.amount}`,
      ),
    ).toEqual(["epic-respite:respite:= Опыт"]);
    expect(epicResourceName(censor(10))).toBe("Добродетель");
    expect(epicResourceGainLabels(censor(10)).map((gain) => gain.label)).toEqual([
      "Завершаешь отдых",
    ]);
  });
});

describe("Цензор: орден и домен", () => {
  it("билдер пишет домен в выборы и активирует ровно его доменные записи", () => {
    const hero = buildCharacter({
      ...emptyBuilderDraft(),
      className: "Цензор",
      subclass: "Оракул",
      domain: "Солнце",
      characteristics: startingCharacteristics("Цензор"),
    });
    expect(hero.automation?.classFeatureSelections?.["censor.domain"]).toBe("Солнце");
    const ids = activeClassFeatures(hero).map((feature) => feature.id);
    expect(ids).toContain("censor.domain.1.vnutrenniy-svet");
    expect(ids).not.toContain("censor.domain.1.osvyashchennoe-oruzhie");
  });

  it("орден активирует только свои записи, а не все двенадцать", () => {
    const excorcist = activeClassFeatures(censor(2, "Экзорцист")).map(
      (feature) => feature.name,
    );
    expect(excorcist).toContain("Бдительность святого");
    expect(excorcist).toContain("Чувство истины");
    expect(excorcist).not.toContain("Вести за собой");
    expect(excorcist).not.toContain("Судья характеров");

    const ideal = activeClassFeatures(censor(2, "Идеал")).map(
      (feature) => feature.name,
    );
    expect(ideal).toContain("Вести за собой");
    expect(ideal).not.toContain("Бдительность святого");
  });

  it("уровень героя отсекает будущие орденские и доменные записи", () => {
    const level2 = activeClassFeatures(censor(2, "Оракул", "Буря")).map(
      (feature) => feature.id,
    );
    expect(level2).toContain("censor.order.2.sudya-kharakterov");
    expect(level2).not.toContain("censor.order.5.prorochestvo");
    expect(level2).not.toContain("censor.domain.4.postup-vetra");

    const level8 = activeClassFeatures(censor(8, "Оракул", "Буря")).map(
      (feature) => feature.id,
    );
    expect(level8).toContain("censor.order.5.prorochestvo");
    expect(level8).toContain("censor.order.8.ikh-proshloe-raskryto");
    expect(level8).toContain("censor.domain.7.verkhom-na-molnii");
    expect(level8).not.toContain("censor.feature.10.gnev-bogov");
  });

  it("чужой орден не показывает свои списки способностей", () => {
    const excorcist = activeClassFeatures(censor(2, "Экзорцист")).map(
      (feature) => feature.name,
    );
    expect(excorcist).toContain("Способности Экзорциста 2-го уровня");
    expect(excorcist).not.toContain("Способности Оракула 2-го уровня");
    expect(excorcist).not.toContain("Способности Идеала 2-го уровня");
    const own = mechanicsFor(
      "censor.feature.2.sposobnosti-ekzortsista-2-go-urovnya",
    );
    expect(own?.choice?.options.map((option) => option.label)).toEqual([
      "Правосудия Вы Боитесь",
      "Откровитель",
    ]);
  });

  it("без сохранённых выборов панель предлагает орден и домен", () => {
    const fresh = createCharacter({ className: "Цензор", level: 1 });
    const choices = classFeatureChoicesForSheet(fresh);
    expect(choices.map((choice) => choice.group).sort()).toEqual([
      "censor.domain",
      "censor.order",
    ]);
    expect(choices.find((choice) => choice.group === "censor.order")?.options).toEqual([
      "Экзорцист",
      "Оракул",
      "Идеал",
    ]);
    expect(choices.find((choice) => choice.group === "censor.domain")?.options).toHaveLength(12);
  });

  it("суд и орденское преимущество попадают в триггеры листа", () => {
    const events = classFeatureTriggers(censor(1, "Оракул")).map(
      (trigger) => trigger.featureId,
    );
    expect(events).toContain("censor.feature.1.sud");
    expect(events).toContain("censor.feature.1.preimushchestvo-ordena-dlya-suda");
    expect(events).toContain("censor.feature.1.moya-zhizn-za-tvoyu");
  });
});

describe("Цензор: числа доменов", () => {
  it("свет палящего солнца добавляет 5 урона и иммунитет к огню, равный уровню", () => {
    const hero = censor(8, "Идеал", "Солнце");
    expect(featureFieldBonus(hero, "rolledDamage", weaponAbility())).toBe(5);
    expect(featureDamageImmunities(hero)).toEqual([
      {
        sourceId: "censor.domain.7.svet-palyashchego-solntsa",
        sourceName: "Свет палящего солнца",
        types: ["огонь"],
        value: 8,
      },
    ]);
  });

  it("верхом на молнии считает урон и принудительное движение от Присутствия", () => {
    const hero = censor(7, "Идеал", "Буря");
    hero.characteristics.presence = 3;
    expect(featureFieldBonus(hero, "rolledDamage", weaponAbility())).toBe(3);
    expect(featureFieldBonus(hero, "push", weaponAbility())).toBe(3);
    expect(featureFieldBonus(hero, "pull", weaponAbility())).toBe(3);
    expect(featureFieldBonus(hero, "slide", weaponAbility())).toBe(3);
  });

  it("один домен не даёт бонусов другого домена", () => {
    // Солнце на 7-м уровне: +5 урона, но никаких бонусов Войны и Бури.
    const sun = censor(7, "Идеал", "Солнце");
    expect(featureFieldBonus(sun, "rolledDamage", weaponAbility())).toBe(5);
    expect(featureFieldBonus(sun, "push", weaponAbility())).toBe(0);
    // Война: «Освящённое оружие» не назначается автоматически.
    const war = censor(7, "Идеал", "Война");
    expect(featureFieldBonus(war, "rolledDamage", weaponAbility())).toBe(0);
  });

  it("без авторасчёта числа не меняются, а панель показывает те же фичи", () => {
    const hero = censor(8, "Идеал", "Солнце");
    const disabled: Character = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(featureFieldBonus(disabled, "rolledDamage", weaponAbility())).toBe(0);
    expect(featureDamageImmunities(disabled)).toEqual([]);
    expect(activeClassFeatures(disabled).map((feature) => feature.id)).toEqual(
      activeClassFeatures(hero).map((feature) => feature.id),
    );
  });
});

describe("Цензор: повышение уровня", () => {
  it("на 2-м уровне левел-ап предлагает две способности выбранного ордена", () => {
    const plan = getLevelUpPlan(censor(1, "Идеал", "Война"));
    expect(plan.available).toBe(true);
    expect(plan.classFeatures.map((feature) => feature.name)).toEqual(
      expect.arrayContaining(["Вести за собой", "Непоколебимый символ"]),
    );
    expect(plan.classFeatures.map((feature) => feature.name)).not.toContain(
      "Бдительность святого",
    );
    const ability = plan.choices.find((choice) => choice.kind === "ability");
    expect(ability?.options.map((option) => option.label).sort()).toEqual([
      "Благословение Верующих",
      "Приговорен",
    ]);
  });

  it("на 3-м уровне предлагает четыре способности за 7 гнева", () => {
    const plan = getLevelUpPlan(censor(2, "Оракул", "Знание"));
    expect(plan.available).toBe(true);
    const ability = plan.choices.find((choice) => choice.kind === "ability");
    expect(ability?.options.map((option) => option.label).sort()).toEqual([
      "Эдикт Идеального Порядка",
      "Эдикт Неподвижности",
      "Эдикт Очищающего Пацифизма",
      "Эдикт Разрушительной Изоляции",
    ]);
  });

  it("особенность домена 4-го уровня приходит как награда, а не как выбор", () => {
    const plan = getLevelUpPlan(censor(3, "Идеал", "Война"));
    expect(plan.available).toBe(true);
    expect(plan.classFeatures.map((feature) => feature.name)).toContain(
      "Улучшенное освященное оружие",
    );
  });
});

describe("Цензор: покрытие механик", () => {
  it("все 102 записи скелета описаны механикой или прозой с причиной", () => {
    const records = GENERATED_CLASS_FEATURES.filter(
      (feature) => feature.className === "Цензор",
    );
    expect(records).toHaveLength(102);
    const missing = records.filter((feature) => !mechanicsFor(feature.id));
    // Прозаические записи (перки и навыки) лежат в TEXT_ONLY и проверяются
    // гейтом покрытия; здесь важно, что механик у них нет намеренно.
    expect(missing.map((feature) => feature.id).sort()).toEqual([
      "censor.feature.10.navyk",
      "censor.feature.10.perk",
      "censor.feature.2.perk",
      "censor.feature.4.navyk",
      "censor.feature.4.perk",
      "censor.feature.6.perk",
      "censor.feature.7.navyk",
      "censor.feature.8.perk",
    ]);
  });

  it("панель группирует фичи по уровню и не показывает будущие", () => {
    const groups = classFeatureGroupsForSheet(censor(3, "Оракул", "Знание"));
    expect(groups.map((group) => group.level)).toEqual([1, 2, 3]);
  });
});
