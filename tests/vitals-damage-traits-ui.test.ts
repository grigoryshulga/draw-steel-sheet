import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { deriveStats } from "../src/lib/rules";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { VitalsPanel } from "../src/views/sheet/VitalsPanel";
import type { Character } from "../src/types";

function render(character: Character): string {
  const value = {
    character,
    derived: deriveStats(character),
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
      { value },
      createElement(VitalsPanel),
    ),
  );
}

describe("Здоровье: иммунитеты и уязвимости", () => {
  it("показывает ручную уязвимость и кнопку добавления", () => {
    const hero = createCharacter({ name: "Тест" });
    hero.damageTraits = [
      { id: "trait-1", kind: "weakness", type: "холод", value: 5 },
    ];
    const html = render(hero);
    expect(html).toContain("damage-trait is-weakness");
    expect(html).toContain("Уязвимость к холоду 5");
    expect(html).toContain("Добавить");
    expect(html).toContain('aria-label="Добавить иммунитет или уязвимость"');
  });

  it("без записей оставляет только кнопку добавления", () => {
    const html = render(createCharacter({ name: "Тест" }));
    expect(html).toContain("damage-trait-add");
    expect(html).not.toContain("damage-trait is-");
    expect(html).not.toContain("damage-trait-more");
  });

  it("сворачивает лишние записи в счётчик «+N»", () => {
    const hero = createCharacter({ name: "Тест" });
    hero.damageTraits = ["огонь", "яд", "холод", "звук"].map(
      (type, index) => ({
        id: `trait-${index}`,
        kind: "immunity" as const,
        type,
        value: 5,
      }),
    );
    const html = render(hero);
    expect(html).toContain("damage-trait-more");
    expect(html).toContain("+1");
    expect(html).toContain(
      "Показать все иммунитеты и уязвимости: ещё 1",
    );
  });
});
