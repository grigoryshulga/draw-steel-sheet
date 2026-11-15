import { afterEach, describe, expect, it, vi } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { availableKits, kitByName, selectableKitByName } from "../src/data/kits";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { builderFlow } from "../src/lib/builder-flow";
import { abilityDistance, abilityKitDamageBonus, calculatedValues, recalculateCharacter } from "../src/lib/character-calculations";
import { readBuilderDraft } from "../src/lib/builder-draft";
import { parseCharacterImport } from "../src/lib/character-import";
import { normalizeCharacter } from "../src/lib/defaults";
import { changeKit } from "../src/lib/equipment";
import { equippedKits, resolvedKitBonus, resolvedKitBonuses, selectKitBonus } from "../src/lib/kit-bonuses";
import { evaluateAbilityDamage, evaluateDamage } from "../src/lib/rules";

function tactician(kit = "Сияющие Доспехи", secondaryKit = "Снайпер") {
  return buildCharacter({
    ...emptyBuilderDraft(),
    className: "Тактик",
    characteristics: startingCharacteristics("Тактик"),
    kit,
    secondaryKit,
  });
}

describe("Полевой арсенал: расчёты и смена комплектов", () => {
  it("предлагает обычные комплекты и проверяет различие пары по комплекту, а не написанию", () => {
    expect(availableKits("Тактик", "")).toHaveLength(21);
    expect(selectableKitByName("Буревестник", "Тактик", "")).toBeUndefined();
    expect(kitByName("Буревестник")).toBeDefined(); // старые документы и каталог читаются
    const steps = (kit: string, secondaryKit: string) => builderFlow({
      ...emptyBuilderDraft(), className: "Тактик", kit, secondaryKit,
    });
    expect(steps("Гора", " гора ").find((step) => step.id === "kit/secondary")?.issue).not.toBe("");
    expect(steps("Гора", "Буревестник").find((step) => step.id === "kit/secondary")?.issue).not.toBe("");
    expect(steps("Гора", "Снайпер").find((step) => step.id === "kit/secondary")?.issue).toBe("");
  });

  it("показывает все итоговые бонусы быстрого билда без сложения", () => {
    const hero = tactician();
    expect(Object.fromEntries(resolvedKitBonuses(hero).map((bonus) => [bonus.label, bonus.value]))).toEqual({
      выносливости: "+12 за эшелон",
      скорости: "+1",
      устойчивости: "+1",
      отходу: "+1",
      "урону (Ближний)": "+2/+2/+2",
      "урону (Дальний)": "+0/+0/+4",
      "расстоянию (Дальний)": "+10",
    });
  });

  it("берёт дальний профиль второго комплекта без скрытого выбора первого", () => {
    const hero = tactician();
    const strike = hero.abilities.find((a) => a.kind === "free-strike" && a.keywords.includes("Дальний"))!;
    expect(abilityKitDamageBonus(strike, hero, 3)).toBe(4);
    const signature = hero.abilities.find((a) => a.source === "Комплект: Снайпер")!;
    for (const tier of [1, 2, 3]) {
      expect(evaluateAbilityDamage(signature, tier, hero).values)
        .toEqual(evaluateDamage(signature.tiers[tier - 1].damage, hero).values);
    }
  });

  it("выбирает доминирующий профиль целиком, сохраняя явный выбор игрока", () => {
    const hero = tactician("Налетчик", "Мистический Лучник");
    const strike = hero.abilities.find((a) => a.kind === "free-strike" && a.keywords.includes("Дальний"))!;
    expect([1, 2, 3].map((tier) => abilityKitDamageBonus(strike, hero, tier))).toEqual([2, 2, 2]);
    hero.automation!.rangedDamageKit = "Налетчик";
    expect([1, 2, 3].map((tier) => abilityKitDamageBonus(strike, hero, tier))).toEqual([1, 1, 1]);
  });

  it("не смешивает тиры разных профилей и понимает старые написания источника", () => {
    const hero = tactician("Мастер Боевых Искусств", "Гора");
    const strike = hero.abilities.find((a) => a.kind === "free-strike" && a.keywords.includes("Ближний"))!;
    expect([1, 2, 3].map((tier) => abilityKitDamageBonus(strike, hero, tier))).toEqual([2, 2, 2]);
    hero.automation!.meleeDamageKit = "  ГОРА ";
    expect([1, 2, 3].map((tier) => abilityKitDamageBonus(strike, hero, tier))).toEqual([0, 0, 4]);
  });

  it("игнорирует устаревший или неподходящий источник и не дублирует одинаковые комплекты", () => {
    const hero = tactician();
    hero.automation!.rangedDamageKit = hero.kit; // первый комплект не даёт дальний бонус
    expect(resolvedKitBonus(hero, "урону (Дальний)")?.kit.name).toBe("Снайпер");
    hero.automation!.kitBonusSelections = { скорости: "Несуществующий комплект" };
    expect(resolvedKitBonus(hero, "скорости")?.value).toBe("+1");
    hero.secondaryKit = "  сияющие доспехи ";
    expect(equippedKits(hero)).toHaveLength(1);
    expect(resolvedKitBonus(hero, "выносливости")?.options).toHaveLength(1);
    expect(resolvedKitBonus(hero, "выносливости")?.value).toBe("+12 за эшелон");
  });

  it("сохраняет карточку и заметки неизменённого комплекта при смене другого", () => {
    const hero = tactician();
    const signature = hero.abilities.find((a) => a.source === "Комплект: Снайпер")!;
    signature.notes = "Моя заметка о выстреле";
    signature.rollBonus = 1;
    const classAbility = ABILITY_COMPENDIUM.find((a) => a.className === "Тактик")!;
    hero.abilities.push(classAbility);
    const next = changeKit(hero, "Гора");
    expect(next.abilities.find((a) => a.id === signature.id)).toEqual(signature);
    expect(next.abilities).toContain(classAbility);
    expect(next.abilities.filter((a) => a.source === "Комплект: Гора")).toHaveLength(1);
    expect(next.abilities.some((a) => a.source === "Комплект: Сияющие Доспехи")).toBe(false);
    expect(changeKit(next, "Гора").abilities).toEqual(next.abilities);
  });

  it("не держит профиль снятого комплекта и сохраняет выбор оставшегося", () => {
    const hero = tactician("Мастер Боевых Искусств", "Гора");
    hero.automation!.meleeDamageKit = "Гора";
    const next = changeKit(hero, "Налетчик", true);
    expect(next.automation!.meleeDamageKit).toBe("");
    expect(hero.automation!.meleeDamageKit).toBe("Гора");
    const kept = changeKit(hero, "Налетчик");
    expect(kept.automation!.meleeDamageKit).toBe("Гора");
  });

  it("учитывает сохранённый источник числового бонуса вместо обязательного максимума", () => {
    const hero = tactician("Мастер Боевых Искусств", "Гора");
    hero.automation!.kitBonusSelections = { выносливости: "Мастер Боевых Искусств" };
    expect(calculatedValues(hero).stamina).toBe(24); // класс 21 + комплект 3
    hero.level = 4;
    expect(calculatedValues(hero).stamina).toBe(54); // класс 48 + комплект 3 × эшелон 2
  });

  it("смена бонуса пересчитывает лист без накопления и сохраняет ручную поправку", () => {
    const hero = tactician("Мастер Боевых Искусств", "Гора");
    const adjusted = recalculateCharacter(hero, { ...hero, stamina: { ...hero.stamina, max: hero.stamina.max + 5 } });
    const selected = recalculateCharacter(adjusted, {
      ...adjusted,
      automation: { ...adjusted.automation!, ...selectKitBonus(adjusted.automation, "выносливости", "Мастер Боевых Искусств") },
    });
    expect(selected.stamina.max).toBe(29);
    expect(selected.automation!.adjustments.stamina).toBe(5);
    expect(recalculateCharacter(selected, selected).stamina.max).toBe(29);
    const changed = changeKit(selected, "Налетчик", true);
    expect(changed.automation!.kitBonusSelections).toEqual({ выносливости: "Мастер Боевых Искусств" });
    const departed = changeKit(selected, "Налетчик");
    expect(departed.automation!.kitBonusSelections).toEqual({});
  });

  it("при выключенном авторасчёте оставляет числа и карточки ручного листа", () => {
    const hero = tactician();
    hero.automation!.enabled = false;
    const next = recalculateCharacter(hero, changeKit(hero, "Гора"));
    expect(next.kit).toBe("Гора");
    expect(next.automation!.enabled).toBe(false);
    expect(next.abilities).toEqual(hero.abilities);
    expect(next.stamina).toEqual(hero.stamina);
    const signature = hero.abilities.find((a) => a.source === "Комплект: Снайпер")!;
    expect(abilityDistance(signature, next)).toBe(signature.distance);
    expect(abilityKitDamageBonus(signature, next, 3)).toBe(0);
  });

  it("пересчитывает встроенную дистанцию знаковой способности по выбранному источнику", () => {
    const hero = tactician("Налетчик", "Снайпер");
    const ranged = hero.abilities.find((a) => a.kind === "free-strike" && a.keywords.includes("Дальний"))!;
    hero.automation!.kitBonusSelections = { "расстоянию (Дальний)": "Налетчик" };
    expect(abilityDistance(ranged, hero)).toBe("Дальний 10");
    const signature = ABILITY_COMPENDIUM.find((a) => a.source === "Комплект: Снайпер")!;
    expect(abilityDistance(signature, hero)).toBe("Дальний 10");
  });
});

