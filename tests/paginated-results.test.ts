import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaginatedResults } from "../src/components/ui/PaginatedResults";
import { pageBounds, RESULTS_PAGE_SIZE } from "../src/lib/pagination";

describe("постраничная выдача", () => {
  const items = Array.from({ length: 416 }, (_, id) => id);
  const render = (initialIndex = 0, entries = items) => renderToStaticMarkup(createElement(PaginatedResults<number>, {
    items: entries,
    initialIndex,
    children: (visible) => createElement("ul", null, visible.map((id) => createElement("li", { key: id }, `Запись ${id}`))),
  }));

  it("рисует только одну страницу большого каталога", () => {
    const html = render();
    expect(html.match(/<li>/g)).toHaveLength(RESULTS_PAGE_SIZE);
    expect(html).toContain("1–24 из 416");
    expect(html).toContain("1 / 18");
    expect(html).not.toContain("Запись 24<");
  });

  it("открывает страницу записи, на которую ведёт прямая ссылка", () => {
    const html = render(300);
    expect(html).toContain("Запись 300<");
    expect(html).toContain("13 / 18");
    expect(html).toContain("289–312 из 416");
  });

  it("показывает каждую запись ровно один раз при обходе всех страниц", () => {
    const all = [];
    for (let n = 0; n < pageBounds(items.length, 0).pageCount; n++) {
      const { start, end } = pageBounds(items.length, n);
      all.push(...items.slice(start, end));
    }
    expect(all).toEqual(items);
  });

  it("ограничивает страницу после сужения фильтра и корректно показывает пустой список", () => {
    expect(pageBounds(3, 12)).toEqual({ page: 0, pageCount: 1, start: 0, end: 3 });
    expect(pageBounds(50, -4).page).toBe(0);
    expect(render(0, [])).toContain("Результаты: пусто");
    expect(render(0, [])).not.toContain("1–0");
    expect(render(0, [1, 2])).not.toContain("results-pagination");
  });
});
