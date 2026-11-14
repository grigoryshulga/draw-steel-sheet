import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { abilityDistance, calculatedValues, recalculateCharacter } from "../src/lib/character-calculations";
import { createGameSession, previewGameAction, type GameAction } from "../src/lib/game-actions";
import { normalizeCharacter } from "../src/lib/defaults";
import { changeKit } from "../src/lib/equipment";
import { currentRuntime } from "../src/lib/runtime";
import { STORMWIGHT_HYBRID_STAMINA, stormwightFormState } from "../src/lib/stormwight-forms";
import type { Character } from "../src/types";

function fury(kit = "Борен", level = 4): Character {
  const base = buildCharacter({ ...emptyBuilderDraft(), className: "Неистовый", subclass: "Буревестник", kit,
    characteristics: startingCharacteristics("Неистовый") });
  return recalculateCharacter(base, { ...base, level, size: "1М" });
}
function apply(character: Character, action: GameAction): Character {
  const result = previewGameAction(character, action);
  expect(result?.ok).toBe(true);
  if (!result?.ok) throw new Error(JSON.stringify(action));
  return recalculateCharacter(character, result.next);
}

describe("формы буревестника", () => {
  it("Борен получает размер 2 и дистанцию оружия ближнего боя +1, не меняя постоянные бонусы", () => {
    const hero = fury();
    const ability = hero.abilities.find(a => a.name === "Медвежьи Когти")!;
    const natural = calculatedValues(hero);
    const animal = apply(hero, { kind: "stormwight-form", form: "animal" });
    expect(animal.size).toBe("2");
    expect(abilityDistance(ability, animal)).toBe("Ближний 2");
    expect(abilityDistance({ ...ability, keywords: ["Магия", "Ближний"] }, animal)).toBe("Ближний 1");
    expect(abilityDistance({ ...ability, distance: "Взрыв 1" }, animal)).toBe("Взрыв 1");
    expect(calculatedValues(animal)).toEqual(natural);
    const hybrid = apply(animal, { kind: "stormwight-form", form: "hybrid" });
    expect(hybrid.size).toBe("2");
    expect(abilityDistance(ability, hybrid)).toBe("Ближний 2");
    const restored = apply(hybrid, { kind: "stormwight-form", form: "true" });
    expect(restored.size).toBe("1М");
    expect(abilityDistance(ability, restored)).toBe("Ближний 1");
    expect(hero.size).toBe("1М");
  });

  it("Вукен складывает +2 скорости формы с комплектом и ручными поправками без накопления", () => {
    const hero = fury("Вукен");
    const adjusted = recalculateCharacter(hero, { ...hero, speed: String(Number(hero.speed) + 1) });
    let character = adjusted;
    for (let i = 0; i < 3; i++) {
      character = apply(character, { kind: "stormwight-form", form: "animal" });
      expect(character.speed).toBe(String(Number(adjusted.speed) + 2));
      expect(character.size).toBe("1L");
      expect(stormwightFormState(character)?.ignoreDifficultTerrain).toBe(true);
      character = apply(character, { kind: "stormwight-form", form: "hybrid" });
      expect(character.speed).toBe(String(Number(adjusted.speed) + 2));
      character = apply(character, { kind: "stormwight-form", form: "true" });
      expect(character.speed).toBe(adjusted.speed);
      expect(character.size).toBe("1М");
    }
    expect(character.automation?.adjustments).toEqual(adjusted.automation?.adjustments);
  });

  it.each(["Корвен", "Раден"])("%s сохраняет выбор размера гибрида и учитывает передвижение с 4-го уровня", (kit) => {
    const animal = apply(fury(kit, 1), { kind: "stormwight-form", form: "animal" });
    expect(animal.size).toBe("1T");
    expect(stormwightFormState(animal)?.[kit === "Корвен" ? "flight" : "climb"]).toBe(true);
    const hybrid = apply(animal, { kind: "stormwight-form", form: "hybrid", hybridSize: "1S" });
    expect(hybrid.size).toBe("1S");
    expect(stormwightFormState(hybrid)?.[kit === "Корвен" ? "flight" : "climb"]).toBe(false);
    const improved = recalculateCharacter(hybrid, { ...hybrid, level: 4 });
    expect(stormwightFormState(improved)?.[kit === "Корвен" ? "flight" : "climb"]).toBe(true);
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(improved)));
    expect(restored.runtime?.stormwight).toEqual(improved.runtime?.stormwight);
    expect(restored.size).toBe("1S");
    const natural = apply(restored, { kind: "stormwight-form", form: "true" });
    expect(natural.size).toBe("1М");
    expect(apply(natural, { kind: "stormwight-form", form: "hybrid" }).size).toBe("1S");
  });

  it.each(["Борен", "Вукен"])("%s получает временную выносливость только при первом входе в гибрида в битве", (kit) => {
    let character = fury(kit);
    const outside = apply(character, { kind: "stormwight-form", form: "hybrid" });
    expect(outside.stamina.temp).toBe(0);
    character = apply(character, { kind: "combat-start" });
    character = apply(character, { kind: "stormwight-form", form: "hybrid" });
    expect(character.stamina.temp).toBe(10);
    expect(currentRuntime(character).triggers[STORMWIGHT_HYBRID_STAMINA]?.encounter).toBe(currentRuntime(character).encounter);
    character = apply(character, { kind: "damage", amount: 10 });
    character = apply(character, { kind: "round" });
    character = apply(character, { kind: "stormwight-form", form: "animal" });
    character = apply(character, { kind: "stormwight-form", form: "hybrid" });
    expect(character.stamina.temp).toBe(0);
    character = apply(character, { kind: "combat-end" });
    character = apply(character, { kind: "combat-start" });
    character = apply(character, { kind: "stormwight-form", form: "true" });
    character = apply(character, { kind: "stormwight-form", form: "hybrid" });
    expect(character.stamina.temp).toBe(10);
  });

  it("бонус гибрида не складывает временные запасы и не появляется до 4-го уровня", () => {
    const low = apply(fury("Борен", 3), { kind: "combat-start" });
    expect(apply(low, { kind: "stormwight-form", form: "hybrid" }).stamina.temp).toBe(0);
    let high = apply(fury(), { kind: "combat-start" });
    high = { ...high, stamina: { ...high.stamina, temp: 20 } };
    high = apply(high, { kind: "stormwight-form", form: "hybrid" });
    expect(high.stamina.temp).toBe(20);
    high = apply(high, { kind: "damage", amount: 20 });
    high = apply(high, { kind: "stormwight-form", form: "true" });
    expect(apply(high, { kind: "stormwight-form", form: "hybrid" }).stamina.temp).toBe(0);
  });

  it("маленькие формы запрещают способности, сохраняя доступ к Аспекту дикой природы", () => {
    for (const kit of ["Корвен", "Раден"]) {
      const animal = apply(fury(kit), { kind: "stormwight-form", form: "animal" });
      const signature = animal.abilities.find(a => a.kind === "signature")!;
      expect(previewGameAction(animal, { kind: "ability", abilityId: signature.id, surges: 0 }).ok).toBe(false);
      const aspect = animal.abilities.find(a => a.name === "Аспект Дикой Природы")!;
      expect(previewGameAction(animal, { kind: "ability", abilityId: aspect.id, surges: 0 }).ok).toBe(true);
      const hybrid = apply(animal, { kind: "stormwight-form", form: "hybrid" });
      expect(previewGameAction(hybrid, { kind: "ability", abilityId: signature.id, surges: 0 }).ok).toBe(true);
    }
  });

  it("свободное превращение тратит 1 свирепость и сохраняет достигнутые пороги своего хода", () => {
    let character = fury("Вукен");
    character = apply(character, { kind: "resource", resource: "heroicResource", value: 2 });
    character = apply(character, { kind: "fury-turn-start" });
    character = apply(character, { kind: "stormwight-form", form: "animal", freeManeuver: true });
    expect(character.heroicResource.current).toBe(1);
    expect(character.runtime?.furyTurn?.peak).toBe(2);
    character = apply(character, { kind: "stormwight-form", form: "hybrid", freeManeuver: true });
    expect(character.heroicResource.current).toBe(0);
    expect(previewGameAction(character, { kind: "stormwight-form", form: "true", freeManeuver: true }).ok).toBe(false);
    expect(previewGameAction(character, { kind: "stormwight-form", form: "true" }).ok).toBe(true);
  });

  it("смена комплекта/аспекта снимает эффекты формы и восстанавливает исходный размер", () => {
    const animal = apply(fury("Вукен"), { kind: "stormwight-form", form: "animal" });
    const changedKit = recalculateCharacter(animal, changeKit(animal, "Борен"));
    expect(changedKit.size).toBe("1М");
    expect(changedKit.speed).toBe("5");
    expect(changedKit.runtime?.stormwight).toBeUndefined();
    const changedAspect = recalculateCharacter(animal, { ...animal, subclass: "Берсерк" });
    expect(changedAspect.size).toBe("1М");
    expect(changedAspect.speed).toBe("7");
    expect(changedAspect.runtime?.stormwight).toBeUndefined();
  });

  it("при выключенном авторасчёте сохраняет ручные числа и включает бонусы после включения", () => {
    const base = fury("Вукен");
    const manual = { ...base, automation: { ...base.automation!, enabled: false } };
    const animal = apply(manual, { kind: "stormwight-form", form: "animal" });
    expect(animal.size).toBe(manual.size);
    expect(animal.speed).toBe(manual.speed);
    const automated = recalculateCharacter(animal, { ...animal, automation: { ...animal.automation!, enabled: true } });
    expect(automated.size).toBe("1L");
    expect(automated.speed).toBe("9");
    expect(apply(automated, { kind: "stormwight-form", form: "true" }).size).toBe("1М");
  });

  it("отмена возвращает форму, исходный размер, скорость, ресурс и разовый бонус гибрида", () => {
    const session = createGameSession();
    let character = apply(fury("Вукен"), { kind: "combat-start" });
    const original = character;
    const result = session.perform(character, { kind: "stormwight-form", form: "hybrid" }, "hybrid");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    character = recalculateCharacter(character, result.next);
    expect(character.size).toBe("1L");
    expect(character.speed).toBe("9");
    expect(character.stamina.temp).toBe(10);
    const undone = session.undo(character);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    character = recalculateCharacter(character, undone.next);
    expect(character.size).toBe(original.size);
    expect(character.speed).toBe(original.speed);
    expect(character.stamina.temp).toBe(0);
    expect(character.runtime?.stormwight).toBeUndefined();
    expect(currentRuntime(character).triggers[STORMWIGHT_HYBRID_STAMINA]).toBeUndefined();
    expect(apply(character, { kind: "stormwight-form", form: "hybrid" }).stamina.temp).toBe(10);
  });

  it("после ручного режима восстанавливает истинный размер, а явную правку истинного размера сохраняет", () => {
    const animal = apply(fury(), { kind: "stormwight-form", form: "animal" });
    const manual = recalculateCharacter(animal, { ...animal, automation: { ...animal.automation!, enabled: false } });
    const natural = apply(manual, { kind: "stormwight-form", form: "true" });
    expect(natural.size).toBe("2");
    const automated = recalculateCharacter(natural, { ...natural, automation: { ...natural.automation!, enabled: true } });
    expect(automated.size).toBe("1М");
    const edited = recalculateCharacter(natural, { ...natural, size: "1S" });
    const enabled = recalculateCharacter(edited, { ...edited, automation: { ...edited.automation!, enabled: true } });
    expect(enabled.size).toBe("1S");
    expect(apply(apply(enabled, { kind: "stormwight-form", form: "animal" }), { kind: "stormwight-form", form: "true" }).size).toBe("1S");
  });

  it("сохранение форм не меняет старые формы и дополнительные ресурсы, повреждённые поля отбрасываются", () => {
    const hero = fury();
    hero.runtime = { ...currentRuntime(hero), forms: ["другая форма"], resources: { щит: 2 } };
    const animal = apply(hero, { kind: "stormwight-form", form: "animal" });
    const saved = JSON.parse(JSON.stringify(animal));
    expect(normalizeCharacter(saved).runtime).toEqual(animal.runtime);
    for (const invalid of [
      { ...saved.runtime.stormwight, form: "unknown" },
      { ...saved.runtime.stormwight, kitId: "kit.stormwight" },
      { ...saved.runtime.stormwight, trueSize: 2 },
      { ...saved.runtime.stormwight, hybridSize: "2" },
    ]) {
      const normalized = normalizeCharacter({ ...saved, runtime: { ...saved.runtime, stormwight: invalid } });
      expect(normalized.runtime?.stormwight).toBeUndefined();
      expect(normalized.runtime?.forms).toEqual(["другая форма"]);
      expect(normalized.runtime?.resources).toEqual(hero.runtime.resources);
    }
  });

  it("смена комплекта и выключенный авторасчёт не позволяют повторно получить бонус гибрида", () => {
    let character = apply(fury(), { kind: "combat-start" });
    character = recalculateCharacter(character, { ...character, automation: { ...character.automation!, enabled: false } });
    character = apply(character, { kind: "stormwight-form", form: "hybrid" });
    expect(character.stamina.temp).toBe(0);
    character = recalculateCharacter(character, { ...character, automation: { ...character.automation!, enabled: true } });
    character = recalculateCharacter(character, changeKit(character, "Вукен"));
    character = apply(character, { kind: "stormwight-form", form: "hybrid" });
    expect(character.stamina.temp).toBe(0);
  });

  it("истинная форма запоминает ручную правку исходного размера, старые листы не получают форму сами", () => {
    const base = fury();
    expect(base.runtime?.stormwight).toBeUndefined();
    expect(normalizeCharacter(JSON.parse(JSON.stringify(base))).runtime?.stormwight).toBeUndefined();
    let character = apply(base, { kind: "stormwight-form", form: "animal" });
    character = apply(character, { kind: "stormwight-form", form: "true" });
    character = recalculateCharacter(character, { ...character, size: "1L" });
    character = apply(character, { kind: "stormwight-form", form: "hybrid" });
    expect(apply(character, { kind: "stormwight-form", form: "true" }).size).toBe("1L");
    expect(ABILITY_COMPENDIUM.find(a => a.name === "Медвежьи Когти")?.distance).toBe("Ближний 1");
  });
});
