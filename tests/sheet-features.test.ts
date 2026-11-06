import { describe, expect, it } from "vitest";
import { ancestrySignatureFeatures } from "../src/data/ancestry-features/skeleton";
import { buildCharacter, BUILDER_DATA, emptyBuilderDraft } from "../src/lib/character-builder";
import { passiveClassFeatures } from "../src/lib/class-feature-view";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { sheetFeatures } from "../src/lib/sheet-features";

describe("знаковые черты в особенностях листа", () => {
  it.each(BUILDER_DATA.ancestries.map((ancestry) => ancestry.name))(
    "%s: сохраняет ID и полный текст каждой знаковой черты после сохранения героя",
    (ancestry) => {
      const built = buildCharacter({ ...emptyBuilderDraft(), ancestry });
      const restored = normalizeCharacter(JSON.parse(JSON.stringify(built)));
      const items = sheetFeatures(restored).filter((item) => item.category === "ancestry");
      const signatures = ancestrySignatureFeatures(ancestry);
      expect(items.map((item) => item.id)).toEqual(signatures.map((feature) => feature.id));
      for (const [index, item] of items.entries()) {
        expect(item.name).toBe(signatures[index].name);
        expect(item.detail).toBe(signatures[index].description);
        expect(item.source).toBe(`Происхождение · ${ancestry}`);
      }
      expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    },
  );

  it("меняет знаковые черты при смене происхождения и сохраняет классовые особенности", () => {
    const hero = createCharacter({ ancestry: "Ящер", className: "Цензор", level: 3 });
    const changed = { ...hero, ancestry: "Дварф" };
    const features = sheetFeatures(changed);
    const ids = features.map((item) => item.id);
    for (const old of ancestrySignatureFeatures("Ящер")) expect(ids).not.toContain(old.id);
    for (const current of ancestrySignatureFeatures("Дварф")) expect(ids).toContain(current.id);
    expect(features.filter((item) => item.category !== "ancestry")).toEqual(passiveClassFeatures(changed));
  });

  it("не добавляет купленные черты и не придумывает знаковую черту неизвестному происхождению", () => {
    const hero = buildCharacter({ ...emptyBuilderDraft(), ancestry: "Ящер", traits: ["Крылья"] });
    expect(sheetFeatures(hero).some((item) => item.name === "Крылья")).toBe(false);
    expect(sheetFeatures(createCharacter({ ancestry: "Неизвестное" }))).toEqual([]);
  });
});
