import { describe, expect, it } from "vitest";
import {
  ALL_PERK_TYPES,
  CAREER_PERK_TYPES,
  PERK_COMPENDIUM,
  PERK_TYPE_META,
  careerPerkType,
  classPerkTypes,
  isPerkUsed,
  perkById,
  perkSlots,
  selectedPerkForSlot,
} from "../src/data/perks";
import { KIT_COMPENDIUM, kitBonusLabel, kitByName } from "../src/data/kits";
import type { Character, SelectedPerk } from "../src/types";

function hero(overrides: Partial<Character> = {}): Character {
  return {
    career: "Солдат",
    className: "Цензор",
    level: 3,
    perks: [],
    ...overrides,
  } as Character;
}

describe("perks data", () => {
  it("содержит все шесть типов и уникальные id", () => {
    expect(PERK_COMPENDIUM.length).toBeGreaterThan(40);
    for (const type of ALL_PERK_TYPES) {
      expect(PERK_COMPENDIUM.some((perk) => perk.type === type)).toBe(true);
    }
    expect(new Set(PERK_COMPENDIUM.map((perk) => perk.id)).size).toBe(PERK_COMPENDIUM.length);
    for (const perk of PERK_COMPENDIUM) {
      expect(perk.name.length).toBeGreaterThan(0);
      expect(perk.summary.length).toBeGreaterThan(0);
      expect(perk.description.length).toBeGreaterThan(0);
      expect(PERK_TYPE_META[perk.type].label.length).toBeGreaterThan(0);
      expect(perkById(perk.id)?.name).toBe(perk.name);
    }
  });

  it("карьеры сопоставлены с типами перков", () => {
    expect(Object.keys(CAREER_PERK_TYPES).length).toBeGreaterThanOrEqual(18);
    expect(careerPerkType("Солдат")).toBe("exploration");
    expect(careerPerkType("Агент")).toBe("intrigue");
    expect(careerPerkType("Ремесленник")).toBe("crafting");
  });
});

describe("perkSlots", () => {
  it("на 3 уровне цензора открывает карьеру и перк 2 уровня", () => {
    const slots = perkSlots(hero());
    expect(slots).toHaveLength(2);
    expect(slots[0].source).toBe("career");
    expect(slots[0].allowedTypes).toEqual(["exploration"]);
    expect(slots[1].level).toBe(2);
    expect(slots[1].allowedTypes).toEqual(["interpersonal", "lore", "supernatural"]);
  });

  it("на 4 и 8 уровнях разрешает любой тип", () => {
    expect(classPerkTypes("Цензор", 4)).toEqual(ALL_PERK_TYPES);
    expect(classPerkTypes("Цензор", 8)).toEqual(ALL_PERK_TYPES);
  });

  it("на 10 уровне открывает все пять классовых слотов", () => {
    const slots = perkSlots(hero({ level: 10 }));
    expect(slots).toHaveLength(6);
    expect(slots.map((slot) => slot.level)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("неизвестные карьера и класс не ограничивают типы", () => {
    const slots = perkSlots(hero({ career: "", className: "", level: 2 }));
    expect(slots[0].allowedTypes).toEqual(ALL_PERK_TYPES);
    expect(slots[1].allowedTypes).toEqual(ALL_PERK_TYPES);
  });

  it("находит выбранный перк в своём слоте и не путает слоты", () => {
    const careerPerk: SelectedPerk = {
      perkId: "x",
      name: "X",
      type: "exploration",
      source: "career",
      level: 0,
    };
    const classPerk: SelectedPerk = {
      perkId: "y",
      name: "Y",
      type: "lore",
      source: "class",
      level: 2,
    };
    const character = hero({ perks: [careerPerk, classPerk] });
    const slots = perkSlots(character);
    expect(selectedPerkForSlot(character, slots[0])?.perkId).toBe("x");
    expect(selectedPerkForSlot(character, slots[1])?.perkId).toBe("y");
  });

  it("не разрешает один и тот же перк в разных слотах, но игнорирует текущий", () => {
    const character = hero({
      perks: [
        {
          perkId: "x",
          name: "X",
          type: "exploration",
          source: "career",
          level: 0,
        },
      ],
    });
    const slots = perkSlots(character);
    expect(isPerkUsed(character, "x")).toBe(true);
    expect(isPerkUsed(character, "x", slots[0])).toBe(false);
    expect(isPerkUsed(character, "x", slots[1])).toBe(true);
  });
});

describe("kits data", () => {
  it("содержит комплекты с бонусами и знаковыми способностями", () => {
    expect(KIT_COMPENDIUM.length).toBeGreaterThanOrEqual(22);
    for (const kit of KIT_COMPENDIUM) {
      expect(kit.name.length).toBeGreaterThan(0);
      expect(kit.equipment.length).toBeGreaterThan(0);
      expect(kit.signatureAbility.length).toBeGreaterThan(0);
    }
  });

  it("находит комплект без учёта регистра", () => {
    expect(kitByName("Сияющие доспехи")?.name).toBe("Сияющие Доспехи");
    expect(kitByName("сияющие доспехи")?.bonuses.length).toBeGreaterThan(0);
    expect(kitByName("Нет такого комплекта")).toBeUndefined();
    expect(kitBonusLabel("выносливости")).toBe("Выносливость");
    expect(kitBonusLabel("урону (Ближний)")).toBe("Урон (Ближний)");
  });
});