describe("Выборы бонусов комплектов: сохранение", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("сохраняет источники из билдера через JSON-импорт и нормализацию без общей ссылки", async () => {
    const preferences = {
      meleeDamageKit: "Гора",
      rangedDamageKit: "",
      kitBonusSelections: { выносливости: "Мастер Боевых Искусств" },
    };
    const hero = buildCharacter({
      ...emptyBuilderDraft(),
      className: "Тактик",
      kit: "Мастер Боевых Искусств",
      secondaryKit: "Гора",
      ...preferences,
    });
    expect(hero.automation!.kitBonusSelections).not.toBe(preferences.kitBonusSelections);
    const normalized = normalizeCharacter(hero);
    expect(normalized.automation!.kitBonusSelections).not.toBe(hero.automation!.kitBonusSelections);
    const text = JSON.stringify(hero);
    const imported = await parseCharacterImport({ size: new TextEncoder().encode(text).length, text: async () => text });
    expect(imported.automation).toMatchObject(preferences);
    expect(calculatedValues(imported).stamina).toBe(24);
    expect(resolvedKitBonus(imported, "урону (Ближний)")?.value).toBe("+0/+0/+4");
  });

  it.each([null, [], { выносливости: 4 }])("отбрасывает повреждённые выборы при загрузке и отклоняет импорт: %j", async (selections) => {
    const hero = tactician();
    const invalid = { ...hero, automation: { ...hero.automation, kitBonusSelections: selections } };
    expect(normalizeCharacter(invalid as unknown as typeof hero).automation!.kitBonusSelections).toBeUndefined();
    const text = JSON.stringify(invalid);
    await expect(parseCharacterImport({ size: text.length, text: async () => text })).rejects.toThrow();
  });

  it("восстанавливает новый и старый черновики, отбрасывая неверный формат выборов", () => {
    const draft = {
      ...emptyBuilderDraft(),
      className: "Тактик",
      kit: "Гора",
      secondaryKit: "Мастер Боевых Искусств",
      kitBonusSelections: { выносливости: "Мастер Боевых Искусств" },
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(draft) });
    expect(readBuilderDraft("test").kitBonusSelections).toEqual(draft.kitBonusSelections);
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ ...draft, kitBonusSelections: ["Гора"] }) });
    expect(readBuilderDraft("test").kitBonusSelections).toBeUndefined();
    const { kitBonusSelections: _choices, ...legacyDraft } = draft;
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(legacyDraft) });
    expect(readBuilderDraft("test").secondaryKit).toBe(draft.secondaryKit);
    expect(readBuilderDraft("test").kitBonusSelections).toBeUndefined();
  });
});
