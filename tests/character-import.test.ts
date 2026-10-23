import { describe, expect, it, vi } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { parseCharacterImport } from "../src/lib/character-import";

function fileWith(
  text: string,
  size = new TextEncoder().encode(text).byteLength,
) {
  return { size, text: async () => text };
}

describe("parseCharacterImport", () => {
  it("imports a valid character and refreshes identity and timestamps", async () => {
    const source = createCharacter({ name: "  Арвен  ", className: "Тактик" });
    source.createdAt = source.updatedAt = "2025-01-01T00:00:00.000Z";
    source.inventory.push({
      id: "item-1",
      name: "Факел",
      category: "gear",
      qty: 2,
      notes: "",
      equipped: false,
    });
    source.perks.push({
      perkId: "custom-1",
      name: "Следопыт",
      type: "exploration",
      source: "custom",
      level: 1,
      summary: "Ориентируется на местности",
      description: "Перк кампании",
    });
    source.projects.push({
      id: "project-1",
      name: "Найти архив",
      assigned: "Арвен",
      characteristic: "reason",
      goal: "8",
      points: "3",
    });
    source.notes.story = "Ищет пропавшего наставника";
    source.notes.contacts = "Лира из архива";
    source.automation = {
      enabled: true,
      adjustments: { stamina: 2, speed: 1 },
      ancestryTraits: ["Ночное зрение"],
      meleeDamageKit: "Гора",
      rangedDamageKit: "Снайпер",
    };
    const imported = await parseCharacterImport(
      fileWith(JSON.stringify(source)),
    );

    expect(imported.name).toBe("Арвен");
    expect(imported.className).toBe(source.className);
    expect(imported.inventory).toEqual(source.inventory);
    expect(imported.perks).toEqual(source.perks);
    expect(imported.projects).toEqual(source.projects);
    expect(imported.notes).toEqual(source.notes);
    expect(imported.automation).toEqual(source.automation);
    expect(imported.id).not.toBe(source.id);
    expect(imported.createdAt).not.toBe(source.createdAt);
    expect(imported.updatedAt).toBe(imported.createdAt);
  });

  it("fills fields omitted by older valid files", async () => {
    const imported = await parseCharacterImport(
      fileWith(
        JSON.stringify({ name: "  Старый лист  ", notes: "Старые заметки" }),
      ),
    );
    expect(imported.name).toBe("Старый лист");
    expect(imported.schemaVersion).toBe(1);
    expect(imported.notes).toEqual({
      story: "",
      contacts: "",
      debts: "",
      secrets: "",
      misc: "Старые заметки",
    });
    expect(imported.abilities.length).toBeGreaterThan(0);
    expect(imported.inventory).toEqual([]);
    expect(imported.notes.misc).toBe("Старые заметки");
  });

  it("accepts old abilities without roll characteristic fields", async () => {
    const source = createCharacter();
    const abilities = source.abilities.map(
      ({
        rollCharacteristics: _rolls,
        preferredCharacteristic: _preferred,
        ...ability
      }) => ability,
    );
    const imported = await parseCharacterImport(
      fileWith(JSON.stringify({ ...source, abilities })),
    );
    expect(imported.abilities[0].rollCharacteristics).toEqual([]);
    expect(imported.abilities[0].preferredCharacteristic).toBe("");
  });

  it("rejects malformed JSON, arrays and missing names with readable errors", async () => {
    await expect(parseCharacterImport(fileWith("{"))).rejects.toThrow(
      "формат JSON",
    );
    await expect(parseCharacterImport(fileWith("[]"))).rejects.toThrow(
      "одного героя",
    );
    await expect(
      parseCharacterImport(fileWith('{"name":"  "}')),
    ).rejects.toThrow("имя героя");
  });

  it("checks size before reading the file", async () => {
    const text = vi.fn(async () => "{}");
    await expect(
      parseCharacterImport({ size: 2 * 1024 * 1024 + 1, text }),
    ).rejects.toThrow("2 МиБ");
    expect(text).not.toHaveBeenCalled();
  });

  it("rejects future schema versions", async () => {
    await expect(
      parseCharacterImport(fileWith('{"schemaVersion":2,"name":"Герой"}')),
    ).rejects.toThrow("не поддерживается");
  });

  it.each([
    {
      abilities: [
        {
          keywords: [],
          tiers: [
            { damage: "", effect: "" },
            { damage: "", effect: "" },
            { damage: "", effect: "" },
          ],
        },
      ],
    },
    { inventory: [{}] },
    { projects: [{}] },
    { characteristics: { might: "много" } },
    { abilities: [{ name: "Удар", tiers: [null] }] },
    {
      abilities: [
        {
          id: "a",
          name: "Удар",
          keywords: [],
          rollCharacteristics: ["strength"],
          tiers: [
            { damage: "", effect: "" },
            { damage: "", effect: "" },
            { damage: "", effect: "" },
          ],
        },
      ],
    },
    { inventory: [{ name: "Зелье", qty: "два" }] },
    { projects: [{ name: "План", goal: {} }] },
    { notes: { story: [] } },
  ])("rejects malformed nested data %#", async (extra) => {
    const input = { ...createCharacter(), ...extra };
    await expect(
      parseCharacterImport(fileWith(JSON.stringify(input))),
    ).rejects.toThrow("неверный формат");
  });
});
