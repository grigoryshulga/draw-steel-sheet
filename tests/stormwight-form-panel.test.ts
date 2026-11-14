import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StormwightFormPanel } from "../src/views/sheet/StormwightFormPanel";
import { SheetView } from "../src/views/SheetView";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import { recalculateCharacter } from "../src/lib/character-calculations";
import { previewGameAction, type GameAction } from "../src/lib/game-actions";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import type { Character } from "../src/types";
import { deriveStats } from "../src/lib/rules";

function render(character: Character, readOnly = false, element: ReactElement = createElement(StormwightFormPanel)) {
  const value: AppContextValue = {
    character, readOnly, derived: deriveStats(character), update() {}, patch() {}, performGameAction() { return true; },
    undoGameAction() {}, gameHistory: [], saveStatus: "idle", saveError: "", notify() {}, goTo() {},
  };
  return renderToStaticMarkup(createElement(AppContext.Provider, { value }, element));
}

function fury(kit = "Борен", level = 4): Character {
  const base = buildCharacter({ ...emptyBuilderDraft(), className: "Неистовый", subclass: "Буревестник", kit,
    characteristics: startingCharacteristics("Неистовый") });
  return recalculateCharacter(base, { ...base, level });
}
function apply(character: Character, action: GameAction): Character {
  const result = previewGameAction(character, action);
  if (!result.ok) throw new Error(result.reason);
  return recalculateCharacter(character, result.next);
}

describe("панель форм Буревестника", () => {
  it("показывает три формы и стоимость свободного манёвра", () => {
    const html = render(fury());
    expect(html).toContain("Борен · Медведь");
    expect(html).toContain('aria-pressed="true" aria-label="Истинная форма" disabled=""');
    expect(html).toContain('aria-label="Форма животного"');
    expect(html).toContain('aria-label="Форма гибрида"');
    expect(html).toContain("без затрат свирепости");
    expect(html).toContain('aria-label="Превратиться свободным манёвром за 1 свирепость"');
    expect(html).not.toContain('aria-label="Размер гибрида"');
  });

  it("у Корвена показывает полёт, ограничение способностей и выбор размера гибрида", () => {
    const animal = apply(fury("Корвен", 1), { kind: "stormwight-form", form: "animal" });
    const animalHtml = render(animal);
    expect(animalHtml).toContain("Полёт");
    expect(animalHtml).toContain("Вы не можете использовать какие-либо способности");
    const hybrid = apply(animal, { kind: "stormwight-form", form: "hybrid", hybridSize: "1S" });
    const hybridHtml = render(hybrid);
    expect(hybridHtml).toContain('aria-label="Размер гибрида"');
    expect(hybridHtml).toContain('value="1S" selected=""');
    expect(hybridHtml).not.toContain(">Полёт<");
    expect(render(recalculateCharacter(hybrid, { ...hybrid, level: 4 }))).toContain(">Полёт<");
  });

  it("отмечает использованный разовый бонус гибрида и выключенный авторасчёт", () => {
    const battle = apply(fury(), { kind: "combat-start" });
    const hybrid = apply(battle, { kind: "stormwight-form", form: "hybrid" });
    expect(render(hybrid)).toContain("в этой битве уже получен");
    expect(render({ ...hybrid, automation: { ...hybrid.automation!, enabled: false } })).toContain("Авторасчёт выключен");
    expect(render(fury("Борен", 1))).not.toContain("Первое превращение в гибрида в битве даст");
  });

  it("скрыта у других классов, аспектов, без выбранного комплекта и в общем листе", () => {
    expect(render(createCharacter({ className: "Тактик" }))).toBe("");
    expect(render({ ...fury(), subclass: "Берсерк" })).toBe("");
    expect(render({ ...fury(), kit: "Буревестник" })).toBe("");
    expect(render(fury(), true)).toBe("");
  });

  it("размещает обе панели после целого блока ресурсов", () => {
    const html = render(fury(), false, createElement(SheetView, { tab: "sheet" }));
    const resources = html.indexOf('data-panel="resources"');
    const ferocity = html.indexOf('data-panel="ferocity"');
    const forms = html.indexOf('data-panel="stormwight-form"');
    expect(resources).toBeGreaterThan(0);
    expect(ferocity).toBeGreaterThan(resources);
    expect(forms).toBeGreaterThan(ferocity);
    expect(html.slice(resources, ferocity)).toContain("Жетоны героя");
    expect(html.slice(resources, ferocity)).not.toContain("Растущая свирепость");
    expect(html.slice(forms)).toContain("Формы Буревестника");
  });
});
