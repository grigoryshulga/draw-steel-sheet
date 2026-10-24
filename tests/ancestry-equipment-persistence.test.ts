import { describe, expect, it } from "vitest";
import { ancestryTraitIdsFromNames } from "../src/data/ancestry-feature-rules";
import {
  buildCharacter,
  emptyBuilderDraft,
} from "../src/lib/character-builder";
import { parseCharacterImport } from "../src/lib/character-import";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";

function fileWith(value: unknown) {
  const text = JSON.stringify(value);
  return {
    size: new TextEncoder().encode(text).byteLength,
    text: async () => text,
  };
}

describe("ancestry and equipment automation persistence", () => {
  it("round-trips canonical ancestry IDs and equipment flags", async () => {
    const ancestry = "Дварф";
    const traits = ["Заземленность", "Искра с твоей кожи"];
    const expectedIds = ancestryTraitIdsFromNames(ancestry, traits);
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Сохранённый герой",
      ancestry,
      traits,
      equipment: { lightArmor: true, lightWeapon: false },
    });

    expect(built.automation?.ancestryTraits).toEqual(traits);
    expect(built.automation?.ancestryTraitIds).toEqual(expectedIds);
    expect(built.automation?.equipment).toEqual({
      lightArmor: true,
      lightWeapon: false,
    });
    const imported = await parseCharacterImport(fileWith(built));
    expect(imported.automation?.ancestryTraitIds).toEqual(expectedIds);
    expect(imported.automation?.equipment).toEqual({
      lightArmor: true,
      lightWeapon: false,
    });
  });

  it("accepts legacy drafts and documents without the new fields", async () => {
    const { equipment: _equipment, ...oldDraft } = emptyBuilderDraft();
    const built = buildCharacter({ ...oldDraft, ancestry: "Дварф" });
    expect(built.automation?.ancestryTraits).toEqual([]);
    expect(built.automation?.ancestryTraitIds).toEqual([]);
    expect(built.automation?.equipment).toEqual({
      lightArmor: false,
      lightWeapon: false,
    });

    const { automation: _automation, ...legacy } = createCharacter({
      name: "Старый лист",
    });
    const imported = await parseCharacterImport(fileWith(legacy));
    expect(imported.automation).toBeUndefined();
    expect(normalizeCharacter(legacy).automation).toBeUndefined();
  });

  it("normalizes partial equipment and retains unknown ancestry IDs", async () => {
    const source = {
      ...createCharacter({ name: "Будущий лист" }),
      automation: {
        enabled: false,
        adjustments: {},
        ancestryTraits: ["Заземленность"],
        ancestryTraitIds: ["future.ancestry-trait", "dwarf.grounded"],
        equipment: { lightWeapon: true },
      },
    };
    const imported = await parseCharacterImport(fileWith(source));
    expect(imported.automation?.ancestryTraitIds).toEqual([
      "future.ancestry-trait",
      "dwarf.grounded",
    ]);
    expect(imported.automation?.equipment).toEqual({
      lightArmor: false,
      lightWeapon: true,
    });
  });

  it("drops malformed runtime fields and copies valid fields when normalizing", () => {
    const malformedCases = [
      {
        ancestryTraitIds: ["valid", 4],
        equipment: { lightWeapon: true },
        retained: ["equipment"],
      },
      {
        ancestryTraitIds: ["valid"],
        equipment: null,
        retained: ["ancestryTraitIds"],
      },
      {
        ancestryTraitIds: [],
        equipment: [],
        retained: ["ancestryTraitIds"],
      },
      {
        ancestryTraitIds: ["future.trait"],
        equipment: { lightArmor: "yes" },
        retained: ["ancestryTraitIds"],
      },
    ];

    for (const { ancestryTraitIds, equipment, retained } of malformedCases) {
      const normalized = normalizeCharacter({
        ...createCharacter({ name: "Runtime JSON" }),
        automation: {
          enabled: false,
          adjustments: {},
          ancestryTraitIds,
          equipment,
          futureAutomationField: "preserved",
        },
      } as Parameters<typeof normalizeCharacter>[0]);
      const automation = normalized.automation! as Record<string, unknown>;

      expect(automation.futureAutomationField).toBe("preserved");
      if (retained.includes("ancestryTraitIds")) {
        expect(automation.ancestryTraitIds).toEqual(ancestryTraitIds);
      } else {
        expect("ancestryTraitIds" in automation).toBe(false);
      }
      if (retained.includes("equipment")) {
        expect(automation.equipment).toEqual({
          lightArmor: false,
          lightWeapon: true,
        });
      } else {
        expect("equipment" in automation).toBe(false);
      }
    }

    const sourceIds = ["future.trait"];
    const sourceEquipment = { lightWeapon: true };
    const normalized = normalizeCharacter({
      ...createCharacter({ name: "Copied runtime JSON" }),
      automation: {
        enabled: true,
        adjustments: {},
        ancestryTraitIds: sourceIds,
        equipment: sourceEquipment,
      },
    } as Parameters<typeof normalizeCharacter>[0]);

    sourceIds.push("mutated.after-normalize");
    sourceEquipment.lightWeapon = false;
    expect(normalized.automation?.ancestryTraitIds).toEqual(["future.trait"]);
    expect(normalized.automation?.equipment).toEqual({
      lightArmor: false,
      lightWeapon: true,
    });
  });

  it("copies equipment flags from the draft", () => {
    const equipment = { lightArmor: true, lightWeapon: false };
    const draft = {
      ...emptyBuilderDraft(),
      ancestry: "Дварф",
      equipment,
    };
    const built = buildCharacter(draft);
    equipment.lightArmor = false;
    expect(built.automation?.equipment).toEqual({
      lightArmor: true,
      lightWeapon: false,
    });
  });

  it.each([
    [{ ancestryTraitIds: ["valid", 4] }, "automation.ancestryTraitIds"],
    [{ equipment: null }, "automation.equipment"],
    [{ equipment: [] }, "automation.equipment"],
    [{ equipment: { lightArmor: 1 } }, "automation.equipment.lightArmor"],
    [{ equipment: { lightWeapon: "yes" } }, "automation.equipment.lightWeapon"],
  ])("rejects malformed fields at the precise path %#", async (extra, path) => {
    const source = {
      ...createCharacter({ name: "Проверка" }),
      automation: {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        ...extra,
      },
    };
    await expect(parseCharacterImport(fileWith(source))).rejects.toThrow(
      `поле «${path}» имеет неверный формат`,
    );
  });
});
