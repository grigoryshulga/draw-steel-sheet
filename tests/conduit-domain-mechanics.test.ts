import { afterEach, describe, expect, it } from "vitest";
import { GENERATED_CLASS_FEATURES as generated } from "../src/data/class-features/skeleton";
import { CONDUIT_DOMAIN_MECHANICS, CONDUIT_DOMAIN_PRAYERS } from "../src/data/class-features/mechanics/conduit-domains";
import { CLASS_RESOURCES } from "../src/data/class-features/class-resources";
import { FEATURE_MECHANICS } from "../src/data/class-features/mechanics";
import { createCharacter } from "../src/lib/defaults";
import { activeClassFeatures, invalidateClassFeatureRegistry } from "../src/lib/class-features";
import { resolvedResourceGains } from "../src/lib/resources";

const originalMechanics = { ...FEATURE_MECHANICS };
const originalResources = { ...CLASS_RESOURCES };
afterEach(() => {
  for (const id of Object.keys(FEATURE_MECHANICS)) delete FEATURE_MECHANICS[id];
  Object.assign(FEATURE_MECHANICS, originalMechanics);
  for (const id of Object.keys(CLASS_RESOURCES)) delete CLASS_RESOURCES[id];
  Object.assign(CLASS_RESOURCES, originalResources);
  invalidateClassFeatureRegistry();
});

const selectedDomains: Record<string, string> = { creation: "Созидание", death: "Смерть", fate: "Судьба", knowledge: "Знание", life: "Жизнь", love: "Любовь", nature: "Природа", protection: "Защита", storm: "Буря", sun: "Солнце", trickery: "Хитрость", war: "Война" };
const domains = generated.filter((feature) => feature.className === "Проводник" && feature.keyedBy === "domain");
const prayers = generated.filter((feature) => feature.id.startsWith("feature.conduit.level-1.domain-piety-and-effects."));
const prayerSuffix = (id: string) => id.slice(id.lastIndexOf(".") + 1);
const text = (id: string) => generated.find((feature) => feature.id === id)!.description;

