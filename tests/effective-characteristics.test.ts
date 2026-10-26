import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  applyCharacteristicEffects,
  effectiveCharacteristics,
  featureCharacteristicBonus,
} from "../src/lib/feature-modifiers";
import { recalculateCharacter } from "../src/lib/character-calculations";
import { invalidateClassFeatureRegistry } from "../src/lib/class-features";
import { deriveStats, evaluateDamage, surgeDamage, surgeDamageTotal } from "../src/lib/rules";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import type { FeatureEffect } from "../src/data/class-features/types";
import type { Character } from "../src/types";

const TEST_ID = "fury.feature.1.test-characteristic";

/** Минимальная автоматизация: своих выбранных фич этим тестам не нужно. */
function automation(enabled = false) {
  return { enabled, adjustments: {}, ancestryTraits: [] };
}

/**
 * Временная запись реестра с эффектами характеристик: ровно тот путь, которым
 * работают настоящие фичи класса. Запись снимается в `finally`.
 */
function withRegistryEffects<T>(effects: FeatureEffect[], run: () => T): T {
  GENERATED_CLASS_FEATURES.push({
    id: TEST_ID,
    className: "Неистовый",
    level: 1,
    name: "Тестовая прибавка",
    articleId: "test",
    description: "",
  });
  FEATURE_MECHANICS[TEST_ID] = { kinds: ["characteristic"], effects };
  invalidateClassFeatureRegistry();
  try {
    return run();
  } finally {
    const index = GENERATED_CLASS_FEATURES.findIndex(
      (feature) => feature.id === TEST_ID,
    );
    if (index >= 0) GENERATED_CLASS_FEATURES.splice(index, 1);
    delete FEATURE_MECHANICS[TEST_ID];
    invalidateClassFeatureRegistry();
  }
}

/** Герой Неистового с включённым авторасчётом. */
function furyWithAutomation(enabled = true): Character {
  const hero = createCharacter({ className: "Неистовый" });
  hero.automation = automation(enabled);
  return hero;
}

describe("applyCharacteristicEffects", () => {
  it("бонус характеристики считается поверх сохранённого значения и поднимает пороги", () => {
    const base = { might: 3, agility: 1, reason: 0, intuition: 0, presence: -1 };
    const effects: FeatureEffect[] = [{ kind: "characteristic", key: "might", value: 1 }];
    expect(applyCharacteristicEffects(base, effects).might).toBe(4);
    expect(applyCharacteristicEffects(base, effects).agility).toBe(1);
    expect(applyCharacteristicEffects(base, [])).toEqual(base);
  });

  it("складывает несколько бонусов и не меняет исходную запись", () => {
    const base = { might: 1, agility: 0, reason: 0, intuition: 0, presence: 0 };
    const effects: FeatureEffect[] = [
      { kind: "characteristic", key: "might", value: 1 },
      { kind: "characteristic", key: "might", value: 2 },
      { kind: "field", field: "speed", value: 3 },
    ];

    expect(applyCharacteristicEffects(base, effects)).toEqual({
      might: 4,
      agility: 0,
      reason: 0,
      intuition: 0,
      presence: 0,
    });
    expect(base.might).toBe(1);
  });
});

