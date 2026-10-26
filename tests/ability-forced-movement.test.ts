import { describe, expect, it } from "vitest";
import {
  abilityForcedMovement,
  forcedMovementSummary,
} from "../src/lib/character-calculations";
import { createCharacter } from "../src/lib/defaults";
import type { Ability, Character } from "../src/types";

/** Неистовый с включённым авторасчётом и выбранным аспектом. */
function fury(aspect?: string): Character {
  const hero = createCharacter({ className: "Неистовый", level: 1 });
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    ...(aspect ? { classFeatureSelections: { "fury.aspect": aspect } } : {}),
  };
  return hero;
}

/** Обычный удар оружием: текст тира остаётся как напечатан. */
function weaponAbility(): Ability {
  return {
    id: "test-forced-movement",
    name: "Тестовый удар",
    flavor: "",
    actionType: "main",
    kind: "signature",
    keywords: ["Ближний", "Удар", "Оружие"],
    distance: "Ближний 1",
    target: "Одно существо",
    rollCharacteristics: ["might"],
    preferredCharacteristic: "might",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "3 + М", effect: "" },
      { damage: "5 + М", effect: "" },
      { damage: "7 + М", effect: "" },
    ],
    effect: "",
    source: "",
    notes: "",
  };
}

describe("принудительное перемещение под карточкой способности", () => {
  it("лист показывает добавку к толчку отдельной строкой и не правит текст тира", () => {
    const hero = fury("Берсерк");
    hero.characteristics.might = 2;
    hero.heroicResource.current = 2;

    const ability = weaponAbility();
    expect(abilityForcedMovement(ability, hero)).toEqual({
      push: 2,
      pull: 0,
      slide: 0,
    });

    // Сам текст тира не переписан: добавка живёт под тирами.
    expect(ability.tiers[0].effect ?? "").toBe("");
    expect(ability.tiers[0].damage).toBe("3 + М");
  });

  it("строка называет только ненулевые манёвры", () => {
    expect(forcedMovementSummary({ push: 2, pull: 0, slide: 1 })).toBe(
      "Толчок +2 · Швыряние +1",
    );
    expect(forcedMovementSummary({ push: 0, pull: 3, slide: 0 })).toBe(
      "Притягивание +3",
    );
  });

  it("без бонусов все три поля 0, строка пустая", () => {
    const hero = createCharacter({ className: "Неистовый" });
    expect(abilityForcedMovement(weaponAbility(), hero)).toEqual({
      push: 0,
      pull: 0,
      slide: 0,
    });
    expect(forcedMovementSummary({ push: 0, pull: 0, slide: 0 })).toBe("");
  });

  it("порог свирепости ниже 2 бонуса не даёт", () => {
    const hero = fury("Берсерк");
    hero.characteristics.might = 2;
    hero.heroicResource.current = 1;
    expect(abilityForcedMovement(weaponAbility(), hero)).toEqual({
      push: 0,
      pull: 0,
      slide: 0,
    });
  });
});
