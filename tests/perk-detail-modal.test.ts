import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/ui", () => ({
  Modal: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  Button: () => null,
  Chip: ({ children }: { children: ReactNode }) => createElement("span", null, children),
}));

import { PerkDetailModal } from "../src/components/PerkDetailModal";

describe("описание перка", () => {
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
