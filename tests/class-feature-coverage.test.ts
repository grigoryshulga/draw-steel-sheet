import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { NOT_YET, TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics/index";
import { LEGACY_CLASS_FEATURE_IDS } from "../src/data/originals";

/**
 * `TEXT_ONLY` — ручной словарь id скелета. Миграция уже перевела ключи на
 * английские id, но один ключ Неистового остался старым, поэтому причину
 * ищем и по новому id, и по его старому написанию из legacy-карты.
 */
const LEGACY_BY_FEATURE_ID = new Map(
  Object.entries(LEGACY_CLASS_FEATURE_IDS).map(([legacyId, id]) => [id, legacyId]),
);

function textOnlyReason(id: string): string | undefined {
  return TEXT_ONLY[id] ?? TEXT_ONLY[LEGACY_BY_FEATURE_ID.get(id) ?? ""];
}

describe("покрытие механик классовых особенностей", () => {
  it("каждая фича скелета смоделирована, помечена прозой или отложена с причиной", () => {
    const unexplained = GENERATED_CLASS_FEATURES.filter(
      (f) => !mechanicsFor(f.id) && !textOnlyReason(f.id) && !NOT_YET[f.className],
    );
    expect(unexplained.map((f) => `${f.className}: ${f.name}`)).toEqual([]);
  });

  it("Неистовый покрыт полностью: ни одной отложенной фичи", () => {
    expect(NOT_YET["Неистовый"]).toBeUndefined();
    const missing = GENERATED_CLASS_FEATURES.filter(
      (f) => f.className === "Неистовый",
    ).filter((f) => !mechanicsFor(f.id) && !textOnlyReason(f.id));
    expect(missing.map((f) => `${f.name} (ур. ${f.level})`)).toEqual([]);
  });
});

describe("причины отложенных и прозаических записей", () => {
  it("TEXT_ONLY и NOT_YET объясняют причину, а не перечисляют пустые строки", () => {
    for (const [id, reason] of Object.entries(TEXT_ONLY)) {
      expect(reason.trim().length, id).toBeGreaterThan(10);
    }
    for (const [className, reason] of Object.entries(NOT_YET)) {
      expect(reason.trim().length, className).toBeGreaterThan(10);
    }
  });

  it("механика без эффектов, триггера, выбора и ресурса обязана иметь notes", () => {
    const silent = GENERATED_CLASS_FEATURES.filter((feature) => {
      const mechanics = mechanicsFor(feature.id);
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
    expect(silent.map((feature) => `${feature.className}: ${feature.name}`)).toEqual(
      [],
    );
  });
});
