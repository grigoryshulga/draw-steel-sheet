import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PassiveFeatureCard } from "../src/views/sheet/PassiveFeatureCard";
import type { FeatureSheetItem } from "../src/lib/class-feature-view";

const item: FeatureSheetItem = {
  id: "feature:test",
  name: "Особенность",
  level: 2,
  category: "class",
  passive: true,
  summary: "Краткий фрагмент.",
  summaryFromDescription: true,
  detail: "Краткий фрагмент. Полный текст правила с продолжением.",
  notes: "Дополнительное примечание.",
  badges: [],
};

describe("карточка пассивной особенности", () => {
  it("показывает описание и кнопку полного текста, а примечание помещает в подсказку", () => {
    const html = renderToStaticMarkup(createElement(PassiveFeatureCard, { item }));
    expect(html).toContain("Полный текст правила с продолжением.");
    expect(html).toContain('aria-label="Открыть особенность: Особенность"');
    expect(html).toContain('aria-label="Примечание: Особенность"');
    expect(html).not.toContain("Текст особенности</summary>");
    expect(html).not.toContain("Примечание</summary>");
    expect(html).not.toContain("Класс</span>");
    expect(html).not.toContain("2 ур.");
    expect(html.match(/Краткий фрагмент/g)).toHaveLength(1);
  });

  it("сохраняет рассчитанное краткое значение, отличное от описания", () => {
    const html = renderToStaticMarkup(createElement(PassiveFeatureCard, { item: { ...item, summary: "Скорость +2", summaryFromDescription: false } }));
    expect(html).toContain("Скорость +2");
    expect(html).toContain("Полный текст правила с продолжением.");
  });

  it("показывает сводку, если полного описания и примечания нет", () => {
    const html = renderToStaticMarkup(createElement(PassiveFeatureCard, {
      item: { ...item, detail: undefined, notes: undefined },
    }));
    expect(html).toContain("Краткий фрагмент.");
    expect(html).not.toContain('aria-label="Примечание: Особенность"');
  });

});
