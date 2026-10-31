import { describe, expect, it } from "vitest";
import { BASIC_ABILITIES } from "../src/data/templates";
import { KIT_COMPENDIUM } from "../src/data/kits";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { BUILDER_DATA, builderIssues, buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { calculatedValues } from "../src/lib/character-calculations";
import { featureAbilityDamageBonus, featureAbilityDamageContributions, featureAbilityDistanceBonus, featureFieldBonus, featureFieldContributions, featureStatBonus } from "../src/lib/feature-modifiers";
import { classFeatureChoicesForSheet, featureSheetChoiceState, withClassFeatureSelection } from "../src/lib/class-feature-view";
import type { Ability, Character } from "../src/types";

const prayers = [
  ["conduit.prayer.destruction", "Молитва о разрушении", "conduit.feature.1.molitva-o-razrushenii"],
  ["conduit.prayer.distance", "Молитва о дистанции", "conduit.feature.1.molitva-o-distantsii"],
  ["conduit.prayer.soldier", "Молитва о мастерстве солдата", "conduit.feature.1.molitva-o-masterstve-soldata"],
  ["conduit.prayer.speed", "Молитва о скорости", "conduit.feature.1.molitva-o-skorosti"],
  ["conduit.prayer.steel", "Молитва о стали", "conduit.feature.1.molitva-o-stali"],
] as const;
const wards = [
  ["conduit.sanctuary.bastion", "Оберег бастиона", "conduit.feature.1.obereg-bastiona"],
  ["conduit.sanctuary.reaction", "Оберег реакции", "conduit.feature.1.obereg-reaktsii"],
  ["conduit.sanctuary.refuge", "Оберег святилища", "conduit.feature.1.obereg-svyatilishcha"],
  ["conduit.sanctuary.spirits", "Оберег духов", "conduit.feature.1.obereg-dukhov"],
] as const;
const all = [...prayers, ...wards];
function build(name?: string, group = "Молитва", level = 1, kit = ""): Character {
  const character = buildCharacter({ ...emptyBuilderDraft(), name: "Проводник паритета", className: "Проводник", subclass: BUILDER_DATA.classes.find((c) => c.name === "Проводник")!.subclasses[0].name, level, kit, characteristics: startingCharacteristics("Проводник"), featureChoices: name ? { [group]: name } : {} });
  // buildCharacter constructs a level-one sheet; keep its real selection and set the tested level.
  return { ...character, level };
}
function select(hero: Character, group: string, id: string): Character {
  return { ...hero, automation: { ...hero.automation!, classFeatureSelections: { ...hero.automation?.classFeatureSelections, [group]: id } } };
}
const magic: Ability = { id: "m", name: "Магия", flavor: "", actionType: "main", kind: "signature", keywords: ["Магия", "Дальний"], distance: "Дальний 5", target: "", rollCharacteristics: ["reason"], preferredCharacteristic: "reason", rollBonus: 0, resourceCost: 0, trigger: "", tiers: [1, 2, 3].map((n) => ({ damage: `${n} урона`, effect: "" })), effect: "", source: "", notes: "" };
const rangedNonmagic: Ability = { ...magic, id: "ranged-nonmagic", keywords: ["Дальний"], distance: "Дальний 5" };
const meleeMagic: Ability = { ...magic, id: "melee-magic", keywords: ["Магия", "Ближний"], distance: "Ближний 1" };
const nonWeaponMagic: Ability = { ...magic, id: "magic-no-weapon", keywords: ["Магия"], distance: "Дальний 5" };
const nonmagicWeapon: Ability = { ...magic, id: "weapon-no-magic", keywords: ["Оружие"], distance: "Ближний 1" };
const basicMeleeFreeStrike: Ability = { ...BASIC_ABILITIES.find((ability) => ability.kind === "free-strike" && ability.keywords.includes("Оружие"))!, id: "basic-melee-free-strike" };
const groupFor = (id: string) => id.startsWith("conduit.prayer.") ? "conduit.prayer" : "conduit.sanctuary";
describe("Проводник: паритет старых выборов при удалении реестра", () => {
  it("показывает все девять сохранённых ID как выбранные, а неизвестные молитву/оберег — нейтрально", () => {
    for (const [id] of all) {
      const group = groupFor(id);
      const hero = withClassFeatureSelection(build(), group, id);
      const choice = classFeatureChoicesForSheet(hero).find((item) => item.group === group)!;
      expect(choice.selected).toBe(id);
      expect(featureSheetChoiceState(choice)).toEqual({ selectedOption: id });
    }
    for (const [group, id] of [["conduit.prayer", "conduit.prayer.unknown"], ["conduit.sanctuary", "conduit.sanctuary.unknown"]]) {
      const hero = withClassFeatureSelection(build(), group, id);
      const state = featureSheetChoiceState(classFeatureChoicesForSheet(hero).find((item) => item.group === group)!);
      expect(state.selectedOption).toBe("");
      expect(state.warning).toContain("не входит в список доступных вариантов");
      expect(state.warning).not.toContain("домен");
      expect(hero.automation?.classFeatureSelections?.[group]).toBe(id);
    }
  });
  it("собирает все девять legacy выборов и сохраняет контракт выбора и описаний книги", () => {
    for (const [id, name, featureId] of all) {
      const group = groupFor(id);
      const built = build(name, group === "conduit.prayer" ? "Молитва" : "Оберег проводника");
      expect(built.automation?.classFeatureSelections?.[group]).toBe(id);
      const bookEntry = GENERATED_CLASS_FEATURES.find((feature) => feature.id === featureId);
      expect(bookEntry?.description.trim()).toBeTruthy();
      const selected = select(built, group, id);
      expect(selected.automation?.classFeatureSelections?.[group]).toBe(id);
      // The registry owns this text after migration, so the builder must not duplicate it.
      expect(selected.classFeatures).not.toContain(bookEntry!.description);
      expect(selected.classFeatures).not.toContain(`${name}\n${bookEntry!.description}`);
    }
    expect(all.map(([id]) => id)).toHaveLength(9);
  });

  it("сохраняет книжные численные эффекты молитв на четырёх эшелонах", () => {
    const destruction = select(build(prayers[0][1]), "conduit.prayer", prayers[0][0]);
    expect(featureAbilityDamageBonus(magic, destruction)).toBe(1);
    expect(featureAbilityDamageBonus(nonWeaponMagic, destruction)).toBe(1);
    expect(featureAbilityDamageBonus(nonmagicWeapon, destruction)).toBe(0);

    const distance = select(build(prayers[1][1]), "conduit.prayer", prayers[1][0]);
    expect(featureAbilityDistanceBonus(magic, distance)).toBe(2);
    expect(featureAbilityDistanceBonus(meleeMagic, distance)).toBe(0);
    expect(featureAbilityDistanceBonus(rangedNonmagic, distance)).toBe(0);

    for (const [level, echelonBonus] of [[1, 3], [4, 6], [7, 9], [10, 12]] as const) {
      const soldier = select(build(prayers[2][1], "Молитва", level), "conduit.prayer", prayers[2][0]);
      const armorOnly = { ...soldier, automation: { ...soldier.automation!, equipment: { lightArmor: true, lightWeapon: false } } };
      const weaponOnly = { ...soldier, automation: { ...soldier.automation!, equipment: { lightArmor: false, lightWeapon: true } } };
      expect(featureStatBonus(armorOnly, "stamina")).toBe(echelonBonus);
      expect(featureFieldBonus(armorOnly, "rolledDamage", nonmagicWeapon)).toBe(0);
      expect(featureStatBonus(weaponOnly, "stamina")).toBe(0);
      expect(featureFieldBonus(weaponOnly, "rolledDamage", nonmagicWeapon)).toBe(1);
      expect(featureFieldBonus(weaponOnly, "rolledDamage", nonWeaponMagic)).toBe(0);
      expect(featureFieldBonus(weaponOnly, "rolledDamage", basicMeleeFreeStrike)).toBe(1);
      const kitted = { ...weaponOnly, kit: KIT_COMPENDIUM[0].name };
      expect(kitted.kit).toBeTruthy();
      expect(featureStatBonus({ ...kitted, automation: { ...kitted.automation!, equipment: { lightArmor: true, lightWeapon: false } } }, "stamina")).toBe(0);
      expect(featureFieldBonus(kitted, "rolledDamage", basicMeleeFreeStrike)).toBe(0);
    }

    const speed = select(build(prayers[3][1]), "conduit.prayer", prayers[3][0]);
    expect(featureStatBonus(speed, "speed")).toBe(1);
    expect(featureStatBonus(speed, "disengage")).toBe(1);
    for (const [level, stamina] of [[1, 6], [4, 12], [7, 18], [10, 24]] as const) {
      const steel = select(build(prayers[4][1], "Молитва", level), "conduit.prayer", prayers[4][0]);
      expect(featureStatBonus(steel, "stamina")).toBe(stamina);
      expect(featureStatBonus(steel, "stability")).toBe(1);
    }
    expect(featureStatBonus(select(build(wards[0][1], "Оберег проводника"), "conduit.sanctuary", wards[0][0]), "save")).toBe(1);
    for (const [id, name] of wards.slice(1)) {
      const situational = select(build(name, "Оберег проводника"), "conduit.sanctuary", id);
      for (const stat of ["stamina", "recoveries", "speed", "stability", "disengage", "save"] as const) expect(featureStatBonus(situational, stat)).toBe(0);
    }
  });

  it("считает один вклад при миграции, уважает выключенную автоматизацию и пустые выборы", () => {
    const selected = select(build(prayers[0][1]), "conduit.prayer", prayers[0][0]);
    // Ровно одна каноническая запись должна отвечать за legacy ID.
    const legacyContributions = featureAbilityDamageContributions(magic, selected);
    expect(legacyContributions).toHaveLength(1);
    expect(legacyContributions[0]).toMatchObject({ sourceId: prayers[0][2], value: 1 });
    for (const level of [1, 4, 7, 10]) {
      const hero = { ...selected, level };
      const contributions = featureAbilityDamageContributions(magic, hero);
      expect(contributions).toHaveLength(1);
      expect(contributions[0].value).toBe(1);
      expect(["conduit.prayer.destruction", "conduit.feature.1.molitva-o-razrushenii"]).toContain(contributions[0].sourceId);
    }

    const soldier = select(build(prayers[2][1]), "conduit.prayer", prayers[2][0]);
    const equipped = { ...soldier, automation: { ...soldier.automation!, equipment: { lightArmor: true, lightWeapon: true } } };
    expect(featureStatBonus(equipped, "stamina")).toBe(3);
    expect(calculatedValues(equipped).stamina).toBe(equipped.stamina.max + 3);
    const disabled = { ...equipped, automation: { ...equipped.automation!, enabled: false } };
    expect(featureStatBonus(disabled, "stamina")).toBe(0);
    expect(calculatedValues(disabled).stamina).toBe(equipped.stamina.max);

    for (const selection of [undefined, "conduit.prayer.unknown"]) {
      const empty = build();
      if (selection) empty.automation!.classFeatureSelections = { "conduit.prayer": selection };
      expect(featureFieldContributions(empty, "stamina")).toHaveLength(0);
      expect(featureAbilityDamageBonus(magic, empty)).toBe(0);
      expect(featureAbilityDamageContributions(basicMeleeFreeStrike, empty)).toHaveLength(0);
    }
    const invalidChoiceDraft = {
      ...emptyBuilderDraft(),
      className: "Проводник",
      subclass: BUILDER_DATA.classes.find((c) => c.name === "Проводник")!.subclasses.slice(0, 2).map((domain) => domain.name).join(", "),
      conduitDomainFeature: BUILDER_DATA.classes.find((c) => c.name === "Проводник")!.subclasses[0].name,
      characteristics: startingCharacteristics("Проводник"),
      featureChoices: { Молитва: "conduit.prayer.unknown" },
    };
    expect(builderIssues(invalidChoiceDraft)[4]).toBe("Выберите дополнительные особенности класса.");
  });
});
