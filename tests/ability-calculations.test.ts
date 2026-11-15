import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AbilityCard, AbilityCardContent } from "../src/components/AbilityCard";
import { CalculationInline, CalculationToggle } from "../src/components/rules/CalculationInline";
import { AbilityBody, referenceAbilityView } from "../src/components/rules/AbilitySheet";
import { abilityCardView } from "../src/components/rules/abilityCardView";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import { abilityFromTemplate, BASIC_ABILITIES } from "../src/data/templates";
import { abilityRollBreakdown, abilityTierRequirements } from "../src/lib/abilities";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { parseCharacterImport } from "../src/lib/character-import";
import { invalidateClassFeatureRegistry } from "../src/lib/class-features";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { evaluateAbilityDamage, evaluateDamage, rollPowerRoll } from "../src/lib/rules";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { AbilityRollPanel } from "../src/views/abilities/RollModal";
import { SheetAbilitiesPanel } from "../src/views/sheet/SheetAbilitiesPanel";
import type { Ability, Character } from "../src/types";

function weaponAbility(): Ability {
  return {
    ...abilityFromTemplate(BASIC_ABILITIES[0]),
    rollCharacteristics: ["might", "agility"],
    preferredCharacteristic: "might",
    keywords: ["Оружие", "Ближний"],
    tiers: [{ damage: "3 + М", effect: "" }, { damage: "5 + М", effect: "" }, { damage: "7 + М", effect: "" }],
  };
}

function withCharacteristicFeature(run: (hero: Character) => void) {
  const id = "feature.test.calculation-characteristic";
  GENERATED_CLASS_FEATURES.push({ id, className: "Неистовый", level: 1, name: "Вдохновение союзника", articleId: "test", description: "" });
  FEATURE_MECHANICS[id] = { kinds: ["characteristic"], effects: [{ kind: "characteristic", key: "might", value: 1 }] };
  invalidateClassFeatureRegistry();
  try {
    const hero = createCharacter({ className: "Неистовый" });
    hero.characteristics.might = 2;
    hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [] };
    run(hero);
  } finally {
    GENERATED_CLASS_FEATURES.splice(GENERATED_CLASS_FEATURES.findIndex((feature) => feature.id === id), 1);
    delete FEATURE_MECHANICS[id];
    invalidateClassFeatureRegistry();
  }
}

function numericTerms(damage: ReturnType<typeof evaluateAbilityDamage>, index = 0) {
  return damage.calculations![index].terms.reduce((sum, term) => sum + (typeof term.value === "number" ? term.value : 0), 0);
}

