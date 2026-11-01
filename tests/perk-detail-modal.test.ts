import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/ui", () => ({
  Modal: ({ children, title }: { children: ReactNode; title: ReactNode }) =>
    createElement("div", null, createElement("header", null, title), createElement("main", null, children)),
  Button: () => null,
  Chip: ({ children }: { children: ReactNode }) => createElement("span", null, children),
}));

import { PerkDetailModal } from "../src/components/PerkDetailModal";

describe("описание перка", () => {
  it("помещает название, источник и тип в шапку, а описание — в содержимое", () => {
    const html = renderToStaticMarkup(createElement(PerkDetailModal, {
      open: true, onClose: () => {}, name: "Находка", type: "exploration",
      eyebrow: "Карьера", description: "Текст перка.",
    }));
    expect(html).toMatch(/<header>.*Находка.*Карьера.*Исследование.*<\/header>/);
    expect(html).toMatch(/<main>.*Текст перка\..*<\/main>/);
    expect(html).not.toMatch(/<main>.*Находка.*<\/main>/);
  });
  it("не повторяет сокращённый текст перед полным описанием", () => {
    const html = renderToStaticMarkup(createElement(PerkDetailModal, {
      open: true, onClose: () => {}, name: "Перк",
      summary: "Начало описания…", description: "Начало описания и полный текст.",
    }));
    expect(html).not.toContain("Начало описания…");
    expect(html).toContain("Начало описания и полный текст.");
  });
  it("показывает краткое описание, если полного нет", () => {
    const html = renderToStaticMarkup(createElement(PerkDetailModal, {
      open: true, onClose: () => {}, name: "Перк", summary: "Сохранённый текст",
    }));
    expect(html).toContain("Сохранённый текст");
    expect(html).not.toContain("Полное описание этого перка недоступно");
  });
});
