import { describe, expect, it } from "vitest";
import { classFeatureSelectionsFromDraft } from "../src/data/class-feature-rules";
import {
  BUILDER_DATA,
  buildCharacter,
  emptyBuilderDraft,
} from "../src/lib/character-builder";
import { parseCharacterImport } from "../src/lib/character-import";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";

function fileWith(value: unknown) {
  const text = JSON.stringify(value);
  return { size: new TextEncoder().encode(text).byteLength, text: async () => text };
}

describe("class feature choice persistence", () => {
  const sourceClass = BUILDER_DATA.classes.find(
    (classData) => classData.featureChoices.length > 0,
  )!;
  const featureGroup = sourceClass.featureChoices[0];
  const draftChoices = { [featureGroup.name]: featureGroup.options[0].name };
  const expectedSelections = classFeatureSelectionsFromDraft(
    sourceClass.name,
    draftChoices,
  );

  it("builds stable selections and preserves them through JSON export/import", async () => {
    const draft = {
      ...emptyBuilderDraft(),
      name: "Выбор особенностей",
      className: sourceClass.name,
      featureChoices: draftChoices,
    };
    const built = buildCharacter(draft);

    expect(built.automation?.classFeatureSelections).toEqual(expectedSelections);
    expect(Object.keys(expectedSelections)).toHaveLength(1);
    const imported = await parseCharacterImport(fileWith(built));
    expect(imported.automation?.classFeatureSelections).toEqual(expectedSelections);
  });

  it("keeps mapped choices in stable selections without duplicating their descriptions", () => {
    const talent = BUILDER_DATA.classes.find((classData) => classData.name === "Талант")!;
    const densityGroup = talent.featureChoices.find((group) =>
      group.options.some((option) => option.name === "Аугментация плотности"),
    )!;
    const wardGroup = talent.featureChoices.find((group) =>
      group.options.some((option) => option.name === "Стальной оберег"),
    )!;
    const choices = {
      [densityGroup.name]: "Аугментация плотности",
      [wardGroup.name]: "Стальной оберег",
    };
    const subclass = talent.subclasses[0];
    const manualNote = "Ручная заметка пользователя";
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      className: talent.name,
      subclass: subclass.name,
      domain: "Тестовый домен",
      features: manualNote,
      featureChoices: choices,
    });

    expect(built.automation?.classFeatureSelections).toEqual(
      classFeatureSelectionsFromDraft(talent.name, choices),
    );
    expect(built.classFeatures).not.toContain(
      densityGroup.options.find((option) => option.name === choices[densityGroup.name])!.text,
    );
    expect(built.classFeatures).not.toContain(
      wardGroup.options.find((option) => option.name === choices[wardGroup.name])!.text,
    );
    expect(built.classFeatures).toContain(subclass.text);
    expect(built.classFeatures).toContain("Домен: Тестовый домен");
    expect(built.classFeatures).toContain(manualNote);
  });

  it("keeps legacy JSON without selections compatible and does not infer from prose", async () => {
    const { automation: _automation, ...legacy } = createCharacter({
      name: "Старый герой",
      className: sourceClass.name,
    });
    const legacyText = `${featureGroup.options[0].name}\n${featureGroup.options[0].text}`;
    legacy.classFeatures = legacyText;
    const imported = await parseCharacterImport(fileWith(legacy));

    expect(imported.automation).toBeUndefined();
    expect(imported.classFeatures).toBe(legacyText);
    expect(
      normalizeCharacter({ ...legacy, automation: undefined }).automation,
    ).toBeUndefined();
  });

  it.each([
    [null, "automation.classFeatureSelections"],
    [[], "automation.classFeatureSelections"],
    [{ "group.id": 7 }, "automation.classFeatureSelections.group.id"],
  ])("rejects malformed selection records %#", async (selections, path) => {
    const character = {
      ...createCharacter({ name: "Проверка" }),
      automation: {
        enabled: true,
        adjustments: {},
        ancestryTraits: [],
        classFeatureSelections: selections,
      },
    };

    await expect(parseCharacterImport(fileWith(character))).rejects.toThrow(
      `поле «${path}» имеет неверный формат`,
    );
  });

  it("retains unknown IDs for forward compatibility", async () => {
    const selections = {
      "future.group": "future.option",
      ...expectedSelections,
    };
    const source = {
      ...createCharacter({ name: "Будущие выборы" }),
      automation: {
        enabled: true,
        adjustments: { stamina: 2 },
        ancestryTraits: ["Заземленность"],
        classFeatureSelections: selections,
      },
    };

    const imported = await parseCharacterImport(fileWith(source));
    expect(imported.automation?.classFeatureSelections).toEqual(selections);
  });
});
