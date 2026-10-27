import { describe, expect, it } from "vitest";
import {
  buildCharacter,
  BUILDER_DATA,
  emptyBuilderDraft,
  startingCharacteristics,
  validCharacteristicArray,
  builderIssues,
  builderSkillSlots,
  grantedClassAbilities,
  selectableClassAbilities,
} from "../src/lib/character-builder";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import {
  calculatedValues,
  recalculateCharacter,
  abilityDistance,
  echelon,
} from "../src/lib/character-calculations";
import { evaluateAbilityDamage, evaluateDamage } from "../src/lib/rules";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { changeKit } from "../src/lib/equipment";
import { PERK_COMPENDIUM } from "../src/data/perks";
import {
  ALL_CREATION_SKILLS,
  CLASS_SIGNATURE_COUNTS,
  canUseKit,
  DOMAIN_GRANTED_ABILITIES,
  DOMAIN_SKILL_SLOTS,
} from "../src/data/creation-rules";

function tactician() {
  return buildCharacter({
    ...emptyBuilderDraft(),
    name: "Тестовый тактик",
    ancestry: "Дварф",
    traits: ["Заземленность", "Искра с твоей кожи"],
    className: "Тактик",
    subclass: "Авангард",
    characteristics: startingCharacteristics("Тактик"),
    kit: "Сияющие Доспехи",
    secondaryKit: "Снайпер",
    meleeDamageKit: "Сияющие Доспехи",
    rangedDamageKit: "Снайпер",
  });
}

