import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { conduitAbilities } from "../src/data/class-features/conduit-abilities";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import { CONDUIT_LEGACY_OPTIONS } from "../src/data/class-feature-rules";
import { CONDUIT_BASE_MECHANICS } from "../src/data/class-features/mechanics/conduit-base";
import { CONDUIT_DOMAIN_MECHANICS } from "../src/data/class-features/mechanics/conduit-domains";
import { CONDUIT_LEVEL_MECHANICS } from "../src/data/class-features/mechanics/conduit-levels";
import { CONDUIT_RESOURCE_MECHANICS } from "../src/data/class-features/mechanics/conduit-resource";
import type {
  FeatureMechanics,
  GeneratedClassFeature,
} from "../src/data/class-features/types";
import type { Character } from "../src/types";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
  conduitLegacyDomainChoicesForSheet,
  setConduitDomainPair,
  confirmConduitLegacyRewardsReviewed,
  featureSheetChoiceState,
  featureBadgeState,
  featureLevelOpenState,
  triggerBadgeCounts,
  type FeatureSheetItem,
} from "../src/lib/class-feature-view";
import {
  conduitFeatureChoiceOptions,
  classFeatureTriggers,
  invalidateClassFeatureRegistry,
} from "../src/lib/class-features";
import { previewGameAction } from "../src/lib/game-actions";
import { beginEncounter, beginRound } from "../src/lib/runtime";

/**
 * Герой Неистового нужного уровня. Аспект пишется туда же, куда его пишет
 * приложение, — в `automation.classFeatureSelections`.
 */
function fury(level: number, aspect?: string): Character {
  const hero = createCharacter({ className: "Неистовый", level });
  hero.characteristics = { ...hero.characteristics, might: 2, agility: 3 };
  hero.automation = {
    enabled: true,
    adjustments: {},
    ancestryTraits: [],
    ...(aspect ? { classFeatureSelections: { "fury.aspect": aspect } } : {}),
  };
  return hero;
}

/** Все записи панели одним списком — по ним ищем фичу по `id`. */
function itemsOf(hero: Character): FeatureSheetItem[] {
  return classFeatureGroupsForSheet(hero).flatMap((group) => group.features);
}

function itemOf(hero: Character, id: string): FeatureSheetItem {
  const item = itemsOf(hero).find((feature) => feature.id === id);
  if (!item) throw new Error(`В панели нет фичи ${id}`);
  return item;
}

const TEST_ID = "fury.feature.1.test-characteristic";

/** Временная запись реестра: снимается в `finally`, даже если тест упал. */
function withFeature<T>(
  record: Partial<GeneratedClassFeature>,
  mechanics: FeatureMechanics,
  run: () => T,
): T {
  GENERATED_CLASS_FEATURES.push({
    id: TEST_ID,
    className: "Неистовый",
    level: 1,
    name: "Тестовая фича",
    articleId: "test",
    description: "",
    ...record,
  });
  FEATURE_MECHANICS[TEST_ID] = mechanics;
  invalidateClassFeatureRegistry();
  try {
    return run();
  } finally {
    const index = GENERATED_CLASS_FEATURES.findIndex(
      (feature) => feature.id === TEST_ID,
    );
    if (index >= 0) GENERATED_CLASS_FEATURES.splice(index, 1);
    delete FEATURE_MECHANICS[TEST_ID];
    invalidateClassFeatureRegistry();
  }
}

/** Временная установка сохраняет совместимость старых проверок отображения. */
function withConduitMechanics<T>(run: () => T): T {
  const mechanics = {
    ...CONDUIT_BASE_MECHANICS,
    ...CONDUIT_DOMAIN_MECHANICS,
    ...CONDUIT_LEVEL_MECHANICS,
    ...CONDUIT_RESOURCE_MECHANICS,
  };
  const originals = new Map(Object.keys(mechanics).map((id) => [id, FEATURE_MECHANICS[id]]));
  Object.assign(FEATURE_MECHANICS, mechanics);
  invalidateClassFeatureRegistry();
  try {
    return run();
  } finally {
    for (const [id, original] of originals) {
      if (original) FEATURE_MECHANICS[id] = original;
      else delete FEATURE_MECHANICS[id];
    }
    invalidateClassFeatureRegistry();
  }
}

const ASPECT_GATE = "fury.feature.1.rastushchaya-svirepost-berserka-2";
const SPEED_FEATURE = "fury.aspect.2.neizbezhnyy-gnev";
const CHAOS_IMMUNITY = "fury.feature.10.voploshchenie-khaosa";
const ELEMENTAL_FORM = "fury.feature.7.elementalnaya-forma";
const ENCOUNTER_TRIGGER = "fury.feature.10.voploshchenie-khaosa";

