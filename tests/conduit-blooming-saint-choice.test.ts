import { afterEach, describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { classFeatureChoicesForSheet, setBloomingSaintImmunityChoice } from "../src/lib/class-feature-view";
import { featureDamageImmunities } from "../src/lib/feature-modifiers";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import { invalidateClassFeatureRegistry } from "../src/lib/class-features";
import type { FeatureEffect } from "../src/data/class-features/types";

const GROUP = "conduit.blooming-saint-immunity";
const TEMP_ID = "test.conduit.blooming-saint.extra-immunity";

function hero(level = 6) {
  const value = createCharacter({ className: "Проводник", level });
  value.automation = { enabled: false, adjustments: { stamina: 3 }, ancestryTraits: ["keep"], classFeatureSelections: { preserved: "yes" } };
  return value;
}

function withTemporaryImmunity(effects: FeatureEffect[], run: () => void) {
  GENERATED_CLASS_FEATURES.push({ id: TEMP_ID, className: "Проводник", level: 1, name: "Тест", articleId: "test", description: "" });
  FEATURE_MECHANICS[TEMP_ID] = { kinds: ["damageImmunity"], effects };
  invalidateClassFeatureRegistry();
  try { run(); } finally {
    const index = GENERATED_CLASS_FEATURES.findIndex((entry) => entry.id === TEMP_ID);
    if (index >= 0) GENERATED_CLASS_FEATURES.splice(index, 1);
    delete FEATURE_MECHANICS[TEMP_ID];
    invalidateClassFeatureRegistry();
  }
}

afterEach(() => {
  const index = GENERATED_CLASS_FEATURES.findIndex((entry) => entry.id === TEMP_ID);
  if (index >= 0) GENERATED_CLASS_FEATURES.splice(index, 1);
  delete FEATURE_MECHANICS[TEMP_ID];
  invalidateClassFeatureRegistry();
});

describe("выбор иммунитета Расцветающего святого", () => {
  it("показывает только с 6 уровня Проводника и понимает сохранённый выбор старого листа", () => {
    expect(classFeatureChoicesForSheet(hero(5)).some((choice) => choice.group === GROUP)).toBe(false);
    const oldSheet = hero(6);
    expect(classFeatureChoicesForSheet(oldSheet).find((choice) => choice.group === GROUP)).toMatchObject({
      label: "Иммунитет Расцветающего святого", options: ["corruption", "holy"],
    });
    oldSheet.automation!.classFeatureSelections![GROUP] = "holy";
    expect(classFeatureChoicesForSheet(oldSheet).find((choice) => choice.group === GROUP)?.selected).toBe("holy");
    expect(classFeatureChoicesForSheet({ ...oldSheet, className: "Неистовый" }).some((choice) => choice.group === GROUP)).toBe(false);
  });

  it("сохраняет один допустимый вариант без потери старых полей в обоих режимах", () => {
    for (const enabled of [false, true]) {
      const source = hero();
      source.automation!.enabled = enabled;
      const saved = setBloomingSaintImmunityChoice(source, "corruption");
      expect(saved.automation?.classFeatureSelections).toEqual({ preserved: "yes", [GROUP]: "corruption" });
      expect(saved.automation?.adjustments).toEqual({ stamina: 3 });
      expect(saved.automation?.ancestryTraits).toEqual(["keep"]);
      expect(source.automation?.classFeatureSelections?.[GROUP]).toBeUndefined();
      expect(featureDamageImmunities(saved, { includeWhenAutomationOff: true })).toEqual([
        expect.objectContaining({ sourceId: GROUP, types: ["порча"], value: 10 }),
      ]);
      expect(featureDamageImmunities(saved).length).toBe(enabled ? 1 : 0);
    }
  });

  it("игнорирует отсутствующий/недопустимый выбор и объединяет его с остальными иммунитетами", () => {
    const value = hero();
    expect(featureDamageImmunities(value, { includeWhenAutomationOff: true })).toEqual([]);
    value.automation!.classFeatureSelections![GROUP] = "both";
    expect(featureDamageImmunities(value, { includeWhenAutomationOff: true })).toEqual([]);
    withTemporaryImmunity([{ kind: "damageImmunity", types: ["порча"], value: 5 }], () => {
      value.automation!.classFeatureSelections![GROUP] = "corruption";
      expect(featureDamageImmunities(value, { includeWhenAutomationOff: true })).toEqual([
        expect.objectContaining({ types: ["порча"], value: 10 }),
      ]);
    });
  });
});
