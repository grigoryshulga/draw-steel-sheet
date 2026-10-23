import { describe, expect, it } from "vitest";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import {
  createGameSession,
  previewGameAction,
  undoReason,
} from "../src/lib/game-actions";

function hero() {
  const base = createCharacter({ name: "Тестовый герой", className: "Тактик" });
  return normalizeCharacter({
    ...base,
    id: "hero-1",
    stamina: { current: 20, max: 30, temp: 0 },
    recoveries: { current: 3, max: 5 },
    heroicResource: { ...base.heroicResource, current: 4, max: 6 },
    surges: 4,
    heroTokens: 3,
  });
}

describe("game actions", () => {
  it("absorbs damage with temporary stamina first and allows negative current stamina", () => {
    const c = hero();
    c.stamina = { ...c.stamina, current: 2, temp: 3 };
    const absorbed = previewGameAction(c, { kind: "damage", amount: 4 });
    expect(absorbed.ok && absorbed.next.stamina).toEqual({
      current: 1,
      max: 30,
      temp: 0,
    });
    const lethal = previewGameAction(c, { kind: "damage", amount: 9 });
    expect(lethal.ok && lethal.next.stamina).toEqual({
      current: -4,
      max: 30,
      temp: 0,
    });
  });

  it("caps healing at max and spends recovery only when healing succeeds", () => {
    const c = hero();
    c.stamina = { ...c.stamina, current: 28 };
    const healed = previewGameAction(c, { kind: "heal", amount: 10 });
    expect(healed.ok && healed.next.stamina.current).toBe(30);
    const recovery = previewGameAction(c, { kind: "recovery" });
    expect(recovery.ok && recovery.next.recoveries.current).toBe(2);
    c.stamina = { ...c.stamina, current: 30 };
    const full = previewGameAction(c, { kind: "recovery" });
    expect(full.ok).toBe(false);
    expect(c.recoveries.current).toBe(3);
  });

  it("sets temporary stamina to the larger value without stacking", () => {
    const c = hero();
    c.stamina = { ...c.stamina, temp: 4 };
    const raised = previewGameAction(c, { kind: "temporary", amount: 7 });
    expect(raised.ok && raised.next.stamina.temp).toBe(7);
    const lower = previewGameAction(c, { kind: "temporary", amount: 3 });
    expect(lower.ok).toBe(false);
    expect(c.stamina.temp).toBe(4);
  });

  it("records five rest changes and undo restores values while preserving other fields and current maxima", () => {
    const c = hero();
    c.stamina = { ...c.stamina, current: 8, temp: 6 };
    c.recoveries = { ...c.recoveries, current: 1 };
    c.heroicResource = { ...c.heroicResource, current: 2 };
    c.surges = 1;
    const session = createGameSession();
    const rested = session.perform(c, { kind: "rest" }, "rest-1");
    expect(rested.ok).toBe(true);
    expect(session.entries()[0].changes).toHaveLength(5);
    if (!rested.ok) return;
    const changed = normalizeCharacter({
      ...rested.next,
      name: "Новое имя",
    });
    const undone = session.undo(changed);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.next.name).toBe("Новое имя");
    expect(undone.next.stamina).toEqual({ current: 8, max: 30, temp: 6 });
    expect(undone.next.recoveries).toEqual({ current: 1, max: 5 });
    expect(undone.next.heroicResource).toEqual({
      ...changed.heroicResource,
      current: 2,
    });
    expect(undone.next.surges).toBe(1);
  });

  it("spends ability resource and selected surges atomically, with waiveCost waiving only resource", () => {
    const c = hero();
    const ability = {
      ...c.abilities[0],
      id: "costly",
      name: "Удар",
      resourceCost: 3,
    };
    c.abilities = [ability];
    c.heroicResource = { ...c.heroicResource, current: 2 };
    const noResource = previewGameAction(c, {
      kind: "ability",
      abilityId: ability.id,
      surges: 2,
    });
    expect(noResource.ok).toBe(false);
    expect(c.heroicResource.current).toBe(2);
    expect(c.surges).toBe(4);
    const waived = previewGameAction(c, {
      kind: "ability",
      abilityId: ability.id,
      surges: 2,
      waiveCost: true,
    });
    expect(waived.ok && waived.next.heroicResource.current).toBe(2);
    expect(waived.ok && waived.next.surges).toBe(2);
    c.heroicResource = { ...c.heroicResource, current: 4 };
    c.surges = 1;
    const noSurges = previewGameAction(c, {
      kind: "ability",
      abilityId: ability.id,
      surges: 2,
    });
    expect(noSurges.ok).toBe(false);
    expect(c.heroicResource.current).toBe(4);
    expect(c.surges).toBe(1);
  });

  it("records a free ability and rejects replay of the same operation id", () => {
    const c = hero();
    const ability = { ...c.abilities[0], id: "free", resourceCost: 0 };
    c.abilities = [ability];
    const session = createGameSession();
    const first = session.perform(
      c,
      { kind: "ability", abilityId: ability.id, surges: 1 },
      "op-1",
    );
    expect(first.ok).toBe(true);
    expect(session.entries()).toHaveLength(1);
    expect(session.entries()[0].changes).toEqual([
      { key: "surges", before: 4, after: 3 },
    ]);
    const replay = session.perform(
      c,
      { kind: "ability", abilityId: ability.id, surges: 1 },
      "op-1",
    );
    expect(replay.ok).toBe(false);
    expect(session.entries()).toHaveLength(1);
  });

  it("spends a paid ability's exact resource and surges, then undoes both", () => {
    const c = hero();
    const ability = { ...c.abilities[0], id: "paid", resourceCost: 3 };
    c.abilities = [ability];
    c.heroicResource = { ...c.heroicResource, current: 6 };
    c.surges = 2;
    const session = createGameSession();
    const used = session.perform(
      c,
      { kind: "ability", abilityId: ability.id, surges: 1 },
      "paid-1",
    );
    expect(used.ok).toBe(true);
    if (!used.ok) return;
    expect(used.next.heroicResource.current).toBe(3);
    expect(used.next.surges).toBe(1);
    const undone = session.undo(used.next);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.next.heroicResource.current).toBe(6);
    expect(undone.next.surges).toBe(2);
  });

  it("charges additional ability cost atomically and rejects invalid extras", () => {
    const c = hero();
    const ability = { ...c.abilities[0], id: "enhanced", resourceCost: 3 };
    c.abilities = [ability];
    c.heroicResource = { ...c.heroicResource, current: 6 };
    c.surges = 2;
    const session = createGameSession();
    const used = session.perform(c, {
      kind: "ability", abilityId: ability.id, surges: 1, additionalCost: 2,
    }, "enhanced-1");
    expect(used.ok).toBe(true);
    if (!used.ok) return;
    expect(used.next.heroicResource.current).toBe(1);
    expect(used.next.surges).toBe(1);

    const short = previewGameAction(c, {
      kind: "ability", abilityId: ability.id, surges: 1, additionalCost: 4,
    });
    expect(short.ok).toBe(false);
    expect(c.heroicResource.current).toBe(6);
    expect(c.surges).toBe(2);
    for (const additionalCost of [Number.NaN, -1]) {
      expect(previewGameAction(c, {
        kind: "ability", abilityId: ability.id, surges: 0, additionalCost,
      }).ok).toBe(false);
    }
  });

  it("records and undoes a free zero-surge ability with no value changes", () => {
    const c = hero();
    const ability = { ...c.abilities[0], id: "free-noop", resourceCost: 0 };
    c.abilities = [ability];
    const session = createGameSession();
    const used = session.perform(
      c,
      { kind: "ability", abilityId: ability.id, surges: 0 },
      "free-noop-1",
    );
    expect(used.ok).toBe(true);
    expect(session.entries()).toHaveLength(1);
    expect(session.entries()[0].changes).toEqual([]);
    if (!used.ok) return;
    const undone = session.undo(used.next);
    expect(undone.ok).toBe(true);
    expect(session.entries()[0].undone).toBe(true);
  });

  it("clears operation receipts on reset", () => {
    const c = hero();
    const session = createGameSession();
    expect(
      session.perform(c, { kind: "damage", amount: 1 }, "reused-id").ok,
    ).toBe(true);
    session.reset();
    expect(session.entries()).toEqual([]);
    expect(
      session.perform(c, { kind: "damage", amount: 1 }, "reused-id").ok,
    ).toBe(true);
  });

  it("undoes a chain newest-first and refuses changed values, maxima, or another character", () => {
    const c = hero();
    const session = createGameSession();
    const first = session.perform(c, { kind: "damage", amount: 2 }, "damage");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = session.perform(
      first.next,
      { kind: "heal", amount: 1 },
      "heal",
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const undoSecond = session.undo(second.next);
    expect(undoSecond.ok && undoSecond.next.stamina.current).toBe(18);
    if (!undoSecond.ok) return;
    const undoFirst = session.undo(undoSecond.next);
    expect(undoFirst.ok && undoFirst.next.stamina.current).toBe(20);

    const maxSession = createGameSession();
    const damaged = maxSession.perform(
      c,
      { kind: "damage", amount: 2 },
      "max-preserve",
    );
    expect(damaged.ok).toBe(true);
    if (!damaged.ok) return;
    const withNewUnrelatedMax = normalizeCharacter({
      ...damaged.next,
      recoveries: { ...damaged.next.recoveries, max: 6 },
    });
    const restored = maxSession.undo(withNewUnrelatedMax);
    expect(restored.ok && restored.next.stamina.current).toBe(20);
    expect(restored.ok && restored.next.recoveries.max).toBe(6);

    const conflictSession = createGameSession();
    const action = conflictSession.perform(
      c,
      { kind: "damage", amount: 2 },
      "conflict",
    );
    expect(action.ok).toBe(true);
    if (!action.ok) return;
    const changed = normalizeCharacter({
      ...action.next,
      stamina: { ...action.next.stamina, current: 15 },
    });
    expect(undoReason(changed, conflictSession.entries()[0])).toBeDefined();
    const refusedCurrent = conflictSession.undo(changed);
    expect(refusedCurrent.ok).toBe(false);
    expect(changed.stamina.current).toBe(15);
    const changedMax = normalizeCharacter({
      ...action.next,
      stamina: { ...action.next.stamina, max: 31 },
    });
    expect(undoReason(changedMax, conflictSession.entries()[0])).toBeDefined();
    const refusedMax = conflictSession.undo(changedMax);
    expect(refusedMax.ok).toBe(false);
    expect(changedMax.stamina).toEqual({ current: 18, max: 31, temp: 0 });
    const other = normalizeCharacter({ ...action.next, id: "other" });
    expect(undoReason(other, conflictSession.entries()[0])).toBeDefined();
  });

  it.each([
    ["damage", -1],
    ["damage", Number.NaN],
    ["heal", 1.5],
    ["temporary", 1.2],
  ] as const)("rejects invalid %s amount %s", (kind, amount) => {
    expect(previewGameAction(hero(), { kind, amount }).ok).toBe(false);
  });

  it("rejects non-integer and negative resource amounts", () => {
    expect(
      previewGameAction(hero(), {
        kind: "resource",
        resource: "surges",
        value: -1,
      }).ok,
    ).toBe(false);
    expect(
      previewGameAction(hero(), {
        kind: "resource",
        resource: "surges",
        value: 1.5,
      }).ok,
    ).toBe(false);
  });
});