describe("classFeatureGroupsForSheet", () => {
  it("группирует фичи по уровню и не показывает будущие уровни", () => {
    const hero = fury(3, "Берсерк");
    const groups = classFeatureGroupsForSheet(hero);

    expect(groups.map((group) => group.level)).toEqual([1, 2, 3]);
    for (const group of groups) {
      expect(group.features.length).toBeGreaterThan(0);
      expect(group.features.every((feature) => feature.level === group.level)).toBe(
        true,
      );
      expect(group.title).toContain(String(group.level));
      expect(group.features.map((feature) => feature.id)).toEqual(
        [...group.features.map((feature) => feature.id)].sort(),
      );
    }
    // Уровень героя выше — будущие группы 4-го уровня не появляются.
    expect(classFeatureGroupsForSheet(fury(2, "Берсерк")).map((g) => g.level)).toEqual([
      1, 2,
    ]);
  });

  it("подставляет числа в описание эффекта: скорость равна Ловкости", () => {
    const hero = fury(2, "Разоритель");
    const speed = itemOf(hero, SPEED_FEATURE);
    // Ловкость 3 у героя выше — «скорость +3 (Ловкость)».
    expect(speed.summary).toContain("скорость +3");
    expect(speed.summary).toContain("Ловкость");
  });

  it("показывает устойчивость и порог тира бонуса характеристики", () => {
    const hero = fury(3, "Берсерк");
    const stability = itemOf(hero, "fury.aspect.3.nedvizhimyy-obekt");
    expect(stability.summary).toContain("устойчивость +2");
    expect(stability.summary).toContain("Мощь");

    // +1 к Мощи 3 даёт эффективную 4 — порог третьего тира 17 − 4 = 13.
    const withBonus = { ...hero, characteristics: { ...hero.characteristics, might: 3 } };
    withFeature({}, { kinds: ["characteristic"], effects: [{ kind: "characteristic", key: "might", value: 1 }] }, () => {
      expect(itemOf(withBonus, TEST_ID).summary).toBe("Мощь +1, порог тира 13");
    });
  });

  it("показывает бейдж порога ресурса, но не прячет фичу", () => {
    const hero = fury(2, "Берсерк");
    const item = itemOf(hero, ASPECT_GATE);
    const threshold = item.badges.find((badge) => badge.kind === "threshold");
    expect(threshold?.label).toBe("нужно 2 свирепости");
    // Свирепости на листе нет — порог не выполнен.
    expect(threshold?.active).toBe(false);

    const withResource: Character = {
      ...hero,
      heroicResource: { ...hero.heroicResource, current: 2 },
    };
    const met = itemOf(withResource, ASPECT_GATE).badges.find(
      (badge) => badge.kind === "threshold",
    );
    expect(met?.active).toBe(true);
  });

  it("порог подписан строчной, а состояние есть только у триггеров и выбора", () => {
    const hero = fury(4, "Берсерк");
    const item = itemOf(
      hero,
      "fury.feature.4.rastushchaya-svirepost-berserka-8-4-y-uroven",
    );
    expect(item.badges.map((badge) => badge.label)).toContain(
      "нужно 8 свирепости",
    );
    const threshold = item.badges.find((badge) => badge.kind === "threshold")!;
    expect(featureBadgeState(threshold)).toBeUndefined();
    expect(
      featureBadgeState({ kind: "immunity", label: "иммунитет", active: false }),
    ).toBeUndefined();
    expect(
      featureBadgeState({ kind: "trigger", label: "триггер", active: false }),
    ).toBe("уже отмечено");
    expect(
      featureBadgeState({ kind: "choice", label: "выбор", active: false }),
    ).toBe("сейчас нет");
    expect(
      featureBadgeState({ kind: "choice", label: "выбор", active: true }),
    ).toBeUndefined();
  });

  it("показывает бейдж аспекта и приглушает его у чужого аспекта", () => {
    const berserker = itemOf(fury(2, "Берсерк"), ASPECT_GATE);
    const aspect = berserker.badges.find((badge) => badge.kind === "choice");
    expect(aspect?.label).toContain("Берсерк");
    expect(aspect?.active).toBe(true);
  });

  it("иммунитет один: движок берёт большее, панель печатает итог по типу", () => {
    const hero = fury(10, "Берсерк");
    // Мощь 2; «Воплощение Хаоса» увеличивает до ×2, «Элементальная форма» (×1)
    // проигрывает — второй строки со старым числом быть не должно.
    const item = itemOf(hero, CHAOS_IMMUNITY);
    expect(item.summary).toContain("иммунитет к огню 4");
    expect(item.summary).toContain("иммунитет к холоду 4");
    expect(item.summary).not.toContain("иммунитет к огню 2");
    // «Элементальная форма» отдельного иммунитета больше не печатает.
    expect(itemOf(hero, ELEMENTAL_FORM).summary).not.toContain("иммунитет");
  });

  it("иммунитеты видны и при выключенном авторасчёте, число то же", () => {
    const immunityLines = (hero: Character) =>
      itemsOf(hero)
        .flatMap((item) => item.summary.split("; "))
        .filter((part) => part.startsWith("иммунитет"));

    const enabled = fury(10, "Берсерк");
    enabled.characteristics.might = 3;
    const disabled = fury(10, "Берсерк");
    disabled.characteristics.might = 3;
    disabled.automation = { ...disabled.automation!, enabled: false };

    expect(immunityLines(disabled)).toHaveLength(7);
    for (const line of immunityLines(disabled)) expect(line).toMatch(/ 6$/);
    expect(immunityLines(disabled)).toEqual(immunityLines(enabled));
  });

  it("перекрывающиеся наборы типов дают одну строку на тип", () => {
    const hero = fury(1, "Берсерк");
    withFeature(
      {},
      {
        kinds: ["immunity"],
        effects: [
          {
            kind: "damageImmunity",
            types: ["огонь"],
            value: 2,
          },
          {
            kind: "damageImmunity",
            types: ["огонь", "холод"],
            value: 3,
          },
        ],
      },
      () => {
        const lines = itemsOf(hero)
          .filter((item) => item.id === TEST_ID)
          .flatMap((item) => item.summary.split("; "))
          .filter((part) => part.startsWith("иммунитет"));
        expect(lines).toEqual(["иммунитет к огню 3", "иммунитет к холоду 3"]);
      },
    );
  });

  it("на 10-м уровне каждый тип урона — одна строка с итоговым числом", () => {
    const hero = fury(10, "Берсерк");
    hero.characteristics.might = 3;
    const parts = itemsOf(hero)
      .flatMap((item) => item.summary.split("; "))
      .filter((part) => part.startsWith("иммунитет"));
    expect(parts).toHaveLength(7);
    for (const part of parts) expect(part).toMatch(/ 6$/);
    expect(parts).toContain("иммунитет к огню 6");
  });

  it("пишет иммунитет к одному типу по-русски с числом", () => {
    const hero = fury(1, "Берсерк");
    withFeature(
      {},
      {
        kinds: ["immunity"],
        effects: [
          {
            kind: "damageImmunity",
            types: ["огонь"],
            value: { characteristic: "might" },
            multiplier: 2,
            when: { keyValue: ["Берсерк"] },
          },
        ],
      },
      () => {
        // Мощь 2 × 2 = 4.
        expect(itemOf(hero, TEST_ID).summary).toBe("иммунитет к огню 4");
        // Чужой аспект не получает чужого иммунитета в описание.
        expect(itemOf(fury(1, "Буревестник"), TEST_ID).summary).toBe("");
      },
    );
  });

  it("показывает у фичи с триггером бейдж «сработает» и кнопку отметки", () => {
    const hero = fury(2, "Буревестник");
    const item = itemOf(hero, "fury.aspect.2.zub-i-kogot");
    expect(item.trigger?.frequency).toBe("turn");
    expect(item.trigger?.used).toBe(false);
    expect(
      item.badges.some(
        (badge) =>
          badge.kind === "trigger" && badge.label.startsWith("сработает: "),
      ),
    ).toBe(true);
  });

  it("возвращает точное условие и заметки механики в чистой модели листа", () => {
    const hero = fury(1, "Берсерк");
    const exactDetail = "Когда враг в пределах 10 клеток получает урон огнём, получите 2 Благочестия.";
    withFeature(
      {},
      {
        kinds: ["trigger"],
        trigger: {
          event: "deal-damage",
          frequency: "encounter",
          label: "Благочестие домена Солнце",
          detail: exactDetail,
        },
        notes: "Проверяйте тип урона вручную; начисление не автоматизировано.",
      },
      () => {
        const item = itemOf(hero, TEST_ID);
        expect(item.trigger?.detail).toBe(exactDetail);
        expect(item.notes).toBe("Проверяйте тип урона вручную; начисление не автоматизировано.");
        expect(item.badges.some((badge) => badge.label === "сработает: Благочестие домена Солнце")).toBe(true);

        const marked = previewGameAction(hero, { kind: "trigger", featureId: TEST_ID, used: true });
        expect(marked.ok).toBe(true);
        if (!marked.ok) return;
        expect(itemOf(marked.next, TEST_ID).trigger).toMatchObject({ detail: exactDetail, used: true, count: 1 });
      },
    );
  });

  it("показывает триггерные подробности при включённом и выключенном авторасчёте", () => {
    const enabled = fury(2, "Буревестник");
    const disabled = { ...enabled, automation: { ...enabled.automation!, enabled: false } };
    const featureId = "fury.aspect.2.zub-i-kogot";
    expect(itemOf(enabled, featureId).trigger?.detail).toBeTruthy();
    expect(itemOf(disabled, featureId).trigger?.detail).toBe(itemOf(enabled, featureId).trigger?.detail);
  });

  it("при выключенном авторасчёте показывает фичи и не трогает лист", () => {
    const hero = fury(4, "Берсерк");
    hero.automation = { ...hero.automation!, enabled: false };
    const snapshot = JSON.stringify(hero);

    const groups = classFeatureGroupsForSheet(hero);
    expect(groups.length).toBeGreaterThan(0);
    expect(itemsOf(hero).length).toBeGreaterThan(0);
    // Числа-описания считаются и без авторасчёта.
    expect(itemOf(hero, ASPECT_GATE).badges.length).toBeGreaterThan(0);
    // Сохранённые значения листа не изменились.
    expect(JSON.stringify(hero)).toBe(snapshot);
  });
});

