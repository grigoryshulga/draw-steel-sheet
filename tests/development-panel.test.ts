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
      choices,
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
    // Выборы используют те же карточки, что и лист.
    expect(html).toContain("sheet-ability-card");
    expect(html).toContain("sheet-perk-card");
    expect(html).toContain('data-type="');
    expect(html).toContain("Повысить уровень");
  });

  it("показывает автоматические награды внутри следующего уровня перед выборами", () => {
    const html = render(hero());
    const next = html.indexOf('data-status="next"');
    const applied = html.indexOf('data-status="applied"');
    expect(next).toBeGreaterThanOrEqual(0);
    expect(applied).toBeGreaterThan(next);
    const nextSection = html.slice(next, applied);
    expect(nextSection).toContain("3-й уровень");
    expect(nextSection).toMatch(/Получите автоматически.*sheet-passive-card.*Выбор способности/s);
    expect(html).not.toContain("Сводка повышения");
    expect(html).not.toContain("Текст особенности");
  });

  it("показывает сохранённые выборы полученных уровней и раскрывает последний", () => {
    const html = render(advancedHero());
    expect(html).toContain("3-й уровень");
    expect(html).toContain("4-й уровень");
    // Последний полученный уровень раскрыт, более ранние свёрнуты.
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
    // Текущие выборы видны как выбранные карточки, а не пустые шаги.
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("is-selected");
    expect(html).toContain("1/1");
  });
});
