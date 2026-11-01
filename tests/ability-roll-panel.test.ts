import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AbilityRollPanel } from "../src/views/abilities/RollModal";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { abilityFromTemplate, BASIC_ABILITIES } from "../src/data/templates";
import { createCharacter } from "../src/lib/defaults";
import { deriveStats } from "../src/lib/rules";

function renderPanel(hasRoll: boolean, singleCharacteristic = false) {
  const ability = abilityFromTemplate(BASIC_ABILITIES[0]);
  if (!hasRoll) ability.rollCharacteristics = [];
  else if (singleCharacteristic) ability.rollCharacteristics = ["might"];
  const character = createCharacter({ name: "Тест" });
  character.abilities = [ability];
  const before = structuredClone(character);
  const perform = vi.fn(() => true);
  const context: AppContextValue = {
    character,
    derived: deriveStats(character),
    update: vi.fn(),
    patch: vi.fn(),
    performGameAction: perform,
    undoGameAction: vi.fn(),
    gameHistory: [],
    saveStatus: "idle",
    saveError: "",
    notify: vi.fn(),
    goTo: vi.fn(),
  };
  const html = renderToStaticMarkup(createElement(AppContext.Provider, { value: context },
    createElement(AbilityRollPanel, { ability, character }),
  ));
  expect(perform).not.toHaveBeenCalled();
  expect(character).toEqual(before);
  return html;
}

describe("подготовка применения способности", () => {
  it("показывает подготовленный бросок без применения и расхода", () => {
    const html = renderPanel(true);
    expect(html).toContain('aria-label="Бросок силы"');
    expect(html).toContain("Бросить 2d10");
    expect(html).toContain('role="switch" aria-checked="true" aria-label="Бросок в приложении"');
    expect(html).not.toContain("Вручную");
    expect(html).toContain("В приложении");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Применить<\/button>/);
    expect(html).not.toContain("abil-roll-result");
    expect(html).toContain('class="characteristic-glyph glyph-might"');
    expect(html).toContain('aria-label="М"');
    expect(html).toContain("Бонус к броску");
    expect(html).toMatch(/<fieldset class="ability-roll-surge" disabled/);
    expect(html).toContain("Преимущества");
    expect(html).toContain("Помехи");
    expect(html).toContain('aria-label="Преимущества: одно преимущество" aria-pressed="false"');
    expect(html).toContain('aria-label="Преимущества: два преимущества" aria-pressed="false"');
    expect(html).toContain('aria-label="Помехи: одна помеха" aria-pressed="false"');
    expect(html).toContain('aria-label="Помехи: две помехи" aria-pressed="false"');
  });

  it("не показывает выбор характеристики, если вариант один", () => {
    const html = renderPanel(true, true);
    expect(html).not.toContain('aria-label="Характеристика броска"');
    expect(html).toContain("Бросить 2d10");
  });

  it("предлагает применение без броска для способностей без характеристик", () => {
    const html = renderPanel(false);
    expect(html).toContain('aria-label="Применение способности"');
    expect(html).toContain("Способность применяется без броска.");
    expect(html).not.toContain("Бросить 2d10");
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Применить<\/button>/);
  });
});
