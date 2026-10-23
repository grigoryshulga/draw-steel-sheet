import { describe, expect, it } from "vitest";
import { abilityFromTemplate, BASIC_ABILITIES } from "../src/data/templates";
import { createCharacter } from "../src/lib/defaults";
import {
  abilityTierRequirements,
  normalizeAbility,
  preferredCharacteristic,
} from "../src/lib/abilities";

function testCharacter() {
  const character = createCharacter({ name: "Тест" });
  character.characteristics = {
    might: 1,
    agility: 2,
    reason: 3,
    intuition: 0,
    presence: -1,
  };
  return character;
}

describe("способности: предпочтительная характеристика", () => {
  it("использует валидную предпочтительную характеристику", () => {
    const ability = abilityFromTemplate(BASIC_ABILITIES[0]);
    ability.rollCharacteristics = ["might", "agility"];
    ability.preferredCharacteristic = "agility";
    expect(preferredCharacteristic(ability)).toBe("agility");
  });

  it("откатывается на первую характеристику, если предпочтительная не входит в список", () => {
    const ability = abilityFromTemplate(BASIC_ABILITIES[0]);
    ability.rollCharacteristics = ["might", "agility"];
    ability.preferredCharacteristic = "reason";
    expect(preferredCharacteristic(ability)).toBe("might");
  });

  it("нормализует старую способность без поля", () => {
    const ability = abilityFromTemplate(BASIC_ABILITIES[0]);
    const legacy = { ...ability, preferredCharacteristic: undefined } as unknown as typeof ability;
    expect(normalizeAbility(legacy).preferredCharacteristic).toBe(ability.rollCharacteristics[0]);
  });
});

describe("способности: пороги тиров", () => {
  it("считает натуральные значения 2d10 от предпочтительной характеристики и бонуса", () => {
    const ability = abilityFromTemplate(BASIC_ABILITIES[0]);
    ability.rollCharacteristics = ["reason", "might"];
    ability.preferredCharacteristic = "reason";
    ability.rollBonus = 1;

    const req = abilityTierRequirements(ability, testCharacter());
    expect(req).not.toBeNull();
    expect(req).toMatchObject({
      characteristic: "reason",
      characteristicBonus: 3,
      rollBonus: 1,
      totalBonus: 4,
      t1Max: 7,
      t2Min: 8,
      t2Max: 12,
      t3Min: 13,
    });
  });

  it("не считает пороги для способности без броска", () => {
    const ability = abilityFromTemplate(BASIC_ABILITIES[2]);
    expect(ability.rollCharacteristics).toEqual([]);
    expect(abilityTierRequirements(ability, testCharacter())).toBeNull();
  });
});