describe("triggerBadgeCounts", () => {
  it("уменьшается после отметки триггера в этом раунде", () => {
    const hero = fury(4, "Буревестник");
    const total = triggerBadgeCounts(hero);
    expect(total).toBeGreaterThan(0);

    const first = classFeatureTriggers(hero)[0];
    const marked = previewGameAction(hero, {
      kind: "trigger",
      featureId: first.featureId,
      used: true,
    });
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(triggerBadgeCounts(marked.next)).toBe(total - 1);

    // Новый раунд снимает отметку раунда — триггер снова доступен.
    expect(triggerBadgeCounts(beginRound(marked.next))).toBe(total);
  });

  it("отметка триггера схватки переживает новый раунд", () => {
    const hero = fury(10, "Берсерк");
    const total = triggerBadgeCounts(hero);
    const trigger = classFeatureTriggers(hero).find(
      (item) => item.featureId === ENCOUNTER_TRIGGER,
    );
    expect(trigger?.frequency).toBe("encounter");

    const marked = previewGameAction(hero, {
      kind: "trigger",
      featureId: ENCOUNTER_TRIGGER,
      used: true,
    });
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    // Отметка схватки хранится номером схватки, а не раунда.
    expect(marked.next.runtime!.triggers[ENCOUNTER_TRIGGER]).toEqual({
      encounter: 1,
      count: 1,
    });
    expect(triggerBadgeCounts(marked.next)).toBe(total - 1);

    const nextRound = beginRound(marked.next);
    expect(nextRound.runtime!.round).toBe(2);
    expect(nextRound.runtime!.triggers[ENCOUNTER_TRIGGER]).toEqual({
      encounter: 1,
      count: 1,
    });
    expect(triggerBadgeCounts(nextRound)).toBe(total - 1);
    expect(itemOf(nextRound, ENCOUNTER_TRIGGER).trigger?.used).toBe(true);

    // Новая схватка снимает отметку.
    const nextEncounter = beginEncounter(nextRound);
    expect(nextEncounter.runtime!.triggers[ENCOUNTER_TRIGGER]).toBeUndefined();
    expect(triggerBadgeCounts(nextEncounter)).toBe(total);
  });
});

