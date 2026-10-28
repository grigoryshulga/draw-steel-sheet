import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DevelopmentPanel } from "../src/views/sheet/DevelopmentPanel";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import type { Character } from "../src/types";

function hero(): Character {
  return {
    ...buildCharacter({
      ...emptyBuilderDraft(),
      name: "Герой развития",
      ancestry: "Дварф",
      className: "Талант",
      subclass: "Хронопатия",
      characteristics: startingCharacteristics("Талант"),
      classSkills: [],
      abilityIds: [],
      featureChoices: {},
    }),
    level: 2,
    xp: 400,
  };
}

function render(character: Character): string {
  // Панели нужен только герой и запись изменений; остальное — заглушки,
  // потому что вкладка ничего не пишет сама.
  const context = {
    character,
    update: () => {},
    patch: () => {},
    performGameAction: () => false,
    undoGameAction: () => {},
    gameHistory: [],
    saveStatus: "saved",
    notify: () => {},
    goTo: () => {},
  } as unknown as AppContextValue;
  return renderToStaticMarkup(
    createElement(
      AppContext.Provider,
      { value: context },
      createElement(DevelopmentPanel),
    ),
  );
}

describe("вкладка «Развитие»", () => {
  it("раскладывает уровни по секциям и показывает шаги", () => {
    const html = render(hero());
    expect(html).toContain("Развитие");
    expect(html).toContain("1-й уровень");
    expect(html).toContain("2-й уровень");
    expect(html).toContain("3-й уровень");
    expect(html).toContain("Создание");
    expect(html).toContain("Получен");
    expect(html).toContain("Следующий");
    expect(html).toContain("Выбор перка");
    expect(html).toContain("Выбор способности");
    expect(html).toContain("Способ повышения");
    expect(html).toContain("Сохранить");
  });

  it("рисует особенности класса внутри секции уровня", () => {
    const html = render(hero());
    expect(html).toContain("cf-item");
  });
});
