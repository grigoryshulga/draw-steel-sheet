import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import type { Ability, Character } from "../src/types";
import {
  elementalistStartTurnGain,
  normalizeElementalistState,
  persistentCost,
  previewRoutinesMagic,
  recordElementalistDamage,
  transitionRoutinesMagic,
  type RoutinesMagicAction,
} from "../src/lib/class-mechanics/routines-magic";

const ability = (
  id: string,
  effect = "",
  keywords: string[] = [],
): Ability => ({
  id,
  name: id,
  effect,
  keywords,
  flavor: "",
  actionType: "none",
  kind: "other",
  distance: "Аура 5",
  target: "Союзники",
  rollCharacteristics: [],
  preferredCharacteristic: "",
  rollBonus: 0,
  resourceCost: 0,
  trigger: "",
  tiers: [
    { damage: "", effect: "" },
    { damage: "", effect: "" },
    { damage: "", effect: "" },
  ],
  source: "",
  notes: "",
});
function hero(className: string): Character {
  const character = createCharacter();
  return {
    ...character,
    className,
    level: 1,
    characteristics: { ...character.characteristics, reason: 2 },
    heroicResource: { ...character.heroicResource, current: 0 },
    runtime: {
      round: 1,
      encounter: 1,
      turn: 1,
      turnActive: true,
      combatActive: true,
      triggers: {},
      forms: [],
      resources: {},
    },
  };
}
function act(character: Character, action: RoutinesMagicAction): Character {
  const result = previewRoutinesMagic(character, action);
  if (!result.ok) throw new Error(result.reason);
  return result.next;
}
describe("выступления", () => {
  it("selects only owned routines and prevents repeated switching in the round, including after manual stop", () => {
    let character = hero("Трубадур");
    expect(
      previewRoutinesMagic(character, {
        kind: "troubadour-select",
        abilityId: "invented",
      }).ok,
    ).toBe(false);
    character.abilities = [
      ability("dance", "Эффект", ["Выступление"]),
      ability("song", "Эффект", ["Выступление"]),
    ];
    character = act(character, {
      kind: "troubadour-select",
      abilityId: "dance",
    });
    character = act(character, { kind: "troubadour-stop" });
    expect(
      previewRoutinesMagic(character, {
        kind: "troubadour-select",
        abilityId: "song",
      }).ok,
    ).toBe(false);
    character = { ...character, runtime: { ...character.runtime!, round: 2 } };
    character = act(character, {
      kind: "troubadour-select",
      abilityId: "song",
    });
    expect(character.classMechanics?.troubadour?.activeRoutineId).toBe("song");
    expect(
      transitionRoutinesMagic(character, "combat-end").classMechanics
        ?.troubadour?.activeRoutineId,
    ).toBeUndefined();
  });
  it("allows two distinct owned routines with Medley from level five", () => {
    let character = hero("Трубадур");
    character.abilities = [
      ability("dance", "", ["Выступление"]),
      ability("song", "", ["Выступление"]),
    ];
    const action = {
      kind: "troubadour-select",
      abilityId: "dance",
      secondAbilityId: "song",
    } as const;
    expect(previewRoutinesMagic(character, action).ok).toBe(false);
    character = { ...character, level: 5 };
    character = act(character, action);
    expect(character.classMechanics?.troubadour?.activeRoutineIds).toEqual([
      "dance",
      "song",
    ]);
    expect(
      previewRoutinesMagic(
        { ...character, runtime: { ...character.runtime!, round: 2 } },
        { ...action, secondAbilityId: "dance" },
      ).ok,
    ).toBe(false);
  });
  it("blocks incapacitation and clears an active routine", () => {
    let character = hero("Трубадур");
    character.abilities = [ability("dance", "", ["Выступление"])];
    character = act(character, {
      kind: "troubadour-select",
      abilityId: "dance",
    });
    character = {
      ...character,
      conditions: { dazed: { active: true, ends: "save" } },
    };
    character = transitionRoutinesMagic(character, "resource-change");
    expect(
      character.classMechanics?.troubadour?.activeRoutineId,
    ).toBeUndefined();
    expect(
      previewRoutinesMagic(character, {
        kind: "troubadour-select",
        abilityId: "dance",
      }).ok,
    ).toBe(false);
  });
});
describe("поддержание", () => {
  it("parses explicit prices and rejects invented support and negative turn gain", () => {
    let character = hero("Элементалист");
    character.abilities = [
      ability("fire", "Поддержание 1: повторите эффект."),
      ability("storm", "Поддержание 2: повторите эффект."),
      ability("plain", "Можно поддерживать объект."),
    ];
    expect(persistentCost(character.abilities[2])).toBeUndefined();
    expect(
      previewRoutinesMagic(character, {
        kind: "elementalist-sustain",
        abilityId: "plain",
        target: "Враг",
      }).ok,
    ).toBe(false);
    character = act(character, {
      kind: "elementalist-sustain",
      abilityId: "fire",
      target: "Враг",
    });
    expect(
      previewRoutinesMagic(character, {
        kind: "elementalist-sustain",
        abilityId: "storm",
        target: "Область",
      }).ok,
    ).toBe(false);
    expect(elementalistStartTurnGain(character)).toBe(1);
    character = transitionRoutinesMagic(character, "turn-start");
    expect(character.heroicResource.current).toBe(1);
    expect(character.runtime?.triggers["start-of-turn"]?.turn).toBe(1);
    expect(
      transitionRoutinesMagic(character, "turn-start").heroicResource.current,
    ).toBe(1);
    character = { ...character, runtime: { ...character.runtime!, turn: 2 } };
    expect(
      transitionRoutinesMagic(character, "turn-start").heroicResource.current,
    ).toBe(2);
  });
  it("stops individually and clears sustain at damage threshold and encounter end", () => {
    let character = hero("Элементалист");
    character.abilities = [
      ability("one", "Поддержание 1: эффект."),
      ability("two", "Поддержание 1: эффект."),
    ];
    character = act(character, {
      kind: "elementalist-sustain",
      abilityId: "one",
      target: "A",
    });
    character = act(character, {
      kind: "elementalist-sustain",
      abilityId: "two",
      target: "B",
    });
    character = act(character, { kind: "elementalist-stop", abilityId: "one" });
    expect(
      character.classMechanics?.elementalist?.sustained.map(
        (item) => item.abilityId,
      ),
    ).toEqual(["two"]);
    character = recordElementalistDamage(character, 9);
    expect(character.classMechanics?.elementalist?.sustained).toHaveLength(1);
    character = recordElementalistDamage(character, 1);
    expect(character.classMechanics?.elementalist?.sustained).toHaveLength(1);
    expect(character.classMechanics?.elementalist?.damageThisTurn).toBe(1);
    character = recordElementalistDamage(character, 10);
    expect(character.classMechanics?.elementalist?.sustained).toEqual([]);
    character = act(character, {
      kind: "elementalist-sustain",
      abilityId: "one",
      target: "A",
    });
    expect(
      transitionRoutinesMagic(character, "combat-end").classMechanics
        ?.elementalist?.sustained,
    ).toEqual([]);
  });
  it("normalizes malformed persistence without duplicate sustained effects", () => {
    expect(
      normalizeElementalistState({
        sustained: [
          null,
          { abilityId: "a", target: "A" },
          { abilityId: "a", target: "B" },
        ],
        damageThisTurn: -2,
      }),
    ).toMatchObject({
      sustained: [{ abilityId: "a", target: "A" }],
      damageThisTurn: 0,
    });
  });
});
