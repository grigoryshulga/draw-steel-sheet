import { describe, expect, it } from "vitest";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import {
  createGameSession,
  previewGameAction,
  undoReason,
} from "../src/lib/game-actions";
import { featureConditionMet } from "../src/lib/feature-conditions";
import { fieldEffectContributions } from "../src/lib/feature-modifiers";
import type { FeatureEffect } from "../src/data/class-features/types";
import {
  beginEncounter,
  beginRound,
  currentRuntime,
  markTrigger,
} from "../src/lib/runtime";

const hero = () => createCharacter({ className: "Неистовый" });

describe("runtime state", () => {
  it("новый раунд снимает отметки раунда и сохраняет отметки схватки", () => {
    let character = markTrigger(hero(), "f1", true);
    character.runtime!.triggers["f2"] = { encounter: 1, count: 1 };
    character = beginRound(character);
    expect(character.runtime!.triggers["f1"]).toBeUndefined();
    expect(character.runtime!.triggers["f2"]).toEqual({ encounter: 1, count: 1 });
    expect(character.runtime!.round).toBe(2);
    expect(character.runtime!.encounter).toBe(1);
  });

  it("новая схватка чистит отметки целиком и растит номер схватки", () => {
    let character = markTrigger(hero(), "f1", true);
    character.runtime!.triggers["f2"] = { encounter: 1, count: 2 };
    character = beginEncounter(character);
    expect(character.runtime!.triggers).toEqual({});
    expect(character.runtime!.encounter).toBe(2);
  });

  it("отметка ставится с номером раунда и снимается повторным вызовом", () => {
    let character = markTrigger(hero(), "f1", true);
    expect(character.runtime!.triggers["f1"]).toEqual({ round: 1, count: 1 });
    character = markTrigger(character, "f1", false);
    expect(character.runtime!.triggers["f1"]).toBeUndefined();
    expect(character.runtime!.triggers).toEqual({});
  });

  it("повторная отметка в том же раунде увеличивает счётчик, в новом — начинает заново", () => {
    let character = markTrigger(hero(), "f1", true);
    character = markTrigger(character, "f1", true);
    expect(character.runtime!.triggers["f1"]).toEqual({ round: 1, count: 2 });
    character = markTrigger(beginRound(character), "f1", true);
    expect(character.runtime!.triggers["f1"]).toEqual({ round: 2, count: 1 });
  });

  it("отметка триггера схватки хранится номером схватки и переживает новый раунд", () => {
    let character = markTrigger(hero(), "f1", true, "encounter");
    expect(character.runtime!.triggers["f1"]).toEqual({ encounter: 1, count: 1 });

    character = beginRound(character);
    expect(character.runtime!.round).toBe(2);
    expect(character.runtime!.triggers["f1"]).toEqual({ encounter: 1, count: 1 });

    character = beginEncounter(character);
    expect(character.runtime!.triggers).toEqual({});
  });

  it("старый лист без runtime работает, а исходный герой не мутируется", () => {
    const character = hero();
    delete (character as { runtime?: unknown }).runtime;
    expect(currentRuntime(character)).toEqual({
      round: 1,
      encounter: 1,
      triggers: {},
      forms: [],
      resources: {},
    });
    expect(() => beginRound(character)).not.toThrow();
    expect(beginRound(character).runtime!.round).toBe(2);
    expect(character.runtime).toBeUndefined();

    const marked = markTrigger(character, "f1", true);
    expect(marked.runtime!.triggers["f1"]).toEqual({ round: 1, count: 1 });
    expect(character.runtime).toBeUndefined();
  });

  it("битый runtime нормализуется, валидный сохраняется, отсутствующий не создаётся", () => {
    const base = createCharacter({ name: "Битый runtime" });
    const broken = normalizeCharacter({
      ...base,
      runtime: {
        round: -3,
        encounter: "два",
        triggers: [],
        forms: "Теневая форма",
        resources: null,
      },
    } as Parameters<typeof normalizeCharacter>[0]);
    expect(broken.runtime).toEqual({
      round: 1,
      encounter: 1,
      triggers: {},
      forms: [],
      resources: {},
    });

    const withoutRuntime = normalizeCharacter({ ...base });
    expect("runtime" in withoutRuntime).toBe(false);

    const valid = normalizeCharacter({
      ...base,
      runtime: {
        round: 3,
        encounter: 2,
        triggers: { f1: { round: 3, count: 2 } },
        forms: ["Теневая форма"],
        resources: { Судьба: 3 },
      },
    });
    expect(valid.runtime).toEqual({
      round: 3,
      encounter: 2,
      triggers: { f1: { round: 3, count: 2 } },
      forms: ["Теневая форма"],
      resources: { Судьба: 3 },
    });
  });
});

