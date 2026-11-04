import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/ui", () => ({
  Modal: ({
    children,
    title,
    footer,
    className,
  }: {
    children: ReactNode;
    title: ReactNode;
    footer?: ReactNode;
    className?: string;
  }) =>
    createElement(
      "div",
      { "data-class": className },
      createElement("header", null, title),
      createElement("main", null, children),
      footer ? createElement("footer", null, footer) : null,
    ),
  Button: ({ children }: { children?: ReactNode }) =>
    createElement("button", null, children),
}));

import { CardDetailModal } from "../src/components/CardDetailModal";

describe("общий поп-ап карточки", () => {
  it("собирает имя, источник и чип в одной шапке, а содержимое — в теле", () => {
    const html = renderToStaticMarkup(
      createElement(CardDetailModal, {
        open: true,
        onClose: () => {},
        title: "Находка",
        source: "Карьера",
        meta: createElement("span", { className: "chip" }, "Исследование"),
        children: createElement("p", null, "Текст перка."),
      }),
    );

    expect(html).toMatch(
      /<header>.*card-detail-heading.*Находка.*Карьера.*Исследование.*<\/header>/,
    );
    expect(html).toMatch(/<main><div class="card-detail-body">.*Текст перка\..*<\/div><\/main>/);
    expect(html).not.toMatch(/<main>.*Находка.*<\/main>/);
  });

  it("без своего действия не рисует футер: закрывает крестик в шапке", () => {
    const html = renderToStaticMarkup(
      createElement(CardDetailModal, {
        open: true,
        onClose: () => {},
        title: "Перк",
        children: "Текст",
      }),
    );

    expect(html).not.toContain("<footer>");
    expect(html).not.toContain("Закрыть");
  });

  it("рисует футер только для действия экрана", () => {
    const html = renderToStaticMarkup(
      createElement(CardDetailModal, {
        open: true,
        onClose: () => {},
        title: "Перк",
        footer: createElement("button", null, "Заменить"),
        children: "Текст",
      }),
    );

    expect(html).toContain("<footer><button>Заменить</button></footer>");
  });

  it("autoHeight отдаёт диалогу прокрутку страницы вместо тела", () => {
    const html = renderToStaticMarkup(
      createElement(CardDetailModal, {
        open: true,
        onClose: () => {},
        title: "Перк",
        autoHeight: true,
        children: "Текст",
      }),
    );

    expect(html).toContain('data-class="card-detail-modal is-auto"');
  });
});
