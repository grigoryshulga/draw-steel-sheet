import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";

const harness = vi.hoisted(() => ({
  state: [] as unknown[],
  cursor: 0,
  character: undefined as unknown,
  patch: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (index >= harness.state.length) harness.state[index] = initial;
    return [harness.state[index], (next: unknown) => {
      harness.state[index] = typeof next === "function"
        ? (next as (value: unknown) => unknown)(harness.state[index])
        : next;
    }];
  },
}));

vi.mock("../src/state/AppContext", () => ({
  useApp: () => ({ character: harness.character, patch: harness.patch, notify: harness.notify }),
}));

import { ConditionsPanel } from "../src/views/sheet/ConditionsPanel";

function find(node: ReactNode, label: string): ReactElement<Record<string, unknown>> | undefined {
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  if (node.props["aria-label"] === label) return node;
  for (const child of Children.toArray([node.props.children, node.props.actions] as ReactNode)) {
    const result = find(child, label);
    if (result) return result;
  }
  return undefined;
}

function renderPanel() {
  harness.cursor = 0;
  return ConditionsPanel();
}

function hasClass(node: ReactNode, className: string): boolean {
  if (!isValidElement<Record<string, unknown>>(node)) return false;
  if (node.props.className === className) return true;
  return Children.toArray(node.props.children as ReactNode).some((child) => hasClass(child, className));
}

describe("управление состояниями", () => {
  beforeEach(() => {
    harness.state = [];
    harness.cursor = 0;
    harness.character = createCharacter();
    harness.patch.mockReset();
    harness.notify.mockReset();
  });

  it("сохраняет выбранное состояние и срок окончания при добавлении", () => {
    let panel = renderPanel();
    const selectCondition = find(panel, "Выберите состояние")!;
    (selectCondition.props.onChange as (event: unknown) => void)({ target: { value: "dazed" } });
    panel = renderPanel();
    const selectEnd = find(panel, "Когда оканчивается новое состояние")!;
    (selectEnd.props.onChange as (event: unknown) => void)({ target: { value: "next-turn" } });
    panel = renderPanel();
    const add = find(panel, "Наложить выбранное состояние")!;
    (add.props.onClick as () => void)();
    expect(harness.patch).toHaveBeenCalledWith(expect.objectContaining({
      conditions: expect.objectContaining({ dazed: { active: true, ends: "next-turn" } }),
    }));
    expect(find(renderPanel(), "Когда оканчивается новое состояние")?.props.value).toBe("save");
  });

  it("при сворачивании сохраняет кубик и крестик в шапке", () => {
    const character = createCharacter();
    character.conditions.bleeding = { active: true, ends: "save" };
    harness.character = character;
    let panel = renderPanel();
    expect(hasClass(panel, "condition-card-body")).toBe(true);
    const toggle = find(panel, "Свернуть карточки состояний до заголовков")!;
    (toggle.props.onClick as () => void)();
    panel = renderPanel();
    expect(find(panel, "Развернуть карточки состояний")).toBeDefined();
    expect(find(panel, "Спасбросок против состояния: Кровотечение")).toBeDefined();
    expect(find(panel, "Снять состояние: Кровотечение")).toBeDefined();
    expect(hasClass(panel, "condition-card-body")).toBe(false);
  });
});
