import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import {
  isSubclassAbility,
  subclassAbilitySource,
  subclassAbilitySources,
} from "../src/lib/ability-origin";
import { abilityFilterOptions } from "../src/lib/ability-sheet-groups";
import type { Ability, Character } from "../src/types";

function withDomain(
  hero: Character,
  group: "censor.domain" | "conduit.domain",
  domain: string,
): Character {
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: { [group]: domain },
  };
  return hero;
}

function censor(level: number, domain?: string): Character {
  const hero = createCharacter({ className: "Цензор", level });
  hero.subclass = "Идеал";
  return domain ? withDomain(hero, "censor.domain", domain) : hero;
}

function conduit(level: number, domains?: string): Character {
  const hero = createCharacter({ className: "Проводник", level });
  return domains ? withDomain(hero, "conduit.domain", domains) : hero;
}

function talent(level: number, subclass: string): Character {
  const hero = createCharacter({ className: "Талант", level });
  hero.subclass = subclass;
  return hero;
}

function ability(partial: Partial<Ability> & Pick<Ability, "name">): Ability {
  return {
    id: "legacy",
    flavor: "",
    actionType: "main",
    kind: "other",
    keywords: [],
    distance: "",
    target: "",
    rollCharacteristics: [],
    preferredCharacteristic: "",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [],
    effect: "",
    source: "",
    notes: "",
    ...partial,
  };
}

describe("происхождение способностей из подкласса", () => {
  it("находит доменную способность Цензора 1-го уровня", () => {
    const sources = subclassAbilitySources(censor(1, "Созидание"));
    const source = sources.get("cenzor-ruki-tvorca-3425397e10");
    expect(source).toMatchObject({
      label: "Домен",
      value: "Созидание",
      text: "Домен · Созидание",
    });
  });

  it("понимает id варианта домена, который сохраняет панель листа", () => {
    const sources = subclassAbilitySources(censor(1, "censor.domain.sozdanie"));
    expect(sources.get("cenzor-ruki-tvorca-3425397e10")).toMatchObject({
      value: "Созидание",
    });
  });

  it("не выдаёт доменные способности без выбранного домена", () => {
    const sources = subclassAbilitySources(censor(3));
    expect(sources.size).toBe(0);
  });

  it("не подставляет орден Цензора вместо домена", () => {
    const hero = censor(1);
    hero.subclass = "Идеал";
    expect(subclassAbilitySources(hero).size).toBe(0);
  });

  it("находит обе доменные способности Проводника по паре доменов", () => {
    const sources = subclassAbilitySources(conduit(2, "Созидание, Смерть"));
    expect(sources.get("provodnik-statuya-sily-d2ae69a37f")).toMatchObject({
      label: "Домен",
      value: "Созидание",
    });
    expect(sources.get("provodnik-zhatva-e3bad0fcb0")).toMatchObject({
      label: "Домен",
      value: "Смерть",
    });
  });

  it("берёт пару доменов Проводника из подкласса, если выбора нет", () => {
    const hero = conduit(2);
    hero.subclass = "Созидание, Смерть";
    const sources = subclassAbilitySources(hero);
    expect(sources.has("provodnik-statuya-sily-d2ae69a37f")).toBe(true);
  });

  it("не добавляет способности выше текущего уровня", () => {
    const sources = subclassAbilitySources(conduit(1, "Созидание"));
    expect(sources.has("provodnik-statuya-sily-d2ae69a37f")).toBe(false);
    // На 1-м уровне у Созидания есть доменная способность «Руки Творца».
    expect(sources.get("provodnik-ruki-tvorca-b0ff1e66a7")).toMatchObject({
      label: "Домен",
      value: "Созидание",
    });
  });

  it("находит способность Таланта, выданную традицией", () => {
    const sources = subclassAbilitySources(talent(8, "Телекинез"));
    expect(sources.get("talant-pole-levitacii-c51c097676")).toMatchObject({
      label: "Традиция",
      value: "Телекинез",
    });
    expect(sources.has("talant-stazisnyy-schit-b4f19a14ce")).toBe(false);
  });

  it("не подмешивает способности другой традиции", () => {
    const sources = subclassAbilitySources(talent(8, "Хронопатия"));
    expect(sources.get("talant-stazisnyy-schit-b4f19a14ce")).toMatchObject({
      label: "Традиция",
      value: "Хронопатия",
    });
    expect(sources.has("talant-pole-levitacii-c51c097676")).toBe(false);
  });

  it("находит старую карточку по названию и источнику, если id не совпал", () => {
    const sources = subclassAbilitySources(censor(1, "Созидание"));
    const legacy = ability({ name: "Руки Творца", source: "Цензор" });
    expect(subclassAbilitySource(sources, legacy)).toMatchObject({
      value: "Созидание",
    });
    expect(isSubclassAbility(sources, legacy)).toBe(true);
  });

  it("добавляет фильтр «Подкласс» со счётчиком", () => {
    const hero = censor(1, "Созидание");
    const sources = subclassAbilitySources(hero);
    const options = abilityFilterOptions(
      [
        ability({ name: "Руки Творца", source: "Цензор", id: "cenzor-ruki-tvorca-3425397e10" }),
        ability({ name: "Обычная", source: "Цензор" }),
      ],
      sources,
    );
    expect(options.find((option) => option.key === "subclass")).toMatchObject({
      label: "Подкласс",
      count: 1,
    });
  });
});
