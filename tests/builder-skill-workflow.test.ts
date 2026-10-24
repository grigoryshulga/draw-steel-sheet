import { describe, expect, it } from "vitest";
import { ancestrySkillSlots } from "../src/data/ancestry-skill-rules";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import {
  CLASS_SIGNATURE_COUNTS,
  canUseKit,
} from "../src/data/creation-rules";
import { careerPerkType, PERK_COMPENDIUM, perkById } from "../src/data/perks";
import { SKILL_GROUPS } from "../src/data/skills";
import { BUILDER_STEP_IDS } from "../src/lib/builder-steps";
import {
  buildCharacter,
  BUILDER_DATA,
  builderIssues,
  builderSkillSelections,
  builderSkillSlots,
  builderStepIssues,
  emptyBuilderDraft,
  grantedClassAbilities,
  startingCharacteristics,
  type BuilderDraft,
} from "../src/lib/character-builder";
import {
  resolveSkillSelection,
  toggleSkillSelection,
} from "../src/lib/skill-selection";

const CLASS_NAMES = [
  "Неистовый",
  "Нуль",
  "Проводник",
  "Тактик",
  "Талант",
  "Тень",
  "Трубадур",
  "Цензор",
  "Элементалист",
];

const CULTURE = {
  environment: "Сельское",
  organization: "Общинная",
  upbringing: "Академическое",
};

const DEVIL_TRAITS = ["Колючий хвост", "Крылья"];
const LIZARD_TRAITS = [
  "Скользкая чешуя",
  "Колючий хвост",
  "Реактивное перемещение",
];
const ORC_TRAITS = [
  "Страстный ремесленник",
  "Заземленность",
  "Натиск кровавого огня",
];

type SkillGroupKind = "ancestry" | "culture" | "career" | "class";
type SkillSeeds = Partial<Record<SkillGroupKind, string[]>>;

const skillGroups: readonly [SkillGroupKind, keyof BuilderDraft][] = [
  ["ancestry", "ancestrySkills"],
  ["culture", "cultureSkills"],
  ["career", "careerSkills"],
  ["class", "classSkills"],
];

/** Fills every skill group through the public engine, in builder order. */
function fillSkills(draft: BuilderDraft, seeds: SkillSeeds = {}): void {
  const slots = builderSkillSlots(draft);
  let prior: string[] = [];
  for (const [kind, field] of skillGroups) {
    const groupSlots = slots[kind];
    let values =
      seeds[kind] ?? groupSlots.map((slot) => slot.fixed ?? "");
    let state = resolveSkillSelection(groupSlots, values, prior);
    for (let guard = 0; !state.complete && guard < 100; guard++) {
      const next = state.selectable[0];
      if (!next) throw new Error(`no legal skill left for ${kind}`);
      values = toggleSkillSelection(groupSlots, values, prior, next);
      state = resolveSkillSelection(groupSlots, values, prior);
    }
    draft[field] = values;
    prior = [...prior, ...state.selected, ...state.automatic];
  }
}

function pickAbilities(draft: BuilderDraft): string[] {
  const granted = grantedClassAbilities(draft);
  const available = ABILITY_COMPENDIUM.filter(
    (ability) =>
      ability.className === draft.className &&
      ability.level === 1 &&
      !granted.some((entry) => entry.id === ability.id),
  );
  return [
    ...available
      .filter((ability) => ability.kind === "signature")
      .slice(0, CLASS_SIGNATURE_COUNTS[draft.className] ?? 0),
    ...[3, 5].flatMap((cost) =>
      available.filter((ability) => ability.resourceCost === cost).slice(0, 1),
    ),
    ...(draft.className === "Проводник"
      ? available.filter((ability) => ability.name === "Слово Наставления")
      : []),
  ].map((ability) => ability.id);
}

