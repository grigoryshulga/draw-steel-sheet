import { describe, expect, it } from "vitest";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { createCharacter } from "../src/lib/defaults";
import {
  applyDevelopment,
  buildDevelopmentPlan,
  developmentIssues,
  draftIsDirty,
  nextLevelEngaged,
  stepSelection,
  type DevelopmentDraft,
  type DevelopmentLevel,
  type DevelopmentPlan,
  type DevelopmentStep,
} from "../src/lib/development";
import { getLevelUpPlan, previewLevelUp } from "../src/lib/level-up";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { conduitAbilities } from "../src/data/class-features/conduit-abilities";
import type { Character } from "../src/types";

const ENOUGH_XP = 400;

function subclassOf(className: string): string {
  const classData = buildCharacterClass(className);
  return classData;
}

/** Первый подкласс класса из данных конструктора. */
function buildCharacterClass(className: string): string {
  // BUILDER_DATA доступен из конструктора; подклассы нужны стабильные.
  const subclass = {
    Талант: "Хронопатия",
    Проводник: "Смерть, Жизнь",
  }[className];
  if (!subclass) throw new Error(`No subclass fixture for ${className}`);
  return subclass;
}

/** Герой, собранный в конструкторе: у него есть навыки происхождения и карьеры. */
function builtHero(className: string): Character {
  const built = buildCharacter({
    ...emptyBuilderDraft(),
    name: "Герой развития",
    ancestry: "Дварф",
    className,
    subclass: subclassOf(className),
    characteristics: startingCharacteristics(className),
    classSkills: [],
    abilityIds: [],
    featureChoices: {},
  });
  return { ...built, level: 1, xp: ENOUGH_XP };
}

function bareHero(className: string, level = 1): Character {
  return {
    ...createCharacter({ name: "Герой развития", className, level }),
    subclass: subclassOf(className),
    xp: ENOUGH_XP,
  };
}

/** Повышает героя на уровень, выбирая первые допустимые варианты. */
function levelUp(hero: Character): Character {
  const plan = getLevelUpPlan(hero);
  if (!plan.available) throw new Error(plan.reason ?? "level up unavailable");
  const choices: Record<string, string[]> = {};
  for (const choice of plan.choices) {
    choices[choice.id] = choice.options
      .slice(0, choice.count)
      .map((option) => option.id);
  }
  const result = previewLevelUp(hero, {
    characterId: hero.id,
    fromLevel: hero.level,
    className: hero.className,
    subclass: hero.subclass ?? "",
    mode: "milestone",
    choices,
    reviewedRules: true,
  });
  if (!result.ok) throw new Error(result.issues.join("; "));
  return result.next;
}

function heroAt(className: string, level: number): Character {
  let hero = builtHero(className);
  for (let current = 1; current < level; current += 1) hero = levelUp(hero);
  return hero;
}

function nextSection(plan: ReturnType<typeof buildDevelopmentPlan>): DevelopmentLevel {
  const level = plan.levels.find((entry) => entry.status === "next");
  if (!level) throw new Error("no next level section");
  return level;
}

function findStep(
  plan: ReturnType<typeof buildDevelopmentPlan>,
  level: number,
  kind: DevelopmentStep["kind"],
): DevelopmentStep {
  const section = plan.levels.find((entry) => entry.level === level);
  const step = section?.steps.find((entry) => entry.kind === kind);
  if (!step) throw new Error(`no ${kind} step on level ${level}`);
  return step;
}

/** Черновик, где каждый шаг следующего уровня заполнен первым вариантом. */
function fillNext(plan: ReturnType<typeof buildDevelopmentPlan>): DevelopmentDraft {
  const draft: DevelopmentDraft = {};
  for (const step of nextSection(plan).steps) {
    draft[step.id] = step.options
      .slice(0, step.count)
      .map((option) => option.id);
  }
  return draft;
}

function messages(plan: ReturnType<typeof buildDevelopmentPlan>, draft: DevelopmentDraft, reviewedRules = true): string {
  return developmentIssues(plan, { draft, mode: "milestone", reviewedRules })
    .map((issue) => issue.message)
    .join("\n");
}

