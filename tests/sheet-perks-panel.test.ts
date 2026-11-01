import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { SheetPerksPanel } from "../src/views/sheet/SheetPerksPanel";

describe("перки на листе", () => {
  it("показывает перки разных типов и свободные слоты в одной сетке", () => {
    const character = createCharacter({ className: "Цензор", level: 4 });
    character.perks = [
      { perkId: "career-example", name: "Походный перк", type: "exploration", source: "career", level: 0 },
      { perkId: "class-example", name: "Классовый перк", type: "lore", source: "class", level: 2 },
      { perkId: "custom-example", name: "Свой перк", type: "crafting", source: "custom", level: 4 },
    ];
    const value = { character, update() {}, goTo() {}, notify() {} } as unknown as AppContextValue;
    const html = renderToStaticMarkup(createElement(AppContext.Provider, { value }, createElement(SheetPerksPanel)));
    expect(html.match(/class="perk-card-grid"/g)).toHaveLength(1);
    expect(html).toContain("Походный перк");
    expect(html).toContain("Классовый перк");
    expect(html).toContain("Свой перк");
    expect(html).toContain("Не выбран");
    expect(html).toContain('aria-label="Свернуть карточки перков до заголовков"');
    expect(html).not.toContain("Карьера");
    expect(html).not.toContain("Класс · 2 уровень");
    expect(html).toContain("Класс · 4 уровень");
    expect(html).not.toContain("sheet-perk-group");
  });
});