describe("Расчёт урона с именованными источниками", () => {
  it("раскладывает знаковую способность на базу без встроенного комплекта, характеристику и выбранный профиль", () => {
    const hero = buildCharacter({
      ...emptyBuilderDraft(), className: "Тактик", characteristics: startingCharacteristics("Тактик"),
      kit: "Мастер Боевых Искусств", secondaryKit: "Гора", meleeDamageKit: "Гора",
    });
    hero.damageModifier = 2;
    const ability = hero.abilities.find((entry) => entry.source === "Комплект: Мастер Боевых Искусств")!;
    const first = evaluateAbilityDamage(ability, 1, hero);
    expect(first.values).toEqual([7]);
    expect(first.calculations![0].terms).toEqual([
      { kind: "base", label: "Базовый урон без комплекта", value: 3 },
      { label: "Мощь", value: 2 },
      { label: "Комплект: Гора", value: 0 },
      { label: "Общий модификатор урона", value: 2 },
    ]);
    expect(first.calculations![0].note).toContain("один раз");
    for (const tier of [1, 2, 3]) {
      const damage = evaluateAbilityDamage(ability, tier, hero);
      expect(numericTerms(damage)).toBe(damage.values[0]);
    }
  });

  it("показывает активную особенность даже при взаимном обнулении с ручным штрафом", () => {
    const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Талант", featureChoices: { "Псионическая аугментация": "Аугментация силы" } });
    const ability = ABILITY_COMPENDIUM.find((entry) => entry.name === "Изморозь")!;
    hero.damageModifier = -1;
    const damage = evaluateAbilityDamage(ability, 1, hero);
    expect(damage.values).toEqual(evaluateDamage(ability.tiers[0].damage, hero).values);
    expect(damage.calculations![0].terms).toContainEqual({ label: "Аугментация силы", value: 1 });
    expect(damage.calculations![0].terms).toContainEqual({ label: "Общий модификатор урона", value: -1 });
    expect(numericTerms(damage)).toBe(damage.values[0]);
    const magic = evaluateAbilityDamage({ ...ability, keywords: ["Магия", "Дальний"] }, 1, hero);
    expect(magic.calculations![0].terms.some((term) => term.label === "Аугментация силы")).toBe(false);
  });

  it("объясняет оба способа атаки и добавляет общий бонус ровно один раз к каждому", () => {
    const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Тактик", kit: "Сияющие Доспехи", secondaryKit: "Снайпер" });
    const ability = ABILITY_COMPENDIUM.find((entry) => entry.name === "Вдохновляющий Удар")!;
    const before = evaluateAbilityDamage(ability, 3, hero);
    hero.damageModifier = 3;
    const damage = evaluateAbilityDamage(ability, 3, hero);
    expect(damage.values).toEqual(before.values.map((value) => value + 3));
    expect(damage.calculations!.map((entry) => entry.label)).toEqual(["Ближний бой", "Дальний бой"]);
    damage.calculations!.forEach((calculation, index) => {
      expect(calculation.terms.filter((term) => term.label === "Общий модификатор урона")).toHaveLength(1);
      expect(numericTerms(damage, index)).toBe(damage.values[index]);
    });
  });

  it("учитывает ручной штраф при выключенном авторасчёте и не создаёт урон в пустом тире", () => {
    const hero = createCharacter();
    hero.characteristics.might = 2;
    hero.damageModifier = -2;
    const ability = weaponAbility();
    expect(evaluateAbilityDamage(ability, 1, hero).values).toEqual([3]);
    ability.tiers[0] = { damage: "", effect: "Цель лежит" };
    const empty = evaluateAbilityDamage(ability, 1, hero, 2);
    expect(empty.values).toEqual([]);
    expect(empty.calculations).toBeUndefined();
  });

  it("сохраняет кубики и объясняет всплески отдельно от общего модификатора", () => {
    const hero = createCharacter();
    hero.characteristics.might = 2;
    hero.damageModifier = 2;
    const ability = weaponAbility();
    ability.tiers[0].damage = "1d6 + М";
    const damage = evaluateAbilityDamage(ability, 1, hero, 2);
    expect(damage.dice).toEqual(["1d6"]);
    expect(damage.values).toEqual([8]);
    expect(damage.calculations![0].terms).toContainEqual({ label: "Всплески: 2 × 2", value: 4 });
    expect(numericTerms(damage)).toBe(8);
    expect(damage.calculations![0].total).toBe(damage.display);
  });

  it("называет выбранную характеристику и её активные прибавки в формуле урона", () => {
    withCharacteristicFeature((hero) => {
      const damage = evaluateAbilityDamage(weaponAbility(), 1, hero);
      expect(damage.values).toEqual([6]);
      expect(damage.calculations![0].terms).toContainEqual({ label: "Мощь", value: 2 });
      expect(damage.calculations![0].terms).toContainEqual({ label: "Вдохновение союзника · мощь", value: 1 });
      expect(numericTerms(damage)).toBe(6);
    });
  });
});

describe("Бонус броска силы: карточка и бросок", () => {
  it("учитывает эффективную характеристику, источник прибавки и бонус способности", () => {
    withCharacteristicFeature((hero) => {
      const ability = { ...weaponAbility(), rollBonus: 1 };
      const calculation = abilityRollBreakdown(ability, hero)!;
      expect(calculation.total).toBe("2d10 +4");
      expect(calculation.terms).toContainEqual({ label: "Вдохновение союзника · мощь", value: 1 });
      expect(abilityTierRequirements(ability, hero)).toMatchObject({ characteristicBonus: 3, totalBonus: 4, t2Min: 8 });
      expect(abilityCardView(ability, hero).roll?.bonus).toBe(4);
      const html = renderToStaticMarkup(createElement(AppContext.Provider, {
        value: { character: hero, gameHistory: [] } as unknown as AppContextValue,
        children: createElement(AbilityRollPanel, { ability, character: hero, showCalculations: true }),
      }));
      expect(html).toContain("2d10 +4");
      expect(html).toContain("Вдохновение союзника · мощь");
      hero.automation!.enabled = false;
      expect(abilityRollBreakdown(ability, hero)!.totalBonus).toBe(3);
    });
  });

  it.each([[1, 0, 2], [0, 1, -2], [1, 1, 0], [2, 0, 0], [0, 2, 0]])("совпадает с реальным броском при преимуществах %i и помехах %i", (edges, banes, edgeBonus) => {
    const hero = createCharacter();
    hero.characteristics.might = 2;
    const ability = { ...weaponAbility(), rollBonus: 1 };
    const calculation = abilityRollBreakdown(ability, hero, { edges, banes, additionalBonus: -1 })!;
    const rolled = rollPowerRoll({ dice: [5, 5], characteristic: calculation.characteristicBonus, bonus: ability.rollBonus - 1, edges, banes });
    expect(calculation.totalBonus).toBe(2 + edgeBonus);
    expect(rolled.total).toBe(rolled.natural + calculation.totalBonus);
    if (Math.abs(edges - banes) >= 2) expect(calculation.note).toContain("к сумме броска не прибавляется");
  });

  it("объясняет альтернативные характеристики с их собственными бонусами", () => {
    const hero = createCharacter();
    hero.characteristics.might = -1;
    hero.characteristics.agility = 2;
    const view = abilityCardView(weaponAbility(), hero);
    expect(view.rollCalculations!.map((calculation) => calculation.total)).toEqual(["2d10 −1", "2d10 +2"]);
    const noRoll = { ...weaponAbility(), rollCharacteristics: [], preferredCharacteristic: "" } as Ability;
    expect(abilityRollBreakdown(noRoll, hero)).toBeNull();
  });
});

