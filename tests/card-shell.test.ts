import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, CardHeader, CardTitle } from "../src/components/ui";
import { ChoiceCard } from "../src/components/ChoiceCard";
import { PerkCard } from "../src/components/PerkCard";

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

describe("общая оболочка карточки", () => {
  it("карточка с выбором становится кнопкой и сообщает состояние", () => {
    const html = render(
      createElement(Card, { className: "demo-card", selected: true, onSelect() {} }),
    );

    expect(html).toContain('class="demo-card is-selected is-interactive"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("карточка без обработчиков остаётся обычным блоком", () => {
    const html = render(createElement(Card, { className: "demo-card" }));

    expect(html).toContain('class="demo-card"');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("aria-pressed");
  });

  it("отключённая карточка не притворяется кнопкой, но доступна для чтения", () => {
    const html = render(
      createElement(Card, { className: "demo-card", disabled: true, onSelect() {} }),
    );

    expect(html).toContain("is-disabled");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('role="button"');
  });

  it("карточка с постоянной кнопкой получает -1 в tabindex, когда отключена", () => {
    const html = render(
      createElement(Card, {
        className: "demo-card",
        disabled: true,
        selected: false,
        alwaysFocusable: true,
        onSelect() {},
      }),
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("при keyboardTarget=\"title\" карточка не добавляет вторую остановку клавиатуры", () => {
    const html = render(
      createElement(Card, {
        className: "demo-card",
        onOpen() {},
        openOnCardClick: true,
        keyboardTarget: "title",
      }),
    );

    expect(html).toContain("is-interactive");
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain("tabindex");
  });
});

describe("общая шапка и заголовок карточки", () => {
  it("пустая шапка не занимает места без reserveSpace", () => {
    expect(render(createElement(CardHeader, {}))).toBe("");
  });

  it("шапка держит надпись слева, а хвост справа", () => {
    const html = render(
      createElement(CardHeader, {
        className: "demo-head",
        eyebrow: "Слот",
        children: createElement("span", { className: "demo-meta" }, "Тип"),
      }),
    );

    expect(html).toContain('class="card-header demo-head"');
    expect(html).toContain('<span class="eyebrow">Слот</span>');
    expect(html).toContain('class="demo-meta"');
  });

  it("заголовок рисует нужный уровень и кнопку только при onOpen", () => {
    const plain = render(createElement(CardTitle, { as: "h4" }, "Имя"));
    const openable = render(
      createElement(CardTitle, {
        as: "h2",
        title: "Полное имя",
        onOpen() {},
        openLabel: "Открыть: Имя",
        children: "Имя",
      }),
    );

    expect(plain).toContain('<h4 class="card-title"');
    expect(plain).not.toContain("card-title-button");
    expect(openable).toContain('<h2 class="card-title" title="Полное имя"');
    expect(openable).toContain('class="card-title-button"');
    expect(openable).toContain('aria-label="Открыть: Имя"');
  });
});

describe("карточки поверх общей оболочки", () => {
  it("перк с открытием остаётся интерактивным и без выбора", () => {
    const html = render(
      createElement(PerkCard, { name: "Перк", onOpen() {} }),
    );

    expect(html).toContain('class="sheet-perk-card is-filled is-interactive"');
    expect(html).toContain('role="button"');
  });

  it("статичный перк не получает лишних атрибутов", () => {
    const html = render(createElement(PerkCard, { name: "Перк" }));

    expect(html).toContain('class="sheet-perk-card is-filled"');
    expect(html).not.toContain('role="button"');
  });

  it("перк берёт общую шапку и общий заголовок, сохраняя свой класс шапки", () => {
    const html = render(
      createElement(PerkCard, {
        eyebrow: "Карьера",
        name: "Перк",
        onOpen() {},
      }),
    );

    expect(html).toContain('class="card-header sheet-perk-head"');
    expect(html).toContain('class="card-title"');
    expect(html).toContain('class="card-title-button"');
    expect(html).toContain('aria-label="Открыть перк: Перк"');
  });

  it("полоса шапки включается только у карточки с banded", () => {
    const plain = render(createElement(PerkCard, { name: "Перк" }));
    const banded = render(createElement(PerkCard, { name: "Перк", banded: true }));

    expect(plain).toContain('class="card-title"');
    expect(plain).not.toContain("card-band");
    expect(banded).toContain('class="card-title card-band"');
  });

  it("карточка выбора берёт общий заголовок того же размера", () => {
    const html = render(createElement(ChoiceCard, { title: "Черта" }));

    expect(html).toContain('<h3 class="card-title">Черта</h3>');
  });

  it("карточка выбора сохраняет свои классы состояния", () => {
    const html = render(
      createElement(ChoiceCard, {
        title: "Черта",
        selected: true,
        onSelect() {},
      }),
    );

    expect(html).toContain('class="choice-card is-selected is-interactive"');
    expect(html).toContain('aria-pressed="true"');
  });
});
