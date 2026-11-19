import { describe, expect, it } from "vitest";
import { missingClassFeatureAbilities } from "../src/lib/class-feature-abilities";
import { createCharacter } from "../src/lib/defaults";
import { previewGameAction } from "../src/lib/game-actions";

function canUse(className: string, subclass: string, level: number, selections: Record<string, string>, abilityId: string) {
  const character = {
    ...createCharacter({ className, level }),
    subclass,
    automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: selections },
  };
  return previewGameAction(character, { kind: "ability", abilityId, surges: 0, waiveCost: true }).ok;
}

describe("карточки, выданные особенностью класса", () => {
  it("даёт выступление только выбранному амплуа с пятого уровня", () => {
    const choice = { "troubadour.feature.5.avtor": "Дубль два!" };
    const card = "feature.ability.troubadour.level-5.take-two";
    expect(canUse("Трубадур", "Автор", 5, choice, card)).toBe(true);
    expect(canUse("Трубадур", "Автор", 4, choice, card)).toBe(false);
    expect(canUse("Трубадур", "Автор", 5, {}, card)).toBe(false);
    expect(canUse("Трубадур", "Дуэлянт", 5, choice, card)).toBe(false);
  });

  it("сохраняет карточку, ранее добавленную игроком с локальным ID", () => {
    const hero = {
      ...createCharacter({ className: "Трубадур", level: 5 }),
      subclass: "Дуэлянт",
      automation: { enabled: true, adjustments: {}, ancestryTraits: [],
        classFeatureSelections: { "troubadour.feature.5.duelyant": "Нас не затмить!" } },
    };
    const grants = missingClassFeatureAbilities(hero);
    expect(grants.map((card) => card.name)).toEqual(["Нас не Затмить!"]);
    const owned = { ...grants[0], id: "manual", effect: "Моё описание" };
    const saved = { ...hero, abilities: [owned] };
    expect(missingClassFeatureAbilities(saved)).toEqual([]);
    expect(saved.abilities).toEqual([owned]);
  });

  it("учитывает выбор домена на седьмом уровне и второй дар на восьмом", () => {
    const pair = "Любовь, Хитрость";
    const choice = { "conduit.domain.7": "Любовь" };
    expect(canUse("Проводник", pair, 7, choice, "feature.ability.conduit.level-7.guided-to-your-side")).toBe(true);
    const trinity = "feature.ability.conduit.level-7.trinity-of-trickery";
    expect(canUse("Проводник", pair, 7, choice, trinity)).toBe(false);
    expect(canUse("Проводник", pair, 8, choice, trinity)).toBe(true);
  });

  it("даёт карточку второго домена Проводника на следующем уровне", () => {
    const choice = { "conduit.domain.4": "Жизнь" };
    const card = "feature.ability.conduit.level-4.blessing-of-secrets";
    expect(canUse("Проводник", "Жизнь, Хитрость", 4, choice, card)).toBe(false);
    expect(canUse("Проводник", "Жизнь, Хитрость", 5, choice, card)).toBe(true);
  });
});
