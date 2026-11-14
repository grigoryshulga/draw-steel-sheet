import { describe, expect, it } from "vitest";
import { availableKits, kitByName } from "../src/data/kits";
import { buildCharacter, builderStepIssues, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { abilityForcedMovement, abilityKitDamageBonus, calculatedValues, recalculateCharacter } from "../src/lib/character-calculations";
import { changeKit } from "../src/lib/equipment";
import { normalizeCharacter } from "../src/lib/defaults";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { activeClassFeatures } from "../src/lib/class-features";
import { featureDamageImmunities } from "../src/lib/feature-modifiers";
import { catalogSectionEntries } from "../src/data/reference-catalog";

function stormwight(kit: string) {
  return buildCharacter({
    ...emptyBuilderDraft(),
    className: "Неистовый",
    subclass: "Буревестник",
    characteristics: startingCharacteristics("Неистовый"),
    kit,
  });
}

describe("комплекты буревестника", () => {
  it("ограничивает выбор четырьмя вариантами, сохраняя общую статью в справочнике", () => {
    expect(availableKits("Неистовый", "Буревестник").map((kit) => kit.name))
      .toEqual(["Борен", "Корвен", "Раден", "Вукен"]);
    expect(availableKits("Тактик", "Авангард")).toHaveLength(21);
    expect(availableKits("Неистовый", "Берсерк").some((kit) => kit.familyId)).toBe(false);
    expect(availableKits("Элементалист", "Огонь")).toEqual([]);
    const entries = catalogSectionEntries("kits").filter((entry) => entry.articleId === "0924");
    expect(entries.map((entry) => entry.name)).toEqual(["Буревестник", "Борен", "Корвен", "Раден", "Вукен"]);
    expect(entries.slice(1).every((entry) => entry.entityName === entry.name)).toBe(true);
    for (const kit of ["", "Буревестник", "Гора"]) {
      expect(builderStepIssues({ ...emptyBuilderDraft(), className: "Неистовый", subclass: "Буревестник", kit }).kit).not.toBe("");
    }
    expect(builderStepIssues({ ...emptyBuilderDraft(), className: "Неистовый", subclass: "Буревестник", kit: "Борен" }).kit).toBe("");
  });
  it.each([
    ["Борен", "Медвежьи Когти", 9, 0, 2, 0],
    ["Корвен", "Взмах Крыльев", 3, 3, 0, 1],
    ["Раден", "Стремительный Наскок", 3, 3, 0, 1],
    ["Вукен", "Сносящая Атака", 9, 2, 0, 1],
  ] as const)("%s даёт свои бонусы и две способности", (name, signature, stamina, speed, stability, disengage) => {
    expect(kitByName(name)?.signatureAbility).toBe(signature);
    const hero = stormwight(name);
    expect(hero.kit).toBe(name);
    const plain = calculatedValues({ ...hero, kit: "" });
    expect(calculatedValues(hero)).toMatchObject({
      stamina: plain.stamina + stamina,
      speed: plain.speed + speed,
      stability: plain.stability + stability,
      disengage: plain.disengage + disengage,
    });
    expect(hero.abilities.filter((a) => a.source.startsWith("Комплект: ")).map((a) => a.name).sort())
      .toEqual([signature, "Аспект Дикой Природы"].sort());
    const ability = hero.abilities.find((a) => a.name === signature)!;
    expect([1, 2, 3].map((tier) => abilityKitDamageBonus(ability, hero, tier))).toEqual([0, 0, 0]);
  });

  it("при смене оставляет одну общую способность и заменяет знаковую", () => {
    const before = stormwight("Борен");
    const next = recalculateCharacter(before, changeKit(before, "Корвен"));
    expect(next.abilities.some((a) => a.name === "Медвежьи Когти")).toBe(false);
    expect(next.abilities.filter((a) => a.name === "Взмах Крыльев")).toHaveLength(1);
    expect(next.abilities.filter((a) => a.name === "Аспект Дикой Природы")).toHaveLength(1);
    expect(next.abilities.filter((a) => !a.source.startsWith("Комплект: ")))
      .toEqual(before.abilities.filter((a) => !a.source.startsWith("Комплект: ")));
    expect(next.speed).toBe("8");
    expect(next.stability).toBe("0");
    expect(changeKit(next, "Корвен").abilities).toEqual(next.abilities);
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(next)));
    expect(restored.kit).toBe("Корвен");
    expect(restored.abilities).toEqual(next.abilities);
  });

  it("не меняет ручной лист при смене комплекта с выключенной автоматизацией", () => {
    const hero = stormwight("Борен");
    const manual = { ...hero, automation: { ...hero.automation!, enabled: false } };
    expect(changeKit(manual, "Корвен")).toEqual({ ...manual, kit: "Корвен" });
  });

  it("читает старое сохранение с общей записью и заменяет его способности без дубликатов", () => {
    const base = stormwight("");
    const old = normalizeCharacter({ ...base, kit: "Буревестник", abilities: [
      ...base.abilities,
      ...ABILITY_COMPENDIUM.filter((ability) => ability.source === "Комплект: Буревестник"),
    ] });
    expect(old.kit).toBe("Буревестник");
    for (const signature of old.abilities.filter((ability) => ability.source === "Комплект: Буревестник")) {
      expect([1, 2, 3].map((tier) => abilityKitDamageBonus(signature, old, tier))).toEqual([0, 0, 0]);
      expect([1, 2, 3].map((tier) => abilityKitDamageBonus(signature, { ...old, kit: "" }, tier))).toEqual([0, 0, 0]);
    }
    const next = changeKit(old, "Раден");
    expect(next.abilities.filter((ability) => ability.source.startsWith("Комплект: ")).map((ability) => ability.name).sort())
      .toEqual(["Аспект Дикой Природы", "Стремительный Наскок"].sort());
    const oldSignature = ABILITY_COMPENDIUM.find((ability) => ability.name === "Стремительный Наскок")!;
    expect([1, 2, 3].map((tier) => abilityKitDamageBonus(oldSignature, next, tier))).toEqual([0, 0, 0]);
  });

  it.each([1, 4, 7, 10])("показывает пороги комплекта по уровню %s", (level) => {
    const hero = { ...stormwight("Борен"), level };
    const rows = activeClassFeatures(hero).filter((feature) => feature.id.startsWith("kit.boren.growing-ferocity."));
    expect(rows).toHaveLength(level === 1 ? 3 : level === 4 ? 4 : level === 7 ? 5 : 6);
    expect(rows.every((feature) => feature.mechanics?.when?.resourceAtLeast)).toBe(true);
    expect(activeClassFeatures({ ...hero, kit: "Корвен" }).some((feature) => feature.id.startsWith("kit.boren."))).toBe(false);
    expect(activeClassFeatures({ ...hero, subclass: "Берсерк" }).some((feature) => feature.id.startsWith("kit.boren."))).toBe(false);
  });

  it("считает отход Корвена и Радена по свирепости и выключает прибавку вместе с автоматизацией", () => {
    for (const name of ["Корвен", "Раден"]) {
      const hero = stormwight(name);
      const low = { ...hero, heroicResource: { ...hero.heroicResource, current: 1 } };
      const high = { ...hero, heroicResource: { ...hero.heroicResource, current: 2 } };
      expect(calculatedValues(low).disengage).toBe(2);
      expect(calculatedValues(high).disengage).toBe(2 + high.characteristics.agility);
      expect(calculatedValues({ ...high, automation: { ...high.automation!, enabled: false } }).disengage).toBe(2);
    }
  });

  it("Вукен усиливает принудительное движение только при броске силы на пороге 12 с 10-го уровня", () => {
    const base = stormwight("Вукен");
    const hero = { ...base, level: 10, heroicResource: { ...base.heroicResource, current: 12 } };
    const rolled = ABILITY_COMPENDIUM.find((ability) => ability.name === "Сносящая Атака")!;
    const amount = hero.characteristics.agility;
    expect(abilityForcedMovement(rolled, hero)).toEqual({ push: amount, pull: amount, slide: amount });
    expect(abilityForcedMovement({ ...rolled, rollCharacteristics: [] }, hero)).toEqual({ push: 0, pull: 0, slide: 0 });
    expect(abilityForcedMovement(rolled, { ...hero, level: 9 })).toEqual({ push: 0, pull: 0, slide: 0 });
    expect(abilityForcedMovement(rolled, { ...hero, heroicResource: { ...hero.heroicResource, current: 11 } })).toEqual({ push: 0, pull: 0, slide: 0 });
  });

  it.each([["Борен", "холод"], ["Корвен", "огонь"], ["Раден", "порча"], ["Вукен", "молния"]])(
    "берёт иммунитет к урону %s из первозданного шторма: %s", (kit, type) => {
      const hero = stormwight(kit);
      expect(featureDamageImmunities({ ...hero, level: 6 })).toEqual([]);
      for (const level of [7, 10]) {
        const immunities = featureDamageImmunities({ ...hero, level });
        expect(immunities).toHaveLength(1);
        expect(immunities[0]).toMatchObject({ types: [type], value: hero.characteristics.might * (level === 7 ? 2 : 3) });
      }
    },
  );
});