describe("development plan structure", () => {
  it("shows level 1 as creation, the earned levels and exactly one next level", () => {
    const hero = heroAt("Талант", 3);
    const plan = buildDevelopmentPlan(hero);

    expect(plan.levels.map((level) => [level.level, level.status])).toEqual([
      [1, "sealed"],
      [2, "applied"],
      [3, "applied"],
      [4, "next"],
    ]);
    expect(plan.nextLevel).toMatchObject({ level: 4 });
    expect(plan.levels[0].steps).toHaveLength(0);
    expect(plan.levels[0].fixed.length).toBeGreaterThan(0);
    // Особенности класса живут внутри уровней, а не отдельной панелью.
    expect(plan.levels[0].features.length + plan.levels[1].features.length).toBeGreaterThan(0);
  });

  it("keeps the hero's own pick among applied-level options", () => {
    const hero = heroAt("Талант", 2);
    const plan = buildDevelopmentPlan(hero);
    const step = findStep(plan, 2, "ability");

    expect(step.required).toBe(true);
    expect(step.current).toHaveLength(1);
    expect(step.options.map((option) => option.id)).toContain(step.current[0]);
    // Выбранная способность уже есть у героя — она не должна исчезнуть из шага.
    expect(step.options.length).toBeGreaterThan(1);
  });

  it("marks the next level as engaged only after the first pick", () => {
    const hero = heroAt("Талант", 2);
    const plan = buildDevelopmentPlan(hero);

    expect(nextLevelEngaged(plan, {})).toBe(false);
    expect(draftIsDirty(plan, {})).toBe(false);

    const engaging = fillNext(plan);
    const firstStep = nextSection(plan).steps[0];
    const partial: DevelopmentDraft = { [firstStep.id]: engaging[firstStep.id] };

    expect(nextLevelEngaged(plan, partial)).toBe(true);
    expect(draftIsDirty(plan, partial)).toBe(true);
  });
});

