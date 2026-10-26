import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  applyCharacteristicEffects,
  effectiveCharacteristics,
  featureCharacteristicBonus,
} from "../src/lib/feature-modifiers";
import { recalculateCharacter } from "../src/lib/character-calculations";
import { deriveStats, evaluateDamage } from "../src/lib/rules";
import type { FeatureEffect } from "../src/data/class-features/types";

/** Минимальная автоматизация: тестам не нужны никакие выбранные фичи. */
function automationWithHook(effects: FeatureEffect[], enabled = false) {
  return {
    enabled,
    adjustments: {},
    ancestryTraits: [],
    // временный тестовый хук, удаляется в задаче 5
    characteristicEffectsForTest: effects,
  };
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
    const hero = createCharacter({ className: "Неистовый" });
    hero.characteristics.might = 3;
    // createCharacter не заводит automation: тест создаёт её сам, хук не зависит от флага
    hero.automation = automationWithHook([
      { kind: "characteristic", key: "might", value: 1 },
    ]);
    expect(hero.characteristics.might).toBe(3);
    expect(effectiveCharacteristics(hero).might).toBe(4);
    expect(deriveStats(hero).tierThresholds.might.t3).toBe(13); // 17 − 4
    expect(deriveStats(hero).potency.strong).toBe(4);
  });

  it("тестовый хук действует независимо от automation.enabled", () => {
    const disabled = createCharacter({ className: "Неистовый" });
    disabled.automation = automationWithHook(
      [{ kind: "characteristic", key: "presence", value: 2 }],
      false,
    );
    const enabled = createCharacter({ className: "Неистовый" });
    enabled.automation = automationWithHook(
      [{ kind: "characteristic", key: "presence", value: 2 }],
      true,
    );

    expect(disabled.automation.enabled).toBe(false);
    expect(effectiveCharacteristics(disabled).presence).toBe(2);
    expect(effectiveCharacteristics(enabled).presence).toBe(2);
  });

  it("без бонусов возвращает сохранённые характеристики и их не подменяет", () => {
    const hero = createCharacter({ className: "Неистовый" });
    hero.automation = automationWithHook([], true);

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
    const hero = createCharacter({ className: "Неистовый" });
    hero.characteristics.might = 3;
    hero.automation = automationWithHook(
      [{ kind: "characteristic", key: "might", value: 1 }],
      true,
    );

    const recalculated = recalculateCharacter(hero, hero);

    expect(recalculated.characteristics.might).toBe(3);
    expect(effectiveCharacteristics(recalculated).might).toBe(4);
  });
});

describe("evaluateDamage", () => {
  it("подставляет эффективную характеристику в формулу урона", () => {
    const hero = createCharacter({ className: "Неистовый" });
    hero.characteristics.might = 3;
    hero.automation = automationWithHook([
      { kind: "characteristic", key: "might", value: 1 },
    ]);

    expect(evaluateDamage("3 + M", hero).values).toEqual([7]);
    expect(evaluateDamage("3 + M", hero).breakdown).toBe("3 + 4");
  });
});
