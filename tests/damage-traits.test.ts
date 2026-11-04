import { describe, expect, it } from "vitest";
import {
  damageTraitText,
  normalizeDamageTraits,
  withDamageTrait,
  withoutDamageTrait,
} from "../src/lib/damage-traits";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { featureDamageImmunities } from "../src/lib/feature-modifiers";
import { damageTraitsForSheet } from "../src/lib/sheet-damage-traits";
import type { Character } from "../src/types";

/** Цензор с солнечным доменом: даёт автоматический иммунитет к огню. */
function censor(level = 8): Character {
  const hero = createCharacter({ className: "Цензор", level });
  hero.subclass = "Идеал";
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: { "censor.domain": "Солнце" },
  };
  return hero;
}

describe("иммунитеты и уязвимости на листе", () => {
  it("показывает автоматический иммунитет особенностей с источником", () => {
    const hero = censor();
    expect(featureDamageImmunities(hero)).toEqual([
      expect.objectContaining({
        sourceName: "Свет палящего солнца",
        types: ["огонь"],
        value: 8,
      }),
    ]);

    const rows = damageTraitsForSheet(hero);
    expect(rows).toEqual([
      expect.objectContaining({
        kind: "immunity",
        type: "огонь",
        value: 8,
        automatic: true,
        source: "Свет палящего солнца",
      }),
    ]);
  });

  it("ставит автоиммунитеты перед ручными уязвимостями", () => {
    const hero = withDamageTrait(censor(), {
      kind: "weakness",
      type: "холод",
      value: 5,
      note: "Морозный перевал",
    });
    const rows = damageTraitsForSheet(hero);
    expect(rows.map((row) => `${row.kind}:${row.type}:${row.value}`)).toEqual([
      "immunity:огонь:8",
      "weakness:холод:5",
    ]);
    expect(rows[1]).toMatchObject({
      automatic: false,
      source: "Морозный перевал",
    });
  });

  it("показывает автоиммунитеты и при выключенном авторасчёте", () => {
    const hero = censor();
    const disabled: Character = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(featureDamageImmunities(disabled)).toEqual([]);
    expect(damageTraitsForSheet(disabled)[0]).toMatchObject({
      type: "огонь",
      value: 8,
      automatic: true,
    });
  });

  it("не добавляет одинаковую ручную запись дважды", () => {
    const hero = censor();
    const once = withDamageTrait(hero, {
      kind: "weakness",
      type: "холод",
      value: 5,
    });
    const twice = withDamageTrait(once, {
      kind: "weakness",
      type: "холод",
      value: 5,
    });
    expect(twice).toBe(once);
    expect(twice.damageTraits).toHaveLength(1);
  });

  it("удаляет ручную запись и не трогает автоиммунитеты", () => {
    const hero = withDamageTrait(censor(), {
      kind: "weakness",
      type: "холод",
      value: 5,
    });
    const id = hero.damageTraits![0].id;
    const removed = withoutDamageTrait(hero, id);
    expect(removed.damageTraits).toEqual([]);
    expect(damageTraitsForSheet(removed)[0]).toMatchObject({
      type: "огонь",
      automatic: true,
    });
    expect(withoutDamageTrait(hero, "missing")).toBe(hero);
  });

  it("пишет фразу в дательном падеже и терпит незнакомый тип", () => {
    expect(
      damageTraitText({ kind: "immunity", type: "огонь", value: 5 }),
    ).toBe("Иммунитет к огню 5");
    expect(
      damageTraitText({ kind: "weakness", type: "психический", value: 3 }),
    ).toBe("Уязвимость к психическому 3");
    expect(
      damageTraitText({ kind: "immunity", type: "первозданный шторм", value: 9 }),
    ).toBe("Иммунитет: первозданный шторм 9");
  });
});

describe("нормализация ручных записей", () => {
  it("чистит значения, отбрасывает мусор и повторные записи", () => {
    const normalized = normalizeDamageTraits([
      { id: "a", kind: "immunity", type: " огонь ", value: 5, note: "  " },
      { kind: "weakness", type: "холод", value: 2 },
      { kind: "immunity", type: "огонь", value: 5 },
      { kind: "nope", type: "яд", value: 5 },
      { kind: "immunity", type: "", value: 5 },
      { kind: "immunity", type: "яд", value: 0 },
      "bad",
    ]);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({
      id: "a",
      kind: "immunity",
      type: "огонь",
      value: 5,
    });
    expect(normalized[1]).toMatchObject({
      kind: "weakness",
      type: "холод",
      value: 2,
    });
  });

  it("нормализация персонажа сохраняет валидные записи и выкидывает битые", () => {
    const hero = normalizeCharacter({
      ...censor(),
      damageTraits: [
        { kind: "weakness", type: "холод", value: 4, note: "тест" },
        { kind: "immunity", type: "огонь", value: -1 },
      ],
    });
    expect(hero.damageTraits).toEqual([
      expect.objectContaining({
        kind: "weakness",
        type: "холод",
        value: 4,
        note: "тест",
      }),
    ]);
  });
});
