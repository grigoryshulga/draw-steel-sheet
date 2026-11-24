import { describe, expect, it } from "vitest";
import { KIT_COMPENDIUM, SELECTABLE_KITS } from "../src/data/kits";
import { kitDisplayBonus, kitDisplayEquipment, kitDisplayName, kitDisplaySignature, kitDisplayStorm, kitDisplayValue } from "../src/lib/kit-display";

describe("kit presentation", () => {
  it("displays English names, equipment, signatures and bonuses for every selectable kit", () => {
    for (const kit of SELECTABLE_KITS) {
      expect(kitDisplayName(kit.name, "en"), kit.name).toBe(kit.originalName);
      expect(kitDisplayEquipment(kit, "en"), kit.name).not.toMatch(/[А-Яа-яЁё]/);
      expect(kitDisplaySignature(kit, "en"), kit.name).not.toMatch(/[А-Яа-яЁё]/);
      for (const bonus of kit.bonuses) {
        expect(kitDisplayBonus(bonus.label, "en"), kit.name).not.toMatch(/[А-Яа-яЁё]/);
        expect(kitDisplayValue(bonus.value, "en"), kit.name).not.toMatch(/[А-Яа-яЁё]/);
      }
    }
  });
  it("preserves Russian and custom names and translates all stormwight fields", () => {
    for (const kit of KIT_COMPENDIUM.flatMap((entry) => entry.variants ?? [])) {
      expect(kitDisplayStorm(kit, "en").join(" ")).not.toMatch(/[А-Яа-яЁё]/);
      expect(kitDisplayStorm(kit, "ru")).toEqual([kit.animalForm, kit.storm, kit.damageType]);
      expect(kitDisplayName(kit.name, "ru")).toBe(kit.name);
    }
    expect(kitDisplayName("Мой комплект", "en")).toBe("Мой комплект");
    expect(kitDisplayName("  Борен  ", "en")).toBe("  Борен  ");
  });
});
