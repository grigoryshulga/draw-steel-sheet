import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KitBonuses } from "../src/components/KitBonuses";
import { kitByName } from "../src/data/kits";
import { BuilderStepProvider, type BuilderStepContextValue } from "../src/components/builder/BuilderStepContext";
import { KitStep } from "../src/components/builder/steps/KitStep";
import { buildCharacter, emptyBuilderDraft } from "../src/lib/character-builder";
import { builderFlow } from "../src/lib/builder-flow";
import { readBuilderDraft } from "../src/lib/builder-draft";
import { AppContext, type AppContextValue } from "../src/state/AppContext";
import { KitPicker } from "../src/views/sheet/KitPicker";
import { InventoryView } from "../src/views/InventoryView";

// Exercise picker content in Node without the browser-only portal shell.
vi.mock("../src/components/ui/Modal", () => ({
  Modal: ({ open, children, footer }: { open: boolean; children: ReactNode; footer?: ReactNode }) =>
    open ? createElement("div", null, children, createElement("footer", null, footer)) : null,
}));

const draft = {
  ...emptyBuilderDraft(),
  className: "Тактик",
  kit: "Мастер Боевых Искусств",
  secondaryKit: "Гора",
  meleeDamageKit: "Гора",
};

describe("Комплекты тактика в интерфейсе", () => {
  it("показывает выбранный профиль, все бонусы и только осмысленные переключатели", () => {
    const html = renderToStaticMarkup(createElement(KitBonuses, {
      loadout: buildCharacter(draft),
      level: 4,
      onChange() {},
    }));
    expect(html).toContain('aria-label="Бонусы двух комплектов"');
    expect(html).toContain('aria-label="По тирам: +0, +0, +4"');
    expect(html).toContain('value="Гора" selected');
    expect(html).toContain('title="+9 за эшелон">+18</strong>');
    expect(html).toContain("+9/эш.");
    expect(html.match(/<select /g)).toHaveLength(2); // конфликт выносливости и ближнего урона
    expect(html).not.toContain("Урон (Дальний): источник бонуса");
    expect(html).not.toContain("kit-loadout-help");
  });

  it("использует сводку бонусов в шаге создания героя", () => {
    const value = { draft, patch() {} } as BuilderStepContextValue;
    const html = renderToStaticMarkup(createElement(BuilderStepProvider, {
      value,
      children: createElement(KitStep, { part: "bonuses" }),
    }));
    expect(html).toContain("Бонусы двух комплектов");
    expect(html).toContain("Выносливость: источник бонуса");
    expect(html).toContain('aria-label="По тирам: +0, +0, +4"');
  });

  it("при восстановлении черновика цензора старый второй слот не блокирует первый", () => {
    const stored = { ...draft, className: "Цензор", kit: "Гора", secondaryKit: " гора " };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(stored) });
    try {
      const restored = readBuilderDraft("test");
      const html = renderToStaticMarkup(createElement(BuilderStepProvider, {
        value: { draft: restored, patch() {} } as BuilderStepContextValue,
        children: createElement(KitStep, { part: "primary" }),
      }));
      expect(html).toContain("Гора");
      expect(html).not.toContain("Уже выбран");
      expect(builderFlow(restored).find((step) => step.id === "kit/primary")?.issue).toBe("");
      expect(buildCharacter(restored)).toMatchObject({ kit: "Гора", secondaryKit: "" });
      expect(restored.secondaryKit).toBe(" гора ");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("даёт равноправные точки выбора двух комплектов и открытие обеих способностей", () => {
    const character = buildCharacter(draft);
    const html = renderToStaticMarkup(createElement(AppContext.Provider, {
      value: { character } as AppContextValue,
      children: createElement(InventoryView),
    }));
    expect(html).toContain("Полевой арсенал");
    expect(html).toContain('aria-label="Сменить: первый комплект"');
    expect(html).toContain('aria-label="Сменить: второй комплект"');
    for (const ability of character.abilities.filter((a) => a.source.startsWith("Комплект: "))) {
      expect(html).toContain(`>${ability.name}</button>`);
    }
    expect(html).toContain("Бонусы двух комплектов");
    expect(html).not.toContain("запасной набор");
    expect(html).not.toContain(kitByName(character.kit)!.summary);
    expect(html).not.toContain(kitByName(character.secondaryKit!)!.summary);
    expect(html).not.toContain("Вы получаете снаряжение, бонусы");
  });

  it("сохраняет классовый каталог Буревестника при добавлении второго слота тактика", () => {
    const character = buildCharacter({ ...emptyBuilderDraft(), className: "Неистовый", subclass: "Буревестник", kit: "Борен" });
    const html = renderToStaticMarkup(createElement(KitPicker, { open: true, character, onClose() {}, onSelect() {} }));
    for (const name of ["Борен", "Корвен", "Раден", "Вукен"]) expect(html).toContain(name);
    expect(html).not.toContain("Сияющие Доспехи");
    expect(html).not.toContain("Мастер Боевых Искусств");
  });

  it("блокирует повтор второго комплекта и сразу показывает сводку допустимой пары", () => {
    const character = buildCharacter(draft);
    const html = renderToStaticMarkup(createElement(KitPicker, { open: true, character, secondary: true, onClose() {}, onSelect() {} }));
    expect(html).toContain("Уже выбран в паре");
    expect(html).toContain("Бонусы в паре с «Мастер Боевых Искусств»");
    expect(html).not.toContain("<details");
    const duplicate = { ...character, secondaryKit: character.kit };
    const blocked = renderToStaticMarkup(createElement(KitPicker, { open: true, character: duplicate, secondary: true, onClose() {}, onSelect() {} }));
    expect(blocked).toMatch(/disabled=""[^>]*>Уже выбран в паре/);
  });

  it("не навязывает второй комплект обычному классу и объясняет ручной режим", () => {
    const render = (className: string) => {
      const character = buildCharacter({ ...draft, className });
      character.automation!.enabled = false;
      return renderToStaticMarkup(createElement(AppContext.Provider, {
        value: { character } as AppContextValue,
        children: createElement(InventoryView),
      }));
    };
    expect(render("Тактик")).toContain("Авторасчёт выключен");
    expect(render("Цензор")).not.toContain("Бонусы двух комплектов");
    expect(render("Цензор")).not.toContain("второй комплект");
  });
});
