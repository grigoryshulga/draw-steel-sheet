import { describe, expect, it } from "vitest";
import generated from "../src/data/class-features.generated.json";
import {
  CONDUIT_BASE_MECHANICS,
  CONDUIT_BASE_TEXT_ONLY,
} from "../src/data/class-features/mechanics/conduit-base";
import type { GeneratedClassFeature } from "../src/data/class-features/types";
import { createCharacter } from "../src/lib/defaults";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { builderIssues, emptyBuilderDraft } from "../src/lib/character-builder";
import { fieldEffectContributions } from "../src/lib/feature-modifiers";
import { CONDUIT_LEVEL_MECHANICS } from "../src/data/class-features/mechanics/conduit-levels";
import { CONDUIT_RESOURCE_MECHANICS } from "../src/data/class-features/mechanics/conduit-resource";
import { classFeatureGroups } from "../src/data/class-feature-rules";

const features = (Array.isArray(generated) ? generated : generated.features) as GeneratedClassFeature[];
const included = features.filter((feature) =>
  feature.className === "Проводник" && feature.level === 1 &&
  !feature.keyedBy && !feature.id.startsWith("conduit.domain.1.") &&
  !/^conduit\.feature\.1\.blagochestie-i-effekt-domena-/.test(feature.id),
);
const feature = (id: string) => included.find((entry) => entry.id === id)!;

