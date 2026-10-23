import { describe, expect, it } from "vitest";
import { CLASS_PRESETS } from "../src/data/classes";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { recalculateCharacter } from "../src/lib/character-calculations";

describe("Class heroic resources", () => {
  it.each(CLASS_PRESETS)(
    "uses the $name resource when creating and importing a sheet",
    (preset) => {
      const hero = createCharacter({ className: preset.name });
      expect(hero.heroicResource.name).toBe(preset.resource);
      const restored = normalizeCharacter({
        ...hero,
        heroicResource: { name: "Старое ручное название", current: 3, max: 9 },
      });
      expect(restored.heroicResource).toEqual({
        name: preset.resource,
        current: 3,
        max: 9,
      });
    },
  );
  it.each([false, true])(
    "updates the resource after changing class with automation=%s",
    (enabled) => {
      const hero = createCharacter({ className: "Тактик" });
      hero.automation = { enabled, adjustments: {}, ancestryTraits: [] };
      hero.heroicResource = { name: "Фокус", current: 3, max: 9 };
      const changed = recalculateCharacter(hero, {
        ...hero,
        className: "Трубадур",
      });
      expect(changed.heroicResource).toEqual({
        name: "Драма",
        current: 3,
        max: 9,
      });
      if (!enabled) expect(changed.stamina).toEqual(hero.stamina);
      expect(hero.heroicResource.name).toBe("Фокус");
    },
  );
  it("uses a generic label when the class is cleared instead of retaining another class's name", () => {
    const hero = createCharacter({ className: "Тактик" });
    expect(
      recalculateCharacter(hero, { ...hero, className: "" }).heroicResource
        .name,
    ).toBe("Героический ресурс");
    expect(
      normalizeCharacter({ ...hero, className: "Неизвестный класс" })
        .heroicResource.name,
    ).toBe("Героический ресурс");
  });
});
