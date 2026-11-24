import { describe, expect, it } from "vitest";
import original from "../src/generated/rules/articles/0811.json";
import { masteryOriginalText } from "../src/views/sheet/class-mechanics/NullTalentPanels";
import { conduitDomains } from "../src/lib/class-mechanics/targets-prayer";
import { createCharacter } from "../src/lib/defaults";

describe("class mechanics original text", () => {
  it.each(["Хронокинетик", "Криокинетик", "Метакинетик"])("finds each original mastery table row for %s", tradition => {
    for (const threshold of [2, 4, 6, 8, 10, 12]) {
      const text = masteryOriginalText(original.entities, tradition, threshold);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/[А-Яа-я]/);
    }
  });
  it("provides original titles and descriptions for selected conduit domains", () => {
    const hero = createCharacter({ className: "Проводник" });
    hero.subclass = "Жизнь, Защита";
    const domains = conduitDomains(hero);
    expect(domains.map(domain => domain.originalName)).toEqual(expect.arrayContaining(["Domain Piety and Effects: Life", "Domain Piety and Effects: Protection"]));
    expect(domains.every(domain => domain.originalDescription && !/[А-Яа-я]/.test(domain.originalDescription))).toBe(true);
  });
});
