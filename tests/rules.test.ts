import { describe, expect, it } from "vitest";
import {
  applyDamage,
  deriveStats,
  evaluateDamage,
  rollPowerRoll,
  surgeDamageTotal,
  tierForTotal,
  vitalStatus,
} from "../src/lib/rules";
import type { Character, CharacteristicKey } from "../src/types";

function rngFrom(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** d10: floor(v * 10) + 1. */
const D10 = { d1: 0.0, d3: 0.2, d6: 0.5, d8: 0.7, d9: 0.8, d10: 0.95 } as const;

function makeCharacter(overrides: Partial<Character> = {}): Character {
  const characteristics: Record<CharacteristicKey, number> = {
    might: 2,
    agility: 1,
    reason: 3,
    intuition: 0,
    presence: -1,
  };
  const base = {
    schemaVersion: 1 as const,
    id: "test-hero",
    name: "Тестовый герой",
    ancestry: "",
    className: "",
    career: "",
    subclass: "",
    level: 1,
    xp: 0,
    epic: 0,
    victories: 0,
    wealth: "",
    renown: "",
    characteristics,
    stamina: { current: 30, max: 30, temp: 0 },
    recoveries: { current: 9, max: 9 },
    heroicResource: { name: "Ресурс", current: 1, max: 1 },
    surges: 0,
    heroTokens: 0,
    size: "",
    speed: "",
    stability: "",
    disengage: "",
    kit: "",
    weapon: "",
    armor: "",
    equipmentEffects: "",
    conditions: {},
    abilities: [],
    skills: [],
    languages: [],
    culture: { environment: "", organization: "", upbringing: "" },
    careerInfo: { benefits: "", details: "", incitingIncident: "" },
    ancestryTraits: "",
    classFeatures: "",
    notes: { story: "", contacts: "", debts: "", secrets: "", misc: "" },
    inventory: [],
    projects: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return { ...base, ...overrides } as Character;
}

describe("tierForTotal", () => {
  it("первые границы: 0 и 11 — тир 1", () => {
    expect(tierForTotal(0)).toBe(1);
    expect(tierForTotal(11)).toBe(1);
  });

  it("12–16 — тир 2", () => {
    expect(tierForTotal(12)).toBe(2);
    expect(tierForTotal(16)).toBe(2);
  });

  it("17 и больше — тир 3", () => {
    expect(tierForTotal(17)).toBe(3);
    expect(tierForTotal(99)).toBe(3);
  });
});

describe("rollPowerRoll", () => {
  it("сумма = кубики + характеристика + бонус", () => {
    const roll = rollPowerRoll({
      characteristic: 2,
      bonus: 1,
      rng: rngFrom(D10.d3, D10.d6),
    });
    expect(roll.die1).toBe(3);
    expect(roll.die2).toBe(6);
    expect(roll.natural).toBe(9);
    expect(roll.total).toBe(12);
    expect(roll.baseTier).toBe(2);
    expect(roll.tier).toBe(2);
    expect(roll.crit).toBe(false);
  });

  it("одно преимущество даёт +2 к сумме", () => {
    const plain = rollPowerRoll({
      characteristic: 2,
      rng: rngFrom(D10.d3, D10.d6),
    });
    const edged = rollPowerRoll({
      characteristic: 2,
      edges: 1,
      rng: rngFrom(D10.d3, D10.d6),
    });
    expect(edged.net).toBe(1);
    expect(edged.edgeBonus).toBe(2);
    expect(edged.total).toBe(plain.total + 2);
    expect(edged.tierShift).toBe(0);
  });

  it("одна помеха даёт −2 к сумме", () => {
    const roll = rollPowerRoll({
      characteristic: 0,
      banes: 1,
      rng: rngFrom(D10.d3, D10.d6),
    });
    expect(roll.net).toBe(-1);
    expect(roll.edgeBonus).toBe(-2);
    expect(roll.total).toBe(9 - 2);
    expect(roll.tier).toBe(1);
  });

  it("преимущества и помехи взаимно сокращаются (нетто)", () => {
    const roll = rollPowerRoll({
      characteristic: 2,
      edges: 2,
      banes: 2,
      rng: rngFrom(D10.d3, D10.d6),
    });
    expect(roll.net).toBe(0);
    expect(roll.edgeBonus).toBe(0);
    expect(roll.tierShift).toBe(0);
    expect(roll.total).toBe(9 + 2);
  });

  it("двойное преимущество сдвигает тир на +1", () => {
    const roll = rollPowerRoll({
      characteristic: 0,
      edges: 2,
      rng: rngFrom(D10.d3, D10.d3),
    });
    expect(roll.natural).toBe(6);
    expect(roll.baseTier).toBe(1);
    expect(roll.tierShift).toBe(1);
    expect(roll.tier).toBe(2);
  });

  it("двойная помеха сдвигает тир на −1", () => {
    const roll = rollPowerRoll({
      characteristic: 0,
      banes: 2,
      rng: rngFrom(D10.d8, D10.d10),
    });
    expect(roll.natural).toBe(18);
    expect(roll.baseTier).toBe(3);
    expect(roll.tierShift).toBe(-1);
    expect(roll.tier).toBe(2);
  });

  it("сдвиг тира клампится в 1..3 снизу", () => {
    const roll = rollPowerRoll({
      characteristic: 0,
      banes: 2,
      rng: rngFrom(D10.d1, D10.d3),
    });
    expect(roll.natural).toBe(4);
    expect(roll.baseTier).toBe(1);
    expect(roll.tier).toBe(1);
  });

  it("сдвиг тира клампится в 1..3 сверху", () => {
    // Тир 3 по сумме без натуральных 19–20: 8+10+10 = 28.
    const roll = rollPowerRoll({
      characteristic: 10,
      edges: 2,
      rng: rngFrom(D10.d8, D10.d10),
    });
    expect(roll.natural).toBe(18);
    expect(roll.baseTier).toBe(3);
    expect(roll.tierShift).toBe(1);
    expect(roll.tier).toBe(3);
  });

  it("натуральные 19–20 всегда дают тир 3 даже при двойной помехе", () => {
    const roll = rollPowerRoll({
      characteristic: 0,
      banes: 2,
      rng: rngFrom(D10.d10, D10.d10),
    });
    expect(roll.natural).toBe(20);
    expect(roll.total).toBe(20);
    expect(roll.tier).toBe(3);
  });

  it("физические кубики используют те же расчёты и не вызывают rng", () => {
    let calls = 0;
    const roll = rollPowerRoll({
      characteristic: 3,
      dice: [8, 6],
      rng: () => {
        calls += 1;
        return 0;
      },
    });
    expect(roll.total).toBe(17);
    expect(roll.tier).toBe(3);
    expect(calls).toBe(0);
  });

  it("физические натуральные 19 сохраняют тир 3 при помехах и дают крит для основного действия", () => {
    const roll = rollPowerRoll({
      characteristic: 0,
      dice: [9, 10],
      banes: 2,
      isMainAction: true,
    });
    expect(roll.natural).toBe(19);
    expect(roll.tier).toBe(3);
    expect(roll.crit).toBe(true);
  });

  it.each([0, 11, 1.5, Number.NaN])(
    "отклоняет недопустимое значение физического d10: %s",
    (die) => {
      expect(() =>
        rollPowerRoll({ characteristic: 0, dice: [die, 1] }),
      ).toThrow();
    },
  );

  it("крит только для основного действия и натуральных 19–20", () => {
    const nat20 = rngFrom(D10.d10, D10.d10);
    expect(
      rollPowerRoll({ characteristic: 0, isMainAction: true, rng: nat20 }).crit,
    ).toBe(true);

    const nat19 = rngFrom(D10.d9, D10.d10);
    expect(
      rollPowerRoll({ characteristic: 0, isMainAction: true, rng: nat19 }).crit,
    ).toBe(true);

    const notMain = rngFrom(D10.d10, D10.d10);
    expect(
      rollPowerRoll({ characteristic: 0, isMainAction: false, rng: notMain })
        .crit,
    ).toBe(false);

    const low = rngFrom(D10.d3, D10.d6);
    expect(
      rollPowerRoll({ characteristic: 0, isMainAction: true, rng: low }).crit,
    ).toBe(false);
  });
});

describe("evaluateDamage", () => {
  const character = makeCharacter();

  it("«3 + M» складывает константу с характеристикой", () => {
    const result = evaluateDamage("3 + M", character);
    expect(result.values).toEqual([5]);
    expect(result.dice).toEqual([]);
    expect(result.display).toBe("5");
    expect(result.breakdown).toBe("3 + 2");
  });

  it("варианты через «или» дают список значений", () => {
    const result = evaluateDamage("5 + A или M", character);
    expect(result.values).toEqual([6, 7]);
    expect(result.display).toBe("6 / 7");
  });

  it("список характеристик через запятую разворачивается в варианты", () => {
    const result = evaluateDamage("5 + M, R, I или P", character);
    expect(result.values).toEqual([7, 8, 5, 4]);
    expect(result.display).toBe("7 / 8 / 5 / 4");
  });

  it("формула без характеристики остаётся числом", () => {
    const result = evaluateDamage("4", character);
    expect(result.values).toEqual([4]);
    expect(result.display).toBe("4");
    expect(result.breakdown).toBe("4");
  });

  it("кубик сохраняется в display", () => {
    const result = evaluateDamage("1d6 + 2", character);
    expect(result.dice).toEqual(["1d6"]);
    expect(result.values).toEqual([2]);
    expect(result.display).toBe("1d6 + 2");
  });

  it("отрицательная характеристика даёт отрицательное значение", () => {
    const result = evaluateDamage("P", character);
    expect(result.values).toEqual([-1]);
    expect(result.display).toBe("-1");
  });

  it("кириллические обозначения характеристик работают", () => {
    const result = evaluateDamage("М + 2", character);
    expect(result.values).toEqual([4]);
  });

  it("пустая формула — пустой результат", () => {
    expect(evaluateDamage("", character)).toEqual({
      values: [],
      dice: [],
      display: "",
      breakdown: "",
    });
    expect(evaluateDamage("   ", character).display).toBe("");
  });
});

describe("applyDamage", () => {
  it("временная выносливость съедается первой", () => {
    const result = applyDamage(20, 5, 3);
    expect(result).toEqual({ stamina: 20, temp: 2, absorbed: 3 });
  });

  it("излишек урона уходит в выносливость", () => {
    const result = applyDamage(20, 5, 8);
    expect(result).toEqual({ stamina: 17, temp: 0, absorbed: 5 });
  });

  it("без временной выносливости урон идёт целиком в выносливость", () => {
    expect(applyDamage(20, 0, 4)).toEqual({
      stamina: 16,
      temp: 0,
      absorbed: 0,
    });
  });

  it("нулевой и отрицательный урон ничего не меняют", () => {
    expect(applyDamage(15, 3, 0)).toEqual({
      stamina: 15,
      temp: 3,
      absorbed: 0,
    });
    expect(applyDamage(15, 3, -7)).toEqual({
      stamina: 15,
      temp: 3,
      absorbed: 0,
    });
  });

  it("дробный урон округляется вниз", () => {
    expect(applyDamage(20, 0, 2.7).stamina).toBe(18);
  });
});

describe("vitalStatus", () => {
  // max 30 → половина 15, смерть от −15.
  const base = makeCharacter();

  function withCurrent(current: number): Character {
    return makeCharacter({ ...base, stamina: { current, max: 30, temp: 0 } });
  }

  it("полное здоровье — в строю", () => {
    expect(vitalStatus(withCurrent(30))).toEqual({
      label: "В строю",
      tone: "normal",
    });
  });

  it("выше половины — в строю", () => {
    expect(vitalStatus(withCurrent(16)).tone).toBe("normal");
  });

  it("ровно половина и ниже — утомлён", () => {
    expect(vitalStatus(withCurrent(15))).toEqual({
      label: "Утомлён",
      tone: "winded",
    });
    expect(vitalStatus(withCurrent(1)).tone).toBe("winded");
  });

  it("ноль и ниже, но не мёртв — при смерти", () => {
    expect(vitalStatus(withCurrent(0))).toEqual({
      label: "При смерти",
      tone: "dying",
    });
    expect(vitalStatus(withCurrent(-14)).tone).toBe("dying");
  });

  it("на −winded и ниже — мёртв", () => {
    expect(vitalStatus(withCurrent(-15))).toEqual({
      label: "Мёртв",
      tone: "dead",
    });
    expect(vitalStatus(withCurrent(-40)).tone).toBe("dead");
  });
});

describe("deriveStats", () => {
  it("recoveryValue = floor(max/3), winded = floor(max/2)", () => {
    const stats = deriveStats(makeCharacter());
    expect(stats.recoveryValue).toBe(10);
    expect(stats.winded).toBe(15);
  });

  it("potency считается от высочайшей характеристики", () => {
    const stats = deriveStats(makeCharacter());
    expect(stats.potency).toEqual({ weak: 1, average: 2, strong: 3 });
  });

  it("potency берёт максимум, а не первую характеристику", () => {
    const stats = deriveStats(
      makeCharacter({
        characteristics: {
          might: -1,
          agility: 0,
          reason: 1,
          intuition: 4,
          presence: 2,
        },
      }),
    );
    expect(stats.potency).toEqual({ weak: 2, average: 3, strong: 4 });
  });

  it("пороги тиров считаются от каждой характеристики", () => {
    const stats = deriveStats(makeCharacter());
    expect(stats.tierThresholds.might).toEqual({ t2: 10, t3: 15 });
    expect(stats.tierThresholds.reason).toEqual({ t2: 9, t3: 14 });
  });

  it("highestCharacteristic — максимум по характеристикам", () => {
    expect(deriveStats(makeCharacter()).highestCharacteristic).toBe(3);
  });
});

describe("surgeDamageTotal", () => {
  it("всплеск равен максимальной характеристике", () => {
    const character = makeCharacter();
    expect(surgeDamageTotal(character, 1)).toBe(3);
    expect(surgeDamageTotal(character, 2)).toBe(6);
  });

  it("больше трёх всплесков не даёт больше урона", () => {
    const character = makeCharacter();
    expect(surgeDamageTotal(character, 5)).toBe(9);
    expect(surgeDamageTotal(character, 100)).toBe(9);
  });

  it("ноль и отрицательное число всплесков не дают минус", () => {
    const character = makeCharacter();
    expect(surgeDamageTotal(character, 0)).toBe(0);
    expect(surgeDamageTotal(character, -2)).toBe(0);
  });

  it("отрицательные характеристики не дают отрицательный бонус", () => {
    const character = makeCharacter({
      characteristics: {
        might: -2,
        agility: -1,
        reason: -3,
        intuition: 0,
        presence: -1,
      },
    });
    expect(surgeDamageTotal(character, 2)).toBe(0);
  });
});
