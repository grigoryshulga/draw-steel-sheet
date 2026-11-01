import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { ConditionsPanel } from "../src/views/sheet/ConditionsPanel";

describe("карточки состояний", () => {
  it("показывает в шапках спасбросок и снятие, учитывая способ окончания", () => {
    const character = createCharacter();
    character.conditions.bleeding = { active: true, ends: "save" };
    character.conditions.dazed = { active: true, ends: "end-turn" };
    const value = { character, patch() {}, notify() {} } as unknown as AppContextValue;
    const html = renderToStaticMarkup(createElement(AppContext.Provider, { value }, createElement(ConditionsPanel)));
    const headers = [...html.matchAll(/<header class="condition-card-head">(.*?)<\/header>/g)].map((match) => match[1]);
    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain("Кровотечение");
    expect(headers[0]).toContain('aria-label="Спасбросок против состояния: Кровотечение"');
    expect(headers[0]).toContain('aria-label="Снять состояние: Кровотечение"');
    expect(headers[0]).not.toContain("disabled");
    expect(headers[1]).toContain("Оглушение");
    expect(headers[1]).toContain("Оканчивается: До конца хода");
    expect(headers[1]).toContain('aria-label="Спасбросок против состояния: Оглушение"');
    expect(headers[1]).toContain("disabled");
    expect(html).toContain('aria-label="Свернуть карточки состояний до заголовков"');
    expect(html).toContain('aria-label="Когда оканчивается новое состояние"');
    expect(html).not.toContain('aria-label="Когда оканчивается: Кровотечение"');
  });
});
