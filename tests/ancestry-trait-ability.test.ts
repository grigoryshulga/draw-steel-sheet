import { describe, expect, it } from "vitest";
import raw from "../src/data/builder.generated.json";
import { ancestryTraitAbility } from "../src/lib/ancestry-trait-ability";

function trait(ancestry: string, name: string): string {
  const entry = raw.ancestries.find((item) => item.name === ancestry);
  const found = entry?.traits.find((item) => item.name === name);
  if (!found) throw new Error(`Нет черты ${ancestry}/${name}`);
  return found.text;
}

describe("черты происхождения со способностью", () => {
  it("разбирает знаковую способность из цитаты", () => {
    const ability = ancestryTraitAbility(trait("Драконий Рыцарь", "Драконья гордость"), "Драконья гордость");
    expect(ability).not.toBeNull();
    expect(ability?.name).toBe("Драконья Гордость");
    expect(ability?.actionType).toBe("main");
    expect(ability?.keywords).toEqual(["Область", "Магия"]);
    expect(ability?.distance).toBe("Взрыв 1");
    expect(ability?.target).toBe("Каждый враг в области");
    expect(ability?.rollCharacteristics).toEqual(["might", "presence"]);
    expect(ability?.tiers.map((tier) => [tier.damage, tier.effect])).toEqual([
      ["2", ""],
      ["5", "толчок 1"],
      ["7", "толчок 2"],
    ]);
  });

  it("не превращает обычную черту в способность", () => {
    expect(ancestryTraitAbility(trait("Дьявол", "Адское зрение"), "Адское зрение")).toBeNull();
  });

  it("не выбирает одну способность из списка за игрока", () => {
    const text = trait("Рейдер Времени", "Псионический дар");
    expect((text.match(/^> \*\*[^*]+\*\*$/gm) ?? []).length).toBeGreaterThan(1);
    expect(ancestryTraitAbility(text, "Псионический дар")).toBeNull();
  });
});