describe("Character creation and automatic rules", () => {
  it.each([
    ["Созидание", "Смерть"],
    ["Природа", "Созидание"],
    ["Смерть", "Созидание"],
  ])("uses only the explicitly selected conduit domain in pair %s / %s", (chosen, complement) => {
    const base = {
      ...emptyBuilderDraft(),
      className: "Проводник",
      subclass: `${chosen}, ${complement}`,
    };
    const selected = { ...base, conduitDomainFeature: chosen };
    const slots = builderSkillSlots(selected).class;
    expect(slots).toContainEqual(DOMAIN_SKILL_SLOTS[chosen]);
    expect(slots).not.toContainEqual(DOMAIN_SKILL_SLOTS[complement]);
    expect(grantedClassAbilities(selected).map((ability) => ability.name)).toEqual(
      expect.arrayContaining(DOMAIN_GRANTED_ABILITIES[chosen] ?? []),
    );
    for (const name of DOMAIN_GRANTED_ABILITIES[complement] ?? []) {
      expect(grantedClassAbilities(selected).map((ability) => ability.name)).not.toContain(name);
    }
  });

  it.each([
    ["Созидание", "Руки Творца", "Могильная Речь", "Смерть"],
    ["Смерть", "Могильная Речь", "Руки Творца", "Созидание"],
    ["Природа", "Верный Друг", "Руки Творца", "Созидание"],
  ])("only exposes and grants the selected conduit domain card: %s", (chosen, grantedName, foreignName, complement) => {
    const domains = `${chosen}, ${complement}`;
    const base = {
      ...emptyBuilderDraft(),
      name: "Проводник",
      className: "Проводник",
      subclass: domains,
      conduitDomainFeature: chosen,
      characteristics: startingCharacteristics("Проводник"),
    };
    const card = (name: string) => ABILITY_COMPENDIUM.find(
      (ability) => ability.className === "Проводник" && ability.level === 1 && ability.name === name,
    )!;
    expect(selectableClassAbilities(base).map((ability) => ability.name)).not.toEqual(
      expect.arrayContaining(["Руки Творца", "Могильная Речь", "Верный Друг"]),
    );
    expect(buildCharacter(base).abilities.map((ability) => ability.name)).toContain(grantedName);
    expect(buildCharacter(base).abilities.map((ability) => ability.name)).not.toContain(foreignName);

    const forged = { ...base, abilityIds: [card(foreignName).id] };
    expect(builderIssues(forged)[6]).toContain("Особенности доменов");
    expect(buildCharacter(forged).abilities.map((ability) => ability.name)).not.toContain(foreignName);
  });

  it("does not exclude same-named non-conduit abilities from other classes", () => {
    const censored = {
      ...emptyBuilderDraft(),
      className: "Цензор",
      domain: "Смерть",
    };
    const sameName = ABILITY_COMPENDIUM.find(
      (ability) => ability.id === "cenzor-ruki-tvorca-3425397e10",
    )!;
    expect(selectableClassAbilities(censored)).toContainEqual(sameName);
    expect(grantedClassAbilities(censored)).not.toContainEqual(sameName);
    expect(
      buildCharacter({ ...censored, abilityIds: [sameName.id] }).abilities,
    ).toContainEqual(sameName);
    const tactician = selectableClassAbilities({
      ...emptyBuilderDraft(),
      className: "Тактик",
    });
    expect(tactician.some((ability) => ability.kind === "heroic")).toBe(true);
    expect(tactician.some((ability) => ability.resourceCost === 3)).toBe(true);
    expect(tactician.some((ability) => ability.resourceCost === 5)).toBe(true);
  });

  it.each(["", "Судьба", "Созидание, Смерть"])(
    "does not grant conduit domain data for missing or invalid choice %s",
    (choice) => {
      const draft = {
        ...emptyBuilderDraft(),
        className: "Проводник",
        subclass: "Созидание, Смерть",
        conduitDomainFeature: choice,
      };
      expect(builderSkillSlots(draft).class).not.toContainEqual(DOMAIN_SKILL_SLOTS["Созидание"]);
      expect(builderSkillSlots(draft).class).not.toContainEqual(DOMAIN_SKILL_SLOTS["Смерть"]);
      expect(grantedClassAbilities(draft).map((ability) => ability.name)).not.toContain("Руки Творца");
      expect(grantedClassAbilities(draft).map((ability) => ability.name)).not.toContain("Могильная Речь");
    },
  );

  it("stores the conduit level 1 domain only when explicitly selected from the pair", () => {
    const base = {
      ...emptyBuilderDraft(),
      className: "Проводник",
      subclass: "Жизнь, Защита",
      characteristics: startingCharacteristics("Проводник"),
      featureChoices: Object.fromEntries(
        BUILDER_DATA.classes.find((entry) => entry.name === "Проводник")!.featureChoices
          .map((group) => [group.name, group.options[0].name]),
      ),
    };
    const valid = { ...base, conduitDomainFeature: "Защита" };
    expect(builderIssues(valid)[4]).not.toContain("особенности 1-го уровня");
    expect(buildCharacter(valid).automation?.classFeatureSelections?.["conduit.domain.1"]).toBe("Защита");

    const missing = { ...base, conduitDomainFeature: "" };
    expect(builderIssues(missing)[4]).toContain("особенности 1-го уровня");
    expect(buildCharacter(missing).automation?.classFeatureSelections).not.toHaveProperty("conduit.domain.1");

    const replaced = { ...valid, subclass: "Война, Смерть" };
    expect(builderIssues(replaced)[4]).toContain("из двух выбранных");
    expect(buildCharacter(replaced).automation?.classFeatureSelections).not.toHaveProperty("conduit.domain.1");

    const otherClass = { ...base, className: "Тактик", subclass: "Авангард" };
    expect(buildCharacter(otherClass).automation?.classFeatureSelections).not.toHaveProperty("conduit.domain.1");
  });
  it.each([
    "Неистовый",
    "Нуль",
    "Проводник",
    "Тактик",
    "Талант",
    "Тень",
    "Трубадур",
    "Цензор",
    "Элементалист",
  ])("can complete the full creation flow for %s", (className) => {
    const source = BUILDER_DATA.classes.find((c) => c.name === className)!;
    const draft = {
      ...emptyBuilderDraft(),
      name: "Тестовый герой",
      ancestry: "Дварф",
      traits: ["Заземленность", "Искра с твоей кожи"],
      culture: {
        environment: "Сельское",
        organization: "Общинная",
        upbringing: "Академическое",
      },
      career: "Солдат",
      incident: BUILDER_DATA.careers.find((c) => c.name === "Солдат")!
        .incidents[0],
      perkId: PERK_COMPENDIUM.find((p) => p.type === "exploration")!.id,
      className,
      subclass:
        className === "Проводник" ? "Жизнь, Защита" : source.subclasses[0].name,
      conduitDomainFeature: className === "Проводник" ? "Защита" : "",
      domain: className === "Цензор" ? "Жизнь" : "",
      characteristics: startingCharacteristics(className),
      featureChoices: Object.fromEntries(
        source.featureChoices.map((g) => [g.name, g.options[0].name]),
      ),
    };
    const slots = builderSkillSlots(draft);
    const used = new Set<string>();
    for (const [kind, field] of [
      ["culture", "cultureSkills"],
      ["career", "careerSkills"],
      ["class", "classSkills"],
    ] as const) {
      const groupSlots = slots[kind];
      const reserved = new Map<number, string>();
      // Fixed skills are reserved before any flexible slot is filled; a fixed
      // skill already owned by an earlier source becomes a replacement slot.
      groupSlots.forEach((s, index) => {
        if (s.fixed && !used.has(s.fixed)) {
          reserved.set(index, s.fixed);
          used.add(s.fixed);
        }
      });
      draft[field] = groupSlots.map((s, index) => {
        const fixed = reserved.get(index);
        if (fixed) return fixed;
        const pool = s.fixed ? ALL_CREATION_SKILLS : s.options;
        const value = pool.find((name) => !used.has(name))!;
        used.add(value);
        return value;
      });
    }
    if (canUseKit(className, draft.subclass)) draft.kit = "Гора";
    if (className === "Тактик") draft.secondaryKit = "Снайпер";
    const granted = grantedClassAbilities(draft);
    const available = ABILITY_COMPENDIUM.filter(
      (a) =>
        a.className === className &&
        a.level === 1 &&
        !granted.some((g) => g.id === a.id),
    );
    draft.abilityIds = [
      ...available
        .filter((a) => a.kind === "signature")
        .slice(0, CLASS_SIGNATURE_COUNTS[className]),
      ...[3, 5].flatMap((cost) =>
        available.filter((a) => a.resourceCost === cost).slice(0, 1),
      ),
      ...(className === "Проводник"
        ? available.filter((a) => a.name === "Слово Наставления")
        : []),
    ].map((a) => a.id);
    expect(builderIssues(draft).filter(Boolean)).toEqual([]);
    const hero = buildCharacter(draft);
    expect(hero.stamina.max).toBeGreaterThan(0);
    expect(hero.abilities.length).toBeGreaterThan(4);
    expect(hero.skills).toHaveLength(used.size);
  });
  it("composes a hero from choices, without mutating the draft or losing the seed identity", () => {
    const seed = createCharacter();
    const perk = PERK_COMPENDIUM.find((p) => p.type === "exploration")!;
    const draft = {
      ...emptyBuilderDraft(),
      name: "Дварф",
      ancestry: "Дварф",
      traits: ["Заземленность", "Искра с твоей кожи"],
      career: "Солдат",
      perkId: perk.id,
      className: "Тактик",
      characteristics: startingCharacteristics("Тактик"),
      kit: "Сияющие Доспехи",
      secondaryKit: "Снайпер",
      languages: "Кастильский, Дварфский, Кастильский",
      culture: {
        environment: "Городское",
        organization: "Общинная",
        upbringing: "Академическое",
      },
      cultureSkills: ["Обман", "Прыжки", "История"],
      careerSkills: ["Плавание", "Внимательность"],
    };
    const before = JSON.stringify(draft);
    const hero = buildCharacter(draft, seed);
    expect(hero.id).toBe(seed.id);
    expect(hero.stamina).toEqual({ current: 39, max: 39, temp: 0 }); // class 21 + kit 12 + ancestry 6
    expect(hero.stability).toBe("2");
    expect(hero.speed).toBe("6");
    expect(hero.disengage).toBe("2");
    expect(hero.renown).toBe("1");
    expect(hero.perks[0].perkId).toBe(perk.id);
    expect(hero.languages).toEqual(["Кастильский", "Дварфский"]);
    expect(
      hero.abilities.filter((a) => a.source.startsWith("Комплект:")),
    ).toHaveLength(2);
    expect(hero.skills).toContain("История");
    expect(JSON.stringify(draft)).toBe(before);
  });
  it.each([
    "Неистовый",
    "Нуль",
    "Проводник",
    "Тактик",
    "Талант",
    "Тень",
    "Трубадур",
    "Цензор",
    "Элементалист",
  ])("offers a valid default characteristic array for %s", (className) => {
    const draft = {
      ...emptyBuilderDraft(),
      className,
      characteristics: startingCharacteristics(className),
    };
    expect(validCharacteristicArray(draft)).toBe(true);
    draft.characteristics.might = 5;
    expect(validCharacteristicArray(draft)).toBe(false);
  });
  it("scales stamina by level and echelon, without stacking the two kits", () => {
    const hero = tactician();
    const advanced = recalculateCharacter(hero, { ...hero, level: 4 });
    expect(advanced.stamina.max).toBe(21 + 27 + 24 + 12);
    expect(advanced.stamina.current).toBe(hero.stamina.current); // changing a maximum does not heal
    expect(
      recalculateCharacter(advanced, { ...advanced, name: "Другое имя" })
        .stamina.max,
    ).toBe(84);
    expect([1, 3, 4, 6, 7, 9, 10].map(echelon)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });
  it("preserves manual numeric adjustments through kit and level changes", () => {
    const hero = tactician();
    const adjusted = recalculateCharacter(hero, {
      ...hero,
      speed: "8",
      stamina: { ...hero.stamina, max: 44 },
    });
    expect(adjusted.automation?.adjustments).toMatchObject({
      speed: 2,
      stamina: 5,
    });
    const advanced = recalculateCharacter(adjusted, {
      ...adjusted,
      level: 4,
      secondaryKit: "",
    });
    expect(advanced.speed).toBe("7");
    expect(advanced.stamina.max).toBe(89);
  });
  it("never retroactively calculates an existing manual sheet", () => {
    const manual = createCharacter({ className: "Тактик" });
    const next = recalculateCharacter(manual, {
      ...manual,
      kit: "Гора",
      level: 4,
    });
    expect(next.stamina.max).toBe(manual.stamina.max);
    expect(normalizeCharacter(next).automation).toBeUndefined();
  });
  it('removes previously selected ancestry bonuses when ancestry is changed', () => {
    const hero = tactician();
    const changed = recalculateCharacter(hero, { ...hero, ancestry: 'Человек' });
    expect(changed.stamina.max).toBe(33);
    expect(changed.stability).toBe('1');
    expect(changed.automation?.ancestryTraits).toEqual([]);
  });
  it('distinguishes melee and ranged weapon damage and adjusts both distance alternatives', () => {
    const hero = tactician();
    const ability = ABILITY_COMPENDIUM.find(a => a.name === 'Вдохновляющий Удар' && a.className === 'Тактик')!;
    const melee = evaluateAbilityDamage({ ...ability, weaponMode: 'melee' }, 1, hero);
    const ranged = evaluateAbilityDamage({ ...ability, weaponMode: 'ranged' }, 1, hero);
    expect(melee.values[0] - ranged.values[0]).toBe(2);
    expect(evaluateAbilityDamage(ability, 1, hero).display).toContain('(дал.)');
    expect(abilityDistance(ability, hero)).toBe('Ближний 1 или дальний 15');
  });
  it("applies kit damage to weapon attacks and not to magic or already included kit signatures", () => {
    const hero = tactician();
    const strike = hero.abilities.find(
      (a) => a.kind === "free-strike" && a.keywords.includes("Ближний"),
    )!;
    expect(evaluateAbilityDamage(strike, 1, hero).values).toEqual([6]);
    const signature = hero.abilities.find(
      (a) => a.source === "Комплект: Сияющие Доспехи",
    )!;
    expect(evaluateAbilityDamage(signature, 1, hero).values).toEqual(
      evaluateDamage(signature.tiers[0].damage, hero).values,
    );
    expect(
      evaluateAbilityDamage(
        { ...strike, keywords: ["Ближний", "Магия"] },
        1,
        hero,
      ).values,
    ).toEqual([4]);
    expect(
      abilityDistance(
        hero.abilities.find(
          (a) => a.kind === "free-strike" && a.keywords.includes("Дальний"),
        )!,
        hero,
      ),
    ).toBe("Дальний 15");
  });
  it("uses an entire chosen damage profile and adjusts embedded signature damage as in Field Arsenal", () => {
    const hero = buildCharacter({
      ...emptyBuilderDraft(),
      className: "Тактик",
      characteristics: startingCharacteristics("Тактик"),
      kit: "Мастер Боевых Искусств",
      secondaryKit: "Гора",
      meleeDamageKit: "Гора",
    });
    const ability = hero.abilities.find(
      (a) => a.source === "Комплект: Мастер Боевых Искусств",
    )!;
    expect(
      [1, 2, 3].map(
        (tier) => evaluateAbilityDamage(ability, tier, hero).values[0],
      ),
    ).toEqual([5, 8, 15]); // book 3/6/13 + Might 2
    expect(calculatedValues(hero).stamina).toBe(30); // highest kit stamina 9, not 3+9
  });
  it("replaces kit signatures exactly once while retaining class and custom abilities", () => {
    const hero = tactician();
    const classAbility = ABILITY_COMPENDIUM.find(
      (a) => a.className === "Тактик" && a.level === 1,
    )!;
    const next = changeKit(
      { ...hero, abilities: [...hero.abilities, classAbility] },
      "Гора",
    );
    expect(
      next.abilities.some((a) => a.source === "Комплект: Сияющие Доспехи"),
    ).toBe(false);
    expect(
      next.abilities.filter((a) => a.source === "Комплект: Гора"),
    ).toHaveLength(1);
    expect(next.abilities).toContain(classAbility);
    expect(changeKit(next, "Гора").abilities).toEqual(next.abilities);
  });
  it("preserves new choices across JSON export/import normalization", () => {
    const hero = tactician();
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(hero)));
    expect(restored.automation).toEqual(hero.automation);
    expect(restored.secondaryKit).toBe("Снайпер");
    expect(restored.abilities).toHaveLength(hero.abilities.length);
  });
  it("includes all existing translated ancestry, career and complication choices", () => {
    expect(BUILDER_DATA.ancestries).toHaveLength(14);
    expect(BUILDER_DATA.careers).toHaveLength(18);
    expect(BUILDER_DATA.complications).toHaveLength(100);
  });
});