describe("механики Проводника 1-го уровня", () => {
  it("покрывают только записи базового класса", () => {
    const covered = new Set([...Object.keys(CONDUIT_BASE_MECHANICS), ...Object.keys(CONDUIT_BASE_TEXT_ONLY), ...Object.keys(CONDUIT_RESOURCE_MECHANICS)]);
    expect(Object.keys(CONDUIT_BASE_MECHANICS).filter((id) => id in CONDUIT_BASE_TEXT_ONLY)).toEqual([]);
    expect(included.filter(({ id }) => !covered.has(id)).map(({ id }) => id)).toEqual([]);
    expect([...covered].filter((id) => !included.some((entry) => entry.id === id))).toEqual([]);
    expect(Object.values(CONDUIT_BASE_TEXT_ONLY).every((reason) => reason.trim().length > 0)).toBe(true);
  });

  it("сохраняет адресата и условия Слова Суда и уточняет границы take-damage для оберегов", () => {
    const judgment = CONDUIT_BASE_MECHANICS["conduit.feature.1.trigger-provodnika"].trigger!.detail;
    expect(judgment).toContain("один союзник должен был бы получить урон");
    expect(judgment).toContain("от способности, использующей бросок силы");
    expect(judgment).toContain("бросок силы получает помеху против этой цели");
    expect(judgment).toContain("за 1 Благочестие — двойную помеху против этой цели");
    expect(judgment).not.toContain("враг в пределах 10 должен получить урон");

    for (const [id, condition] of [
      ["conduit.feature.1.obereg-reaktsii", "Когда смежное существо наносит вам урон"],
      ["conduit.feature.1.obereg-svyatilishcha", "Когда другое существо наносит вам урон"],
      ["conduit.feature.1.obereg-dukhov", "Когда смежное существо наносит вам урон"],
    ] as const) {
      const mechanic = CONDUIT_BASE_MECHANICS[id];
      expect(mechanic.trigger?.event).toBe("take-damage");
      expect(mechanic.trigger?.detail).toContain(condition);
      expect(mechanic.notes).toContain("шире условия книги");
      expect(mechanic.notes).toContain("не смежном источнике");
      expect(mechanic.notes).toContain("в том числе не существе");
    }
  });

  it("сверяет пять молитв с книгой и считает stamina формулой движка на каждом рубеже", () => {
    const ids = ["molitva-o-razrushenii", "molitva-o-distantsii", "molitva-o-masterstve-soldata", "molitva-o-skorosti", "molitva-o-stali"].map((suffix) => `conduit.feature.1.${suffix}`);
    for (const id of ids) expect(CONDUIT_BASE_MECHANICS[id]).toBeDefined();

    expect(CONDUIT_BASE_MECHANICS[ids[0]].effects?.[0]).toMatchObject({ field: "rolledDamage", value: 1, filter: { keywords: ["Магия"] } });
    expect(feature(ids[0]).description).toContain("бонус +1 к выброшенному урону магическими способностями");
    expect(CONDUIT_BASE_MECHANICS[ids[1]].effects?.[0]).toMatchObject({ field: "distance", value: 2, filter: { keywords: ["Магия", "Дальний"] } });
    expect(feature(ids[1]).description).toContain("бонус +2 к расстоянию");

    const soldier = CONDUIT_BASE_MECHANICS[ids[2]];
    const soldierStamina = soldier.effects!.find((effect) => effect.kind === "field" && effect.field === "stamina")!;
    expect(soldierStamina).toMatchObject({ value: 0, perEchelon: 3, when: { equipment: { lightArmor: true }, noKit: true } });
    expect(soldier.effects).toContainEqual({ kind: "proficiency", armor: ["light"], weapons: ["light"], treasures: true });
    expect(soldier.effects).toContainEqual(expect.objectContaining({ field: "rolledDamage", value: 1, filter: { keywords: ["Оружие"] }, rolledOnly: false }));
    expect(soldier.effects?.some((effect) => effect.kind === "field" && effect.field === "freeStrikeDamage")).toBe(false);
    for (const exact of ["+3 к Выносливости", "увеличивается на 3", "+1 к урону", "использовать сокровища", "Если у вас есть комплект"]) expect(feature(ids[2]).description).toContain(exact);
    expect(soldier.notes).toContain("Условное владение");
    expect(soldier.notes).toContain("старой записи");

    const hero = createCharacter({ className: "Проводник" });
    hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [], equipment: { lightArmor: true } };
    for (const [level, expected] of [[1, 3], [4, 6], [7, 9], [10, 12]] as const) {
      hero.level = level;
      expect(fieldEffectContributions([soldierStamina], hero, "stamina").reduce((sum, item) => sum + item.value, 0)).toBe(expected);
    }
    hero.kit = "Любой комплект";
    expect(fieldEffectContributions([soldierStamina], hero, "stamina")).toEqual([]);

    expect(CONDUIT_BASE_MECHANICS[ids[3]].effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "speed", value: 1 }), expect.objectContaining({ field: "disengage", value: 1 }),
    ]));
    expect(feature(ids[3]).description).toContain("бонус +1");

    const steelStamina = CONDUIT_BASE_MECHANICS[ids[4]].effects!.find((effect) => effect.kind === "field" && effect.field === "stamina")!;
    expect(steelStamina).toMatchObject({ value: 0, perEchelon: 6 });
    for (const [level, expected] of [[1, 6], [4, 12], [7, 18], [10, 24]] as const) {
      hero.level = level;
      expect(fieldEffectContributions([steelStamina], hero, "stamina").reduce((sum, item) => sum + item.value, 0)).toBe(expected);
    }
    expect(CONDUIT_BASE_MECHANICS[ids[4]].effects).toContainEqual(expect.objectContaining({ field: "stability", value: 1 }));
    expect(feature(ids[4]).description).toContain("бонус +6 к Выносливости");
  });

  it("не дублирует базовые gains Благочестия и сохраняет теги замещения уровней", () => {
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.blagochestie"]).toBeUndefined();
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.blagochestie-v-boyu"]).toBeUndefined();
    expect(CONDUIT_RESOURCE_MECHANICS["conduit.feature.1.blagochestie-v-boyu"].trigger?.detail).toContain("1d6 + уровень");
    expect(CONDUIT_RESOURCE_MECHANICS["conduit.feature.1.blagochestie-v-boyu"].trigger?.detail).toContain("на 3 получите +2 Благочестия");
    expect(CONDUIT_RESOURCE_MECHANICS["conduit.feature.1.blagochestie-i-effekty-domena"].notes).toContain("одно событие может активировать оба");
    const level7 = CONDUIT_LEVEL_MECHANICS["conduit.feature.7.nagrada-veruyushchego-faithful-s-reward"].resource!.gains[0];
    expect(level7).toMatchObject({ tag: "start-of-turn", event: "start-of-turn", replaces: ["start-of-turn"] });
  });

  it("использует реальные ключи доступных выборов и не создаёт пустых фиктивных вариантов", () => {
    const conduitGroups = classFeatureGroups("Проводник");
    expect(conduitGroups).toEqual([]);
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.molitva"].choice).toMatchObject({ group: "conduit.prayer" });
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.molitva"].choice!.options.map(({ id }) => id)).toEqual(["conduit.prayer.destruction", "conduit.prayer.distance", "conduit.prayer.soldier", "conduit.prayer.speed", "conduit.prayer.steel"]);
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.obereg-provodnika"].choice).toMatchObject({ group: "conduit.sanctuary" });
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.obereg-provodnika"].choice!.options.map(({ id }) => id)).toEqual(["conduit.sanctuary.bastion", "conduit.sanctuary.reaction", "conduit.sanctuary.refuge", "conduit.sanctuary.spirits"]);
    for (const id of ["conduit.feature.1.bozhestvo-i-domeny", "conduit.feature.1.osobennost-domena-1-go-urovnya", "conduit.feature.1.znakovye-sposobnosti", "conduit.feature.1.sposobnost-za-3-blagochestiya", "conduit.feature.1.sposobnost-za-5-blagochestiya"]) {
      expect(CONDUIT_BASE_MECHANICS[id].choice).toBeUndefined();
      expect(CONDUIT_BASE_MECHANICS[id].notes).not.toContain("options: []");
    }
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.bozhestvo-i-domeny"].notes).toContain("conduit.domain");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.osobennost-domena-1-go-urovnya"].notes).toContain("conduit.domain.1");
  });

  it("сохраняет точную семантику триггеров и не подменяет её событием врага", () => {
    const reaction = CONDUIT_BASE_MECHANICS["conduit.feature.1.obereg-reaktsii"].trigger!;
    expect(reaction.event).toBe("take-damage");
    expect(reaction.detail).toContain("смежное существо");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.obereg-reaktsii"].notes).toContain("включает союзника");
    const spirits = CONDUIT_BASE_MECHANICS["conduit.feature.1.obereg-dukhov"];
    expect(spirits.trigger?.event).toBe("take-damage");
    expect(spirits.trigger?.detail).toContain("смежное существо");
    expect(spirits.notes).toContain("включает союзника");
    expect(spirits.notes).toContain("смежное существо");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.obereg-svyatilishcha"].trigger?.detail).toContain("другое существо");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.trigger-provodnika"].notes).toContain("Не сужать условие до вражеской цели");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.obereg-bastiona"].effects).toContainEqual(expect.objectContaining({ field: "save", value: 1 }));
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.istselyayushchaya-blagodat"].notes).toContain("ровно 1 Благочестие");
    const healing = feature("conduit.feature.1.istselyayushchaya-blagodat").description;
    expect(healing).toContain("Потратить 1+ Благочестия");
    expect(healing).toContain("За каждое потраченное благочестие выберите одно");
    const judgmentBookText = feature("conduit.feature.1.trigger-provodnika").description;
    expect(judgmentBookText).toContain("должна была бы получить урон от способности, использующей бросок силы");
    expect(judgmentBookText).toContain("Бросок силы получает двойную помеху против цели");
    expect(feature("conduit.feature.1.obereg-dukhov").description).toContain("смежное существо наносит вам урон");
  });

  it("проверяет выбор способностей Проводника через настоящий builder flow", () => {
    const conduitAbilities = ABILITY_COMPENDIUM.filter(
      (ability) => ability.className === "Проводник" && ability.level === 1,
    );
    const signatures = conduitAbilities.filter((ability) => ability.kind === "signature");
    const cost3Abilities = conduitAbilities.filter((ability) => ability.resourceCost === 3);
    const cost3 = cost3Abilities[0];
    const secondCost3 = cost3Abilities[1];
    const cost5 = conduitAbilities.find((ability) => ability.resourceCost === 5)!;
    const trigger = conduitAbilities.find((ability) => ability.name === "Слово Наставления")!;
    const judgment = conduitAbilities.find((ability) => ability.name === "Слово Суда")!;
    expect(signatures).toHaveLength(8);
    expect(cost3Abilities.length).toBeGreaterThanOrEqual(2);
    expect(cost5).toBeDefined();
    expect(trigger).toBeDefined();
    expect(judgment).toBeDefined();

    const draft = {
      ...emptyBuilderDraft(),
      className: "Проводник",
      abilityIds: [signatures[0].id, signatures[1].id, cost3.id, cost5.id, trigger.id],
    };
    expect(builderIssues(draft)[6]).toBe("");
    expect(builderIssues({ ...draft, abilityIds: [signatures[0].id, cost3.id, cost5.id, trigger.id] })[6]).toContain("Выберите знаковые способности класса: 2");
    expect(builderIssues({ ...draft, abilityIds: [...signatures.slice(0, 2).map(({ id }) => id), cost3.id, secondCost3.id, cost5.id, trigger.id] })[6]).toContain("по одной героической способности за 3 и за 5");
    expect(builderIssues({ ...draft, abilityIds: [...signatures.slice(0, 2).map(({ id }) => id), cost3.id, trigger.id] })[6]).toContain("по одной героической способности за 3 и за 5");
    expect(builderIssues({ ...draft, abilityIds: [...signatures.slice(0, 2).map(({ id }) => id), cost3.id, cost5.id, trigger.id, judgment.id] })[6]).toContain("Выберите один триггер проводника");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.znakovye-sposobnosti"].notes).toContain("CLASS_SIGNATURE_COUNTS");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.sposobnost-za-3-blagochestiya"].notes).toContain("resourceCost 3");
    expect(CONDUIT_BASE_MECHANICS["conduit.feature.1.sposobnost-za-5-blagochestiya"].notes).toContain("resourceCost 5");
  });
});