function completedDraft(
  className: string,
  overrides: Partial<BuilderDraft> = {},
  seeds: SkillSeeds = {},
): BuilderDraft {
  const source = BUILDER_DATA.classes.find((entry) => entry.name === className)!;
  const draft: BuilderDraft = {
    ...emptyBuilderDraft(),
    name: "Тестовый герой",
    ancestry: "Дварф",
    traits: ["Заземленность", "Искра с твоей кожи"],
    culture: CULTURE,
    career: "Солдат",
    incident: BUILDER_DATA.careers.find((entry) => entry.name === "Солдат")!
      .incidents[0],
    perkId: PERK_COMPENDIUM.find(
      (perk) => perk.type === careerPerkType("Солдат"),
    )!.id,
    className,
    subclass:
      className === "Проводник" ? "Жизнь, Защита" : source.subclasses[0].name,
    domain: className === "Цензор" ? "Жизнь" : "",
    characteristics: startingCharacteristics(className),
    featureChoices: Object.fromEntries(
      source.featureChoices.map((group) => [group.name, group.options[0].name]),
    ),
    ...overrides,
  };
  fillSkills(draft, seeds);
  if (canUseKit(draft.className, draft.subclass)) draft.kit = "Гора";
  if (draft.className === "Тактик") draft.secondaryKit = "Снайпер";
  draft.abilityIds = pickAbilities(draft);
  return draft;
}

/** Automation stores ancestry traits in catalog order, not draft order. */
function ancestorTraits(ancestry: string, names: readonly string[]): string[] {
  return BUILDER_DATA.ancestries
    .find((entry) => entry.name === ancestry)!
    .traits.map((trait) => trait.name)
    .filter((name) => names.includes(name));
}

function firstInvalidStep(draft: BuilderDraft): string {
  const issues = builderStepIssues(draft);
  return BUILDER_STEP_IDS.find((id) => issues[id]) ?? "summary";
}

