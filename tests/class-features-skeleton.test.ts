import { describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { readSources, sourceHeadings } from "../scripts/build-class-features.mjs";

const KEY_GROUPS = ["aspect", "order", "domain", "tradition", "doctrine", "college", "troupe", "specialization"];

function recordKey(className: string, level: number, name: string) {
  return `${className}|${level}|${name.trim().toLowerCase()}`;
}

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

  it("у каждой записи есть текст и нет обрубка таблицы вместо текста", () => {
    const broken = GENERATED_CLASS_FEATURES.filter(
      (f) => !f.description.trim() || f.description.trimStart().startsWith("|"),
    );
    expect(broken.map((f) => `${f.className} L${f.level}: ${f.id}`)).toEqual([]);
  });

  it("keyedBy — только из известного набора групп выбора", () => {
    const unknown = GENERATED_CLASS_FEATURES.filter((f) => f.keyedBy && !KEY_GROUPS.includes(f.keyedBy));
    expect(unknown.map((f) => `${f.id}: ${f.keyedBy}`)).toEqual([]);
  });

  it("одна особенность — одна запись на уровне класса", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const f of GENERATED_CLASS_FEATURES) {
      const key = recordKey(f.className, f.level, f.name);
      const previous = seen.get(key);
      if (previous) duplicates.push(`${previous} / ${f.id}`);
      else seen.set(key, f.id);
    }
    expect(duplicates).toEqual([]);
  });

  it("каждый заголовок книги разрешается в запись скелета", () => {
    const { builder, levelUp } = readSources();
    const records = new Set(GENERATED_CLASS_FEATURES.map((f) => recordKey(f.className, f.level, f.name)));
    const unresolved = sourceHeadings(builder, levelUp).filter(
      (heading) => !records.has(recordKey(heading.className, heading.level, heading.name)),
    );
    expect(unresolved).toEqual([]);
  });
});
