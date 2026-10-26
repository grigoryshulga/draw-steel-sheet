import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";

describe("скелет классовых особенностей", () => {
  it("скелет покрывает девять классов и все уровни 1–10", () => {
    const byClass = new Map<string, Set<number>>();
    for (const f of GENERATED_CLASS_FEATURES) {
      if (!byClass.has(f.className)) byClass.set(f.className, new Set());
      byClass.get(f.className)!.add(f.level);
    }
    expect([...byClass.keys()].sort()).toEqual(
      ["Неистовый", "Нуль", "Проводник", "Тактик", "Талант", "Тень", "Трубадур", "Цензор", "Элементалист"].sort(),
    );
    for (const [name, levels] of byClass) {
      expect([...levels].sort((a, b) => a - b), name).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it("id уникальны, вложенные фичи ссылаются на существующего родителя", () => {
    const ids = new Set(GENERATED_CLASS_FEATURES.map((f) => f.id));
    expect(ids.size).toBe(GENERATED_CLASS_FEATURES.length);
    for (const f of GENERATED_CLASS_FEATURES) {
      if (f.parentId) expect(ids.has(f.parentId), f.id).toBe(true);
    }
  });

  it("вложенные фичи из таблиц Неистового разобраны по аспектам", () => {
    const nested = GENERATED_CLASS_FEATURES.filter(
      (f) => f.className === "Неистовый" && f.level === 2 && f.keyValue,
    );
    expect(nested.map((f) => f.name).sort()).toEqual(
      ["Зуб и коготь", "Неизбежный гнев", "Непреодолимая сила"].sort(),
    );
  });
});
