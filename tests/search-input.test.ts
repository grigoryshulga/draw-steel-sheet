import { Children, isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  input: { focus: vi.fn(), disabled: false, getClientRects: () => [1] },
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: () => ({ current: harness.input }),
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup) harness.cleanups.push(cleanup);
  },
}));
import { SearchInput } from "../src/components/ui/SearchInput";

class Target {
  constructor(public editing = false, public isContentEditable = false) {}
  closest() { return this.editing; }
}
const listeners = new Map<string, (event: unknown) => void>();
let modalOpen = false;
beforeEach(() => {
  harness.input.focus.mockClear();
  harness.input.disabled = false;
  modalOpen = false;
  vi.stubGlobal("HTMLElement", Target);
  vi.stubGlobal("document", {
    addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
    querySelector: () => modalOpen ? {} : null,
  });
});
afterEach(() => {
  harness.cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});

describe("клавиатура поиска", () => {
  it("нажимает / для фокуса и освобождает обработчик при закрытии", () => {
    SearchInput({ "aria-label": "Поиск", value: "", onValueChange() {}, shortcut: true });
    const event = { key: "/", target: new Target(), preventDefault: vi.fn() };
    listeners.get("keydown")!(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(harness.input.focus).toHaveBeenCalledOnce();
    harness.cleanups.splice(0).forEach((cleanup) => cleanup());
    expect(listeners.has("keydown")).toBe(false);
  });

  it("не перехватывает ввод, модификаторы, композицию и открытый диалог", () => {
    SearchInput({ "aria-label": "Поиск", value: "", onValueChange() {}, shortcut: true });
    for (const extra of [
      { target: new Target(true) }, { target: new Target(false, true) },
      { ctrlKey: true }, { metaKey: true }, { altKey: true },
      { isComposing: true }, { defaultPrevented: true },
    ]) {
      const event = { key: "/", target: new Target(), preventDefault: vi.fn(), ...extra };
      listeners.get("keydown")!(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    modalOpen = true;
    listeners.get("keydown")!({ key: "/", target: new Target(), preventDefault: vi.fn() });
    expect(harness.input.focus).not.toHaveBeenCalled();
  });

  it("очищает поиск через Escape и кнопку, сохраняя фокус", () => {
    const change = vi.fn();
    const node = SearchInput({ "aria-label": "Поиск", value: "гоблин", onValueChange: change });
    const children = Children.toArray(node.props.children).filter(isValidElement) as ReactElement<Record<string, unknown>>[];
    const input = children.find((child) => child.type === "input")!;
    const button = children.find((child) => child.type === "button")!;
    const event = { key: "Escape", nativeEvent: { isComposing: false }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    (input.props.onKeyDown as (event: unknown) => void)(event);
    expect(change).toHaveBeenLastCalledWith("");
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    (button.props.onClick as () => void)();
    expect(change).toHaveBeenCalledTimes(2);
    expect(harness.input.focus).toHaveBeenCalledTimes(2);
  });
});
