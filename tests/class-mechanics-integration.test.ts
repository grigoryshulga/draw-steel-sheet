import { describe, expect, it } from "vitest";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import {
  createGameSession,
  previewGameAction,
  type GameAction,
} from "../src/lib/game-actions";
import { featureConditionMet } from "../src/lib/feature-conditions";
import { triggerMark } from "../src/lib/runtime";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { conduitDomains } from "../src/lib/class-mechanics/targets-prayer";
import { persistentCost } from "../src/lib/class-mechanics/routines-magic";
import type { Character } from "../src/types";

function apply(c: Character, action: GameAction): Character {
  const result = previewGameAction(c, action);
  if (!result.ok) throw new Error(result.reason);
  return result.next;
}
const start = (c: Character) =>
  apply(apply(c, { kind: "combat-start" }), { kind: "turn-start" });

describe("классовые разделы: интеграция с игровыми действиями", () => {
  it("старый герой не получает обязательных полей; новый формат переживает JSON и нормализацию", () => {
    const old = createCharacter({ className: "Талант" });
    expect(normalizeCharacter(old).classMechanics).toBeUndefined();
    const next = apply(start(old), {
      kind: "class-mechanic",
      action: {
        kind: "talent-consequence-add",
        text: "Замедлен до спасброска",
      },
    });
    const loaded = normalizeCharacter(JSON.parse(JSON.stringify(next)));
    expect(loaded.classMechanics?.talent?.consequences).toEqual([
      "Замедлен до спасброска",
    ]);
    expect(loaded.runtime).toMatchObject({ turn: 1, turnActive: true });
    expect(
      normalizeCharacter({
        ...old,
        classMechanics: null,
      } as unknown as Character).classMechanics,
    ).toEqual({});
  });

  it("пик дисциплины действует в вычислениях после траты и прекращается в конце своего хода", () => {
    let c = createCharacter({ className: "Нуль" });
    c.heroicResource.current = 8;
    c = start(c);
    c = apply(c, { kind: "resource", resource: "heroicResource", value: 1 });
    expect(
      featureConditionMet(c, {
        resourceAtLeast: { name: "Дисциплина", value: 8 },
      }),
    ).toBe(true);
    c = apply(c, { kind: "turn-end" });
    expect(
      featureConditionMet(c, {
        resourceAtLeast: { name: "Дисциплина", value: 8 },
      }),
    ).toBe(false);
  });

  it("начало хода не теряет дисциплину, достигнутую и потраченную между своими ходами", () => {
    let c = start(createCharacter({ className: "Нуль" }));
    c = apply(c, { kind: "turn-end" });
    c = apply(c, { kind: "resource", resource: "heroicResource", value: 6 });
    c = apply(c, { kind: "resource", resource: "heroicResource", value: 1 });
    c = apply(c, { kind: "turn-start" });
    expect(c.classMechanics?.null?.peakDiscipline).toBe(6);
  });

  it("отмена конца хода возвращает урон и отметку, повторное окончание не наносит урон дважды", () => {
    const session = createGameSession();
    let c = start(createCharacter({ className: "Талант" }));
    c = { ...c, heroicResource: { ...c.heroicResource, current: -2 } };
    const end = session.perform(c, { kind: "turn-end" }, "end");
    if (!end.ok) throw new Error(end.reason);
    expect(end.next.stamina.current).toBe(c.stamina.current - 2);
    expect(previewGameAction(end.next, { kind: "turn-end" }).ok).toBe(false);
    const undo = session.undo(
      normalizeCharacter(JSON.parse(JSON.stringify(end.next))),
    );
    if (!undo.ok) throw new Error(undo.reason);
    expect(undo.next.stamina.current).toBe(c.stamina.current);
    expect(undo.next.runtime?.turnActive).toBe(true);
    expect(undo.next.classMechanics).toEqual(c.classMechanics);
  });

  it("отмена усиления поля возвращает ресурс и сохраняет изменение имени", () => {
    const session = createGameSession();
    let c = start(createCharacter({ className: "Нуль" }));
    c = apply(c, { kind: "resource", resource: "heroicResource", value: 5 });
    c = apply(c, {
      kind: "class-mechanic",
      action: { kind: "null-field", active: true },
    });
    const result = session.perform(
      c,
      {
        kind: "class-mechanic",
        action: { kind: "null-enhance", enhancement: "Инерционный якорь" },
      },
      "field",
    );
    if (!result.ok) throw new Error(result.reason);
    const undo = session.undo({ ...result.next, name: "Новое имя" });
    if (!undo.ok) throw new Error(undo.reason);
    expect(undo.next.heroicResource.current).toBe(5);
    expect(undo.next.classMechanics?.null?.enhancement).toBeUndefined();
    expect(undo.next.name).toBe("Новое имя");
  });

  it("раунд не снимает отметку своего хода и не позволяет повторить молитву", () => {
    let c = start(createCharacter({ className: "Проводник" }));
    c = apply(c, {
      kind: "class-mechanic",
      action: { kind: "conduit-prayer", pray: false },
    });
    c = apply(c, {
      kind: "class-mechanic",
      action: { kind: "conduit-roll", die: 2 },
    });
    c = apply(c, { kind: "round" });
    expect(triggerMark(c, "start-of-turn", "turn").used).toBe(true);
    expect(
      previewGameAction(c, {
        kind: "class-mechanic",
        action: { kind: "conduit-roll", die: 2 },
      }).ok,
    ).toBe(false);
    c = apply(apply(c, { kind: "turn-end" }), { kind: "turn-start" });
    expect(triggerMark(c, "start-of-turn", "turn").used).toBe(false);
  });

  it("распознаёт поддержание из настоящего каталога; здоровье срывает его одним большим ударом и отменяет атомарно", () => {
    const ability = ABILITY_COMPENDIUM.find(
      (a) => a.name === "Не Более Чем Ветерок",
    )!;
    expect(persistentCost(ability)).toBe(1);
    let c = createCharacter({ className: "Элементалист" });
    c.abilities = [ability];
    c.characteristics.reason = 2;
    c = start(c);
    c = apply(c, {
      kind: "class-mechanic",
      action: {
        kind: "elementalist-sustain",
        abilityId: ability.id,
        target: "Союзник",
      },
    });
    c = apply(apply(c, { kind: "turn-end" }), { kind: "turn-start" });
    expect(c.heroicResource.current).toBe(3); // 2 first turn + (2 - 1) next turn
    const session = createGameSession();
    const result = session.perform(c, { kind: "damage", amount: 10 }, "hit");
    if (!result.ok) throw new Error(result.reason);
    expect(result.next.classMechanics?.elementalist?.sustained).toHaveLength(0);
    const undo = session.undo(result.next);
    if (!undo.ok) throw new Error(undo.reason);
    expect(undo.next.classMechanics?.elementalist?.sustained).toHaveLength(1);
    expect(undo.next.stamina).toEqual(c.stamina);
  });
  it("молитва предлагает только выбранные домены, а не заголовок правил, и расходует один выбор", () => {
    let c = start(createCharacter({ className: "Проводник" }));
    c.subclass = "Жизнь, Смерть";
    const domains = conduitDomains(c);
    expect(domains).toHaveLength(2);
    c = apply(c, {
      kind: "class-mechanic",
      action: { kind: "conduit-prayer", pray: true },
    });
    c = apply(c, {
      kind: "class-mechanic",
      action: { kind: "conduit-roll", die: 3 },
    });
    c = apply(c, {
      kind: "class-mechanic",
      action: { kind: "conduit-domain", domain: domains[0].id },
    });
    expect(
      previewGameAction(c, {
        kind: "class-mechanic",
        action: { kind: "conduit-domain", domain: domains[1].id },
      }).ok,
    ).toBe(false);
  });

  it("конец боя сбрасывает ясность, но сохраняет последствия с собственным сроком; отмена возвращает состояние", () => {
    let c = start(createCharacter({ className: "Талант" }));
    c = apply(c, { kind: "resource", resource: "heroicResource", value: -2 });
    c = apply(c, {
      kind: "class-mechanic",
      action: { kind: "talent-consequence-add", text: "До отдыха" },
    });
    const session = createGameSession();
    const end = session.perform(c, { kind: "combat-end" }, "end-battle");
    if (!end.ok) throw new Error(end.reason);
    expect(end.next.heroicResource.current).toBe(0);
    expect(end.next.classMechanics?.talent?.consequences).toEqual([
      "До отдыха",
    ]);
    const undo = session.undo(end.next);
    if (!undo.ok) throw new Error(undo.reason);
    expect(undo.next.heroicResource.current).toBe(-2);
    expect(undo.next.runtime?.turnActive).toBe(true);
  });
});
