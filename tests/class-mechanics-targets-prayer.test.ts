import { describe, expect, it } from "vitest";
import type { Character } from "../src/types";
import { createCharacter } from "../src/lib/defaults";
import {
  previewTargetsPrayer,
  transitionTargetsPrayer,
  tacticianMarkLimit,
  normalizeConduitState,
} from "../src/lib/class-mechanics/targets-prayer";
import type { TargetsPrayerAction } from "../src/lib/class-mechanics/targets-prayer";
const hero = (className: string): Character => ({
  ...createCharacter({ name: "Тест", className }),
  runtime: {
    round: 1,
    turn: 1,
    turnActive: true,
    combatActive: true,
    encounter: 1,
    triggers: {},
    resources: {},
    forms: [],
  },
});
function apply(c: Character, a: TargetsPrayerAction) {
  const p = previewTargetsPrayer(c, a);
  if (!p.ok) throw new Error(p.reason);
  return p.next;
}
describe("цели и молитва", () => {
  it("требует решения до броска и получает сумму кости и молитвы один раз за ход", () => {
    let c = hero("Проводник");
    c.heroicResource.current = 0;
    expect(previewTargetsPrayer(c, { kind: "conduit-roll", die: 3 }).ok).toBe(
      false,
    );
    c = apply(c, { kind: "conduit-prayer", pray: true });
    expect(
      previewTargetsPrayer(c, { kind: "conduit-prayer", pray: false }).ok,
    ).toBe(false);
    c = apply(c, { kind: "conduit-roll", die: 3 });
    expect(c.heroicResource.current).toBe(5);
    expect(c.classMechanics?.conduit?.domainAvailable).toBe(true);
    expect(previewTargetsPrayer(c, { kind: "conduit-roll", die: 3 }).ok).toBe(
      false,
    );
    const next = transitionTargetsPrayer(
      { ...c, runtime: { ...c.runtime!, turn: 2 } },
      "turn-start",
    );
    expect(
      previewTargetsPrayer(next, { kind: "conduit-prayer", pray: false }).ok,
    ).toBe(true);
  });
  it("на единице требует 1d6 и применяет неуменьшаемый урон с обычным расходом временной выносливости", () => {
    let c = hero("Проводник");
    c.stamina = { current: 20, max: 20, temp: 8 };
    c.level = 4;
    c.heroicResource.current = 0;
    c = apply(c, { kind: "conduit-prayer", pray: true });
    expect(previewTargetsPrayer(c, { kind: "conduit-roll", die: 1 }).ok).toBe(
      false,
    );
    c = apply(c, { kind: "conduit-roll", die: 1, damageDie: 6 });
    expect(c.stamina).toEqual({ current: 18, max: 20, temp: 0 });
    expect(c.heroicResource.current).toBe(2);
  });
  it("учитывает уровень 10 и общий маркер начала хода", () => {
    let c = hero("Проводник");
    c.level = 10;
    c.heroicResource.current = 0;
    c = apply(c, { kind: "conduit-prayer", pray: true });
    expect(
      apply(c, { kind: "conduit-roll", die: 2 }).heroicResource.current,
    ).toBe(4);
    c.runtime!.triggers["start-of-turn"] = { turn: 1, encounter: 1 };
    expect(previewTargetsPrayer(c, { kind: "conduit-roll", die: 2 }).ok).toBe(
      false,
    );
  });
  it("сохраняет одну цель суда и даёт преимущество ордена один раз за ход", () => {
    let c = hero("Цензор");
    c.subclass = "Оракул";
    c.heroicResource.current = 1;
    c = apply(c, { kind: "censor-target", target: "Первый" });
    expect(c.classMechanics?.censor?.orderBenefitTurn).toBe(1);
    c = apply(c, { kind: "censor-target", target: "Второй" });
    expect(c.classMechanics?.censor?.target).toBe("Второй");
    c = apply(c, { kind: "censor-reaction", effect: "bane" });
    expect(c.heroicResource.current).toBe(0);
    expect(
      previewTargetsPrayer(c, { kind: "censor-reaction", effect: "potency" })
        .ok,
    ).toBe(false);
    expect(
      previewTargetsPrayer(c, {
        kind: "censor-reaction",
        effect: "main-action",
      }).ok,
    ).toBe(true);
  });
  it("ограничивает метки замыслом Воеводы и проверяет оплату преимущества", () => {
    let c = hero("Тактик");
    c.level = 5;
    c.subclass = "Воевода";
    c.heroicResource.current = 1;
    expect(tacticianMarkLimit(c)).toBe(2);
    c = apply(c, { kind: "tactician-targets", targets: ["А", "Б"] });
    expect(
      previewTargetsPrayer(c, {
        kind: "tactician-targets",
        targets: ["А", "Б", "В"],
      }).ok,
    ).toBe(false);
    expect(
      previewTargetsPrayer(c, {
        kind: "tactician-benefit",
        target: "В",
        effect: "damage",
      }).ok,
    ).toBe(false);
    c = apply(c, { kind: "tactician-benefit", target: "А", effect: "damage" });
    expect(c.heroicResource.current).toBe(0);
    expect(
      previewTargetsPrayer(c, {
        kind: "tactician-benefit",
        target: "А",
        effect: "shift",
      }).ok,
    ).toBe(false);
    expect(
      transitionTargetsPrayer(c, "combat-end").classMechanics?.tactician
        ?.targets,
    ).toEqual([]);
  });
  it("нормализует старое и повреждённое состояние без случайных бросков", () => {
    expect(normalizeConduitState(null)).toEqual({ domainAvailable: false });
    expect(normalizeConduitState({ prayer: "yes", resolvedTurn: NaN })).toEqual(
      { domainAvailable: false },
    );
  });
});
