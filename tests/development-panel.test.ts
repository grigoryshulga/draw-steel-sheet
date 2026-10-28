import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DevelopmentPanel } from "../src/views/sheet/DevelopmentPanel";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { getLevelUpPlan, previewLevelUp } from "../src/lib/level-up";
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

/** Герой с записями повышений: уровни 2 и 3 уже получены. */
function advancedHero(): Character {
  let current = hero();
  for (let step = 0; step < 2; step += 1) {
    const plan = getLevelUpPlan(current);
    if (!plan.available) throw new Error(plan.reason ?? "level up unavailable");
    const choices: Record<string, string[]> = {};
    for (const choice of plan.choices) {
      choices[choice.id] = choice.options
        .slice(0, choice.count)
        .map((option) => option.id);
    }
    const result = previewLevelUp(current, {
      characterId: current.id,
      fromLevel: current.level,
      className: current.className,
      subclass: current.subclass ?? "",
      mode: "milestone",
      choices,
      reviewedRules: true,
    });
    if (!result.ok) throw new Error(result.issues.join("; "));
    current = result.next;
  }
  return current;
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

  it("показывает сохранённые выборы полученных уровней и раскрывает последний", () => {
    const html = render(advancedHero());
    expect(html).toContain("3-й уровень");
    expect(html).toContain("4-й уровень");
    // Последний полученный уровень раскрыт, более ранние свёрнуты.
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
    // Текущие выборы видны как выбранные карточки, а не пустые шаги.
    expect(html).toContain("Выбрано");
    expect(html).toContain("1/1");
  });
});
