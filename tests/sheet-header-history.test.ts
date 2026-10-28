import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderPanel } from "../src/views/sheet/HeaderPanel";
import { GameHistory } from "../src/views/sheet/GameHistory";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { createCharacter } from "../src/lib/defaults";
import type { GameHistoryEntry } from "../src/lib/game-actions";
import type { Character } from "../src/types";

function censor(): Character {
  const hero = createCharacter({ className: "Цензор", level: 2 });
  hero.subclass = "Идеал";
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    classFeatureSelections: { "censor.domain": "Война" },
  };
  return hero;
}

function context(character: Character, gameHistory: GameHistoryEntry[] = []) {
  return {
    character,
    update: () => {},
    patch: () => {},
    performGameAction: () => false,
    undoGameAction: () => {},
    gameHistory,
    saveStatus: "saved",
    saveError: "",
    notify: () => {},
    goTo: () => {},
  } as unknown as AppContextValue;
}

function render(node: ReturnType<typeof createElement>, value: AppContextValue) {
  return renderToStaticMarkup(
    createElement(AppContext.Provider, { value }, node),
  );
}

describe("шапка героя", () => {
  it("показывает домен компактным чипом в строке идентичности", () => {
    const html = render(createElement(HeaderPanel), context(censor()));
    expect(html).toContain("sheet-domain-chip");
    expect(html).toContain("Домен");
    expect(html).toContain("Война");
    expect(html).toContain('aria-haspopup="menu"');
    // Отдельного блока с полем выбора в шапке больше нет.
    expect(html).not.toContain("sheet-header-domains");
    expect(html).not.toContain("sheet-domain-choice");
  });
});

describe("журнал действий", () => {
  const entry: GameHistoryEntry = {
    id: "entry-1",
    characterId: "",
    label: "Отдых",
    detail: "Восстановлены выносливость и ресурс",
    at: Date.now(),
    undone: false,
    changes: [],
    limits: { stamina: 10, recoveries: 3, resource: 5 },
  };

  it("в поп-апе показывает журнал и управление раундом", () => {
    const hero = censor();
    const html = render(
      createElement(GameHistory, { turnControls: true }),
      context(hero, [{ ...entry, characterId: hero.id }]),
    );
    expect(html).toContain("Отдых");
    expect(html).toContain("Отменить");
    expect(html).toContain("Раунд");
    expect(html).toContain("Новый раунд");
    expect(html).toContain("Новая схватка");
  });

  it("без действий показывает подсказку", () => {
    const html = render(createElement(GameHistory), context(censor()));
    expect(html).toContain("game-history-empty");
  });
});