describe("runtime game actions", () => {
  it("отметка триггера проходит через журнал действий и отменяется", () => {
    const character = hero();
    const preview = previewGameAction(character, {
      kind: "trigger",
      featureId: "f1",
      used: true,
    });
    expect(preview.ok).toBe(true);
    expect(preview.ok && preview.label).toBe("Отмечено: f1");

    const session = createGameSession();
    const applied = session.perform(
      character,
      { kind: "trigger", featureId: "f1", used: true },
      "trigger-1",
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.next.runtime!.triggers["f1"]).toEqual({ round: 1, count: 1 });

    const entry = session.entries()[0];
    expect(undoReason(applied.next, entry)).toBeUndefined();
    const undone = session.undo(applied.next);
    expect(undone.ok).toBe(true);
    // Отметка создала runtime, поэтому отмена возвращает лист без поля.
    expect(undone.ok && undone.next.runtime).toBeUndefined();
  });

  it("новый раунд идёт через журнал и возвращает снятые отметки", () => {
    const session = createGameSession();
    const character = markTrigger(hero(), "f1", true);
    const preview = previewGameAction(character, { kind: "round" });
    expect(preview.ok && preview.label).toBe("Новый раунд 2");

    const applied = session.perform(character, { kind: "round" }, "round-1");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.next.runtime!.triggers).toEqual({});
    expect(undoReason(applied.next, session.entries()[0])).toBeUndefined();
    const undone = session.undo(applied.next);
    expect(undone.ok).toBe(true);
    expect(undone.ok && undone.next.runtime!.round).toBe(1);
    expect(undone.ok && undone.next.runtime!.triggers["f1"]).toEqual({
      round: 1,
      count: 1,
    });
  });

  it("новая схватка идёт через журнал и отменяется", () => {
    const session = createGameSession();
    const character = markTrigger(hero(), "f1", true);
    const applied = session.perform(character, { kind: "encounter" }, "encounter-1");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.label).toBe("Новая схватка 2");
    expect(applied.next.runtime!.triggers).toEqual({});
    const undone = session.undo(applied.next);
    expect(undone.ok).toBe(true);
    expect(undone.ok && undone.next.runtime!.encounter).toBe(1);
    expect(undone.ok && undone.next.runtime!.triggers["f1"]).toEqual({
      round: 1,
      count: 1,
    });
  });

  it("отмену блокирует более поздняя правка состояния схватки", () => {
    const session = createGameSession();
    const character = hero();
    const applied = session.perform(character, { kind: "round" }, "round-2");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const later = markTrigger(applied.next, "f1", true);
    expect(undoReason(later, session.entries()[0])).toBeDefined();
  });
});

describe("runtime в движке особенностей", () => {
  const effects: FeatureEffect[] = [
    { kind: "field", field: "speed", value: 1, when: { formActive: "Теневая форма" } },
  ];
  const withRuntime = (patch: Partial<ReturnType<typeof currentRuntime>>) => {
    const character = hero();
    return {
      ...character,
      runtime: { ...currentRuntime(character), ...patch },
    };
  };

  it("форма из runtime включает условие formActive", () => {
    expect(featureConditionMet(hero(), { formActive: "Теневая форма" })).toBe(false);
    const transformed = withRuntime({ forms: ["Теневая форма"] });
    expect(featureConditionMet(transformed, { formActive: "Теневая форма" })).toBe(
      true,
    );
    expect(featureConditionMet(transformed, { formActive: "Элементальная форма" })).toBe(
      false,
    );
    expect(fieldEffectContributions(effects, transformed, "speed")).toHaveLength(1);
  });

  it("дополнительный пул из runtime закрывает условие resourceAtLeast", () => {
    const withPool = withRuntime({ resources: { Судьба: 3 } });
    expect(
      featureConditionMet(withPool, { resourceAtLeast: { name: "Судьба", value: 3 } }),
    ).toBe(true);
    expect(
      featureConditionMet(withPool, { resourceAtLeast: { name: "Судьба", value: 4 } }),
    ).toBe(false);
    expect(
      featureConditionMet(hero(), { resourceAtLeast: { name: "Судьба", value: 1 } }),
    ).toBe(false);
  });
});
