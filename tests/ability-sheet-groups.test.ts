import { describe, expect, it } from "vitest";
import {
  BASIC_ABILITY_SOURCE,
  abilityActionGroups,
  abilityFilterOptions,
  filterAbilitiesForSheet,
  matchesAbilityQuery,
  sheetAbilityLayout,
  sortAbilitiesForSheet,
} from "../src/lib/ability-sheet-groups";
import type { Ability } from "../src/types";

let counter = 0;

function ability(partial: Partial<Ability> & Pick<Ability, "name">): Ability {
  counter += 1;
  return {
    id: `ability-${counter}`,
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

const signature = ability({ name: "Знаковая", kind: "signature" });
const heroic = ability({ name: "Героическая", kind: "heroic", resourceCost: 3 });
const freeStrike = ability({ name: "Свободный удар", kind: "free-strike" });
const basicStrike = ability({
  name: "Базовый удар",
  kind: "free-strike",
  source: BASIC_ABILITY_SOURCE,
});
const other = ability({ name: "Другая" });
const basicManeuver = ability({
  name: "Базовый маневр",
  actionType: "maneuver",
  source: BASIC_ABILITY_SOURCE,
});

describe("способности на листе: сортировка и фильтры", () => {
  it("ставит знаковые и героические выше, а базовые — в конец", () => {
    const sorted = sortAbilitiesForSheet([
      basicStrike,
      other,
      freeStrike,
      heroic,
      signature,
    ]);
    expect(sorted.map((item) => item.name)).toEqual([
      "Знаковая",
      "Героическая",
      "Свободный удар",
      "Другая",
      "Базовый удар",
    ]);
  });

  it("сохраняет порядок добавления внутри одного вида", () => {
    const first = ability({ name: "Первая", kind: "signature" });
    const second = ability({ name: "Вторая", kind: "signature" });
    expect(sortAbilitiesForSheet([first, second]).map((item) => item.name)).toEqual([
      "Первая",
      "Вторая",
    ]);
  });

  it("фильтрует по виду, базовым и «все»", () => {
    const all = [signature, heroic, freeStrike, basicStrike, other];
    expect(filterAbilitiesForSheet(all, "all")).toHaveLength(5);
    expect(filterAbilitiesForSheet(all, "heroic").map((item) => item.name)).toEqual([
      "Героическая",
    ]);
    expect(
      filterAbilitiesForSheet(all, "basic").map((item) => item.name),
    ).toEqual(["Базовый удар"]);
    // Базовый удар остаётся свободным ударом по виду — фильтр вида его включает.
    expect(filterAbilitiesForSheet(all, "free-strike")).toHaveLength(2);
  });

  it("показывает «Все» и только непустые категории со счётчиками", () => {
    const options = abilityFilterOptions([
      signature,
      heroic,
      freeStrike,
      basicStrike,
      other,
    ]);
    expect(options.map((option) => option.key)).toEqual([
      "all",
      "signature",
      "heroic",
      "free-strike",
      "other",
      "basic",
    ]);
    expect(options[0]).toMatchObject({ label: "Все", count: 5 });
    expect(options.find((option) => option.key === "heroic")?.count).toBe(1);
  });

  it("не предлагает фильтр для пустой категории", () => {
    const options = abilityFilterOptions([signature]);
    expect(options.map((option) => option.key)).toEqual(["all", "signature"]);
  });

  it("строит секции по типу действия, пропуская пустые", () => {
    const groups = abilityActionGroups([
      basicManeuver,
      signature,
      heroic,
    ]);
    expect(groups.map((group) => group.key)).toEqual(["main", "maneuver"]);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });

  it("собирает раскладку: фильтр, сортировка и секции", () => {
    const layout = sheetAbilityLayout(
      [basicStrike, heroic, signature, freeStrike],
      "all",
    );
    expect(layout.visible).toBe(4);
    expect(layout.groups).toHaveLength(1);
    expect(layout.groups[0].items.map((item) => item.name)).toEqual([
      "Знаковая",
      "Героическая",
      "Свободный удар",
      "Базовый удар",
    ]);
  });

  it("поднимает совпадения в названии выше совпадений в тексте", () => {
    const inName = ability({ name: "Огонь", effect: "" });
    const inText = ability({ name: "Тихий", effect: "огонь" });
    const none = ability({ name: "Лёд" });
    const sorted = sortAbilitiesForSheet([inText, none, inName], "огонь");
    expect(sorted.map((item) => item.name)).toEqual(["Огонь", "Тихий", "Лёд"]);
  });

  it("ищет по заметкам, тирам и русским подписям типа", () => {
    const withNote = ability({ name: "Заметка", notes: "очищающий огонь" });
    const withTier = ability({
      name: "Тир",
      tiers: [{ damage: "5", effect: "цель горит" }],
    });
    const heroicCard = ability({ name: "Карта", kind: "heroic" });
    expect(
      sortAbilitiesForSheet([withNote, withTier, heroicCard], "огонь")[0].name,
    ).toBe("Заметка");
    expect(sortAbilitiesForSheet([withNote, withTier], "горит")[0].name).toBe(
      "Тир",
    );
    expect(sortAbilitiesForSheet([withNote, heroicCard], "героическая")[0].name).toBe(
      "Карта",
    );
  });

  it("требует все слова запроса и игнорирует ё/е", () => {
    const target = ability({ name: "Ледяной Огонь", effect: "урон" });
    expect(matchesAbilityQuery(target, "лед огонь")).toBe(true);
    expect(matchesAbilityQuery(target, "огонь урон")).toBe(true);
    expect(matchesAbilityQuery(target, "огонь молния")).toBe(false);
  });

  it("выносит совпадения в отдельный список наверху", () => {
    const layout = sheetAbilityLayout(
      [
        ability({ name: "Огонь" }),
        ability({ name: "Тихий", effect: "огонь" }),
        ability({ name: "Лёд" }),
      ],
      "all",
      "огонь",
    );
    expect(layout.visible).toBe(3);
    expect(layout.topMatches.map((item) => item.name)).toEqual([
      "Огонь",
      "Тихий",
    ]);
    expect(layout.groups.flatMap((group) => group.items).map((item) => item.name)).toEqual([
      "Лёд",
    ]);
  });
});
