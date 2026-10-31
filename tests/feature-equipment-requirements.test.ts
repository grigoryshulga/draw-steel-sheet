import { describe, expect, it } from "vitest";
import { BUILDER_DATA, buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { featureEquipmentRequirements } from "../src/lib/feature-equipment-requirements";
import { featureStatBonus } from "../src/lib/feature-modifiers";

describe("conditional equipment configuration", () => {
  it("shows both controls for the selected soldier prayer across current and legacy values", () => {
    for (const selected of ["conduit.prayer.soldier", "feature.conduit.level-1.prayer-of-soldiers-skill", "Молитва о мастерстве солдата", "  молитва о мастерстве солдата  "]) {
      expect(featureEquipmentRequirements("Проводник", { "conduit.prayer": selected })).toEqual({ lightArmor: true, lightWeapon: true });
    }
    expect(featureEquipmentRequirements("Проводник", { "conduit.prayer": "conduit.prayer.steel" })).toBeUndefined();
    expect(featureEquipmentRequirements("Проводник", { "conduit.prayer": "conduit.prayer.soldier, conduit.prayer.steel" })).toBeUndefined();
    expect(featureEquipmentRequirements("Воин", { "conduit.prayer": "conduit.prayer.soldier" })).toBeUndefined();
  });

  it("builds and preserves user-entered flags and applies only the matching no-kit effect", () => {
    const conduit = BUILDER_DATA.classes.find((item) => item.name === "Проводник")!;
    const built = buildCharacter({
      ...emptyBuilderDraft(), name: "Проверка", className: conduit.name,
      subclass: conduit.subclasses[0].name, characteristics: startingCharacteristics(conduit.name),
      featureChoices: { Молитва: "Молитва о мастерстве солдата" },
      equipment: { lightArmor: true, lightWeapon: false },
    });
    expect(built.automation?.equipment).toEqual({ lightArmor: true, lightWeapon: false });
    expect(featureStatBonus(built, "stamina")).toBe(3);
    expect(featureStatBonus({ ...built, automation: { ...built.automation!, equipment: { lightArmor: false, lightWeapon: false } } }, "stamina")).toBe(0);
    expect(featureStatBonus({ ...built, kit: "Воинский комплект" }, "stamina")).toBe(0);
    expect(featureEquipmentRequirements("Талант", { "talent.augmentation": "Боевая аугментация" })).toBeDefined();
    expect(featureEquipmentRequirements("Элементалист", { "elementalist.enchantment": "Зачарование битвы" })).toBeDefined();
    expect(featureEquipmentRequirements("Нуль", { "null.augmentation": "Аугментация плотности" })).toBeUndefined();
  });
});
