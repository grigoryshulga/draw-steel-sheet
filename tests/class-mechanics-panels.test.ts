import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassMechanicsPanel } from "../src/views/sheet/ClassMechanicsPanel";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { createCharacter } from "../src/lib/defaults";
import { deriveStats } from "../src/lib/rules";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import type { Character } from "../src/types";

function render(character: Character) {
  const context: AppContextValue = {
    character,
    derived: deriveStats(character),
    update() {},
    patch() {},
    performGameAction: () => false,
    undoGameAction() {},
    gameHistory: [],
    saveStatus: "saved",
    saveError: "",
    notify() {},
    goTo() {},
  };
  return renderToStaticMarkup(
    createElement(
      AppContext.Provider,
      { value: context },
      createElement(ClassMechanicsPanel),
    ),
  );
}
describe("классовые панели", () => {
  it.each([
    ["Нуль", "Мастерство дисциплины"],
    ["Талант", "Ясность и возбужденность"],
    ["Трубадур", "Выступление"],
    ["Элементалист", "Поддержание магии"],
    ["Тактик", "Метка"],
    ["Цензор", "Суд"],
    ["Проводник", "Молитва"],
  ])(
    "показывает раздел %s без нового сохранённого состояния",
    (className, title) => {
      expect(render(createCharacter({ className }))).toContain(title);
    },
  );
  it("не добавляет пустые панели Неистовому или Призывателю", () => {
    expect(render(createCharacter({ className: "Неистовый" }))).toBe("");
    expect(render(createCharacter({ className: "Призыватель" }))).toBe("");
  });
  it("после загрузки показывает названия обоих выступлений, оставляя полные эффекты для попапа", () => {
    const hero = createCharacter({ className: "Трубадур", level: 5 });
    const routines = ["Хореография", "Живительный Лимерик"].map((name) =>
      ABILITY_COMPENDIUM.find((a) => a.name === name)!,
    );
    hero.abilities = routines;
    hero.classMechanics = {
      troubadour: {
        activeRoutineId: routines[0].id,
        activeRoutineIds: routines.map((a) => a.id),
      },
    };
    const html = render(hero);
    expect(html).toContain("Хореография");
    expect(html).not.toContain("бонус +2 к скорости");
    expect(html).toContain("Живительный Лимерик");
    expect(html).not.toContain("потратить Восстановление");
  });
});
