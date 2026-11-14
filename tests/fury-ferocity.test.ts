import { describe, expect, it } from "vitest";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { calculatedValues, recalculateCharacter } from "../src/lib/character-calculations";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { createGameSession, previewGameAction, type GameAction } from "../src/lib/game-actions";
import { featureConditionMet } from "../src/lib/feature-conditions";
import { currentRuntime, markTrigger } from "../src/lib/runtime";
import { growingFerocityState } from "../src/lib/fury-ferocity";
import type { Character } from "../src/types";

function fury(subclass = "Буревестник", kit = "Корвен", level = 10): Character {
  const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Неистовый", subclass, kit,
    characteristics: startingCharacteristics("Неистовый") });
  return { ...hero, level, heroicResource: { ...hero.heroicResource, current: 2 } };
}

function apply(hero: Character, action: GameAction): Character {
  const result = previewGameAction(hero, action);
  expect(result?.ok).toBe(true);
  if (!result?.ok) throw new Error(`Action failed: ${JSON.stringify(action)}`);
  return recalculateCharacter(hero, result.next);
}

describe("Растущая свирепость на листе", () => {
  it.each([
    ["Берсерк", "Гора"], ["Разоритель", "Гора"],
    ["Буревестник", "Борен"], ["Буревестник", "Корвен"], ["Буревестник", "Раден"], ["Буревестник", "Вукен"],
  ])("показывает пороги и заменяет слабые преимущества: %s, %s", (subclass, kit) => {
    const hero = fury(subclass, kit);
    const state = growingFerocityState({ ...hero, heroicResource: { ...hero.heroicResource, current: 12 } })!;
    expect(state.rows.map((row) => row.threshold)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(state.rows.filter((row) => row.active && !row.replacedBy).map((row) => row.threshold)).toEqual([2, 8, 10, 12]);
    expect(state.rows.find((row) => row.threshold === 4)?.replacedBy).toBe(8);
    expect(state.rows.find((row) => row.threshold === 6)?.replacedBy).toBe(10);
    expect(state.rows.every((row) => row.description.length > 0)).toBe(true);
  });

  it.each([[1, [2, 4, 6]], [4, [2, 6, 8]], [7, [2, 8, 10]], [10, [2, 8, 10, 12]]])(
    "не открывает недоступные по уровню преимущества: %s", (level, expected) => {
      const hero = fury("Буревестник", "Борен", level as number);
      const state = growingFerocityState({ ...hero, heroicResource: { ...hero.heroicResource, current: 12 } })!;
      expect(state.rows.filter((row) => row.active && !row.replacedBy).map((row) => row.threshold)).toEqual(expected);
    },
  );

  it("в свой ход удерживает максимум после траты, затем возвращается к текущему ресурсу", () => {
    let hero = apply(fury(), { kind: "fury-turn-start" });
    hero = apply(hero, { kind: "resource", resource: "heroicResource", value: 8 });
    hero = apply(hero, { kind: "resource", resource: "heroicResource", value: 1 });
    expect(growingFerocityState(hero)).toMatchObject({ current: 1, effective: 8, turnActive: true });
    expect(calculatedValues(hero).disengage).toBe(2 + hero.characteristics.agility);
    expect(featureConditionMet(hero, { resourceAtLeast: { name: "Свирепость", value: 8 } })).toBe(false);
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(hero)));
    expect(growingFerocityState(restored)).toMatchObject({ current: 1, effective: 8, turnActive: true });
    hero = apply(restored, { kind: "fury-turn-end" });
    expect(growingFerocityState(hero)).toMatchObject({ current: 1, effective: 1, turnActive: false });
    expect(calculatedValues(hero).disengage).toBe(2);
  });

  it("учитывает прямую правку ресурса и растущий максимум в том же ходе", () => {
    const started = apply(fury(), { kind: "fury-turn-start" });
    const raised = recalculateCharacter(started, { ...started, heroicResource: { ...started.heroicResource, current: 10 } });
    const spent = recalculateCharacter(raised, { ...raised, heroicResource: { ...raised.heroicResource, current: 0 } });
    expect(growingFerocityState(spent)?.effective).toBe(10);
  });

  it("начало своего хода снимает отметки хода, сохраняя отметки раунда и схватки", () => {
    let hero = markTrigger(fury(), "start-of-turn", true, "turn");
    hero = markTrigger(hero, "take-damage", true, "round");
    hero = markTrigger(hero, "winded-or-dying", true, "encounter");
    const started = apply(hero, { kind: "fury-turn-start" });
    expect(currentRuntime(started).triggers["start-of-turn"]).toBeUndefined();
    expect(currentRuntime(started).triggers["take-damage"]).toBeDefined();
    expect(currentRuntime(started).triggers["winded-or-dying"]).toBeDefined();
    expect(previewGameAction(started, { kind: "fury-turn-start" })?.ok).toBe(false);
  });

  it("связывает расчёт с выбранным комплектом и сохраняет ручные числа без автоматизации", () => {
    let hero = apply(fury(), { kind: "fury-turn-start" });
    hero = apply(hero, { kind: "resource", resource: "heroicResource", value: 6 });
    hero = apply(hero, { kind: "resource", resource: "heroicResource", value: 0 });
    expect(growingFerocityState(hero)?.source).toContain("Корвен");
    expect(growingFerocityState({ ...hero, kit: "Борен" })?.source).toContain("Борен");
    const manual = { ...hero, automation: { ...hero.automation!, enabled: false } };
    expect(growingFerocityState(manual)?.effective).toBe(6);
    expect(calculatedValues(manual).disengage).toBe(2);
  });

  it.each(["round", "encounter", "rest", "combat-end"] as const)("сбрасывает удержанные пороги: %s", (kind) => {
    let hero = apply(fury(), { kind: "combat-start" });
    hero = apply(hero, { kind: "fury-turn-start" });
    hero = apply(hero, { kind: "resource", resource: "heroicResource", value: 8 });
    hero = apply(hero, { kind: "resource", resource: "heroicResource", value: 1 });
    const reset = apply(hero, { kind });
    expect(growingFerocityState(reset)?.turnActive).toBe(false);
    expect(growingFerocityState(reset)?.effective).toBe(kind === "rest" || kind === "combat-end" ? 0 : 1);
  });

  it("отменяет рост ресурса, расход способности и конец хода вместе с удержанными порогами", () => {
    const session = createGameSession();
    let hero = fury();
    hero.abilities = [...hero.abilities, { ...hero.abilities[0], id: "ferocity-spend", resourceCost: 5 }];
    const perform = (action: GameAction, id: string) => {
      const result = session.perform(hero, action, id);
      expect(result.ok).toBe(true);
      if (result.ok) hero = recalculateCharacter(hero, result.next);
    };
    const undo = () => {
      const result = session.undo(hero);
      expect(result.ok).toBe(true);
      if (result.ok) hero = recalculateCharacter(hero, result.next);
    };
    perform({ kind: "fury-turn-start" }, "start");
    perform({ kind: "resource", resource: "heroicResource", value: 8 }, "gain");
    perform({ kind: "ability", abilityId: "ferocity-spend", surges: 0 }, "ability");
    expect(growingFerocityState(hero)).toMatchObject({ current: 3, effective: 8 });
    perform({ kind: "fury-turn-end" }, "end");
    undo();
    expect(growingFerocityState(hero)).toMatchObject({ current: 3, effective: 8, turnActive: true });
    undo();
    expect(growingFerocityState(hero)).toMatchObject({ current: 8, effective: 8 });
    undo();
    expect(growingFerocityState(hero)).toMatchObject({ current: 2, effective: 2 });
    undo();
    expect(currentRuntime(hero).furyTurn).toBeUndefined();
  });

  it("сравнивает состояние хода по значениям, даже если порядок полей изменился при сериализации", () => {
    const session = createGameSession();
    const started = apply(fury(), { kind: "fury-turn-start" });
    const changed = session.perform(started, { kind: "resource", resource: "heroicResource", value: 8 }, "raise");
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    const reordered = { ...changed.next, runtime: { ...currentRuntime(changed.next), furyTurn: { peak: 8, active: true } } };
    expect(session.undo(reordered).ok).toBe(true);
  });

  it("сохраняет совместимость старых листов, чистит некорректное состояние и не переносит ход на другой класс", () => {
    const hero = fury();
    expect(hero.runtime?.furyTurn).toBeUndefined();
    expect(growingFerocityState(hero)?.effective).toBe(2);
    const started = apply(hero, { kind: "fury-turn-start" });
    const changed = recalculateCharacter(started, { ...started, className: "Тактик" });
    expect(currentRuntime(changed).furyTurn).toBeUndefined();
    expect(growingFerocityState(changed)).toBeUndefined();
    expect(previewGameAction(createCharacter({ className: "Тактик" }), { kind: "fury-turn-start" })?.ok).toBe(false);
    const invalid = normalizeCharacter({ ...hero, runtime: { ...currentRuntime(hero), furyTurn: { active: "да", peak: -1 } } } as unknown as Character);
    expect(currentRuntime(invalid).furyTurn).toBeUndefined();
  });
});