describe("classFeatureChoicesForSheet", () => {
  it("resolves every conduit choice alias for display and keeps legacy select values", () => {
    for (const group of ["conduit.prayer", "conduit.sanctuary"] as const) {
      for (const option of conduitFeatureChoiceOptions(group)) {
        for (const selected of [option.id, option.featureId, option.name, `  ${option.name.toLocaleUpperCase("ru")}  `]) {
          expect(featureSheetChoiceState({ group, label: group, options: conduitFeatureChoiceOptions(group).map(({ id }) => id), selected }))
            .toEqual({ selectedOption: option.id });
        }
      }
      expect(featureSheetChoiceState({ group, label: group, options: conduitFeatureChoiceOptions(group).map(({ id }) => id), selected: "unknown.value" }))
        .toMatchObject({ selectedOption: "", warning: expect.any(String) });
    }
  });

  it("keeps the resolver aliases aligned with legacy builder options and unique", () => {
    const prayer = conduitFeatureChoiceOptions("conduit.prayer");
    const sanctuary = conduitFeatureChoiceOptions("conduit.sanctuary");
    expect(prayer.map(({ id, name }) => ({ id, name }))).toEqual(CONDUIT_LEGACY_OPTIONS.prayer);
    expect(sanctuary.map(({ id, name }) => ({ id, name }))).toEqual(CONDUIT_LEGACY_OPTIONS.sanctuary);
    const all = [...prayer, ...sanctuary];
    expect(new Set(all.map(({ id }) => id)).size).toBe(all.length);
    expect(new Set(all.map(({ featureId }) => featureId)).size).toBe(all.length);
  });

  it("предлагает только отсутствующие выборы домена 1/4/7 из legacy-пары", () => {
    const hero = createCharacter({ className: "Проводник", level: 7 });
    hero.subclass = "Жизнь, Защита";
    hero.automation = { enabled: false, adjustments: { stamina: 2 }, ancestryTraits: ["old"], classFeatureSelections: { "conduit.domain.1": "Жизнь", legacy: "keep" } };
    const state = conduitLegacyDomainChoicesForSheet(hero);
    expect(state.choices.map(({ group, options, selected }) => [group, options, selected])).toEqual([
      ["conduit.domain.1", ["Жизнь", "Защита"], "Жизнь"],
      ["conduit.domain.4", ["Жизнь", "Защита"], undefined],
      ["conduit.domain.7", ["Жизнь", "Защита"], undefined],
    ]);
    expect(hero.subclass).toBe("Жизнь, Защита");
    expect(hero.automation.classFeatureSelections).toEqual({ "conduit.domain.1": "Жизнь", legacy: "keep" });
    expect(classFeatureChoicesForSheet(hero).some((choice) => choice.group === "conduit.domain.7")).toBe(true);
  });

  it("берёт пару из старого выбора доменов, ограничивает доступный уровень и не пропускает чужой класс", () => {
    const hero = createCharacter({ className: "Проводник", level: 3 });
    hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": "Защита, Жизнь" } };
    expect(conduitLegacyDomainChoicesForSheet(hero).choices.map((choice) => choice.group)).toEqual(["conduit.domain.1"]);
    hero.className = "Неистовый";
    expect(conduitLegacyDomainChoicesForSheet(hero).choices).toEqual([]);
    expect(conduitLegacyDomainChoicesForSheet(hero).message).toBeUndefined();
  });

  it("объясняет некорректную пару и не предлагает подменить её доменами", () => {
    const hero = createCharacter({ className: "Проводник", level: 10 });
    hero.subclass = "Жизнь, Жизнь";
    const invalid = conduitLegacyDomainChoicesForSheet(hero);
    expect(invalid.choices).toEqual([]);
    expect(invalid.message).toContain("выберите два разных домена");
    hero.subclass = "Жизнь, Неизвестный домен";
    expect(conduitLegacyDomainChoicesForSheet(hero).choices).toEqual([]);
    hero.automation = { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": "Жизнь, Неизвестный домен" } };
    const explicitInvalid = conduitLegacyDomainChoicesForSheet(hero);
    expect(explicitInvalid.message).toContain("Жизнь, Неизвестный домен");
    expect(explicitInvalid.message).toContain("оставлено без изменений");
  });

  it("показывает честное предупреждение только при пропущенных выборах пройденных уровней", () => {
    const legacy = createCharacter({ className: "Проводник", level: 7 });
    legacy.subclass = "Жизнь, Защита";
    const state = conduitLegacyDomainChoicesForSheet(legacy);
    expect(state.legacyWarning).toContain("ОДНА способность домена на каждом из уровней 2, 6");
    expect(state.legacyWarning).toContain("Наличие карты способности не подтверждает");
    // Completing the feature selectors does not prove that cards were added.
    const complete = { ...legacy, automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain.1": "Жизнь", "conduit.domain.4": "Защита", "conduit.domain.7": "Жизнь" } } };
    expect(conduitLegacyDomainChoicesForSheet(complete).legacyWarning).toContain("ОДНА способность");
    const mapping = conduitAbilities.find((entry) => entry.domain === "Жизнь" && entry.level === 2)!;
    const ability = ABILITY_COMPENDIUM.find((entry) => entry.id === mapping.abilityId)!;
    const ownedByName = { ...complete, abilities: [{ ...ability, id: "manual-custom-id" }] };
    expect(conduitLegacyDomainChoicesForSheet(ownedByName).legacyWarning).not.toContain("2-го"); // Either matching name+source card covers level 2.
    const ownedBoth = { ...ownedByName, abilities: [...ownedByName.abilities, ...conduitAbilities.filter((entry) => entry.level === 2 && entry.domain === "Защита").map((entry) => ABILITY_COMPENDIUM.find((item) => item.id === entry.abilityId)!)] };
    expect(conduitLegacyDomainChoicesForSheet(ownedBoth).legacyWarning).toContain("уровней 6");
    const acknowledged = confirmConduitLegacyRewardsReviewed(complete);
    expect(conduitLegacyDomainChoicesForSheet(acknowledged).legacyWarning).toBeUndefined();
    expect(acknowledged.automation?.classFeatureSelections?.legacy).toBeUndefined();
  });

  it("не предупреждает легального героя 9-го уровня с одной наградой каждого уровня", () => {
    const hero = createCharacter({ className: "Проводник", level: 9 });
    hero.subclass = "Жизнь, Защита";
    const selectedRewards = [
      conduitAbilities.find((entry) => entry.level === 2 && entry.domain === "Жизнь")!,
      conduitAbilities.find((entry) => entry.level === 6 && entry.domain === "Защита")!,
      conduitAbilities.find((entry) => entry.level === 9 && entry.domain === "Жизнь")!,
    ].map((entry) => ABILITY_COMPENDIUM.find((ability) => ability.id === entry.abilityId)!);
    hero.abilities = selectedRewards;
    expect(conduitLegacyDomainChoicesForSheet(hero).legacyWarning).toBeUndefined();

    // Удалены обе возможные карты 6-го уровня; карты 2-го и 9-го остаются.
    const withoutLevelSix = {
      ...hero,
      abilities: selectedRewards.filter((ability) => !conduitAbilities.some((entry) =>
        entry.level === 6 && entry.abilityId === ability.id,
      )),
    };
    const warning = conduitLegacyDomainChoicesForSheet(withoutLevelSix).legacyWarning!;
    expect(warning).toContain("ОДНА способность домена на каждом из уровней 6");
    expect(warning).not.toContain("2-го");
    expect(warning).not.toContain("9-го");
    expect(warning).not.toContain("Сияние Благодати");
    expect(warning).not.toContain("Кираса богов");
  });

  it("канонизирует написание Жизнь в значении, отображаемом селектом", () => {
    const hero = createCharacter({ className: "Проводник", level: 2 });
    hero.subclass = "жизнь, защита";
    hero.automation = { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain.1": "жИЗНЬ" } };
    const choice = conduitLegacyDomainChoicesForSheet(hero).choices[0];
    expect(choice.options).toEqual(["Жизнь", "Защита"]);
    expect(choice.selected).toBe("Жизнь");
    expect(choice.options.includes(choice.selected!)).toBe(true);
    expect(conduitLegacyDomainChoicesForSheet(hero).legacyWarning).toContain("ОДНА способность");
  });

  it("сохраняет и явно показывает сохранённый выбор уровня вне пары доменов", () => {
    const hero = createCharacter({ className: "Проводник", level: 2 });
    hero.subclass = "жизнь, защита";
    hero.automation = { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain.1": "неизвестный домен" } };
    const choice = conduitLegacyDomainChoicesForSheet(hero).choices[0];
    expect(choice.selected).toBe("неизвестный домен");
    expect(choice.options).not.toContain(choice.selected);
    expect(hero.automation.classFeatureSelections?.["conduit.domain.1"]).toBe("неизвестный домен");
  });

  it("позволяет заменить недопустимые explicit и subclass пары прямо в панели без потери данных", () => {
    const hero = createCharacter({ className: "Проводник", level: 4 });
    hero.subclass = "несуществующая пара";
    hero.automation = { enabled: false, adjustments: { stamina: 4 }, ancestryTraits: ["keep"], classFeatureSelections: { "conduit.domain": "тоже неверно", custom: "preserve", "conduit.domain.1": "Жизнь" } };
    const repaired = setConduitDomainPair(hero, ["Жизнь", "Защита"]);
    expect(conduitLegacyDomainChoicesForSheet(repaired).message).toBeUndefined();
    expect(conduitLegacyDomainChoicesForSheet(repaired).choices.map((choice) => choice.group)).toEqual(["conduit.domain.1", "conduit.domain.4"]);
    expect(repaired.subclass).toBe(hero.subclass);
    expect(repaired.automation?.adjustments).toEqual({ stamina: 4 });
    expect(repaired.automation?.ancestryTraits).toEqual(["keep"]);
    expect(repaired.automation?.classFeatureSelections).toMatchObject({ custom: "preserve", "conduit.domain.1": "Жизнь", "conduit.domain": "Жизнь, Защита" });
  });

  it("просит выбрать аспект, пока его нет ни в выборах, ни в подклассе", () => {
    const choices = classFeatureChoicesForSheet(fury(1));
    expect(choices).toHaveLength(1);
    expect(choices[0].group).toBe("fury.aspect");
    expect(choices[0].label).toBe("Аспект");
    expect(choices[0].options).toEqual(["Берсерк", "Разоритель", "Буревестник"]);
  });

  it("не спрашивает выбор, когда аспект уже записан", () => {
    expect(classFeatureChoicesForSheet(fury(1, "Буревестник"))).toEqual([]);

    const subclassHero = fury(1);
    subclassHero.subclass = "Разоритель";
    expect(classFeatureChoicesForSheet(subclassHero)).toEqual([]);
  });

  it("у класса без разобранных выборов ничего не спрашивает", () => {
    const bard = createCharacter({ className: "Трубадур", level: 3 });
    expect(classFeatureChoicesForSheet(bard)).toEqual([]);
  });

  it("Талант просит традицию, аугментацию и оберег с русскими подписями", () => {
    const talent = createCharacter({ className: "Талант", level: 3 });
    const choices = classFeatureChoicesForSheet(talent);
    expect(choices.map((choice) => choice.group)).toEqual([
      "talent.sanctuary",
      "talent.augmentation",
      "talent.tradition",
    ]);
    expect(choices.find((choice) => choice.group === "talent.tradition")?.options).toEqual([
      "Хронопатия",
      "Телекинез",
      "Телепатия",
    ]);
    const augmentation = choices.find(
      (choice) => choice.group === "talent.augmentation",
    );
    expect(augmentation?.selected).toBeUndefined();
    expect(augmentation?.optionLabels?.["talent.augmentation.density"]).toBe(
      "Аугментация плотности",
    );

    // Аугментация и оберег остаются в панели и после сохранения, чтобы их
    // можно было сменить на отдыхе; выбор традиции после записи скрывается.
    const saved = createCharacter({ className: "Талант", level: 3 });
    saved.subclass = "Телекинез";
    saved.automation = {
      enabled: true,
      adjustments: {},
      ancestryTraits: [],
      classFeatureSelections: {
        "talent.augmentation": "talent.augmentation.density",
        "talent.sanctuary": "talent.sanctuary.steel",
      },
    };
    const savedChoices = classFeatureChoicesForSheet(saved);
    expect(savedChoices.map((choice) => choice.group)).toEqual([
      "talent.sanctuary",
      "talent.augmentation",
    ]);
    expect(
      savedChoices.find((choice) => choice.group === "talent.augmentation")?.selected,
    ).toBe("talent.augmentation.density");
  });
});

describe("панель показывает механику и прозу, но не контейнеры", () => {
  it("показывает временно зарегистрированные механики Проводника и не подмешивает другие классы", () => {
    withConduitMechanics(() => {
      const conduit = createCharacter({ className: "Проводник", level: 6 });
      const conduitItems = itemsOf(conduit);
      expect(conduitItems.some((item) => item.id === "conduit.feature.1.blagochestie-v-boyu")).toBe(true);
      expect(conduitItems.every((item) => item.trigger ? item.trigger.detail.length > 0 : true)).toBe(true);

      for (const className of ["Трубадур"]) {
        const hero = createCharacter({ className, level: 6 });
        expect(classFeatureGroupsForSheet(hero)).toEqual([]);
        expect(classFeatureChoicesForSheet(hero)).toEqual([]);
      }
      expect(classFeatureChoicesForSheet(conduit).map((choice) => choice.group)).toContain("conduit.blooming-saint-immunity");
    });
  });

  it("у Неистового нет контейнеров и служебных заголовков", () => {
    const hero = fury(10, "Берсерк");
    const names = new Set(itemsOf(hero).map((item) => item.name));
    for (const container of [
      "Свирепость",
      "Растущая свирепость",
      "Особенности аспекта 1-го уровня",
      "Особенность аспекта 2-го уровня",
      "Способность аспекта 2-го уровня",
      "Триггер аспекта",
      "Героические способности",
      "Способности неистового",
    ]) {
      expect(names.has(container)).toBe(false);
    }
    // Прозаические особенности своего аспекта при этом остаются на листе.
    expect(names.has("Непреодолимая сила")).toBe(true);
    expect(names.has("Свирепость в бою")).toBe(true);
  });

  it("оставляет 6 пороговых строк выбранного аспекта и его триггеры", () => {
    const hero = fury(10, "Берсерк");
    const items = itemsOf(hero);
    const thresholds = items.filter((item) =>
      item.id.includes("rastushchaya-svirepost-berserka"),
    );
    expect(thresholds).toHaveLength(6);
    for (const item of thresholds) {
      expect(item.badges.some((badge) => badge.kind === "threshold")).toBe(true);
    }
    // Триггеры аспекта: строки порогов 4/8/12, «Линии силы», «Первозданная сила», «Воплощение Хаоса».
    const triggered = items.filter((item) => item.trigger);
    expect(triggered.length).toBeGreaterThanOrEqual(6);
    expect(triggered.map((item) => item.name)).toContain("Воплощение Хаоса");
  });

  it("не показывает записи с keyedBy у класса без зарегистрированной группы выборов", () => {
    const hero = createCharacter({ className: "Трубадур", level: 3 });
    withFeature(
      { className: "Трубадур", keyedBy: "aspect", keyValue: "Берсерк" },
      { kinds: ["bonus"], effects: [{ kind: "field", field: "speed", value: 1 }] },
      () => {
        // Выбор неизвестной группы панель проверить не может.
        expect(classFeatureGroupsForSheet(hero)).toEqual([]);
      },
    );
    withFeature(
      { className: "Трубадур" },
      { kinds: ["bonus"], effects: [{ kind: "field", field: "speed", value: 1 }] },
      () => {
        expect(itemsOf(hero)).toHaveLength(1);
      },
    );
  });
});

describe("featureLevelOpenState", () => {
  it("раскрывает ровно текущий уровень героя", () => {
    const groups = classFeatureGroupsForSheet(fury(4, "Берсерк"));
    const opened = (state: Record<number, boolean>) =>
      Object.entries(state)
        .filter(([, open]) => open)
        .map(([level]) => Number(level));

    expect(opened(featureLevelOpenState(groups, 4))).toEqual([4]);
    // Смена уровня пересчитывает умолчание, а не фиксирует прошлое открытие.
    expect(opened(featureLevelOpenState(groups, 2))).toEqual([2]);
    expect(opened(featureLevelOpenState(groups, 3))).toEqual([3]);
  });

  it("клик игрока переопределяет только тронутую группу", () => {
    const groups = classFeatureGroupsForSheet(fury(4, "Берсерк"));
    const state = featureLevelOpenState(groups, 4, { 1: true });
    expect(state[1]).toBe(true);
    expect(state[4]).toBe(true);
    expect(state[2]).toBe(false);

    // Явное закрытие текущего уровня тоже переживает пересчёт.
    expect(featureLevelOpenState(groups, 4, { 4: false })[4]).toBe(false);
    // А на другом уровне та же группа вернётся к умолчанию.
    expect(featureLevelOpenState(groups, 2, { 4: false })[2]).toBe(true);
  });
});

describe("частота отметки берётся из механики, а не из отфильтрованного списка", () => {
  it("невыполненный encounter-триггер отмечается по схватке и переживает раунд", () => {
    const hero = fury(4, "Берсерк");
    withFeature(
      {},
      {
        kinds: ["trigger"],
        trigger: {
          event: "combat-start",
          frequency: "encounter",
          label: "Тестовый триггер схватки",
          detail: "Срабатывает раз за схватку.",
          when: { resourceAtLeast: { name: "Свирепость", value: 5 } },
        },
      },
      () => {
        // Условие не выполнено, поэтому в список триггеров фича не попадает.
        expect(
          classFeatureTriggers(hero).some((item) => item.featureId === TEST_ID),
        ).toBe(false);

        const marked = previewGameAction(hero, {
          kind: "trigger",
          featureId: TEST_ID,
          used: true,
        });
        expect(marked.ok).toBe(true);
        if (!marked.ok) return;
        expect(marked.next.runtime!.triggers[TEST_ID]).toEqual({
          encounter: 1,
          count: 1,
        });
        const nextRound = beginRound(marked.next);
        expect(nextRound.runtime!.triggers[TEST_ID]).toEqual({
          encounter: 1,
          count: 1,
        });
        expect(beginEncounter(nextRound).runtime!.triggers[TEST_ID]).toBeUndefined();
      },
    );
  });
});

describe("прозаические особенности на листе", () => {
  const namesOf = (hero: Character) =>
    itemsOf(hero).map((item) => item.name);

  it("2-й уровень: «Непреодолимая сила» есть у Берсерка и нет у Разорителя", () => {
    expect(namesOf(fury(2, "Берсерк"))).toContain("Непреодолимая сила");
    expect(namesOf(fury(2, "Разоритель"))).not.toContain("Непреодолимая сила");
  });

  it("1-й уровень: прозаические особенности своего аспекта на месте", () => {
    const raider = namesOf(fury(1, "Разоритель"));
    expect(raider).toContain("Могучие прыжки");
    expect(raider).toContain("Первозданная хитрость");
    // Чужой аспект по-прежнему не показывается.
    expect(raider).not.toContain("Первозданная сила");
    expect(namesOf(fury(1, "Берсерк"))).toContain("Первозданная сила");
  });

  it("ни у одной показанной записи нет детей", () => {
    const shown = new Set(itemsOf(fury(10, "Берсерк")).map((item) => item.id));
    const parents = new Set(
      GENERATED_CLASS_FEATURES.map((feature) => feature.parentId).filter(
        (id): id is string => Boolean(id),
      ),
    );
    for (const id of shown) expect(parents.has(id)).toBe(false);
  });

  it("у прозаической записи подпись из текста и бейдж «по тексту правил»", () => {
    const item = itemOf(
      fury(2, "Берсерк"),
      "fury.aspect.2.nepreodolimaya-sila",
    );
    expect(
      item.summary.startsWith(
        "Всякий раз, когда вы используете действие атаки с рывком",
      ),
    ).toBe(true);
    expect(item.summary.length).toBeLessThanOrEqual(121);
    expect(item.badges).toContainEqual({
      kind: "text",
      label: "по тексту правил",
      active: true,
    });
  });

  it("прозаическая запись отдаёт полный текст для раскрытия", () => {
    const item = itemOf(
      fury(2, "Берсерк"),
      "fury.aspect.2.nepreodolimaya-sila",
    );
    expect(item.detail).toBeDefined();
    expect(item.detail!.length).toBeGreaterThan(item.summary.length);
    expect(item.detail).toContain("с рывком");
    // Числовая механика и книжное описание хранятся отдельно.
    const speed = itemOf(fury(2, "Разоритель"), SPEED_FEATURE);
    expect(speed.detail).toBeDefined();
    expect(speed.summaryFromDescription).toBeUndefined();
  });

  it("у триггерной записи без чисел подпись берётся из триггера", () => {
    const item = itemOf(
      fury(4, "Берсерк"),
      "fury.feature.4.rastushchaya-svirepost-berserka-8-4-y-uroven",
    );
    expect(item.summary).toBe("Первый толчок в свой ход при 8+ свирепости");
  });
});

describe("подпись строки", () => {
  it("подпись триггера, совпадающая с названием, заменяется текстом правила", () => {
    const item = itemOf(fury(1, "Берсерк"), "fury.aspect.1.linii-sily");
    expect(item.summary).not.toBe("Линии силы");
    expect(
      item.summary.startsWith("Вы перенаправляете энергию движения"),
    ).toBe(true);
  });
});
