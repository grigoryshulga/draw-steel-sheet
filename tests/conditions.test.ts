import { describe, expect, it } from "vitest";
import { normalizeCharacter } from "../src/lib/defaults";
import type { Character } from "../src/types";

describe("condition state migration", () => {
  it("превращает старый saveEnds в срок окончания", () => {
    const character = normalizeCharacter({
      name: "Герой",
      conditions: {
        bleeding: { active: true, saveEnds: true },
        dazed: { active: true, saveEnds: false },
        prone: { active: false, saveEnds: false },
      },
    } as unknown as Partial<Character>);
    expect(character.conditions.bleeding).toEqual({ active: true, ends: "save" });
    expect(character.conditions.dazed).toEqual({ active: true, ends: "until-removed" });
    expect(character.conditions.prone).toEqual({ active: false, ends: "save" });
  });

  it("сохраняет новый формат срока окончания", () => {
    const character = normalizeCharacter({
      name: "Герой",
      conditions: {
        slowed: { active: true, ends: "end-turn" },
      },
    } as unknown as Partial<Character>);
    expect(character.conditions.slowed).toEqual({ active: true, ends: "end-turn" });
  });
});