describe("conduit domain mechanics", () => {
  it("individually documents and registers all 72 domain features", () => {
    expect(domains).toHaveLength(72);
    expect(Object.keys(CONDUIT_DOMAIN_MECHANICS).sort()).toEqual(domains.map((feature) => feature.id).sort());
    expect([...new Set(domains.map((feature) => feature.level))].sort()).toEqual([1, 2, 4, 6, 7, 9]);
    const notes = Object.values(CONDUIT_DOMAIN_MECHANICS).map((mechanic) => mechanic.notes);
    expect(notes.every((note) => typeof note === "string" && note.length > 100)).toBe(true);
    expect(new Set(notes).size).toBe(72);
    expect(notes.some((note) => note?.includes("Пассивная/отдыховая особенность домена"))).toBe(false);
    expect(notes.some((note) => note?.includes("Эффект адресован выбранной цели/области"))).toBe(false);
  });

  it("binds all twelve piety triggers to their own domain selection and exact book condition", () => {
    expect(prayers).toHaveLength(12);
    expect(Object.keys(CONDUIT_DOMAIN_PRAYERS).sort()).toEqual(prayers.map((feature) => feature.id).sort());
    for (const prayer of prayers) {
      const mechanic = CONDUIT_DOMAIN_PRAYERS[prayer.id];
      const suffix = prayerSuffix(prayer.id);
      expect(mechanic.when?.keyValue).toEqual([selectedDomains[suffix]]);
      expect(mechanic.kinds).toContain("trigger");
      expect(mechanic.trigger?.frequency).toBe("encounter");
      expect(mechanic.trigger?.detail).toContain("Получить 2 благочестия");
      expect(mechanic.kinds).toContain("resourceGain");
      expect(mechanic.resource).toMatchObject({ name: "Благочестие", gains: [{ amount: "2", amountByLevel: [{ level: 4, amount: "3" }], frequency: "encounter" }] });
      expect(mechanic.resource?.gains[0].tag).toBeTruthy();
      expect(mechanic.resource?.gains[0].label).toBeTruthy();
      expect(mechanic.resource?.gains[0].event).toBe(mechanic.trigger?.event);
      expect(mechanic.effects).toBeUndefined();
      expect(mechanic.trigger?.detail).toContain("первый раз за встречу");
      expect(mechanic.trigger?.detail).toContain("На 4-м уровне и выше размер этой прибавки уже равен 3");
      expect(mechanic.trigger?.detail).not.toContain("добавляет 1 благочестие");
      expect(mechanic.trigger?.detail).not.toContain("прибавьте 1 вручную");
      expect(mechanic.trigger?.detail).not.toContain("Схема ResourceGain не выражает условие уровня");
      expect(mechanic.notes).toContain("Точные дальность");
    }
    expect(CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".death"))!.id].trigger?.detail).toContain("соло-существо");
    expect(CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".knowledge"))!.id].trigger?.event).toBe("passive");
    expect(CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".life"))!.id].trigger?.event).toBe("spend-recovery");
    expect(CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".life"))!.id].trigger?.detail).toContain("не всегда означает трату Восстановления");
    expect(CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".sun"))!.id].trigger?.detail).toContain("огнём или святым уроном");
    const war = CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".war"))!.id];
    expect(war.trigger?.detail).toContain("вы или существо в пределах 10 клеток получает за один ход урон больше 10 + ваш уровень");
    const sunNotes = CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".sun"))!.id].notes;
    expect(sunNotes).toContain("Один враг в пределах 10 клеток получает урон огнем");
    expect(sunNotes).not.toContain("выбирает себя ИЛИ союзника");
    expect(CONDUIT_DOMAIN_PRAYERS[prayers.find((f) => f.id.endsWith(".protection"))!.id].trigger?.detail).toContain("вы или союзник в пределах 10 получает временную Выносливость");
  });

  it("models only safe owner-facing effects and rejects false target bonuses", () => {
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-1.sanctified-weapon"].effects).toBeUndefined();
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-4.4th-level-domain-feature.war"].effects).toBeUndefined();
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-7.word-of-death-deferred"].effects).toBeUndefined();
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-7.word-of-fate-denied"].trigger?.event).toBe("ally-damaged");
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-7.thunderstruck"].effects?.map((effect) => "field" in effect ? effect.field : "")).toEqual(["push", "pull", "slide"]);
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-7.thunderstruck"].trigger?.event).toBe("deal-damage");
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-7.font-of-grace"].trigger?.event).toBe("use-ability");
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-7.font-of-grace"].notes).toContain("только на эту способность в том же ходу");
    const sun = CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-7.light-of-the-burning-sun"];
    expect(sun.effects).toEqual([{ kind: "damageImmunity", types: ["огонь"], value: { level: true } }]);
    expect(sun.notes).toContain("15, если цель нежить");
    expect(sun.notes).toContain("добавляет 5 огня");
    expect(sun.notes).toContain("не фильтровать по ключевым словам");
    expect(sun.notes).toContain("числовой эффект не автоматизирован");
  });

  it("checks independent book numbers against represented effects and rule notes", () => {
    expect(text("feature.ability.conduit.level-2.statue-of-power")).toContain("получаете 1 всплеск в начале каждого вашего хода");
    expect(text("feature.ability.conduit.level-2.statue-of-power")).toContain("20 или более урона");
    expect(text("feature.conduit.level-7.light-of-the-burning-sun")).toContain("дополнительные 15 урона огнем");
    expect(text("feature.ability.conduit.level-9.alacrity-of-the-heart")).toContain("получает 3 очка своего Героического Ресурса");
    expect(text("feature.conduit.level-1.sanctified-weapon")).toContain("бонус +1 к выброшенному урону");
    expect(text("feature.conduit.level-4.4th-level-domain-feature.war")).toContain("бонус +3");
    expect(text("feature.conduit.level-4.4th-level-domain-feature.storm")).toContain("5 или более Побед");
    expect(text("feature.conduit.level-1.domain-piety-and-effects.sun")).toContain("трехкратному показателю вашей Интуиции");
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-1.inner-light"].effects).toBeUndefined();
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-1.revitalizing-ritual"].effects).toBeUndefined();
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-4.4th-level-domain-feature.storm"].effects).toBeUndefined();
  });

  it("resolves exactly the selected domains' piety gains", () => {
    const allTags = Object.values(CONDUIT_DOMAIN_PRAYERS).map((mechanic) => mechanic.resource!.gains[0].tag);
    expect(new Set(allTags).size).toBe(12);
    for (const [id, mechanics] of Object.entries(CONDUIT_DOMAIN_PRAYERS)) {
      FEATURE_MECHANICS[id] = mechanics;
    }
    CLASS_RESOURCES["проводник"] = { name: "Благочестие", gains: [] };
    invalidateClassFeatureRegistry();
    const hero = createCharacter({ className: "Проводник", level: 4 });
    hero.automation = { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": "Жизнь, Солнце" } };

    const gains = resolvedResourceGains(hero).filter((gain) => gain.tag.startsWith("conduit-piety-domain-"));
    expect(gains).toHaveLength(2);
    expect(gains.map((gain) => [gain.amount, gain.frequency])).toEqual([["3", "encounter"], ["3", "encounter"]]);
    const blessedDomain = generated.find((feature) => feature.id === "feature.conduit.level-4.blessed-domain")!;
    expect(blessedDomain.level).toBe(4);
    expect(blessedDomain.description).toContain("получаете 1 дополнительное благочестие");
    expect(gains).toHaveLength(2);
    expect(gains.map((gain) => gain.event)).toEqual(["spend-recovery", "deal-damage"]);
    expect(new Set(gains.map((gain) => gain.tag)).size).toBe(2);
    expect(gains.map((gain) => gain.sourceId).sort()).toEqual([
      "feature.conduit.level-1.domain-piety-and-effects.sun",
      "feature.conduit.level-1.domain-piety-and-effects.life",
    ].sort());
    expect(gains.some((gain) => /znanie|priroda/u.test(gain.tag))).toBe(false);
  });

  it("does not apply target-selected prayer numbers to the hero", () => {
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-1.inner-light"].effects).toBeUndefined();
    expect(CONDUIT_DOMAIN_MECHANICS["feature.conduit.level-1.revitalizing-ritual"].effects).toBeUndefined();
    for (const domain of ["life", "sun"]) {
      const prayer = CONDUIT_DOMAIN_PRAYERS[`feature.conduit.level-1.domain-piety-and-effects.${domain}`];
      expect(prayer.effects).toBeUndefined();
      expect(prayer.notes).toContain("выбор цели остаются ручными");
    }
  });

  it("requires exactly two distinct valid domains for prayers, including legacy fallback", () => {
    for (const [id, mechanics] of Object.entries(CONDUIT_DOMAIN_PRAYERS)) {
      FEATURE_MECHANICS[id] = mechanics;
    }
    CLASS_RESOURCES["проводник"] = { name: "Благочестие", gains: [] };
    invalidateClassFeatureRegistry();
    const hero = (selections: Record<string, string>, subclass?: string, className = "Проводник") => {
      const character = createCharacter({ className, level: 1 });
      if (subclass) character.subclass = subclass;
      character.automation = { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: selections };
      return character;
    };
    const prayerIds = () => activeClassFeatures(hero({ "conduit.domain": "Жизнь, Смерть" })).filter((f) => f.id.startsWith("feature.conduit.level-1.domain-piety-and-effects.")).map((f) => f.id);
    expect(prayerIds()).toHaveLength(2);
    for (const pair of ["Жизнь", "Жизнь, Смерть, Знание", "Жизнь, Жизнь"]) {
      const invalid = hero({ "conduit.domain": pair });
      expect(activeClassFeatures(invalid).some((f) => f.id.startsWith("feature.conduit.level-1.domain-piety-and-effects."))).toBe(false);
      expect(resolvedResourceGains(invalid).filter((g) => g.tag.startsWith("conduit-piety-domain-"))).toHaveLength(0);
    }
    expect(activeClassFeatures(hero({}, "Жизнь, Смерть")).filter((f) => f.id.startsWith("feature.conduit.level-1.domain-piety-and-effects."))).toHaveLength(2);
    const precedence = hero({ "conduit.domain": "Знание", "conduit.domain.1": "Жизнь" }, "Жизнь, Смерть");
    expect(activeClassFeatures(precedence).some((f) => f.id.endsWith(".life"))).toBe(false);
    expect(activeClassFeatures(hero({ "conduit.domain": "Жизнь, Смерть" }, undefined)).filter((f) => f.id.startsWith("feature.conduit.level-1.domain-piety-and-effects."))).toHaveLength(2);
    expect(activeClassFeatures(hero({ "conduit.domain": "Жизнь, Смерть" }, undefined, "Неистовый")).some((f) => f.id.startsWith("feature.conduit.level-1.domain-piety-and-effects."))).toBe(false);
  });

  it("labels domain gains with their subject and exact event while preserving Fury labels", () => {
    const expectedLabels: Record<string, string> = {
      "creation": "Существо в пределах 10 клеток использует способность по области",
      "death": "Не-миньон в пределах 10 клеток снижает Выносливость до 0 или соло-существо там становится утомлённым",
      "fate": "Союзник в пределах 10 клеток получает третий тир или враг там получает первый тир броска силы",
      "knowledge": "Ведущий тратит Раздор",
      "life": "Существо в пределах 10 клеток восстанавливает Выносливость",
      "love": "Вы или союзник в пределах 10 клеток используете помощь в атаке или способность, нацеленную на союзника",
      "nature": "Вы или существо в пределах 10 клеток получаете кислотный, холодный, огненный, молниевый, ядовитый или звуковой урон",
      "protection": "Вы или союзник в пределах 10 клеток получаете временную Выносливость или применяете триггер снижения урона, помехи либо двойной помехи врагу",
      "storm": "Враг в пределах 10 клеток подвергается принудительному движению",
      "sun": "Враг в пределах 10 клеток получает огненный или святой урон",
      "trickery": "Вы или существо в пределах 10 клеток совершаете помощь в атаке или тест Скрытности",
      "war": "Вы или существо в пределах 10 клеток получает за один ход урон больше 10 + ваш уровень",
    };
    expect(Object.keys(expectedLabels)).toHaveLength(12);
    for (const [suffix, label] of Object.entries(expectedLabels)) {
      const id = "feature.conduit.level-1.domain-piety-and-effects." + suffix;
      expect(CONDUIT_DOMAIN_PRAYERS[id].resource?.gains[0]).toMatchObject({ label: `Домен ${selectedDomains[suffix]}: ${label}`, amount: "2", amountByLevel: [{ level: 4, amount: "3" }], frequency: "encounter" });
    }
    for (const [id, mechanics] of Object.entries(CONDUIT_DOMAIN_PRAYERS)) FEATURE_MECHANICS[id] = mechanics;
    CLASS_RESOURCES["проводник"] = { name: "Благочестие", gains: [] };
    invalidateClassFeatureRegistry();
    const character = createCharacter({ className: "Проводник", level: 1 });
    character.automation = { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": "Знание, Смерть, Жизнь" } };
    // Three domains are invalid, so use the actual pair for resolution.
    character.automation.classFeatureSelections["conduit.domain"] = "Знание, Смерть";
    const gains = resolvedResourceGains(character).filter((gain) => gain.tag.startsWith("conduit-piety-domain-"));
    expect(new Set(gains.map((gain) => gain.label)).size).toBe(gains.length);
    expect(gains.find((gain) => gain.event === "passive")?.label).toBe("Домен Знание: Ведущий тратит Раздор");
    expect(gains.find((gain) => gain.event === "dying")?.label).toBe("Домен Смерть: Не-миньон в пределах 10 клеток снижает Выносливость до 0 или соло-существо там становится утомлённым");
    expect(gains.map((gain) => gain.amount)).toEqual(["2", "2"]);
  });
});
