import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../src/i18n/locale";
import { ferocityDescription, ferocitySource } from "../src/views/sheet/ferocity-language";
import { FuryFerocityTracker } from "../src/views/sheet/FuryFerocityTracker";
import { createCharacter } from "../src/lib/defaults";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import type { Character } from "../src/types";
import { currentRuntime } from "../src/lib/runtime";
import { deriveStats } from "../src/lib/rules";

function render(character: Character, readOnly = false) {
  const value: AppContextValue = {
    character, readOnly, derived: deriveStats(character), update() {}, patch() {}, performGameAction() { return true; },
    undoGameAction() {}, gameHistory: [], saveStatus: "idle", saveError: "", notify() {}, goTo() {},
  };
  return renderToStaticMarkup(createElement(LocaleProvider, null, createElement(AppContext.Provider, { value }, createElement(FuryFerocityTracker))));
}

function fury(): Character {
  const character = createCharacter({ className: "Неистовый", level: 1 });
  return { ...character, subclass: "Буревестник", kit: "Борен",
    heroicResource: { ...character.heroicResource, current: 4 } };
}

describe("блок Растущей свирепости", () => {
  it("не появляется у других классов", () => {
    expect(render(createCharacter({ className: "Тактик" }))).toBe("");
  });

  it("не показывает личный трекер хода в публичной проекции общего героя", () => {
    expect(render(fury(), true)).toBe("");
  });

  it("показывает только текущие преимущества выбранного комплекта, будущие пороги — с требованием уровня", () => {
    const html = render(fury());
    expect(html).toContain("Борен · Медведь");
    expect(html).toContain('aria-label="Начать свой ход"');
    expect(html).toContain('aria-label="8 свирепости: Доступен с 4-го уровня"');
    expect(html).toContain("до двух существ схваченными одновременно");
    expect(html).toContain('data-threshold="4"');
    expect(html).not.toContain('data-threshold="6"');
    expect(html).toContain('aria-label="Следующий порог"');
    expect(html).not.toContain("Первый толчок");
    expect(html).not.toContain("Взмах Крыльев");
  });

  it("показывает удержанные преимущества и замену 4/6 на 8/10", () => {
    const hero = fury();
    const html = render({ ...hero, level: 10, heroicResource: { ...hero.heroicResource, current: 1 },
      runtime: { ...currentRuntime(hero), furyTurn: { active: true, peak: 10 } } });
    expect(html).toContain('aria-label="Завершить свой ход"');
    expect(html).toContain("Максимум за ход: 10");
    expect(html).toContain('data-threshold="8"');
    expect(html).toContain('data-threshold="10"');
    expect(html).not.toContain('data-threshold="4"');
    expect(html).not.toContain('data-threshold="6"');
    expect(html).toContain('aria-label="4 свирепости: Заменён преимуществом порога 8"');
    expect(html).toContain('data-state="retained"');
  });

  it("помогает выбрать комплект старому герою с общей записью Буревестник", () => {
    const html = render({ ...fury(), kit: "Буревестник" });
    expect(html).toContain("Выберите комплект буревестника");
    expect(html).toContain("Выбрать комплект");
    expect(html).not.toContain('aria-label="Пороги свирепости"');
  });
});


afterEach(() => vi.unstubAllGlobals());
it("renders English descriptions and threshold titles for every Stormwight kit", () => {
  vi.stubGlobal("window", { location: { search: "?lang=en" }, localStorage: { getItem: () => null } });
  for (const [kit, source] of [["Борен", "Boren · Bear"], ["Корвен", "Corven · Crow"], ["Раден", "Raden · Rat"], ["Вукен", "Vuken · Wolf"]]) {
    const html = render({ ...fury(), kit });
    expect(html).toContain(source);
    expect(html).toContain('aria-label="8 ferocity: Available at level 4"');
    expect(html).toContain('aria-label="Next threshold"');
    expect(html).not.toMatch(/title="[^"]*[А-Яа-я]/);
  }
  const hero = fury();
  const retained = render({ ...hero, level: 10, heroicResource: { ...hero.heroicResource, current: 1 }, runtime: { ...currentRuntime(hero), furyTurn: { active: true, peak: 10 } } });
  expect(retained).toContain('aria-label="4 ferocity: Replaced by threshold 8"');
  expect(retained).toContain('aria-label="2 ferocity: Retained until end of turn"');
});
it("preserves unknown source and descriptions", () => {
  expect(ferocitySource("Мой аспект", "en")).toBe("Мой аспект");
  const row = { id: "custom", threshold: 2, level: 1, description: "Мой текст", available: true, active: true, retained: false };
  expect(ferocityDescription(row, "en")).toBe("Мой текст");
});