describe("effectiveCharacteristics", () => {
  it("пороги тиров и потенциал считаются от эффективных характеристик, сохранённые не меняются", () => {
    withRegistryEffects(
      [{ kind: "characteristic", key: "might", value: 1 }],
      () => {
        const hero = furyWithAutomation();
        hero.characteristics.might = 3;

        expect(hero.characteristics.might).toBe(3);
        expect(effectiveCharacteristics(hero).might).toBe(4);
        expect(deriveStats(hero).tierThresholds.might.t3).toBe(13); // 17 − 4
        expect(deriveStats(hero).potency.strong).toBe(4);
      },
    );
  });

  it("прибавка реестра не действует при выключенной автоматизации и действует при включённой", () => {
    withRegistryEffects(
      [{ kind: "characteristic", key: "presence", value: 2 }],
      () => {
        const disabled = furyWithAutomation(false);
        const enabled = furyWithAutomation(true);

        expect(disabled.automation?.enabled).toBe(false);
        expect(effectiveCharacteristics(disabled).presence).toBe(
          disabled.characteristics.presence,
        );
        expect(effectiveCharacteristics(enabled).presence).toBe(2);
        expect(featureCharacteristicBonus(enabled, "presence")).toBe(2);
        expect(featureCharacteristicBonus(disabled, "presence")).toBe(0);
      },
    );
  });

  it("без бонусов возвращает сохранённые характеристики и их не подменяет", () => {
    const hero = furyWithAutomation(true);

    expect(effectiveCharacteristics(hero)).toEqual(hero.characteristics);
    expect(effectiveCharacteristics(hero)).not.toBe(hero.characteristics);
  });

  it("при выключенной автоматизации реальные источники не считаются, при включённой — считаются", async () => {
    vi.resetModules();
    vi.doMock("../src/data/class-feature-rules", () => ({
      CLASS_FEATURE_GROUPS: [
        {
          id: "test.group",
          name: "Тестовая группа",
          className: "Тестовый класс",
          options: [
            {
              id: "test.option",
              name: "Тестовая опция",
              description: "",
              effects: [
                { kind: "characteristic" as const, key: "might" as const, value: 1 },
              ],
            },
          ],
        },
      ],
    }));
    try {
      const modifiers = await import("../src/lib/feature-modifiers");
      const hero = createCharacter();
      hero.className = "Тестовый класс";
      hero.characteristics.might = 2;
      const selections = { "test.group": "test.option" };

      hero.automation = {
        enabled: false,
        adjustments: {},
        ancestryTraits: [],
        classFeatureSelections: selections,
      };
      expect(modifiers.featureCharacteristicBonus(hero, "might")).toBe(0);
      expect(modifiers.effectiveCharacteristics(hero).might).toBe(2);

      const withAutomation = {
        ...hero,
        automation: { ...hero.automation, enabled: true },
      };
      expect(modifiers.featureCharacteristicBonus(withAutomation, "might")).toBe(1);
      expect(modifiers.effectiveCharacteristics(withAutomation).might).toBe(3);
      expect(modifiers.featureCharacteristicBonus(withAutomation, "agility")).toBe(0);
    } finally {
      vi.doUnmock("../src/data/class-feature-rules");
      vi.resetModules();
    }
  });

  it("пересчёт листа не трогает сохранённые характеристики", () => {
    withRegistryEffects(
      [{ kind: "characteristic", key: "might", value: 1 }],
      () => {
        const hero = furyWithAutomation(true);
        hero.characteristics.might = 3;

        const recalculated = recalculateCharacter(hero, hero);

        expect(recalculated.characteristics.might).toBe(3);
        expect(effectiveCharacteristics(recalculated).might).toBe(4);
      },
    );
  });
});

describe("evaluateDamage", () => {
  it("подставляет эффективную характеристику в формулу урона", () => {
    withRegistryEffects(
      [{ kind: "characteristic", key: "might", value: 1 }],
      () => {
        const hero = furyWithAutomation(true);
        hero.characteristics.might = 3;

        expect(evaluateDamage("3 + M", hero).values).toEqual([7]);
        expect(evaluateDamage("3 + M", hero).breakdown).toBe("3 + 4");
      },
    );
  });
});

describe("surgeDamage", () => {
  it("урон всплеска считается от эффективной характеристики", () => {
    withRegistryEffects(
      [{ kind: "characteristic", key: "might", value: 1 }],
      () => {
        const hero = furyWithAutomation(true);
        hero.characteristics.might = 3;

        expect(hero.characteristics.might).toBe(3);
        expect(surgeDamage(hero)).toBe(4);
        expect(surgeDamageTotal(hero, 2)).toBe(8);
      },
    );
  });
});
