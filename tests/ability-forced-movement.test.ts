import { describe, expect, it } from "vitest";
import {
  abilityForcedMovement,
  abilityForcedMovementLine,
  abilityHasForcedMovement,
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

/** Берсерк на пороге свирепости 2: Мощь 2, ресурса 2. */
function berserkerAtThreshold(): Character {
  const hero = fury("Берсерк");
  hero.characteristics.might = 2;
  hero.heroicResource.current = 2;
  return hero;
}

/** Обычный удар оружием; `effect` — текст тира, как в книге. */
function weaponAbility(effect = ""): Ability {
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
      { damage: "3 + М", effect },
      { damage: "5 + М", effect },
      { damage: "7 + М", effect },
    ],
    effect: "",
    source: "",
    notes: "",
  };
}

describe("принудительное перемещение под карточкой способности", () => {
  it("лист показывает добавку к толчку отдельной строкой и не правит текст тира", () => {
    const hero = berserkerAtThreshold();
    const ability = weaponAbility("толчок 1");
    const before = structuredClone(ability);

    expect(abilityForcedMovement(ability, hero)).toEqual({
      push: 2,
      pull: 0,
      slide: 0,
    });
    expect(abilityForcedMovementLine(ability, hero)).toBe("Толчок +2");

    // Расчёт не мутирует способность: текст тира остаётся как напечатан.
    expect(ability).toEqual(before);
  });

  it("бонус считается по полям, но строка — только по тексту способности", () => {
    const hero = berserkerAtThreshold();
    const plain = weaponAbility();

    expect(abilityHasForcedMovement(plain)).toBe(false);
    expect(abilityForcedMovement(plain, hero)).toEqual({
      push: 2,
      pull: 0,
      slide: 0,
    });
    expect(abilityForcedMovementLine(plain, hero)).toBe("");

    const pushing = weaponAbility("толчок 1");
    expect(abilityHasForcedMovement(pushing)).toBe(true);
    expect(abilityForcedMovementLine(pushing, hero)).toBe("Толчок +2");
  });

  it("швыряние и сдвиг в тексте включают строку так же, как толчок", () => {
    const hero = berserkerAtThreshold();
    expect(abilityHasForcedMovement(weaponAbility("Швыряние 1"))).toBe(true);
    expect(abilityHasForcedMovement(weaponAbility("сдвиг на 1"))).toBe(true);
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
    expect(abilityForcedMovement(weaponAbility("толчок 1"), hero)).toEqual({
      push: 0,
      pull: 0,
      slide: 0,
    });
    expect(abilityForcedMovementLine(weaponAbility("толчок 1"), hero)).toBe("");
    expect(forcedMovementSummary({ push: 0, pull: 0, slide: 0 })).toBe("");
  });

  it("порог свирепости ниже 2 бонуса не даёт", () => {
    const hero = fury("Берсерк");
    hero.characteristics.might = 2;
    hero.heroicResource.current = 1;
    expect(abilityForcedMovement(weaponAbility("толчок 1"), hero)).toEqual({
      push: 0,
      pull: 0,
      slide: 0,
    });
  });
});
