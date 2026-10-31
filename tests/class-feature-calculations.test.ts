import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import {
  abilityDistance,
  calculatedValues,
  characterStatBreakdown,
  recalculateCharacter,
} from "../src/lib/character-calculations";
import {
  BUILDER_DATA,
  buildCharacter,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import {
  featureAbilityDamageContributions,
  featureAbilityDistanceBonus,
  featureStatBonus,
} from "../src/lib/feature-modifiers";
import { evaluateAbilityDamage, evaluateDamage } from "../src/lib/rules";
import type { Ability } from "../src/types";

/** Real builder choice labels, mapped to stable IDs by the registry helper. */
const DENSITY = { "Псионическая аугментация": "Аугментация плотности" };
const SPEED = { "Псионическая аугментация": "Аугментация скорости" };
const FORCE = { "Псионическая аугментация": "Аугментация силы" };
const DISTANCE = { "Псионическая аугментация": "Аугментация дистанции" };
const BASTION = { "Оберег проводника": "Оберег бастиона" };
const PRAYER_DISTANCE = { "Молитва": "Молитва о дистанции" };

function subclassOf(className: string): string {
  return (
    BUILDER_DATA.classes.find((entry) => entry.name === className)
      ?.subclasses[0]?.name ?? ""
  );
}

function talent(choices: Record<string, string>) {
  return buildCharacter({
    ...emptyBuilderDraft(),
    name: "Тестовый талант",
    className: "Талант",
    subclass: subclassOf("Талант"),
    characteristics: startingCharacteristics("Талант"),
    featureChoices: choices,
  });
}

function conduit(choices: Record<string, string>) {
  return buildCharacter({
    ...emptyBuilderDraft(),
    name: "Тестовый проводник",
    className: "Проводник",
    subclass: subclassOf("Проводник"),
    characteristics: startingCharacteristics("Проводник"),
    featureChoices: choices,
  });
}

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

function abilityNamed(name: string): Ability {
  const found = ABILITY_COMPENDIUM.find((entry) => entry.name === name);
  if (!found) throw new Error(`Нет способности «${name}» в справочнике`);
  return { ...found };
}

const PSIONIC_RANGED = () => abilityNamed("Изморозь"); // Псионика, Дальний, 2 + R
const MAGIC_RANGED = () => abilityNamed("Иссушение"); // Магия, Дальний, 3 + I
const PSIONIC_AREA = () => abilityNamed("Испепеление"); // Область, Псионика, Дальний, Куб 3
const PSIONIC_STRIKE = () => abilityNamed("Болевые Точки"); // Псионика, Оружие, Ближний 1
const DUAL_WEAPON = () => abilityNamed("Вдохновляющий Удар"); // Ближний 1 или дальний 5

function withKeyword(ability: Ability, keyword: string): Ability {
  return { ...ability, keywords: [...ability.keywords, keyword] };
}

describe("class feature stat integration", () => {
  it("adds density as Talent 24/stability 1 at level 1 and 48 at level 4", () => {
    const hero = talent(DENSITY);

    expect(hero.automation?.classFeatureSelections).toEqual({
      "talent.augmentation": "talent.augmentation.density",
    });
    expect(hero.stamina.max).toBe(24); // 18 class + 6 density
    expect(hero.stamina.current).toBe(24);
    expect(hero.stability).toBe("1");
    expect(featureStatBonus(hero, "stamina")).toBe(6);
    expect(calculatedValues(hero).stamina).toBe(24);

    const advanced = recalculateCharacter(hero, { ...hero, level: 4 });
    expect(advanced.stamina.max).toBe(48); // 36 class + 12 density
    expect(advanced.stamina.current).toBe(24); // a growing maximum never heals
    expect(advanced.stability).toBe("1");
    expect(calculatedValues(advanced).stability).toBe(1);
  });

  it("explains the saved stat from base, named features and manual adjustment", () => {
    const hero = talent(DENSITY);
    expect(characterStatBreakdown(hero, "stamina")).toEqual({
      base: 18,
      contributions: [
        {
          sourceId: "feature.talent.level-1.density-augmentation",
          sourceName: "Аугментация плотности",
          value: 6,
        },
      ],
      adjustment: 0,
      total: 24,
    });
    expect(characterStatBreakdown(hero, "stability")).toEqual({
      base: 0,
      contributions: [
        {
          sourceId: "feature.talent.level-1.density-augmentation",
          sourceName: "Аугментация плотности",
          value: 1,
        },
      ],
      adjustment: 0,
      total: 1,
    });
    expect(characterStatBreakdown(hero, "speed").total).toBe(
      calculatedValues(hero).speed,
    );
    expect(characterStatBreakdown(hero, "disengage").total).toBe(
      calculatedValues(hero).disengage,
    );
    expect(characterStatBreakdown(hero, "recoveries").total).toBe(
      calculatedValues(hero).recoveries,
    );
  });

  it("removes the former contribution when the option changes, without healing", () => {
    const hero = talent(DENSITY);
    const advanced = recalculateCharacter(hero, { ...hero, level: 4 });
    expect(advanced.stamina.max).toBe(48);

    const changed = recalculateCharacter(advanced, {
      ...advanced,
      automation: {
        ...advanced.automation!,
        classFeatureSelections: { "talent.augmentation": "talent.augmentation.speed" },
      },
    });

    expect(changed.stamina.max).toBe(36); // density bonus is gone
    expect(changed.stamina.current).toBe(24); // current is not healed
    expect(changed.stability).toBe("0");
    expect(changed.speed).toBe("6");
    expect(changed.disengage).toBe("2");
    expect(featureStatBonus(changed, "stamina")).toBe(0);
    expect(characterStatBreakdown(changed, "stamina").contributions).toEqual([]);
  });

  it("keeps manual adjustments separate while feature bonuses change", () => {
    const hero = talent(DENSITY);
    const adjusted = recalculateCharacter(hero, {
      ...hero,
      stamina: { ...hero.stamina, max: 34 },
    });
    expect(adjusted.automation?.adjustments.stamina).toBe(10); // 34 − calculated 24
    expect(adjusted.stamina.max).toBe(34);

    const advanced = recalculateCharacter(adjusted, {
      ...adjusted,
      level: 4,
    });

    expect(advanced.stamina.max).toBe(58); // 36 base + 12 density + 10 manual
    expect(advanced.stamina.current).toBe(24);
    expect(advanced.automation?.adjustments.stamina).toBe(10);
    expect(characterStatBreakdown(advanced, "stamina")).toEqual({
      base: 36,
      contributions: [
        {
          sourceId: "feature.talent.level-1.density-augmentation",
          sourceName: "Аугментация плотности",
          value: 12,
        },
      ],
      adjustment: 10,
      total: 58,
    });
    expect(recalculateCharacter(advanced, { ...advanced, name: "Другое имя" }).stamina.max).toBe(58);
  });

  it("clears stale selections on a class change unless the recipe replaces them", () => {
    const hero = talent(DENSITY);
    expect(hero.stamina.max).toBe(24);

    const switched = recalculateCharacter(hero, { ...hero, className: "Нуль" });
    expect(switched.automation?.classFeatureSelections).toEqual({});
    expect(featureStatBonus(switched, "stamina")).toBe(0);
    expect(switched.stamina.max).toBe(21); // Нуль class base only
    expect(switched.stamina.current).toBe(21);
    expect(switched.stability).toBe("0");

    const replaced = recalculateCharacter(hero, {
      ...hero,
      className: "Нуль",
      automation: {
        ...hero.automation!,
        classFeatureSelections: {
          "null.augmentation": "null.augmentation.speed",
        },
      },
    });
    expect(replaced.automation?.classFeatureSelections).toEqual({
      "null.augmentation": "null.augmentation.speed",
    });
    expect(replaced.speed).toBe("6");
    expect(replaced.disengage).toBe("2");
    expect(replaced.stamina.max).toBe(21); // no Talent density anymore
  });

  it("invalidates stale selections on a class change even while automation is off", () => {
    const hero = talent(DENSITY);
    const off = recalculateCharacter(hero, {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    });
    expect(off.automation?.classFeatureSelections).toEqual({
      "talent.augmentation": "talent.augmentation.density",
    });
    expect(off.stamina).toEqual(hero.stamina); // a disabled sheet keeps its numbers
    expect(off.stability).toBe("1");

    const nulled = recalculateCharacter(off, { ...off, className: "Нуль" });
    expect(nulled.automation?.classFeatureSelections).toEqual({});
    expect(nulled.stamina).toEqual(hero.stamina);
    expect(nulled.stability).toBe("1");

    const restored = recalculateCharacter(nulled, {
      ...nulled,
      className: "Талант",
    });
    expect(restored.automation?.classFeatureSelections).toEqual({});

    const on = recalculateCharacter(restored, {
      ...restored,
      automation: { ...restored.automation!, enabled: true },
    });
    expect(on.automation?.classFeatureSelections).toEqual({}); // nothing resurrects
    expect(featureStatBonus(on, "stamina")).toBe(0);
    expect(on.stamina.max).toBe(18);
    expect(on.stamina.current).toBe(18);
    expect(on.stability).toBe("0");
  });

  it("keeps selections explicitly replaced in the same disabled operation", () => {
    const hero = talent(DENSITY);
    const off = recalculateCharacter(hero, {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    });
    const replaced = recalculateCharacter(off, {
      ...off,
      className: "Нуль",
      automation: {
        ...off.automation!,
        classFeatureSelections: {
          "null.augmentation": "null.augmentation.speed",
        },
      },
    });
    expect(replaced.automation?.classFeatureSelections).toEqual({
      "null.augmentation": "null.augmentation.speed",
    });
    expect(replaced.stamina).toEqual(hero.stamina);
  });

  it("ignores foreign-class and disabled selections", () => {
    const hero = talent(DENSITY);
    const foreign = { ...hero, className: "Проводник" };
    expect(featureStatBonus(foreign, "stamina")).toBe(0);
    expect(calculatedValues(foreign).stamina).toBe(18);
    expect(characterStatBreakdown(foreign, "stamina")).toEqual({
      base: 18,
      contributions: [],
      adjustment: 0,
      total: 18,
    });

    const disabled = {
      ...hero,
      automation: { ...hero.automation!, enabled: false },
    };
    expect(featureStatBonus(disabled, "stamina")).toBe(0);
    expect(calculatedValues(disabled).stamina).toBe(18);
    expect(characterStatBreakdown(disabled, "stamina").contributions).toEqual([]);
  });

  it("leaves existing manual sheets untouched", () => {
    const manual = {
      ...createCharacter({ className: "Талант" }),
      stamina: { current: 20, max: 50, temp: 0 },
    };
    const next = recalculateCharacter(manual, { ...manual, level: 4 });
    expect(next.stamina.max).toBe(50);
    expect(next.stamina.current).toBe(20);
    expect(next.automation).toBeUndefined();
  });

  it("exposes the save bonus without folding it into saved maxima", () => {
    const hero = conduit(BASTION);
    expect(featureStatBonus(hero, "save")).toBe(1);
    expect(calculatedValues(hero)).not.toHaveProperty("save");
  });
});

describe("class feature damage integration", () => {
  it("adds the force augmentation to matching psionic rolled damage only", () => {
    const hero = talent(FORCE);
    const psionic = PSIONIC_RANGED();
    const magic = MAGIC_RANGED();

    expect(featureAbilityDamageContributions(psionic, hero)).toEqual([
      {
        sourceId: "feature.talent.level-1.force-augmentation",
        sourceName: "Аугментация силы",
        value: 1,
      },
    ]);

    const boosted = evaluateAbilityDamage(psionic, 1, hero);
    const plain = evaluateDamage(psionic.tiers[0].damage, hero);
    expect(boosted.values).toEqual(plain.values.map((value) => value + 1));
    expect(boosted.breakdown).toContain("Аугментация силы");

    const untouched = evaluateAbilityDamage(magic, 1, hero);
    expect(featureAbilityDamageContributions(magic, hero)).toEqual([]);
    expect(untouched.values).toEqual(
      evaluateDamage(magic.tiers[0].damage, hero).values,
    );
    expect(untouched.breakdown).not.toContain("Аугментация силы");
  });

  it("applies once to a matching weapon ability and never to a no-roll ability", () => {
    const hero = talent(FORCE);
    const strike = PSIONIC_STRIKE(); // Псионика + Оружие, no kit on this hero
    const boosted = evaluateAbilityDamage(strike, 1, hero);
    const plain = evaluateDamage(strike.tiers[0].damage, hero);
    expect(boosted.values).toEqual(plain.values.map((value) => value + 1));
    expect(boosted.values[0] - plain.values[0]).toBe(1); // exactly once

    const noRoll: Ability = { ...PSIONIC_RANGED(), rollCharacteristics: [] };
    expect(featureAbilityDamageContributions(noRoll, hero)).toEqual([]);
    const evaluated = evaluateAbilityDamage(noRoll, 1, hero);
    expect(evaluated.values).toEqual(
      evaluateDamage(noRoll.tiers[0].damage, hero).values,
    );
    expect(evaluated.display).toBe(
      evaluateDamage(noRoll.tiers[0].damage, hero).display,
    );
  });

  it("keeps dice expressions and dual-mode handling with the feature applied per mode", () => {
    const kit = {
      kit: "Сияющие Доспехи",
      secondaryKit: "Снайпер",
      meleeDamageKit: "Сияющие Доспехи",
      rangedDamageKit: "Снайпер",
    };
    // The kit makes melee and ranged displays differ, so dual-mode keeps both.
    const hero = { ...talent(FORCE), ...kit };
    const plainHero = { ...talent({}), ...kit };
    const mercy = withKeyword(abilityNamed("Удар Милосердия"), "Псионика");
    const melee = evaluateAbilityDamage({ ...mercy, weaponMode: "melee" }, 1, hero);
    const ranged = evaluateAbilityDamage({ ...mercy, weaponMode: "ranged" }, 1, hero);
    const plainMelee = evaluateAbilityDamage(
      { ...mercy, weaponMode: "melee" },
      1,
      plainHero,
    );
    const plainRanged = evaluateAbilityDamage(
      { ...mercy, weaponMode: "ranged" },
      1,
      plainHero,
    );
    const dual = evaluateAbilityDamage(mercy, 1, hero);

    expect(melee.dice).toEqual(["2d6"]);
    expect(melee.values).toEqual(plainMelee.values.map((value) => value + 1));
    expect(ranged.values).toEqual(plainRanged.values.map((value) => value + 1));
    expect(dual.values).toEqual([...melee.values, ...ranged.values]);
    expect(dual.display).toBe(`${melee.display} (бл.) · ${ranged.display} (дал.)`);
  });

  it("keeps kit damage and included signature subtraction unchanged", () => {
    const hero = tactician();
    const strike = hero.abilities.find(
      (entry) => entry.kind === "free-strike" && entry.keywords.includes("Ближний"),
    )!;
    const signature = hero.abilities.find(
      (entry) => entry.source === "Комплект: Сияющие Доспехи",
    )!;
    const dual = DUAL_WEAPON();

    expect(evaluateAbilityDamage(strike, 1, hero).values).toEqual([6]);
    expect(evaluateAbilityDamage(signature, 1, hero).values).toEqual(
      evaluateDamage(signature.tiers[0].damage, hero).values,
    );
    expect(
      evaluateAbilityDamage({ ...dual, weaponMode: "melee" }, 1, hero).values[0] -
        evaluateAbilityDamage({ ...dual, weaponMode: "ranged" }, 1, hero).values[0],
    ).toBe(2);
    expect(abilityDistance(dual, hero)).toBe("Ближний 1 или дальний 15");
  });
});

describe("class feature distance integration", () => {
  it("extends each ranged alternative of a matching psionic ability", () => {
    const hero = talent(DISTANCE);
    const psionic = PSIONIC_RANGED();

    expect(featureAbilityDistanceBonus(psionic, hero)).toBe(2);
    expect(abilityDistance(psionic, hero)).toBe("Дальний 12"); // 10 + 2

    const magic = MAGIC_RANGED();
    expect(featureAbilityDistanceBonus(magic, hero)).toBe(0);
    expect(abilityDistance(magic, hero)).toBe("Дальний 10");
  });

  it("moves an area's placement range without stretching its size", () => {
    const hero = talent(DISTANCE);
    const area = PSIONIC_AREA(); // Испепеление: Куб 3 в пределах 10
    expect(featureAbilityDistanceBonus(area, hero)).toBe(2);
    expect(abilityDistance(area, hero)).toBe("Куб 3 в пределах 12");
    expect(abilityDistance(area, hero)).not.toContain("Куб 5");

    const wall = abilityNamed("Ледяная Стена"); // Стена 10 в пределах 10, Псионика + Дальний
    expect(featureAbilityDistanceBonus(wall, hero)).toBe(2);
    expect(abilityDistance(wall, hero)).toBe("Стена 10 в пределах 12");
  });

  it("moves a magic line or wall placement range by the prayer bonus", () => {
    const hero = conduit(PRAYER_DISTANCE);
    const line = abilityNamed("Натиск Духов"); // Линия 10 x 2 в пределах 5, Магия + Дальний
    expect(featureAbilityDistanceBonus(line, hero)).toBe(2);
    expect(abilityDistance(line, hero)).toBe("Линия 10 x 2 в пределах 7");

    const wall = abilityNamed("Стена Огня"); // Стена 10 в пределах 10, Магия + Дальний
    expect(abilityDistance(wall, hero)).toBe("Стена 10 в пределах 12");

    const talentOnly = talent(DISTANCE); // Псионика + Дальний
    expect(featureAbilityDistanceBonus(wall, talentOnly)).toBe(0);
    expect(abilityDistance(wall, talentOnly)).toBe("Стена 10 в пределах 10");
  });

  it("leaves areas without a matching ranged keyword and self ranges alone", () => {
    const hero = conduit(PRAYER_DISTANCE);
    const noRangedKeyword = abilityNamed("Повелитель Молний"); // Три линии 10 x 1 в пределах 1, Магия без Дальний
    expect(featureAbilityDistanceBonus(noRangedKeyword, hero)).toBe(0);
    expect(abilityDistance(noRangedKeyword, hero)).toBe(noRangedKeyword.distance);

    const selfHero = talent(DISTANCE);
    const self = withKeyword(abilityNamed("Инерционный Щит"), "Дальний"); // На себя, Псионика
    expect(featureAbilityDistanceBonus(self, selfHero)).toBe(2);
    expect(abilityDistance(self, selfHero)).toBe("На себя");
  });

  it("moves a weapon area's placement range only outside a selected melee mode", () => {
    const hero = talent(DISTANCE);
    // Куб 2 в пределах 1, Магия + Оружие + Ближний на печати
    const weaponArea = withKeyword(
      withKeyword(abilityNamed("Назад, Богохульник!"), "Псионика"),
      "Дальний",
    );
    expect(abilityDistance({ ...weaponArea, weaponMode: "melee" }, hero)).toBe(
      "Куб 2 в пределах 1",
    );
    expect(abilityDistance({ ...weaponArea, weaponMode: "ranged" }, hero)).toBe(
      "Куб 2 в пределах 3",
    );
  });

  it("applies the range bonus once when a line prints both a range and a placement range", () => {
    const hero = talent(DISTANCE);
    const ambiguous = { ...PSIONIC_RANGED(), distance: "Дальний 10 в пределах 5" };
    expect(abilityDistance(ambiguous, hero)).toBe("Дальний 12 в пределах 5");
  });

  it("keeps the melee alternative when a ranged mode is added", () => {
    const hero = talent(DISTANCE);
    const dual = withKeyword(DUAL_WEAPON(), "Псионика");

    expect(featureAbilityDistanceBonus({ ...dual, weaponMode: "melee" }, hero)).toBe(0);
    expect(abilityDistance({ ...dual, weaponMode: "melee" }, hero)).toBe(
      "Ближний 1 или дальний 5",
    );
    expect(abilityDistance({ ...dual, weaponMode: "ranged" }, hero)).toBe(
      "Ближний 1 или дальний 7",
    );
    expect(abilityDistance(dual, hero)).toBe("Ближний 1 или дальний 7");
  });

  it("keeps the kit distance bonus for weapon abilities", () => {
    const hero = tactician();
    const ranged = hero.abilities.find(
      (entry) => entry.kind === "free-strike" && entry.keywords.includes("Дальний"),
    )!;
    expect(abilityDistance(ranged, hero)).toBe("Дальний 15");
  });
});
