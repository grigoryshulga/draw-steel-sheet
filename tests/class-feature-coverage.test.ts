import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { NOT_YET, TEXT_ONLY, mechanicsFor } from "../src/data/class-features/mechanics/index";

/** Класс, механики которого пишутся отдельным заходом: его пробел печатает второй тест. */
const PENDING_CLASS = "Неистовый";

describe("покрытие механик классовых особенностей", () => {
  it("каждая фича скелета смоделирована, помечена прозой или отложена с причиной", () => {
    // Неистовый стоит вне этого гейта: его механики пишет задача следующего захода,
    // а полный список недостающих фич перечисляет второй тест файла.
    const unexplained = GENERATED_CLASS_FEATURES.filter((f) => f.className !== PENDING_CLASS).filter(
      (f) => !mechanicsFor(f.id) && !TEXT_ONLY[f.id] && !NOT_YET[f.className],
    );
    expect(unexplained.map((f) => `${f.className}: ${f.name}`)).toEqual([]);
  });

  it("Неистовый покрыт полностью: ни одной отложенной фичи", () => {
    expect(NOT_YET[PENDING_CLASS]).toBeUndefined();
    const missing = GENERATED_CLASS_FEATURES.filter((f) => f.className === PENDING_CLASS).filter(
      (f) => !mechanicsFor(f.id) && !TEXT_ONLY[f.id],
    );
    expect(missing.map((f) => `${f.name} (ур. ${f.level})`)).toEqual([]);
  });
});
