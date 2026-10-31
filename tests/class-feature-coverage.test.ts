import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { NOT_YET, TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics/index";

describe("покрытие механик классовых особенностей", () => {
  it("каждая фича скелета смоделирована, помечена прозой или отложена с причиной", () => {
    const unexplained = GENERATED_CLASS_FEATURES.filter(
      (f) => !mechanicsFor(f.id) && !TEXT_ONLY[f.id] && !NOT_YET[f.className],
    );
    expect(unexplained.map((f) => `${f.className}: ${f.name}`)).toEqual([]);
  });

  it("Неистовый покрыт полностью: ни одной отложенной фичи", () => {
    expect(NOT_YET["Неистовый"]).toBeUndefined();
    const missing = GENERATED_CLASS_FEATURES.filter(
      (f) => f.className === "Неистовый",
    ).filter((f) => !mechanicsFor(f.id) && !TEXT_ONLY[f.id]);
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
