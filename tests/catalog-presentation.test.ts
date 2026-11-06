import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/data/library";
import { catalogAccent, catalogLevelSections } from "../src/lib/catalog-presentation";

describe("оформление сокровищ и титулов", () => {
  it("сохраняет все свойства каждого развивающегося предмета при разбиении", () => {
    const items = CATALOG.filter((entry) => entry.category === "Сокровища с Уровнем");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const result = catalogLevelSections(item.markdown);
      expect(result.levels.map((stage) => stage.level)).toEqual([1, 5, 9]);
      const rebuilt = [result.introduction, ...result.levels.map((stage) => `**${stage.level}-й уровень:** ${stage.text}`)].join("\n\n");
      expect(rebuilt.replace(/\s+/g, " ").trim()).toBe(item.markdown.replace(/\s+/g, " ").trim());
      expect([1, 5, 9].map((level) => catalogAccent(item, level))).toEqual(["1", "2", "3"]);
      expect(catalogAccent(item)).toBe("growing");
    }
  });
  it("отличает артефакты и не назначает ранги проектам", () => {
    for (const item of CATALOG) {
      if (item.category === "Артефакты") expect(catalogAccent(item)).toBe("artifact");
      if (item.kind === "project") expect(catalogAccent(item)).toBeUndefined();
      if (item.kind === "title") expect(catalogAccent(item)).toBe(String(item.echelon));
    }
  });
});
