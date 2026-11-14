import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  normalizeNullState,
  normalizeTalentState,
  nullDiscipline,
  nullMastery,
  previewNullTalent,
  talentState,
  transitionNullTalent,
} from "../src/lib/class-mechanics/null-talent";
import type { Character } from "../src/types";
function hero(className: string): Character {
  const c = createCharacter();
  return {
    ...c,
    className,
    subclass: "Хронокинетик",
    level: 7,
    stamina: { ...c.stamina, current: 20, max: 30 },
    runtime: {
      round: 1,
      encounter: 1,
      turn: 1,
      turnActive: true,
      triggers: {},
      forms: [],
      resources: {},
    },
    heroicResource: { ...c.heroicResource, current: 10 },
  };
}
describe("Нуль и Талант: состояние листа", () => {
  it("сохраняет достигнутую дисциплину до конца хода и заменяет низшие пороги", () => {
    let c = transitionNullTalent(hero("Нуль"), "resource-change");
    c = { ...c, heroicResource: { ...c.heroicResource, current: 1 } };
    expect(nullDiscipline(c)).toBe(10);
    expect(
      nullMastery(c)
        .filter((r) => r.active)
        .map((r) => r.threshold),
    ).toEqual([2, 8, 10]);
    expect(nullDiscipline(transitionNullTalent(c, "turn-end"))).toBe(1);
  });
  it("тратит дисциплину на поле раз за ход и снимает усиление в начале следующего", () => {
    let c = hero("Нуль");
    const field = previewNullTalent(c, { kind: "null-field", active: true });
    if (!field.ok) throw Error();
    const enhanced = previewNullTalent(field.next, {
      kind: "null-enhance",
      enhancement: "Инерционный якорь",
    });
    if (!enhanced.ok) throw Error();
    c = enhanced.next;
    expect(c.heroicResource.current).toBe(9);
    expect(
      previewNullTalent(c, {
        kind: "null-enhance",
        enhancement: "Синаптический разрыв",
      }).ok,
    ).toBe(false);
    c = transitionNullTalent(c, "turn-start");
    expect(c.classMechanics?.null?.fieldActive).toBe(true);
    expect(c.classMechanics?.null?.enhancement).toBeUndefined();
  });
  it("наносит урон ровно раз за свой ход и сохраняет последствия после боя", () => {
    let c = hero("Талант");
    c = {
      ...c,
      heroicResource: { ...c.heroicResource, current: -3 },
      stamina: { ...c.stamina, current: 20, temp: 1 },
    };
    const added = previewNullTalent(c, {
      kind: "talent-consequence-add",
      text: "Замедлен до спасброска",
    });
    if (!added.ok) throw Error();
    c = transitionNullTalent(added.next, "turn-end");
    expect(c.stamina.current).toBe(18);
    expect(c.stamina.temp).toBe(0);
    expect(transitionNullTalent(c, "turn-end").stamina.current).toBe(18);
    expect(
      talentState(transitionNullTalent(c, "combat-end")).consequences,
    ).toHaveLength(1);
  });
  it("снимает только выбранное последствие и позволяет отказаться от урона на 10-м уровне", () => {
    let c = { ...hero("Талант"), level: 10 };
    c = { ...c, heroicResource: { ...c.heroicResource, current: -3 } };
    const added = previewNullTalent(c, {
      kind: "talent-consequence-add",
      text: "Не может использовать маневры до спасброска",
    });
    if (!added.ok) throw Error();
    const waived = previewNullTalent(added.next, {
      kind: "talent-waive-strain",
      waive: true,
    });
    if (!waived.ok) throw Error();
    expect(transitionNullTalent(waived.next, "turn-end").stamina.current).toBe(
      c.stamina.current,
    );
    const removed = previewNullTalent(waived.next, {
      kind: "talent-consequence-remove",
      index: 0,
    });
    if (!removed.ok) throw Error();
    expect(talentState(removed.next).consequences).toEqual([]);
  });
  it("не открывает пороги преждевременно и безопасно читает старые данные", () => {
    const c = { ...hero("Нуль"), level: 1 };
    expect(
      nullMastery(c)
        .filter((r) => r.active)
        .map((r) => r.threshold),
    ).toEqual([2, 4, 6]);
    expect(
      normalizeNullState({
        peakDiscipline: -4,
        fieldActive: "yes",
        enhancement: "bad",
      }),
    ).toMatchObject({ peakDiscipline: 0, fieldActive: false });
    expect(
      normalizeTalentState({ consequences: [null, "Эффект"] }).consequences,
    ).toEqual(["Эффект"]);
  });
});