describe("Прозрачные расчёты в карточке и общий модификатор", () => {
  it.each([false, true])("показывает в карточке только итоги без раскрывающихся расчётов (полная карточка: %s)", (full) => {
    const hero = createCharacter();
    hero.characteristics.might = 2;
    hero.damageModifier = 3;
    const ability = weaponAbility();
    const html = renderToStaticMarkup(createElement(AbilityCard, { ability, character: hero, full }));
    expect(html).toContain("Бросок силы");
    expect(html).toContain("2d10 +2");
    expect(html).toContain("<strong>8</strong>");
    expect(html).not.toContain("Расчёт урона");
    expect(html).not.toContain("Как считается");
    expect(html).not.toContain("Общий модификатор урона");
    expect(html).not.toContain("calculation-inline");
    expect(html).not.toContain("Показать расчёт");
    expect(html).not.toContain("<details");
    const reference = renderToStaticMarkup(createElement(AbilityBody, { view: referenceAbilityView(ability) }));
    expect(reference).not.toContain("Расчёт урона");
    expect(reference).not.toContain("Общий модификатор урона");
  });

  it("показывает слагаемые инлайново только по запросу и не добавляет таблицы или каты", () => {
    const hero = createCharacter();
    hero.characteristics.might = 2;
    hero.damageModifier = -1;
    const view = abilityCardView(weaponAbility(), hero);
    const hidden = renderToStaticMarkup(createElement(AbilityBody, { view }));
    const shown = renderToStaticMarkup(createElement(AbilityBody, { view, showCalculations: true }));
    expect(hidden).not.toContain("calculation-inline");
    expect(shown).toContain("calculation-inline");
    expect(shown).toContain("общий модификатор");
    expect(shown).toContain("− 1");
    expect(shown).toContain("= 4");
    expect(shown).not.toContain("<details");
    expect(shown).not.toContain("<dl");
    const content = renderToStaticMarkup(createElement(AbilityCardContent, {
      ability: weaponAbility(), character: hero,
    }));
    expect(content).not.toContain("Показать расчёт");
    expect(content).not.toContain('class="calculation-inline"');
    const toggle = renderToStaticMarkup(createElement(CalculationToggle, { checked: false, onChange() {} }));
    expect(toggle).toContain('role="switch" aria-checked="false" aria-label="Показать расчёт"');
  });

  it("сохраняет понятные знаки и названия источников для обоих способов атаки", () => {
    const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Тактик", kit: "Сияющие Доспехи", secondaryKit: "Снайпер" });
    const ability = ABILITY_COMPENDIUM.find((entry) => entry.name === "Вдохновляющий Удар")!;
    const html = renderToStaticMarkup(createElement(CalculationInline, {
      calculations: evaluateAbilityDamage(ability, 3, hero).calculations!,
    }));
    expect(html).toContain("Ближний бой:");
    expect(html).toContain("Дальний бой:");
    expect(html).toContain("Комплект: Сияющие Доспехи");
    expect(html).toContain("Комплект: Снайпер");
    expect(html).not.toContain("<details");
  });

  it("размещает сохраняемую поправку над списком способностей и предлагает сброс", () => {
    const hero = createCharacter();
    hero.damageModifier = -2;
    const html = renderToStaticMarkup(createElement(AppContext.Provider, {
      value: { character: hero } as AppContextValue,
      children: createElement(SheetAbilitiesPanel),
    }));
    expect(html).toContain('aria-label="Общий модификатор урона"');
    expect(html).toContain('value="-2"');
    expect(html).toContain('aria-label="Сбросить общий модификатор урона"');
    expect(html.indexOf("sheet-ability-damage-modifier")).toBeLessThan(html.indexOf("sheet-ability-toolbar"));
  });

  it("сохраняет отрицательный модификатор через экспорт, импорт и нормализацию старых документов", async () => {
    const hero = createCharacter();
    hero.damageModifier = -2;
    const text = JSON.stringify(hero);
    const imported = await parseCharacterImport({ size: text.length, text: async () => text });
    expect(imported.damageModifier).toBe(-2);
    expect(normalizeCharacter(hero).damageModifier).toBe(-2);
    expect(normalizeCharacter(createCharacter()).damageModifier).toBeUndefined();
  });

  it.each(["3", null, 1.5])("отбрасывает неверный формат модификатора при загрузке и отклоняет импорт: %j", async (damageModifier) => {
    const invalid = { ...createCharacter(), damageModifier };
    expect(normalizeCharacter(invalid as unknown as Character).damageModifier).toBeUndefined();
    const text = JSON.stringify(invalid);
    await expect(parseCharacterImport({ size: text.length, text: async () => text })).rejects.toThrow();
  });
});
