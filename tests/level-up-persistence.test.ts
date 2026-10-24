import { describe, expect, it } from "vitest";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import { parseCharacterImport } from "../src/lib/character-import";
import type { LevelAdvancementRecord } from "../src/types";

const record: LevelAdvancementRecord = {
  fromLevel: 4,
  toLevel: 5,
  className: "Тактик",
  subclass: "Командир",
  mode: "milestone",
  articleId: "tactician-5",
  choices: { ability_group_unknown: ["unknown-ability", "other-id"] },
  notes: "Решение ведущего",
  createdAt: "2026-10-24T10:30:00.000Z",
};

function fileWith(value: unknown) {
  const text = JSON.stringify(value);
  return { size: new TextEncoder().encode(text).byteLength, text: async () => text };
}

describe("level-up persistence", () => {
  it("leaves newly created and legacy characters without an advancement field", () => {
    expect(createCharacter()).not.toHaveProperty("advancements");
    expect(normalizeCharacter({ name: "Старый герой" })).not.toHaveProperty(
      "advancements",
    );
  });

  it("normalizes valid records as deep copies and keeps unknown choice IDs", () => {
    const input = { name: "Герой", advancements: [record] };
    const normalized = normalizeCharacter(input);

    expect(normalized.advancements).toEqual([record]);
    expect(normalized.advancements).not.toBe(input.advancements);
    expect(normalized.advancements?.[0]).not.toBe(record);
    expect(normalized.advancements?.[0].choices).not.toBe(record.choices);
    expect(normalized.advancements?.[0].choices.ability_group_unknown).not.toBe(
      record.choices.ability_group_unknown,
    );
    expect(normalized.advancements?.[0].choices).toEqual({
      ability_group_unknown: ["unknown-ability", "other-id"],
    });
  });

  it("drops a malformed optional field as a whole during direct normalization", () => {
    const normalized = normalizeCharacter({
      name: "Герой",
      advancements: [record, { ...record, toLevel: 8 }],
    } as unknown as Parameters<typeof normalizeCharacter>[0]);

    expect(normalized).not.toHaveProperty("advancements");
  });

  it("imports a valid history without inferring one for older documents", async () => {
    const imported = await parseCharacterImport(
      fileWith({ name: "Герой", advancements: [record] }),
    );
    expect(imported.advancements).toEqual([record]);
    expect(
      await parseCharacterImport(fileWith({ name: "Старый герой" })),
    ).not.toHaveProperty("advancements");
  });

  it.each([
    [{ ...record, fromLevel: 0 }, "advancements[0].fromLevel"],
    [{ ...record, toLevel: 7 }, "advancements[0].toLevel"],
    [{ ...record, mode: "manual" }, "advancements[0].mode"],
    [{ ...record, choices: [] }, "advancements[0].choices"],
    [{ ...record, choices: { group: ["ok", 3] } }, "advancements[0].choices.group"],
    [{ ...record, createdAt: "not a date" }, "advancements[0].createdAt"],
    [{ ...record, notes: null }, "advancements[0].notes"],
  ])("rejects malformed imported records at the exact path %#", async (bad, path) => {
    await expect(
      parseCharacterImport(fileWith({ name: "Герой", advancements: [bad] })),
    ).rejects.toThrow(`поле «${path}»`);
  });
});
