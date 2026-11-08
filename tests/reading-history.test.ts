import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearReadingHistory, readReadingHistory, rememberArticle } from "../src/lib/reading-history";

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("история чтения", () => {
  it("сохраняет шесть последних разных статей и поднимает повторно открытую", () => {
    for (let n = 1; n <= 8; n++) rememberArticle(`article-${n}`);
    expect(readReadingHistory()).toEqual(["article-8", "article-7", "article-6", "article-5", "article-4", "article-3"]);
    expect(rememberArticle("article-5")).toEqual(["article-5", "article-8", "article-7", "article-6", "article-4", "article-3"]);
    expect(readReadingHistory()).toEqual(rememberArticle("article-5"));
  });

  it("отбрасывает повреждённые данные и дубликаты", () => {
    rememberArticle("seed");
    const key = [...values.keys()][0];
    values.set(key, "{broken");
    expect(readReadingHistory()).toEqual([]);
    values.set(key, JSON.stringify({ id: "wrong shape" }));
    expect(readReadingHistory()).toEqual([]);
    values.set(key, JSON.stringify([null, 42, "", "0201", "0201", "0202"]));
    expect(readReadingHistory()).toEqual(["0201", "0202"]);
  });

  it("очищает только историю чтения", () => {
    values.set("hero-document", "keep");
    rememberArticle("0201");
    clearReadingHistory();
    expect(readReadingHistory()).toEqual([]);
    expect(values.get("hero-document")).toBe("keep");
  });

  it("продолжает чтение при заблокированном хранилище и превышенной квоте", () => {
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("Storage blocked"); },
      setItem() { throw new Error("Quota exceeded"); },
      removeItem() { throw new Error("Storage blocked"); },
    });
    expect(readReadingHistory()).toEqual([]);
    expect(rememberArticle("0201")).toEqual(["0201"]);
    expect(() => clearReadingHistory()).not.toThrow();
  });
});