describe("saving the draft", () => {
  it("blocks the save while the engaged next level has unfilled steps", () => {
    const hero = heroAt("Талант", 3);
    const plan = buildDevelopmentPlan(hero);
    const steps = nextSection(plan).steps;
    expect(steps.length).toBeGreaterThan(1);

    const draft = fillNext(plan);
    const missing = steps[steps.length - 1];
    delete draft[missing.id];

    expect(messages(plan, draft)).toContain("не заполнен шаг");

    const blocked = applyDevelopment(hero, plan, {
      draft,
      mode: "milestone",
      reviewedRules: true,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.leveledUp).toBe(false);
    expect(blocked.next).toBe(hero);
    expect(blocked.issues.length).toBeGreaterThan(0);

    const applied = applyDevelopment(hero, plan, {
      draft: fillNext(plan),
      mode: "milestone",
      reviewedRules: true,
    });
    expect(applied.ok, applied.issues.join("; ")).toBe(true);
    expect(applied.next.level).toBe(4);
  });

  it("asks to confirm the rules before the level actually rises", () => {
    const hero = heroAt("Талант", 2);
    const plan = buildDevelopmentPlan(hero);
    const draft = fillNext(plan);

    expect(messages(plan, draft, false)).toContain("прочитаны");

    const result = applyDevelopment(hero, plan, {
      draft,
      mode: "milestone",
      reviewedRules: true,
    });
    expect(result.ok, result.issues.join("; ")).toBe(true);
    expect(result.leveledUp).toBe(true);
    expect(result.next.level).toBe(3);
    expect(result.next.advancements).toHaveLength(2);
    const record = result.next.advancements?.[1];
    expect(record).toMatchObject({ fromLevel: 2, toLevel: 3, mode: "milestone" });
    expect(Object.keys(record?.choices ?? {}).length).toBe(nextSection(plan).steps.length);
  });

  it("flags a step whose pick count does not match the rule", () => {
    const hero = heroAt("Талант", 2);
    const plan = buildDevelopmentPlan(hero);
    const step = findStep(plan, 2, "ability");
    const draft = { [step.id]: step.options.slice(0, 2).map((option) => option.id) };

    expect(messages(plan, draft)).toContain("нужно выбрать 1");
  });
});

describe("reconfiguring an earned level", () => {
  it("replaces only the swapped ability and leaves the rest of the hero alone", () => {
    const hero = heroAt("Талант", 2);
    const plan = buildDevelopmentPlan(hero);
    const step = findStep(plan, 2, "ability");
    const [currentId] = step.current;
    const replacement = step.options.find((option) => option.id !== currentId);
    expect(replacement).toBeDefined();

    const before = {
      abilities: hero.abilities.map((ability) => ability.id),
      perks: hero.perks.map((perk) => perk.perkId),
      skills: [...hero.skills],
    };

    const result = applyDevelopment(hero, plan, {
      draft: { [step.id]: [replacement!.id] },
      mode: "milestone",
      reviewedRules: false,
    });
    expect(result.ok, result.issues.join("; ")).toBe(true);
    expect(result.leveledUp).toBe(false);
    expect(result.next.level).toBe(hero.level);

    const after = result.next.abilities.map((ability) => ability.id);
    expect(after).toContain(replacement!.id);
    expect(after).not.toContain(currentId);
    // Остальные способности героя не тронуты.
    for (const id of before.abilities.filter((entry) => entry !== currentId)) {
      expect(after).toContain(id);
    }
    expect(result.next.perks.map((perk) => perk.perkId)).toEqual(before.perks);
    expect(result.next.skills).toEqual(before.skills);
    expect(result.next.advancements?.[0].choices[step.choiceId]).toEqual([
      replacement!.id,
    ]);
  });

  it("lets the player unselect a card but refuses to save the empty step", () => {
    const hero = heroAt("Талант", 2);
    const plan = buildDevelopmentPlan(hero);
    const step = findStep(plan, 2, "ability");
    const [currentId] = step.current;

    const result = applyDevelopment(hero, plan, {
      draft: { [step.id]: [] },
      mode: "milestone",
      reviewedRules: false,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("не заполнен шаг");
    // Ничего не применилось: герой и запись остались прежними.
    expect(result.next).toBe(hero);
    expect(result.next.abilities.map((ability) => ability.id)).toContain(currentId);
  });

  it("swaps a level skill without touching the skills from character creation", () => {
    const hero = heroAt("Талант", 4);
    const plan = buildDevelopmentPlan(hero);
    const step = findStep(plan, 4, "skill");
    const [currentSkill] = step.current;
    const replacement = step.options.find((option) => option.id !== currentSkill);
    expect(replacement).toBeDefined();

    const creationSkills = hero.skills.filter((skill) => skill !== currentSkill);
    expect(creationSkills.length).toBeGreaterThan(0);

    const result = applyDevelopment(hero, plan, {
      draft: { [step.id]: [replacement!.id] },
      mode: "milestone",
      reviewedRules: false,
    });
    expect(result.ok, result.issues.join("; ")).toBe(true);
    expect(result.next.skills).toContain(replacement!.id);
    expect(result.next.skills).not.toContain(currentSkill);
    for (const skill of creationSkills) expect(result.next.skills).toContain(skill);
  });

  it("lets a hero without an advancement record fill the level in later", () => {
    const hero = bareHero("Талант", 2);
    const plan = buildDevelopmentPlan(hero);
    const section = plan.levels.find((level) => level.level === 2);
    expect(section?.status).toBe("applied");
    expect(section?.note).toContain("Записи о повышении");
    expect(section?.steps.every((step) => !step.required)).toBe(true);

    const draft: DevelopmentDraft = {};
    for (const step of section?.steps ?? []) {
      draft[step.id] = step.options.slice(0, step.count).map((option) => option.id);
    }
    const perkStep = findStep(plan, 2, "perk");

    const result = applyDevelopment(hero, plan, {
      draft,
      mode: "milestone",
      reviewedRules: false,
    });
    expect(result.ok, result.issues.join("; ")).toBe(true);
    expect(result.next.level).toBe(2);
    expect(result.next.perks.some((perk) => perk.source === "class" && perk.level === 2)).toBe(true);
    expect(result.next.advancements?.[0]).toMatchObject({ fromLevel: 1, toLevel: 2 });
    expect(result.next.advancements?.[0].choices[perkStep.choiceId]).toEqual(
      draft[perkStep.id],
    );
  });

  it("keeps a step's saved pick out of reach of unrelated steps", () => {
    const hero = heroAt("Талант", 3);
    const plan = buildDevelopmentPlan(hero);
    const level2 = findStep(plan, 2, "ability");
    const level3 = findStep(plan, 3, "ability");
    // Способности разных уровней не пересекаются, и подмены не задевают друг друга.
    expect(level2.current[0]).not.toBe(level3.current[0]);

    const replacement = level2.options.find(
      (option) => option.id !== level2.current[0],
    )!;
    const result = applyDevelopment(hero, plan, {
      draft: { [level2.id]: [replacement.id] },
      mode: "milestone",
      reviewedRules: false,
    });
    expect(result.ok, result.issues.join("; ")).toBe(true);
    expect(result.next.abilities.map((ability) => ability.id)).toContain(level3.current[0]);
    expect(stepSelection(level2, { [level2.id]: [replacement.id] })).toEqual([
      replacement.id,
    ]);
    expect(stepSelection(level3, { [level2.id]: [replacement.id] })).toEqual(
      level3.current,
    );
  });
});

describe("домены Проводника", () => {
  const deathSix = "provodnik-aura-dush-f3bad427a7";
  const lifeSix = conduitAbilities.find(
    (entry) => entry.level === 6 && entry.domain === "Жизнь",
  )!.abilityId;
  const knowledgeSix = conduitAbilities.find(
    (entry) => entry.level === 6 && entry.domain === "Знание",
  )!.abilityId;

  function conduitHero(): Character {
    const ability = ABILITY_COMPENDIUM.find((entry) => entry.id === deathSix)!;
    return {
      ...bareHero("Проводник", 6),
      automation: {
        enabled: false,
        adjustments: {},
        ancestryTraits: [],
        classFeatureSelections: {
          "conduit.domain": "Смерть, Жизнь",
          "conduit.ability.domain.6": "Смерть",
        },
      },
      abilities: [{ ...ability }],
      advancements: [
        {
          fromLevel: 5,
          toLevel: 6,
          className: "Проводник",
          subclass: "Смерть, Жизнь",
          mode: "milestone",
          articleId: "",
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
          choices: { "conduit.ability.domain.6": [deathSix] },
        },
      ],
    };
  }

  it("предлагает доменные способности только из пары доменов героя", () => {
    const step = findStep(buildDevelopmentPlan(conduitHero()), 6, "ability");
    const optionIds = step.options.map((option) => option.id);
    expect(optionIds).toContain(deathSix);
    expect(optionIds).toContain(lifeSix);
    expect(optionIds).not.toContain(knowledgeSix);
    expect(step.options.every((option) => /Домен: (Смерть|Жизнь)/.test(option.tag ?? ""))).toBe(true);
  });

  it("переносит выбор на другой домен в метку automation", () => {
    const hero = conduitHero();
    const plan = buildDevelopmentPlan(hero);
    const step = findStep(plan, 6, "ability");
    // Запись уровня 6 в этом герое без перка: шаг перка остаётся обязательным,
    // поэтому дозаполняем его вместе со сменой доменной способности.
    const perkStep = plan.levels
      .find((level) => level.level === 6)!
      .steps.find((item) => item.kind === "perk")!;

    const result = applyDevelopment(hero, plan, {
      draft: { [step.id]: [lifeSix], [perkStep.id]: [perkStep.options[0].id] },
      mode: "milestone",
      reviewedRules: false,
    });
    expect(result.ok, result.issues.join("; ")).toBe(true);
    expect(result.next.level).toBe(6);
    expect(result.next.automation?.classFeatureSelections?.["conduit.ability.domain.6"]).toBe("Жизнь");
    const ids = result.next.abilities.map((ability) => ability.id);
    expect(ids).toContain(lifeSix);
    expect(ids).not.toContain(deathSix);
  });
});

describe("конфликты выбора", () => {
  function level(levelNumber: number, stepId: string, choiceId: string): DevelopmentLevel {
    return {
      level: levelNumber,
      status: "applied",
      title: `Уровень ${levelNumber}`,
      echelonLabel: "1-й эшелон",
      steps: [
        {
          id: stepId,
          choiceId,
          kind: "ability",
          title: "Выбор способности",
          count: 1,
          required: true,
          current: [],
          options: [
            { id: "a1", label: "Первая способность" },
            { id: "a2", label: "Вторая способность" },
          ],
        },
      ],
      features: [],
      upcoming: [],
      granted: [],
      fixed: [],
    };
  }

  it("не даёт взять одну способность в шагах разных уровней", () => {
    const plan = {
      levels: [level(2, "l2:g1", "g1"), level(3, "l3:g2", "g2")],
    };
    const issues = developmentIssues(plan, {
      draft: { "l2:g1": ["a1"], "l3:g2": ["a1"] },
      mode: "milestone",
      reviewedRules: false,
    });
    expect(issues.map((issue) => issue.message).join("\n")).toContain("выбрана дважды");
  });

  it("пропускает разные способности в шагах разных уровней", () => {
    const plan = {
      levels: [level(2, "l2:g1", "g1"), level(3, "l3:g2", "g2")],
    };
    expect(
      developmentIssues(plan, {
        draft: { "l2:g1": ["a1"], "l3:g2": ["a2"] },
        mode: "milestone",
        reviewedRules: false,
      }),
    ).toEqual([]);
  });
});
