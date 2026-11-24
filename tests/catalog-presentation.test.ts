import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/data/library";
import { catalogAccent, catalogLevelSections, catalogEditionText } from "../src/lib/catalog-presentation";

describe("оформление сокровищ и титулов", () => {
  it("preserves flavor, prerequisite and body across both inventory editions", () => {
    const entries = CATALOG.filter(entry => entry.kind !== "project");
    expect(entries).toHaveLength(159);
    for (const entry of entries) {
      for (const lang of ["ru", "en"] as const) {
        const { flavor, prerequisite, body } = catalogEditionText(entry, lang);
        if (entry.kind === "title") expect(prerequisite, entry.name).toBeTruthy();
        const label = lang === "en" ? "**Prerequisite:**" : "**Предварительное условие:**";
        const restored = [flavor, prerequisite && label + " " + prerequisite, body].filter(Boolean).join(" ");
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        expect(normalize(restored), entry.name).toBe(normalize(lang === "en" ? entry.originalDescription! : entry.markdown));
      }
    }
  });
  it("сохраняет все свойства каждого развивающегося предмета при разбиении", () => {
    const items = CATALOG.filter((entry) => entry.category === "Сокровища с Уровнем");
    expect(items.length).toBeGreaterThan(0);
    expect(items).toHaveLength(35);
    for (const item of items) {
      for (const [language, markdown] of [["ru", item.markdown], ["en", item.originalDescription]] as const) {
        expect(markdown, `${item.name} ${language}`).toBeTruthy();
        const result = catalogLevelSections(markdown!, language);
        expect(result.levels.map((stage) => stage.level), `${item.name} ${language}`).toEqual([1, 5, 9]);
        const rebuilt = [result.introduction, ...result.levels.map((stage) => {
          const heading = language === "ru" ? `**${stage.level}-й уровень:**` : `**${stage.level}${stage.level === 1 ? "st" : "th"} Level:**`;
          return `${heading} ${stage.text}`;
        })].join("\n\n");
        expect(rebuilt.replace(/\s+/g, " ").trim(), `${item.name} ${language}`).toBe(markdown!.replace(/\s+/g, " ").trim());
      }
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
