import { describe, expect, it } from "vitest";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { createGameSession, localizeGameMessage, previewGameAction, type GameAction } from "../src/lib/game-actions";

const hero = () => normalizeCharacter({ ...createCharacter({ name: "Авторское имя", className: "Тактик" }), stamina: { current: 15, max: 30, temp: 3 }, recoveries: { current: 2, max: 4 }, heroicResource: { current: 4, max: 10 } });
describe("game action presentation language", () => {
  it.each<GameAction>([{ kind: "damage", amount: 5 }, { kind: "heal", amount: 3 }, { kind: "recovery" }, { kind: "temporary", amount: 7 }, { kind: "resource", resource: "heroicResource", value: 5 }, { kind: "rest" }, { kind: "round" }, { kind: "encounter" }])("keeps mechanics identical for $kind", action => {
    const character = hero();
    const ru = previewGameAction(character, action, "ru");
    const en = previewGameAction(character, action, "en");
    expect(en.ok).toBe(ru.ok);
    if (!ru.ok || !en.ok) throw new Error("Expected valid action");
    expect(en.next).toEqual(ru.next);
    expect(en.label).not.toMatch(/[А-Яа-яЁё]/);
    expect(en.detail).not.toMatch(/[А-Яа-яЁё]/);
  });
  it("localizes class mechanics without changing their state", () => {
    const c = normalizeCharacter({ ...createCharacter({ name: "Авторский герой", className: "Нуль" }), stamina: { current: 10, max: 20, temp: 0 } });
    const action: GameAction = { kind: "class-mechanic", action: { kind: "null-field", active: true } };
    const ru = previewGameAction(c, action, "ru");
    const en = previewGameAction(c, action, "en");
    expect(ru.ok && en.ok).toBe(true);
    if (!ru.ok || !en.ok) return;
    expect(en.next).toEqual(ru.next);
    expect(en.label).toBe("Null Field activated");
    expect(en.detail).toBe("Null Field activated");
  });
  it("preserves free text while translating the generated resource suffix", () => {
    const message = "Авторский бросок. Фокус: 4 → 2. Всплески: 3 → 1.";
    expect(localizeGameMessage(message, "en")).toBe("Авторский бросок. Focus: 4 → 2. Surges: 3 → 1.");
  });
  it("localizes rejection and undo without changing stored history", () => {
    const c = hero();
    expect(previewGameAction(c, { kind: "damage", amount: 0 }, "en")).toEqual({ ok: false, reason: "Enter damage greater than zero" });
    const session = createGameSession();
    const result = session.perform(c, { kind: "damage", amount: 5 }, "one", "en");
    expect(result.ok).toBe(true);
    expect(session.entries()[0].label).toBe("Урон: 5");
    if (!result.ok) return;
    const undo = session.undo(result.next, "en");
    expect(undo.ok && undo.label).toBe("Undone: Damage: 5");
    expect(undo.ok && undo.next.stamina).toEqual(c.stamina);
  });
  it("preserves unrecognized authored text and dynamic names", () => {
    expect(localizeGameMessage("Авторское имя", "en")).toBe("Авторское имя");
    expect(localizeGameMessage("Отмечено: Авторское имя", "en")).toBe("Marked: Авторское имя");
  });
});