describe("builder skill workflow", () => {
  it.each(CLASS_NAMES)(
    "completes the full creation flow for %s through the shared skill engine",
    (className) => {
      const draft = completedDraft(className);
      expect(Object.entries(builderStepIssues(draft)).filter(([, issue]) => issue)).toEqual(
        [],
      );
      expect(builderIssues(draft).filter(Boolean)).toEqual([]);

      const chain = builderSkillSelections(draft);
      const expected = [
        ...chain.ancestry,
        ...chain.culture,
        ...chain.career,
        ...chain.class,
      ];
      const hero = buildCharacter(draft);
      expect(hero.skills).toEqual([...new Set(expected)]);
      expect(hero.stamina.max).toBeGreaterThan(0);
      expect(hero.abilities.length).toBeGreaterThan(4);
    },
  );

  it("uses only the source-backed ancestry grants and no prose or project bonuses", () => {
    const interpersonal = SKILL_GROUPS.find(
      (group) => group.key === "interpersonal",
    )!;
    const exploration = SKILL_GROUPS.find(
      (group) => group.key === "exploration",
    )!;
    const intrigue = SKILL_GROUPS.find((group) => group.key === "intrigue")!;

    expect(ancestrySkillSlots("Дварф", ["Заземленность"])).toEqual([]);
    expect(ancestrySkillSlots("Дьявол", [])).toEqual([
      { label: "Навык происхождения (межличностный)", options: interpersonal.skills },
    ]);
    expect(ancestrySkillSlots("Таурус", [])[0].options).toEqual(
      exploration.skills,
    );
    expect(ancestrySkillSlots("Ящер", [])[0].options).toEqual(intrigue.skills);
    // «Скользкая чешуя» prints «ускальзывания»; the catalog name is mapped.
    expect(ancestrySkillSlots("Ящер", ["Скользкая чешуя"])).toEqual([
      { label: "Навык происхождения (интрига)", options: intrigue.skills },
      {
        label: "Мастер ускользания",
        options: ["Мастер ускользания"],
        fixed: "Мастер ускользания",
      },
    ]);
    // «Страстный ремесленник» only grants a project bonus, never proficiency.
    expect(ancestrySkillSlots("Орк", ["Страстный ремесленник"])).toEqual([]);
    expect(ancestrySkillSlots("Орк", ORC_TRAITS)).toEqual([]);
  });

  it("requests the ancestry skill, rejects prose picks and keeps it as prior for culture", () => {
    const draft = {
      ...completedDraft("Трубадур"),
      ancestry: "Дьявол",
      traits: DEVIL_TRAITS,
      ancestrySkills: [] as string[],
    };
    const slots = builderSkillSlots(draft);
    expect(slots.ancestry).toHaveLength(1);
    expect(builderStepIssues(draft)["ancestry-options"]).not.toBe("");
    expect(builderIssues(draft)[1]).not.toBe("");

    const malformed = { ...draft, ancestrySkills: ["История"] };
    expect(resolveSkillSelection(slots.ancestry, ["История"]).invalid).toEqual([
      "История",
    ]);
    expect(builderStepIssues(malformed)["ancestry-options"]).not.toBe("");

    const legal = { ...draft, ancestrySkills: ["Обман"] };
    expect(builderStepIssues(legal)["ancestry-options"]).toBe("");

    // The ancestry skill is prior for culture: picking it again is invalid.
    const cultureClash = { ...legal, cultureSkills: ["Обман", "Плавание", "История"] };
    expect(
      resolveSkillSelection(
        slots.culture,
        cultureClash.cultureSkills,
        ["Обман"],
      ).invalid,
    ).toEqual(["Обман"]);
    expect(builderStepIssues(cultureClash).culture).not.toBe("");

    const hero = buildCharacter(legal);
    expect(hero.skills).toContain("Обман");
    expect(hero.ancestryTraits).toContain("Серебряный Язык");
    expect(hero.automation?.ancestryTraits).toEqual(
      ancestorTraits("Дьявол", DEVIL_TRAITS),
    );
  });

  it("counts a fixed trait grant as automatic and refuses to spend the flexible grant on it", () => {
    const draft = completedDraft(
      "Трубадур",
      { ancestry: "Ящер", traits: LIZARD_TRAITS, ancestrySkills: [] },
      { ancestry: ["Внимательность"] },
    );
    const slots = builderSkillSlots(draft);
    expect(slots.ancestry).toHaveLength(2);
    expect(builderStepIssues(draft)["ancestry-options"]).toBe("");

    const state = resolveSkillSelection(slots.ancestry, draft.ancestrySkills!);
    expect(state.automatic).toEqual(["Мастер ускользания"]);
    expect(state.selected).toEqual(["Внимательность"]);
    expect(state.complete).toBe(true);

    // The reserved automatic skill cannot be consumed by the flexible grant.
    expect(
      resolveSkillSelection(slots.ancestry, ["Мастер ускользания", "Мастер ускользания"])
        .invalid,
    ).toEqual(["Мастер ускользания"]);
    expect(
      toggleSkillSelection(
        slots.ancestry,
        ["", "Мастер ускользания"],
        [],
        "Мастер ускользания",
      ),
    ).toEqual(["", "Мастер ускользания"]);

    const hero = buildCharacter(draft);
    expect(hero.skills).toContain("Мастер ускользания");
    expect(hero.skills).toContain("Внимательность");
    expect(hero.automation?.ancestryTraits).toEqual(
      ancestorTraits("Ящер", LIZARD_TRAITS),
    );
  });

  it("adds no skill for the orc «Страстный ремесленник» project bonus", () => {
    const draft = {
      ...emptyBuilderDraft(),
      name: "Орк",
      ancestry: "Орк",
      traits: ORC_TRAITS,
    };
    const slots = builderSkillSlots(draft);
    expect(slots.ancestry).toEqual([]);
    expect(builderStepIssues(draft)["ancestry-options"]).toBe("");
    expect(builderSkillSelections(draft).ancestry).toEqual([]);
    const hero = buildCharacter(draft);
    expect(hero.skills).toEqual([]);
    expect(hero.automation?.ancestryTraits).toEqual(
      ancestorTraits("Орк", ORC_TRAITS),
    );
  });

  it("keeps legacy drafts valid and still requests the new grant on relevant ancestries", () => {
    const dwarf = completedDraft("Нуль");
    delete dwarf.ancestrySkills;
    expect(builderStepIssues(dwarf)["ancestry-options"]).toBe("");
    expect(builderIssues(dwarf)[1]).toBe("");
    expect(() => buildCharacter(dwarf)).not.toThrow();

    const oldLizard = {
      ...completedDraft("Нуль"),
      ancestry: "Ящер",
      traits: LIZARD_TRAITS,
    };
    delete oldLizard.ancestrySkills;
    expect(builderStepIssues(oldLizard)["ancestry-options"]).not.toBe("");
    expect(builderIssues(oldLizard)[1]).not.toBe("");
    // The fixed trait grant is still applied for old drafts.
    expect(buildCharacter(oldLizard).skills).toContain("Мастер ускользания");
  });

  it("reserves a fixed career skill and replaces it when culture already granted it", () => {
    const base = completedDraft("Тактик", { career: "Моряк" });
    const draft = {
      ...base,
      cultureSkills: ["Алхимия", "Плавание", "История"],
      careerSkills: ["Плавание", "Прыжки", "Гимнастика"],
    };
    const slots = builderSkillSlots(draft);
    const prior = ["Алхимия", "Плавание", "История"];
    expect(slots.career[0]).toMatchObject({ fixed: "Плавание" });
    const state = resolveSkillSelection(slots.career, draft.careerSkills, prior);
    expect(state.automatic).toEqual([]);
    expect(state.required).toBe(3);
    expect(state.invalid).toEqual(["Плавание"]);
    expect(state.complete).toBe(false);
    expect(builderStepIssues(draft)["career-options"]).not.toBe("");

    // The replacement slot accepts a skill from outside the original group.
    const fixed = toggleSkillSelection(slots.career, draft.careerSkills, prior, "Азарт");
    expect(resolveSkillSelection(slots.career, fixed, prior).complete).toBe(true);
    expect(builderStepIssues({ ...draft, careerSkills: fixed })["career-options"]).toBe(
      "",
    );
    expect(buildCharacter({ ...draft, careerSkills: fixed }).skills).toContain(
      "Азарт",
    );
  });

  it("turns a duplicated fixed class skill into one flexible replacement slot", () => {
    const draft = completedDraft("Тень", { subclass: "Разоритель" });
    const slots = builderSkillSlots(draft);
    expect(slots.class.filter((slot) => slot.fixed === "Скрытность")).toHaveLength(2);
    const state = resolveSkillSelection(slots.class, draft.classSkills, []);
    expect(state.automatic).toEqual(["Скрытность", "Подкрадывание"]);
    expect(state.required).toBe(6);
    expect(state.complete).toBe(true);

    // A stale duplicate in the replacement position is rejected, not hidden.
    const stale = [...draft.classSkills];
    stale[slots.class.length - 1] = "Скрытность";
    expect(resolveSkillSelection(slots.class, stale).invalid).toEqual(["Скрытность"]);
    expect(resolveSkillSelection(slots.class, stale).complete).toBe(false);
  });

  it("blocks malformed raw arrays with the same validation the builder shows", () => {
    const draft = {
      ...completedDraft("Тактик"),
      cultureSkills: ["Алхимия", "Обман", "Обман"],
    };
    const slots = builderSkillSlots(draft);
    const state = resolveSkillSelection(slots.culture, draft.cultureSkills);
    expect(state.invalid).toEqual(["Обман", "Обман"]);
    expect(state.complete).toBe(false);
    expect(builderStepIssues(draft).culture).not.toBe("");
    expect(builderIssues(draft)[2]).not.toBe("");
    expect(firstInvalidStep(draft)).toBe("culture");

    const hero = buildCharacter(draft);
    const chain = builderSkillSelections(draft);
    expect(hero.skills).toEqual([
      ...new Set([
        ...chain.ancestry,
        ...chain.culture,
        ...chain.career,
        ...chain.class,
      ]),
    ]);
    expect(hero.skills).not.toContain("Обман");
  });

  it("keeps the legacy nine builderIssues positions and exposes twelve step ids", () => {
    const empty = emptyBuilderDraft();
    expect(builderIssues(empty)).toHaveLength(9);
    expect(Object.keys(builderStepIssues(empty))).toEqual([...BUILDER_STEP_IDS]);

    const emptyIssues = builderStepIssues(empty);
    // Choice steps only validate the top-level pick.
    expect(emptyIssues.concept).toBe("Дайте герою имя.");
    expect(emptyIssues.ancestry).toBe("Выберите происхождение.");
    expect(emptyIssues["ancestry-options"]).toBe(
      "Сначала выберите происхождение.",
    );
    expect(emptyIssues.career).toBe("Выберите карьеру.");
    expect(emptyIssues["career-options"]).toBe("Сначала выберите карьеру.");
    expect(emptyIssues.class).toBe("Выберите класс.");
    expect(emptyIssues["class-options"]).toBe("Сначала выберите класс.");
    expect(emptyIssues.kit).toBe("Сначала выберите класс.");
    expect(emptyIssues.abilities).toBe("Сначала выберите класс.");
    expect(emptyIssues.details).toBe("");
    expect(emptyIssues.summary).toBe("");
    expect(firstInvalidStep(empty)).toBe("concept");

    const named = { ...empty, name: "Герой" };
    expect(firstInvalidStep(named)).toBe("ancestry");

    const devil = {
      ...completedDraft("Трубадур"),
      ancestry: "Дьявол",
      traits: DEVIL_TRAITS,
      ancestrySkills: [],
    };
    expect(firstInvalidStep(devil)).toBe("ancestry-options");

    const complete = completedDraft("Трубадур");
    expect(firstInvalidStep(complete)).toBe("summary");

    const withoutSubclass = { ...complete, subclass: "" };
    expect(firstInvalidStep(withoutSubclass)).toBe("class-options");
    const withoutKit = { ...complete, kit: "" };
    expect(firstInvalidStep(withoutKit)).toBe("kit");
  });

  it("never reports a dependent step complete while its parent pick is missing", () => {
    const empty = emptyBuilderDraft();
    const issues = builderStepIssues(empty);
    expect(issues["ancestry-options"]).toBe("Сначала выберите происхождение.");
    expect(issues["career-options"]).toBe("Сначала выберите карьеру.");
    expect(issues["class-options"]).toBe("Сначала выберите класс.");
    expect(issues.kit).toBe("Сначала выберите класс.");
    expect(issues.abilities).toBe("Сначала выберите класс.");
    for (const id of [
      "ancestry",
      "ancestry-options",
      "career",
      "career-options",
      "class",
      "class-options",
      "kit",
      "abilities",
    ] as const)
      expect(issues[id]).not.toBe("");

    // A catalog entry without basics is not a selectable class yet.
    const unfinished = {
      ...empty,
      name: "Герой",
      className: "Призыватель",
      characteristics: startingCharacteristics("Призыватель"),
    };
    const unfinishedIssues = builderStepIssues(unfinished);
    expect(unfinishedIssues.class).toBe("Выберите класс.");
    expect(unfinishedIssues["class-options"]).toBe("Сначала выберите класс.");
    expect(unfinishedIssues.kit).toBe("Сначала выберите класс.");
    expect(firstInvalidStep(unfinished)).toBe("ancestry");

    // Once the parent is chosen the dependent step validates its own options.
    const careerPicked = {
      ...completedDraft("Тактик"),
      career: "Моряк",
      careerSkills: [],
    };
    expect(builderStepIssues(careerPicked).career).toBe("");
    expect(builderStepIssues(careerPicked)["career-options"]).toBe(
      "Заполните навыки карьеры; повторяющиеся навыки замените.",
    );
  });

  it("does not mutate the draft while validating or building", () => {
    const draft = completedDraft("Элементалист");
    const before = JSON.stringify(draft);
    builderIssues(draft);
    builderStepIssues(draft);
    builderSkillSelections(draft);
    buildCharacter(draft);
    expect(JSON.stringify(draft)).toBe(before);
  });

  it("keeps ancestry traits, manuals and automation fields while adding ancestry skills", () => {
    const draft = completedDraft("Трубадур", {
      ancestry: "Дьявол",
      traits: DEVIL_TRAITS,
      details: "Ручная предыстория",
      connections: "Старый друг",
      features: "Ручная особенность",
    });
    expect(draft.ancestrySkills).toHaveLength(1);
    const hero = buildCharacter(draft);
    expect(hero.skills).toContain(draft.ancestrySkills![0]);
    expect(hero.ancestryTraits).toContain("Серебряный Язык");
    expect(hero.notes.story).toContain("Ручная предыстория");
    expect(hero.notes.contacts).toBe("Старый друг");
    expect(hero.classFeatures).toContain("Ручная особенность");
    expect(hero.automation?.ancestryTraits).toEqual(DEVIL_TRAITS);
  });

  it("turns the «Исполнитель» «Музыка или Выступление» choice into a free replacement once culture owns both", () => {
    // Real player chain: culture Городское/Бюрократическая/Творческое grants
    // Музыка, Выступление and Алхимия, so the career choice offers only owned
    // skills. Source 0301 allows a different skill from any group here.
    const draft = completedDraft(
      "Трубадур",
      {
        career: "Исполнитель",
        culture: {
          environment: "Городское",
          organization: "Бюрократическая",
          upbringing: "Творческое",
        },
        incident: BUILDER_DATA.careers.find(
          (career) => career.name === "Исполнитель",
        )!.incidents[0],
        perkId: PERK_COMPENDIUM.find(
          (perk) => perk.type === careerPerkType("Исполнитель"),
        )!.id,
      },
      {
        culture: ["Музыка", "Выступление", "Алхимия"],
        career: ["Кулинария", "Обман", "Эмпатия"],
      },
    );
    const chain = builderSkillSelections(draft);
    expect([...chain.culture].sort()).toEqual(
      ["Алхимия", "Выступление", "Музыка"].sort(),
    );
    const prior = chain.culture;
    expect([...chain.career].sort()).toEqual(
      ["Кулинария", "Обман", "Эмпатия"].sort(),
    );
    expect(chain.career).toContain("Кулинария");

    // The career group exposes the replacement instead of dead-ending on the
    // two already owned options.
    const state = resolveSkillSelection(chain.slots.career, [], prior);
    expect(state.complete).toBe(false);
    expect(state.available).toContain("Кулинария");
    expect(state.requirements[0].label).toBe(
      "Замена: Музыка или Выступление (уже известны)",
    );

    // The full draft still validates and builds with three career skills.
    expect(Object.entries(builderStepIssues(draft)).filter(([, issue]) => issue)).toEqual(
      [],
    );
    expect(builderIssues(draft).filter(Boolean)).toEqual([]);
    const hero = buildCharacter(draft);
    expect(hero.skills).toEqual([
      ...new Set([
        ...chain.ancestry,
        ...chain.culture,
        ...chain.career,
        ...chain.class,
      ]),
    ]);
    expect(hero.skills).toContain("Кулинария");
    expect(hero.skills).not.toContain("Музыка ");
  });

  it("keeps the partially known «Исполнитель» choice narrow instead of broadening it", () => {
    const draft = completedDraft(
      "Трубадур",
      {
        career: "Исполнитель",
        culture: {
          environment: "Городское",
          organization: "Бюрократическая",
          upbringing: "Творческое",
        },
        incident: BUILDER_DATA.careers.find(
          (career) => career.name === "Исполнитель",
        )!.incidents[0],
        perkId: PERK_COMPENDIUM.find(
          (perk) => perk.type === careerPerkType("Исполнитель"),
        )!.id,
      },
      { culture: ["Музыка", "Обман", "Алхимия"] },
    );
    const slots = builderSkillSlots(draft);
    const state = resolveSkillSelection(slots.career, [], ["Музыка"]);
    expect(state.complete).toBe(false);
    expect(state.available).toContain("Выступление");
    expect(state.available).not.toContain("Кулинария");
    expect(
      toggleSkillSelection(slots.career, ["", "", ""], ["Музыка"], "Кулинария"),
    ).toEqual(["", "", ""]);

    const filled = toggleSkillSelection(
      slots.career,
      ["", "", ""],
      ["Музыка"],
      "Выступление",
    );
    expect(resolveSkillSelection(slots.career, filled, ["Музыка"]).complete).toBe(
      false,
    );
  });

  it("survives malformed stored skill arrays without throwing and drops them from the build", () => {
    const base = completedDraft("Трубадур");
    const junk: [string, unknown][] = [
      ["number", 42],
      ["object", {}],
      ["null", null],
      ["undefined", undefined],
    ];
    for (const [label, raw] of junk) {
      const draft = { ...base, cultureSkills: raw as string[] };
      expect(() => builderStepIssues(draft), label).not.toThrow();
      expect(() => builderIssues(draft), label).not.toThrow();
      expect(() => builderSkillSelections(draft), label).not.toThrow();
      expect(builderStepIssues(draft).culture, label).not.toBe("");
      expect(builderIssues(draft)[2], label).not.toBe("");
      const state = resolveSkillSelection(
        builderSkillSlots(draft).culture,
        raw as string[],
      );
      expect(state.complete, label).toBe(false);
      if (raw === undefined) expect(state.invalid, label).toEqual([]);
      else expect(state.invalid.length, label).toBeGreaterThan(0);
      // The draft is never rewritten while reporting the problem.
      expect(draft.cultureSkills, label).toBe(raw);
      const hero = buildCharacter(draft);
      const chain = builderSkillSelections(draft);
      expect(hero.skills, label).toEqual([
        ...new Set([
          ...chain.ancestry,
          ...chain.culture,
          ...chain.career,
          ...chain.class,
        ]),
      ]);
      expect(hero.skills, label).not.toContain("42");
    }

    // Non-string entries inside a real array keep the valid picks.
    const mixed = {
      ...base,
      cultureSkills: ["Алхимия", 42, {}, null, undefined] as unknown as string[],
    };
    expect(() => builderStepIssues(mixed)).not.toThrow();
    expect(builderStepIssues(mixed).culture).not.toBe("");
    expect(builderIssues(mixed)[2]).not.toBe("");
    expect(
      resolveSkillSelection(
        builderSkillSlots(mixed).culture,
        mixed.cultureSkills,
      ).invalid,
    ).toEqual(["42", "{}", "null", "undefined"]);
    expect(builderSkillSelections(mixed).culture).toEqual(["Алхимия"]);
    const mixedHero = buildCharacter(mixed);
    expect(mixedHero.skills).toContain("Алхимия");
    for (const junkName of ["42", "{}", "null", "undefined"])
      expect(mixedHero.skills).not.toContain(junkName);

    // Career and class arrays are guarded the same way.
    const broken = {
      ...base,
      careerSkills: {} as unknown as string[],
      classSkills: 42 as unknown as string[],
    };
    expect(() => builderStepIssues(broken)).not.toThrow();
    expect(builderIssues(broken)[3]).not.toBe("");
    expect(builderIssues(broken)[4]).not.toBe("");
    expect(() => buildCharacter(broken)).not.toThrow();
  });
});

// Guard the fixture itself: the data catalogs used above must stay real.
describe("builder skill workflow fixtures", () => {
  it("uses catalogs that contain the referenced careers, ancestries and perks", () => {
    expect(BUILDER_DATA.ancestries).toHaveLength(14);
    expect(BUILDER_DATA.careers.find((career) => career.name === "Моряк")).toBeTruthy();
    expect(
      BUILDER_DATA.ancestries.find((ancestry) => ancestry.name === "Ящер")!
        .traits.map((trait) => trait.name),
    ).toEqual(expect.arrayContaining(LIZARD_TRAITS));
    expect(perkById(PERK_COMPENDIUM[0].id)).toBeTruthy();
  });
});
