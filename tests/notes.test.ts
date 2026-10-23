import { describe, expect, it } from "vitest";
import { normalizeCharacter } from "../src/lib/defaults";
import type { Character } from "../src/types";

describe("notes migration", () => {
  it("переносит старую строку заметок в раздел «Разное»", () => {
    const legacy = {
      name: "Старый герой",
      notes: "Старые заметки",
    } as unknown as Partial<Character>;
    const character = normalizeCharacter(legacy);
    expect(character.notes).toEqual({
      story: "",
      contacts: "",
      debts: "",
      secrets: "",
      misc: "Старые заметки",
    });
  });

  it("дополняет недостающие разделы", () => {
    const character = normalizeCharacter({
      name: "Герой",
      notes: { story: "Сюжет", contacts: "", debts: "", secrets: "", misc: "" },
    } as Partial<Character>);
    expect(character.notes.story).toBe("Сюжет");
    expect(character.notes.secrets).toBe("");
  });
});
