import { describe, expect, it } from "vitest";
import { TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics";
import { classFeatureGroups } from "../src/data/class-feature-rules";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { activeClassFeatures } from "../src/lib/class-features";
import {
  classFeatureChoicesForSheet,
  classFeatureGiftsAtLevel,
  classFeatureGroupsForSheet,
  classFeatureOptionAutomated,
  featureSheetChoiceState,
  withClassFeatureSelection,
} from "../src/lib/class-feature-view";
import { createCharacter } from "../src/lib/defaults";
import type { Character } from "../src/types";

function elementalist(
  level = 4,
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

function sheetItems(hero: Character) {
  return classFeatureGroupsForSheet(hero).flatMap((group) => group.features);
}

function visibleText(hero: Character): string {
  return sheetItems(hero)
    .flatMap((feature) => [
      feature.summary,
      feature.notes ?? "",
      feature.detail ?? "",
      feature.trigger?.label ?? "",
      feature.trigger?.detail ?? "",
      ...feature.badges.map((badge) => badge.label),
    ])
    .join(" ");
}

const activeIds = (hero: Character) =>
  activeClassFeatures(hero).map((feature) => feature.id);

const FORBIDDEN = [
  "light",
  "keyValue",
  "rolledOnly",
  "SUBCLASS_",
  "adjacent-enemy-damages-you",
  "sourceId",
  "generated.json",
  "elementalist.feature.",
  "elementalist.specialization.",
  "elementalist.enchantment.",
  "elementalist.sanctuary.",
  "forced-movement",
  "damageImmunity",
  "when.",
];

describe("Элементалист: видимый текст без внутренних имён", () => {
  it("notes, summary, триггеры и бейджи чистые для всех выборов", () => {
    const heroes: Character[] = [
      elementalist(1),
      ...["Земля", "Огонь", "Зелень", "Пустота"].map((subclass) =>
        elementalist(4, {}, { subclass }),
      ),
      ...[
        "Зачарование битвы",
        "Зачарование быстроты",
        "Зачарование разрушения",
        "Зачарование дистанции",
        "Зачарование постоянства",
      ].flatMap((value) => [
        elementalist(1, { "elementalist.enchantment": value }),
        elementalist(4, {
          "elementalist.enchantment": `elementalist.enchantment.${
            {
              "Зачарование битвы": "battle",
              "Зачарование быстроты": "speed",
              "Зачарование разрушения": "destruction",
              "Зачарование дистанции": "distance",
              "Зачарование постоянства": "constancy",
            }[value]
          }`,
        }),
      ]),
      ...[
        "Оберег восхитительных последствий",
        "Оберег превосходной защиты",
        "Оберег привязанности природы",
        "Оберег удивительной реактивности",
      ].map((value) => elementalist(1, { "elementalist.sanctuary": value })),
    ];

    const leaks: string[] = [];
    for (const hero of heroes) {
      const text = visibleText(hero);
      for (const token of FORBIDDEN) {
        if (text.includes(token)) {
          leaks.push(
            `${token} в листе (ур. ${hero.level}, ${hero.subclass || "без специализации"})`,
          );
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("notes и причины прозы не содержат технических имён", () => {
    const features = GENERATED_CLASS_FEATURES.filter(
      (feature) => feature.className === "Элементалист",
    );
    const leaked: string[] = [];
    for (const feature of features) {
      const text = [
        mechanicsFor(feature.id)?.notes ?? "",
        TEXT_ONLY[feature.id] ?? "",
      ].join(" ");
      for (const token of FORBIDDEN) {
        if (text.includes(token)) leaked.push(`${feature.id}: ${token}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("иммунитет оберега читается по-русски", () => {
    const hero = elementalist(1, {
      "elementalist.sanctuary": "Оберег превосходной защиты",
    });
    const item = sheetItems(hero).find(
      (feature) => feature.name === "Оберег превосходной защиты",
    );
    expect(item?.summary).toContain("иммунитет к огню");
    expect(item?.summary).toContain("иммунитет к кислоте");
    expect(item?.summary).not.toContain("damageImmunity");
  });
});

describe("Элементалист: панель и выборы", () => {
  it("старая панель удалена: все legacy-группы ведёт новый реестр", () => {
    const legacyGroups = classFeatureGroups("Элементалист").map(
      (group) => group.id,
    );
    const groups = classFeatureChoicesForSheet(elementalist(1)).map(
      (choice) => choice.group,
    );
    expect(groups).toEqual(expect.arrayContaining(legacyGroups));
  });

  it("подсказка билдера смотрит на механику, а не на старые эффекты", () => {
    for (const name of [
      "Зачарование битвы",
      "Зачарование быстроты",
      "Зачарование разрушения",
      "Зачарование дистанции",
      "Зачарование постоянства",
    ]) {
      expect(classFeatureOptionAutomated("Элементалист", name), name).toBe(true);
    }
    for (const name of [
      "Оберег восхитительных последствий",
      "Оберег превосходной защиты",
      "Оберег привязанности природы",
      "Оберег удивительной реактивности",
    ]) {
      expect(classFeatureOptionAutomated("Элементалист", name), name).toBe(true);
    }
    expect(classFeatureOptionAutomated("Элементалист", "неизвестная опция")).toBe(
      false,
    );
  });

  it("старый ID и русское имя показываются без предупреждения", () => {
    for (const value of [
      "elementalist.enchantment.distance",
      "Зачарование дистанции",
    ]) {
      const choice = classFeatureChoicesForSheet(
        elementalist(1, { "elementalist.enchantment": value }),
      ).find((item) => item.group === "elementalist.enchantment");
      expect(choice?.selected).toBe("elementalist.enchantment.distance");
      expect(featureSheetChoiceState(choice!).warning).toBeUndefined();
    }

    for (const value of [
      "elementalist.sanctuary.nature",
      "Оберег привязанности природы",
    ]) {
      const choice = classFeatureChoicesForSheet(
        elementalist(1, { "elementalist.sanctuary": value }),
      ).find((item) => item.group === "elementalist.sanctuary");
      expect(choice?.selected).toBe("elementalist.sanctuary.nature");
      expect(featureSheetChoiceState(choice!).warning).toBeUndefined();
    }
  });

  it("значение чужой группы не активирует запись", () => {
    const enchantmentWithSanctuary = elementalist(1, {
      "elementalist.enchantment": "elementalist.sanctuary.superior",
    });
    const ids = activeIds(enchantmentWithSanctuary);
    expect(ids).not.toContain(
      "elementalist.feature.1.obereg-prevoskhodnoy-zashchity",
    );
    expect(ids).not.toContain("elementalist.feature.1.zacharovanie-bitvy");

    const sanctuaryWithEnchantment = elementalist(1, {
      "elementalist.sanctuary": "Зачарование дистанции",
    });
    const reverse = activeIds(sanctuaryWithEnchantment);
    expect(reverse).not.toContain(
      "elementalist.feature.1.zacharovanie-distantsii",
    );
    expect(reverse).not.toContain(
      "elementalist.feature.1.obereg-prevoskhodnoy-zashchity",
    );
  });

  it("выбор оберега из панели пишет старый ID и включает триггер", () => {
    const hero = elementalist(1);
    const selected = withClassFeatureSelection(
      hero,
      "elementalist.sanctuary",
      "elementalist.sanctuary.reactivity",
    );
    expect(selected.automation?.classFeatureSelections).toEqual({
      "elementalist.sanctuary": "elementalist.sanctuary.reactivity",
    });
    expect(activeIds(selected)).toContain(
      "elementalist.feature.1.obereg-udivitelnoy-reaktivnosti",
    );
  });
});

describe("Элементалист: прозаические записи и подарки уровней 1–4", () => {
  it("на листе видны прозаические записи уровня", () => {
    const names = sheetItems(elementalist(4)).map((feature) => feature.name);
    for (const name of [
      "Эссенция в бою",
      "Эссенция вне боя",
      "Поддерживаемая магия",
      "Практическая магия",
      "Увеличение характеристик",
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it("контейнеры не попадают на лист", () => {
    const names = new Set(sheetItems(elementalist(4)).map((item) => item.name));
    for (const container of [
      "Эссенция",
      "Особенность специализации 1-го уровня",
      "Триггер специализации",
      "Зачарование",
      "Оберег элементалиста",
      "Способности элементалиста",
      "Героические способности",
      "Особенность специализации 2-го уровня",
      "Особенность специализации 3-го уровня",
      "Мантия эссенции",
    ]) {
      expect(names.has(container), container).toBe(false);
    }
  });

  it("classFeatureGiftsAtLevel на 4-м уровне называет прозу уровня", () => {
    const level4 = classFeatureGiftsAtLevel(
      elementalist(3, {}, { subclass: "Земля" }),
      4,
    ).map((feature) => feature.name);
    expect(level4).toContain("Увеличение характеристик");
    expect(level4).toContain("Сотрясающаяся земля");
  });
});

describe("Элементалист: старый лист и автоматизация", () => {
  it("старый лист без выбора получает панель и не показывает чужие записи", () => {
    const hero = elementalist(1);
    const ids = activeIds(hero);
    for (const id of [
      "elementalist.feature.1.zacharovanie-bitvy",
      "elementalist.feature.1.obereg-prevoskhodnoy-zashchity",
    ]) {
      expect(ids).not.toContain(id);
    }
    const choices = classFeatureChoicesForSheet(hero);
    expect(choices.map((choice) => choice.group)).toContain(
      "elementalist.enchantment",
    );
    expect(choices.map((choice) => choice.group)).toContain(
      "elementalist.sanctuary",
    );
  });

  it("выключенная автоматизация не скрывает записи и выборы", () => {
    const hero = elementalist(4, {
      "elementalist.enchantment": "Зачарование постоянства",
    }, { subclass: "Земля" });
    const off = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(activeIds(off)).toContain(
      "elementalist.feature.1.zacharovanie-postoyanstva",
    );
    expect(activeIds(off)).toContain(
      "elementalist.specialization.2.uchenik-zemli",
    );
    expect(
      classFeatureChoicesForSheet(off).some(
        (choice) => choice.group === "elementalist.enchantment",
      ),
    ).toBe(true);
    expect(visibleText(off)).toContain("Зачарование постоянства");
  });
});
