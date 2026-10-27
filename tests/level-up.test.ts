import { describe, expect, it } from "vitest";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { CLASS_PRESETS } from "../src/data/classes";
import { ALL_CREATION_SKILLS } from "../src/data/creation-rules";
import { DOMAIN_GRANTED_ABILITIES, DOMAIN_SKILL_SLOTS } from "../src/data/creation-rules";
import { SKILL_GROUPS } from "../src/data/skills";
import {
  LEVEL_UP_RULES,
  levelUpRule,
} from "../src/data/level-up-rules";
import { PERK_COMPENDIUM, classPerkTypes, perkById } from "../src/data/perks";
import { BUILDER_DATA, buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import { GENERATED_CLASS_FEATURES } from "../src/data/class-features/skeleton";
import { conduitAbilities } from "../src/data/class-features/conduit-abilities";
import { recalculateCharacter } from "../src/lib/character-calculations";
import { activeClassFeatures } from "../src/lib/class-features";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";
import {
  MAX_CHARACTER_LEVEL,
  getLevelUpPlan,
  previewLevelUp,
  type LevelUpPlan,
  type LevelUpPreview,
  type LevelUpRequest,
} from "../src/lib/level-up";
import type { Ability, Character } from "../src/types";

const ENOUGH_XP = 160;

function subclassOf(className: string): string {
  const classData = BUILDER_DATA.classes.find((entry) => entry.name === className);
  const subclass = classData?.subclasses?.[0];
  if (!subclass) throw new Error(`No builder subclass for ${className}`);
  return subclass.name;
}

function makeHero(
  className: string,
  level: number,
  subclass: string,
  overrides: Partial<Character> = {},
): Character {
  const base = createCharacter({ name: "Тестовый герой", className, level });
  return { ...base, subclass, xp: ENOUGH_XP, ...overrides };
}

function makeRequest(
  character: Character,
  overrides: Partial<LevelUpRequest> = {},
): LevelUpRequest {
  return {
    characterId: character.id,
    fromLevel: character.level,
    className: character.className,
    subclass: character.subclass,
    mode: "milestone",
    choices: {},
    reviewedRules: true,
    ...overrides,
  };
}

/** Every plan choice filled with its first legal options, as the dialog would suggest. */
function firstChoices(character: Character): Record<string, string[]> {
  const plan = getLevelUpPlan(character);
  const choices: Record<string, string[]> = {};
  for (const choice of plan.choices) {
    choices[choice.id] = choice.options
      .slice(0, choice.count)
      .map((option) => option.id);
  }
  return choices;
}

function expectOk(result: LevelUpPreview) {
  expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
  if (!result.ok) throw new Error(result.issues.join("; "));
  return result;
}

function expectIssues(result: LevelUpPreview, fragment: string) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.issues.join("\n")).toContain(fragment);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function optionLabels(plan: LevelUpPlan, choiceId: string): string[] {
  return (
    plan.choices.find((choice) => choice.id === choiceId)?.options.map(
      (option) => option.label,
    ) ?? []
  );
}

describe("level-up XP and availability", () => {
  it("blocks the XP mode below the cumulative threshold and keeps XP intact", () => {
    const short = makeHero("Талант", 1, "Телепатия", { xp: 15 });
    const plan = getLevelUpPlan(short);
    expect(plan).toMatchObject({
      available: true,
      fromLevel: 1,
      toLevel: 2,
      xpRequired: 16,
      xpMissing: 1,
    });

    const blocked = previewLevelUp(
      short,
      makeRequest(short, { mode: "xp", choices: firstChoices(short) }),
    );
    expectIssues(blocked, "Недостаточно опыта");
    // Nothing is spent or changed by a rejected request.
    expect(short.xp).toBe(15);
    expect(short.level).toBe(1);

    const ready = makeHero("Талант", 1, "Телепатия", { xp: 16 });
    const result = expectOk(
      previewLevelUp(
        ready,
        makeRequest(ready, { mode: "xp", choices: firstChoices(ready) }),
      ),
    );
    expect(result.next.level).toBe(2);
    expect(result.next.xp).toBe(16);
    expect(result.next.advancements?.[0]).toMatchObject({
      fromLevel: 1,
      toLevel: 2,
      mode: "xp",
      className: "Талант",
      subclass: "Телепатия",
    });
  });

  it("allows an explicit milestone with zero XP and no XP or victory changes", () => {
    const character = makeHero("Талант", 1, "Телепатия", {
      xp: 0,
      victories: 7,
      epic: 3,
    });
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          mode: "milestone",
          choices: firstChoices(character),
        }),
      ),
    );
    expect(result.next.level).toBe(2);
    expect(result.next.xp).toBe(0);
    expect(result.next.victories).toBe(7);
    expect(result.next.epic).toBe(3);
    expect(result.next.advancements?.[0].mode).toBe("milestone");
  });

  it("refuses any growth beyond level ten", () => {
    const character = makeHero("Талант", MAX_CHARACTER_LEVEL, "Телепатия");
    const plan = getLevelUpPlan(character);
    expect(plan.available).toBe(false);
    expect(plan.reason).toContain("10-го уровня");
    expect(plan.choices).toEqual([]);
    expectIssues(
      previewLevelUp(character, makeRequest(character, { mode: "milestone" })),
      "10-го уровня",
    );
  });

  it("gives a clear reason for an unknown class and for an empty Summoner", () => {
    const unknown = makeHero("Изобретатель", 1, "Что-то");
    const unknownPlan = getLevelUpPlan(unknown);
    expect(unknownPlan.available).toBe(false);
    expect(unknownPlan.reason).toContain("не распознан");
    expectIssues(
      previewLevelUp(unknown, makeRequest(unknown, { mode: "milestone" })),
      "не распознан",
    );

    const summoner = makeHero("Призыватель", 1, "");
    const summonerPlan = getLevelUpPlan(summoner);
    expect(summonerPlan.available).toBe(false);
    expect(summonerPlan.reason).toContain("нет проверенных правил");
    expectIssues(
      previewLevelUp(
        summoner,
        makeRequest(summoner, { mode: "milestone" }),
      ),
      "нет проверенных правил",
    );
    // The manual level editor remains the documented fallback, not an invented reward.
    expect(summonerPlan.rule).toBeUndefined();
    expect(summoner.xp).toBe(ENOUGH_XP);
  });

  it("has verified rules for every supported class on levels 2–10", () => {
    const supported = CLASS_PRESETS.map((preset) => preset.name).filter(
      (name) => name !== "Призыватель",
    );
    expect(supported).toHaveLength(9);
    expect(
      LEVEL_UP_RULES.filter((rule) => rule.className !== "Призыватель"),
    ).toHaveLength(81);

    for (const className of supported) {
      const subclass = className === "Проводник" ? "Жизнь, Защита" : subclassOf(className);
      for (let level = 2; level <= 10; level += 1) {
        const rule = levelUpRule(className, level);
        expect(rule, `${className} ${level}`).toBeDefined();
        expect(rule?.articleId, `${className} ${level} article`).toMatch(/\d/);
        expect(rule?.title.length, `${className} ${level} title`).toBeGreaterThan(0);
        expect(rule?.features.length, `${className} ${level} features`).toBeGreaterThan(0);

        const character = makeHero(className, level - 1, subclass, className === "Проводник"
          ? { automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
              "conduit.domain": "Созидание, Смерть", "conduit.domain.1": "Созидание",
              "conduit.domain.4": "Созидание", "conduit.domain.7": "Созидание",
            } } }
          : className === "Цензор"
            // Цензор всегда создаётся с одним доменом; без него правила 4/7
            // уровней честно блокируются, поэтому фикстура его задаёт.
            ? { automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
                "censor.domain": "Война",
              } } }
            : {});
        const plan = getLevelUpPlan(character);
        expect(
          plan.available,
          `${className} ${level}: ${plan.reason ?? ""}`,
        ).toBe(true);
        const result = previewLevelUp(
          character,
          makeRequest(character, { choices: firstChoices(character) }),
        );
        expect(
          result.ok,
          `${className} ${level}: ${result.ok ? "" : result.issues.join("; ")}`,
        ).toBe(true);
      }
    }
  });

  it("matches a scoped rule only by the exact canonical subclass name", () => {
    const scoped = LEVEL_UP_RULES.flatMap((rule) =>
      rule.abilityChoices
        .filter((group) => group.subclasses && group.subclasses.length > 0)
        .map((group) => ({ rule, subclass: group.subclasses![0] })),
    )[0];
    const character = makeHero(
      scoped.rule.className,
      scoped.rule.level - 1,
      scoped.subclass,
    );
    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);
    expect(
      expectOk(
        previewLevelUp(
          character,
          makeRequest(character, { choices: firstChoices(character) }),
        ),
      ).next.level,
    ).toBe(scoped.rule.level);
  });

  it("never accepts a prefix, typo or extra word as a subclass", () => {
    const scoped = LEVEL_UP_RULES.flatMap((rule) =>
      rule.abilityChoices
        .filter((group) => group.subclasses && group.subclasses.length > 0)
        .map((group) => ({ rule, subclass: group.subclasses![0] })),
    )[0];
    const variant = (subclass: string) => {
      const character = makeHero(
        scoped.rule.className,
        scoped.rule.level - 1,
        subclass,
      );
      const before = structuredClone(character);
      const plan = getLevelUpPlan(character);
      const result = previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      );
      expect(plan.available, subclass).toBe(false);
      expect(plan.reason, subclass).toContain("подкласс");
      expect(result.ok, subclass).toBe(false);
      expect(character).toEqual(before);
    };
    const words = scoped.subclass.split(/[\s,]+/).filter(Boolean);
    variant(`${scoped.subclass}а`);
    variant(`${words[0]}а`);
    variant(scoped.subclass.slice(0, -1));
    variant(`не ${scoped.subclass}`);
    variant("Посторонний подкласс");
  });

  it("keeps every scoped rule name an exact canonical builder subclass", () => {
    for (const rule of LEVEL_UP_RULES) {
      const canonical =
        BUILDER_DATA.classes
          .find((entry) => entry.name === rule.className)
          ?.subclasses?.map((subclass) => subclass.name) ?? [];
      const scoped = [
        ...rule.abilityChoices.flatMap((group) => group.subclasses ?? []),
        ...rule.grantedAbilities.flatMap((grant) => grant.subclasses ?? []),
      ];
      for (const subclass of scoped) {
        expect(
          canonical,
          `${rule.className} ${rule.level} «${subclass}»`,
        ).toContain(subclass);
      }
    }
  });
});

describe("level-up required choices", () => {
  it("does not silently skip a required subclass choice", () => {
    const missing = makeHero("Талант", 1, "");
    const plan = getLevelUpPlan(missing);
    expect(plan.available).toBe(false);
    expect(plan.reason).toContain("подкласс");
    expectIssues(
      previewLevelUp(missing, makeRequest(missing, { mode: "milestone" })),
      "подкласс",
    );

    const foreign = makeHero("Талант", 1, "Берсерк");
    expectIssues(
      previewLevelUp(
        foreign,
        makeRequest(foreign, {
          mode: "milestone",
          choices: firstChoices(foreign),
        }),
      ),
      "подкласс",
    );
  });

  it("rejects a foreign group, an invalid option, duplicates and unknown keys", () => {
    const character = makeHero("Талант", 1, "Телепатия");
    const plan = getLevelUpPlan(character);
    const ownGroup = plan.choices.find((choice) => choice.kind === "ability")!;
    expect(ownGroup).toBeDefined();

    const foreignRule = levelUpRule("Талант", 2)!;
    const foreignGroup = foreignRule.abilityChoices.find(
      (group) =>
        group.subclasses?.includes("Хронопатия") && group.id !== ownGroup.id,
    )!;
    const foreignChoice = foreignGroup.abilityIds[0];
    const ownChoice = ownGroup.options[0].id;
    const perkChoice = plan.choices.find((choice) => choice.kind === "perk")!;

    const base: Record<string, string[]> = {
      [ownGroup.id]: [ownChoice],
      [perkChoice.id]: [perkChoice.options[0].id],
    };

    const issuesFor = (choices: Record<string, string[]>) =>
      previewLevelUp(
        character,
        makeRequest(character, { choices }),
      ) as Extract<LevelUpPreview, { ok: false }>;

    expect(
      issuesFor({ ...base, [foreignGroup.id]: [foreignChoice] }).issues.join("\n"),
    ).toContain("Неизвестный выбор");

    expect(
      issuesFor({ ...base, [ownGroup.id]: ["нет-такой-способности"] }).issues.join(
        "\n",
      ),
    ).toContain("не входит в варианты");

    expect(
      issuesFor({ ...base, [ownGroup.id]: [ownChoice, ownChoice] }).issues.join(
        "\n",
      ),
    ).toContain("повторяющиеся");

    expect(
      issuesFor({ ...base, [perkChoice.id]: ["нет-такого-перка"] }).issues.join(
        "\n",
      ),
    ).toContain("не входит в варианты");

    expect(issuesFor({ ...base, лишний: ["x"] }).issues.join("\n")).toContain(
      "Неизвестный выбор",
    );

    expect(issuesFor({}).issues.join("\n")).toContain(
      "Не выбран обязательный вариант",
    );

    // The complete legal request passes.
    const result = previewLevelUp(
      character,
      makeRequest(character, { choices: base }),
    );
    expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
  });

  it("requires reviewing the rules and validates optional manual maxima", () => {
    const character = makeHero("Талант", 1, "Телепатия");
    const choices = firstChoices(character);
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, { choices, reviewedRules: false }),
      ),
      "правила нового уровня прочитаны",
    );
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices,
          manualMaxima: { stamina: 1.5 },
        }),
      ),
      "целым числом",
    );
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices,
          manualMaxima: { spirit: 4 } as never,
        }),
      ),
      "Неизвестный ручной максимум",
    );
    expectIssues(
      previewLevelUp(character, null as never),
      "Некорректный запрос",
    );
  });

  it("excludes learned abilities, skills and used perks from the options", () => {
    const character = makeHero("Талант", 3, "Телепатия", {
      skills: ["Алхимия"],
    });
    const plan = getLevelUpPlan(character);
    const skillChoice = plan.choices.find((choice) => choice.kind === "skill")!;
    expect(skillChoice).toBeDefined();
    expect(skillChoice.count).toBe(1);
    expect(skillChoice.options.map((option) => option.id)).not.toContain("Алхимия");
    expect(ALL_CREATION_SKILLS).toContain("Алхимия");

    const perkChoice = plan.choices.find((choice) => choice.kind === "perk")!;
    expect(perkChoice).toBeDefined();
    for (const option of perkChoice.options) {
      const perk = perkById(option.id)!;
      expect(
        classPerkTypes(character.className, character.level + 1),
      ).toContain(perk.type);
    }

    const learnedSkill = ALL_CREATION_SKILLS[1];
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: {
            [perkChoice.id]: [perkChoice.options[0].id],
            [skillChoice.id]: [learnedSkill, ALL_CREATION_SKILLS[2]],
          },
        }),
      ),
      "нужно 1",
    );
  });

  it("keeps or safely replaces an already selected next-level perk slot", () => {
    const slotTypes = classPerkTypes("Талант", 4);
    const candidates = PERK_COMPENDIUM.filter((perk) =>
      slotTypes.includes(perk.type),
    );
    expect(candidates.length).toBeGreaterThan(2);
    const existing = candidates[0];
    const replacement = candidates[1];
    const careerPerk = candidates[2];
    const character = makeHero("Талант", 3, "Телепатия", {
      perks: [
        {
          perkId: existing.id,
          name: existing.name,
          type: existing.type,
          source: "class",
          level: 4,
        },
        {
          perkId: careerPerk.id,
          name: careerPerk.name,
          type: careerPerk.type,
          source: "career",
          level: 0,
        },
      ],
    });
    const plan = getLevelUpPlan(character);
    const perkChoice = plan.choices.find((choice) => choice.kind === "perk")!;
    expect(perkChoice).toBeDefined();
    expect(perkChoice.options.map((option) => option.id)).toContain(existing.id);
    // Keeping the current slot perk is the suggested default.
    expect(perkChoice.options[0].id).toBe(existing.id);

    const kept = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: {
            [plan.choices.find((choice) => choice.kind === "skill")!.id]:
              [plan.choices.find((choice) => choice.kind === "skill")!.options[0].id],
          },
        }),
      ),
    );
    expect(kept.next.perks.filter((perk) => perk.level === 4)).toHaveLength(1);
    expect(kept.next.perks.find((perk) => perk.level === 4)?.perkId).toBe(
      existing.id,
    );
    expect(kept.next.perks.filter((perk) => perk.source === "career")).toHaveLength(
      1,
    );

    const replaced = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: {
            perk: [replacement.id],
            skill: [
              plan.choices.find((choice) => choice.kind === "skill")!.options[0]
                .id,
            ],
          },
        }),
      ),
    );
    const classPerks = replaced.next.perks.filter(
      (perk) => perk.source === "class",
    );
    expect(classPerks).toHaveLength(1);
    expect(classPerks[0]).toMatchObject({
      perkId: replacement.id,
      level: 4,
      source: "class",
    });
  });

  it("rejects reusing a perk from an earlier class slot", () => {
    const earlier = PERK_COMPENDIUM.find(
      (perk) => perk.type === "interpersonal",
    )!;
    const character = makeHero("Талант", 3, "Телепатия", {
      perks: [
        {
          perkId: earlier.id,
          name: earlier.name,
          type: earlier.type,
          source: "class",
          level: 2,
        },
      ],
    });
    const plan = getLevelUpPlan(character);
    const perkChoice = plan.choices.find((choice) => choice.kind === "perk")!;
    expect(perkChoice.options.map((option) => option.id)).not.toContain(
      earlier.id,
    );
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: {
            perk: [earlier.id],
            skill: [
              plan.choices.find((choice) => choice.kind === "skill")!.options[0]
                .id,
            ],
          },
        }),
      ),
      "не входит в варианты",
    );
  });
});

describe("level-up characteristics", () => {
  it("raises primaries to the target without lowering a manually higher value", () => {
    const rule = levelUpRule("Талант", 4)!;
    const character = makeHero("Талант", 3, "Телепатия", {
      characteristics: { ...makeHero("Талант", 3, "Телепатия").characteristics, reason: 4 },
    });
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    expect(rule.characteristics?.set).toEqual({ reason: 3, presence: 3 });
    expect(result.next.characteristics.reason).toBe(4);
    expect(result.next.characteristics.presence).toBe(3);
    // No characteristic choice on a two-primary class.
    expect(
      getLevelUpPlan(character).choices.some(
        (choice) => choice.kind === "characteristic",
      ),
    ).toBe(false);
  });

  it("offers one capped characteristic choice for single-primary classes", () => {
    const character = makeHero("Проводник", 3, "Созидание, Смерть");
    const plan = getLevelUpPlan(character);
    const choice = plan.choices.find(
      (entry) => entry.kind === "characteristic",
    )!;
    expect(choice).toBeDefined();
    expect(choice.count).toBe(1);
    expect(choice.options.map((option) => option.id)).not.toContain("intuition");
    for (const option of choice.options) {
      expect(character.characteristics[option.id as never]).toBeLessThan(3);
    }
    const target = choice.options[0].id;
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: { ...firstChoices(character), characteristic: [target] },
        }),
      ),
    );
    expect(result.next.characteristics[target as never]).toBe(
      character.characteristics[target as never] + 1,
    );
    expect(result.next.characteristics.intuition).toBe(3);
  });

  it("adds one to all characteristics at level seven but never lowers manual values", () => {
    const base = makeHero("Неистовый", 6, "Берсерк");
    const character = {
      ...base,
      characteristics: { ...base.characteristics, might: 5 },
    };
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    expect(result.next.characteristics.might).toBe(5);
    expect(result.next.characteristics.agility).toBe(
      Math.min(4, character.characteristics.agility + 1),
    );
    expect(result.next.characteristics.reason).toBe(
      Math.min(4, character.characteristics.reason + 1),
    );
  });

  it("raises primaries to five at level ten", () => {
    const character = makeHero("Талант", 9, "Телепатия");
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    expect(result.next.characteristics.reason).toBe(5);
    expect(result.next.characteristics.presence).toBe(5);
  });

  it("does not offer a characteristic choice once every value reached the cap", () => {
    const base = makeHero("Проводник", 3, "Созидание");
    const maxed = {
      ...base,
      characteristics: {
        might: 3,
        agility: 3,
        reason: 3,
        intuition: 3,
        presence: 3,
      },
    };
    const plan = getLevelUpPlan(maxed);
    expect(
      plan.choices.some((choice) => choice.kind === "characteristic"),
    ).toBe(false);
    expect(plan.warnings.join("\n")).toContain("выбор характеристики не требуется");
  });
});

describe("level-up commit invariants", () => {
  const automation = {
    enabled: true,
    adjustments: { stamina: 4, speed: 1 } as const,
    ancestryTraits: [] as string[],
    ancestryTraitIds: [] as string[],
    equipment: { lightArmor: true, lightWeapon: true },
    meleeDamageKit: "",
    rangedDamageKit: "",
    classFeatureSelections: {},
  };

  function automatedHero(): Character {
    const base = makeHero("Нуль", 1, subclassOf("Нуль"));
    const calculated = recalculateCharacter(base, {
      ...base,
      automation: {
        ...automation,
        adjustments: { stamina: 4, speed: 1 },
        classFeatureSelections: {
          "null.augmentation": "null.augmentation.density",
        },
      },
    });
    return {
      ...calculated,
      stamina: { current: 5, max: calculated.stamina.max, temp: 2 },
      recoveries: {
        current: Math.min(3, calculated.recoveries.max),
        max: calculated.recoveries.max,
      },
    };
  }

  it("returns a raw patch whose maxima are untouched, so App.update recalculates once", () => {
    const character = automatedHero();
    const oldAdjustments = { ...character.automation!.adjustments };
    const plan = getLevelUpPlan(character);
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );

    // The raw patch must not pre-grow the saved maxima: that growth is App.update's job.
    expect(result.rawNext.stamina.max).toBe(character.stamina.max);
    expect(result.rawNext.recoveries.max).toBe(character.recoveries.max);
    expect(result.rawNext.stamina.current).toBe(5);
    expect(result.rawNext.automation?.adjustments).toEqual(oldAdjustments);
    expect(result.rawNext.updatedAt).toBe(character.updatedAt);

    // `next` is exactly the single recalculation the app performs on commit.
    const committed = {
      ...recalculateCharacter(character, result.rawNext),
      updatedAt: "stamp",
    };
    expect(committed.level).toBe(4 - 2);
    expect(committed.stamina.max).toBe(result.next.stamina.max);
    expect(committed.stamina.max).toBeGreaterThan(character.stamina.max);
    expect(committed.stamina.current).toBe(5);
    expect(committed.stamina.temp).toBe(2);
    expect(committed.automation?.adjustments).toEqual(oldAdjustments);
    expect(committed.automation).toEqual(character.automation);
    expect(result.next.automation).toEqual(character.automation);
    // Class growth only: the class-feature bonus stays at the same echelon.
    expect(committed.stamina.max - character.stamina.max).toBe(9);
    expect(committed.speed).toBe(result.next.speed);

    // A repeated recalculation of the already calculated sheet is stable.
    const again = recalculateCharacter(result.next, result.next);
    expect(again.stamina.max).toBe(result.next.stamina.max);
    expect(again.automation?.adjustments).toEqual(oldAdjustments);
    expect(plan.toLevel).toBe(2);
  });

  it("keeps disabled sheets untouched and applies only explicit manual maxima", () => {
    const base = makeHero("Неистовый", 1, "Берсерк");
    const character: Character = {
      ...base,
      automation: {
        enabled: false,
        adjustments: { stamina: 2 },
        ancestryTraits: [],
        ancestryTraitIds: [],
      },
      stamina: { current: 20, max: 23, temp: 1 },
      recoveries: { current: 9, max: 10 },
    };

    const untouched = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    expect(untouched.next.stamina).toEqual({ current: 20, max: 23, temp: 1 });
    expect(untouched.next.recoveries).toEqual({ current: 9, max: 10 });
    expect(untouched.next.automation?.enabled).toBe(false);
    expect(untouched.next.automation?.adjustments).toEqual({ stamina: 2 });
    expect(untouched.next.speed).toBe(character.speed);
    expect(untouched.rawNext).toBe(untouched.next);

    const manual = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: firstChoices(character),
          manualMaxima: { stamina: 40, recoveries: 6 },
        }),
      ),
    );
    expect(manual.next.stamina).toEqual({ current: 20, max: 40, temp: 1 });
    expect(manual.next.recoveries).toEqual({ current: 6, max: 6 });
    expect(manual.rawNext.stamina.max).toBe(40);
    expect(manual.next.automation).toEqual(character.automation);

    const enabled = {
      ...makeHero("Неистовый", 1, "Берсерк"),
      automation: { enabled: true, adjustments: {}, ancestryTraits: [] },
    };
    expectIssues(
      previewLevelUp(enabled, {
        ...makeRequest(enabled),
        choices: firstChoices(enabled),
        manualMaxima: { stamina: 30 },
      }),
      "только при выключенной автоматизации",
    );
  });

  it("rejects stale identity, level, class, subclass and double confirmation", () => {
    const character = makeHero("Талант", 1, "Телепатия");
    const request = makeRequest(character, { choices: firstChoices(character) });
    const first = expectOk(previewLevelUp(character, request));

    // The same request replayed after the hero grew must not apply the reward twice.
    const replay = previewLevelUp(first.next, request);
    expectIssues(replay, "герой уже на 2-м");
    expect(first.next.advancements).toHaveLength(1);

    expectIssues(
      previewLevelUp(character, { ...request, characterId: "другой-герой" }),
      "другому герою",
    );
    expectIssues(
      previewLevelUp(character, { ...request, className: "Тактик" }),
      "Класс героя изменился",
    );
    expectIssues(
      previewLevelUp(character, { ...request, subclass: "Телекинез" }),
      "Подкласс героя изменился",
    );
  });

  it("changes nothing on cancel or on an invalid request", () => {
    const base = makeHero("Талант", 1, "Телепатия");
    const character = deepFreeze(
      structuredClone({
        ...base,
        abilities: [
          ...base.abilities,
          {
            id: "homebrew-legacy",
            name: "Самодельная способность",
            flavor: "",
            actionType: "none",
            kind: "other",
            keywords: [],
            distance: "",
            target: "",
            rollCharacteristics: [],
            preferredCharacteristic: "",
            rollBonus: 0,
            resourceCost: 0,
            trigger: "",
            tiers: [
              { damage: "", effect: "" },
              { damage: "", effect: "" },
              { damage: "", effect: "" },
            ],
            effect: "",
            source: "Домашние правила",
            notes: "не удалять",
            homebrewExtra: { keep: true },
          } as Ability,
        ],
      }),
    );
    const before = structuredClone(character);

    const plan = getLevelUpPlan(character);
    expect(plan.available).toBe(true);
    const blocked = previewLevelUp(
      character,
      makeRequest(character, { reviewedRules: false }),
    );
    expect(blocked.ok).toBe(false);
    previewLevelUp(
      character,
      makeRequest(character, {
        choices: { ...firstChoices(character), unknown: ["x"] },
      }),
    );
    expect(character).toEqual(before);
    expect(character.advancements).toBeUndefined();

    const advanced = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    const homebrew = advanced.next.abilities.find(
      (ability) => ability.id === "homebrew-legacy",
    ) as (Ability & { homebrewExtra?: { keep: boolean } }) | undefined;
    expect(homebrew).toBeDefined();
    expect(homebrew?.homebrewExtra).toEqual({ keep: true });
  });

  it("appends one stable advancement record and preserves old unknown data", () => {
    const base = makeHero("Талант", 1, "Телепатия", {
      notes: {
        story: "История",
        contacts: "",
        debts: "",
        secrets: "",
        misc: "заметка игрока",
      },
    });
    const legacyRecord = {
      fromLevel: 1,
      toLevel: 2,
      className: "Старый класс",
      subclass: "Старый подкласс",
      mode: "milestone" as const,
      articleId: "0000",
      choices: { unknown_group: ["unknown-id"] },
      notes: "старая запись",
      createdAt: "2024-01-01T00:00:00.000Z",
      legacyExtra: "не удалять",
    };
    const homebrewPerk = {
      perkId: "custom-perk",
      name: "Самодельный перк",
      type: "lore" as const,
      source: "custom" as const,
      level: 0,
    };
    const character: Character = {
      ...base,
      advancements: [legacyRecord],
      perks: [{ ...homebrewPerk }],
      notes: { ...base.notes, misc: "заметка игрока" },
    };

    const plan = getLevelUpPlan(character);
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: firstChoices(character),
          notes: "  выбрали по совету ведущего  ",
        }),
      ),
    );
    const record = result.next.advancements?.[1];
    expect(result.next.advancements).toHaveLength(2);
    expect(result.next.advancements?.[0]).toEqual(legacyRecord);
    expect(result.next.advancements?.[0]).not.toBe(legacyRecord);
    expect(result.next.advancements?.[0].choices).not.toBe(legacyRecord.choices);
    expect(record).toMatchObject({
      fromLevel: 1,
      toLevel: 2,
      className: "Талант",
      subclass: "Телепатия",
      mode: "milestone",
      articleId: plan.rule?.articleId,
      notes: "выбрали по совету ведущего",
    });
    expect(Number.isFinite(Date.parse(record!.createdAt))).toBe(true);
    expect(record!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const expectedChoices = firstChoices(character);
    expect(Object.keys(record!.choices).sort()).toEqual(
      Object.keys(expectedChoices).sort(),
    );
    for (const [key, ids] of Object.entries(record!.choices)) {
      const options =
        plan.choices.find((choice) => choice.id === key)?.options ?? [];
      const order = options.map((option) => option.id);
      expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    }

    // Old custom data survives and the record is importable/normalizable as-is.
    expect(result.next.perks.some((perk) => perk.perkId === "custom-perk")).toBe(
      true,
    );
    expect(result.next.notes.misc).toBe("заметка игрока");
    expect(
      result.next.abilities.some((ability) => ability.id === "homebrew-legacy"),
    ).toBe(false);
    expect(
      (result.next.advancements?.[0] as typeof legacyRecord).legacyExtra,
    ).toBe("не удалять");
    // Persistence keeps the documented record shape and preserves unknown IDs/choice keys.
    const normalized = normalizeCharacter(result.next);
    expect(normalized.advancements).toHaveLength(2);
    expect(normalized.advancements?.[1]).toEqual(record);
    const { legacyExtra: _legacyExtra, ...canonicalLegacy } = legacyRecord;
    expect(normalized.advancements?.[0]).toEqual(canonicalLegacy);
    expect(normalized.advancements).not.toBe(result.next.advancements);

    // Two previews from the same source append exactly once each.
    const repeated = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    expect(repeated.next.advancements).toHaveLength(2);
  });
});

describe("level-up ability ownership", () => {
  it("does not re-award a catalog ability already learned under another ID", () => {
    // The ability picker clones catalog abilities with a fresh makeId().
    const rule = LEVEL_UP_RULES.find((candidate) =>
      candidate.grantedAbilities.some(
        (grant) => grant.subclasses && grant.subclasses.length > 0,
      ),
    )!;
    const grant = rule.grantedAbilities.find(
      (candidate) => candidate.subclasses && candidate.subclasses.length > 0,
    )!;
    const subclass = grant.subclasses![0];
    const entry = ABILITY_COMPENDIUM.find(
      (ability) => ability.id === grant.abilityIds[0],
    )!;
    expect(entry).toBeDefined();

    const legacyCopy: Ability = {
      ...entry,
      id: "b1e0c4f6-6d7a-4f4b-9a1e-0c3f7d2b9a55",
      keywords: [...entry.keywords],
      tiers: entry.tiers.map((tier) => ({ ...tier })),
    };
    const base = makeHero(rule.className, rule.level - 1, subclass);
    const character: Character = {
      ...base,
      abilities: [...base.abilities, legacyCopy],
    };

    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);
    expect(plan.grantedAbilityIds).not.toContain(entry.id);
    expect(plan.warnings.join("\n")).toContain("уже есть у героя");

    const choiceLabels = plan.choices
      .filter((choice) => choice.kind === "ability")
      .flatMap((choice) => choice.options.map((option) => option.label));
    expect(choiceLabels).not.toContain(entry.name);

    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    const same = result.next.abilities.filter(
      (ability) =>
        ability.name === entry.name && ability.source === entry.source,
    );
    expect(same).toHaveLength(1);
    expect(same[0].id).toBe(legacyCopy.id);
    expect(result.next.advancements).toHaveLength(1);
  });

  it("accepts comma separated subclass tokens such as Conduit domains", () => {
    // Conduit stores several domains in one comma separated subclass string.
    const conduit = makeHero("Проводник", 2, "Созидание, Смерть");
    const conduitPlan = getLevelUpPlan(conduit);
    expect(conduitPlan.available, conduitPlan.reason).toBe(true);
    const conduitResult = expectOk(
      previewLevelUp(
        conduit,
        makeRequest(conduit, { choices: firstChoices(conduit) }),
      ),
    );
    expect(conduitResult.next.level).toBe(3);

    // A scoped grant still matches when its subclass is one token of such a list.
    const rule = LEVEL_UP_RULES.find(
      (candidate) =>
        candidate.grantedAbilities.some(
          (grant) => grant.subclasses && grant.subclasses.length > 0,
        ),
    )!;
    const grant = rule.grantedAbilities.find(
      (candidate) => candidate.subclasses && candidate.subclasses.length > 0,
    )!;
    const scopedSubclass = grant.subclasses![0];
    const character = makeHero(
      rule.className,
      rule.level - 1,
      `Не тот подкласс, ${scopedSubclass}`,
    );
    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);
    expect(plan.grantedAbilityIds).toContain(grant.abilityIds[0]);
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    expect(
      result.next.abilities.filter(
        (ability) => ability.id === grant.abilityIds[0],
      ),
    ).toHaveLength(1);
  });

  it("never adds a granted ability twice across several level-ups", () => {
    const rule = LEVEL_UP_RULES.find(
      (candidate) =>
        candidate.className === "Элементалист" &&
        candidate.grantedAbilities.some(
          (grant) => grant.subclasses && grant.subclasses.length > 0,
        ),
    )!;
    const grant = rule.grantedAbilities.find(
      (candidate) => candidate.subclasses && candidate.subclasses.length > 0,
    )!;
    const grantedId = grant.abilityIds[0];
    let character = makeHero(
      "Элементалист",
      rule.level - 1,
      grant.subclasses![0],
    );
    for (let step = 0; step < 3; step += 1) {
      character = expectOk(
        previewLevelUp(
          character,
          makeRequest(character, { choices: firstChoices(character) }),
        ),
      ).next;
    }
    expect(
      character.abilities.filter((ability) => ability.id === grantedId),
    ).toHaveLength(1);
    const keys = character.abilities
      .filter((ability) => ability.name || ability.source)
      .map((ability) => `${ability.name}|${ability.source}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not block a level when every option of a required group is already owned", () => {
    const rule = LEVEL_UP_RULES.find(
      (candidate) =>
        candidate.abilityChoices.some(
          (group) => group.subclasses?.length && group.abilityIds.length > 0,
        ),
    )!;
    const group = rule.abilityChoices.find(
      (candidate) => candidate.subclasses?.length,
    )!;
    const owned = group.abilityIds.map((id) => {
      const entry = ABILITY_COMPENDIUM.find((ability) => ability.id === id)!;
      return { ...entry, id: `legacy-${id}` } as Ability;
    });
    const base = makeHero(
      rule.className,
      rule.level - 1,
      group.subclasses![0],
    );
    const character: Character = {
      ...base,
      abilities: [...base.abilities, ...owned],
    };
    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);
    expect(plan.choices.some((choice) => choice.id === group.id)).toBe(false);
    expect(plan.warnings.join("\n")).toContain("уже есть у героя");

    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    for (const entry of owned) {
      expect(
        result.next.abilities.filter(
          (ability) =>
            ability.name === entry.name && ability.source === entry.source,
        ),
      ).toHaveLength(1);
    }
  });

  it("does not block a level when every creation skill is already learned", () => {
    const character = makeHero("Талант", 3, "Телепатия", {
      skills: [...ALL_CREATION_SKILLS],
    });
    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);
    expect(plan.choices.some((choice) => choice.kind === "skill")).toBe(false);
    expect(plan.warnings.join("\n")).toContain("Все навыки уже есть");
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: firstChoices(character) }),
      ),
    );
    expect(result.next.skills).toHaveLength(ALL_CREATION_SKILLS.length);
    expect(result.next.advancements?.[0].choices.skill).toBeUndefined();
  });
});

describe("level-up full automated path", () => {
  it("advances Talent from 1 to 10 with all choices automated", () => {
    let character = makeHero("Талант", 1, "Телепатия", { xp: 0 });
    const chosenAbilityIds: string[] = [];
    const chosenSkillNames: string[] = [];

    for (let level = 1; level < MAX_CHARACTER_LEVEL; level += 1) {
      const plan = getLevelUpPlan(character);
      expect(plan.available, `level ${level}: ${plan.reason ?? ""}`).toBe(true);
      expect(plan.fromLevel).toBe(level);
      expect(plan.toLevel).toBe(level + 1);
      expect(plan.xpRequired).toBe(level * 16);

      const choices = firstChoices(character);
      for (const choice of plan.choices) {
        if (choice.kind === "ability") {
          chosenAbilityIds.push(...choices[choice.id]);
        }
        if (choice.kind === "skill") {
          chosenSkillNames.push(...choices[choice.id]);
        }
      }
      const result = previewLevelUp(
        character,
        makeRequest(character, { mode: "milestone", choices }),
      );
      expect(
        result.ok,
        `level ${level}: ${result.ok ? "" : result.issues.join("; ")}`,
      ).toBe(true);
      if (!result.ok) return;
      expect(result.next.xp).toBe(character.xp);
      expect(result.next.victories).toBe(character.victories);
      character = result.next;
    }

    expect(character.level).toBe(10);
    expect(character.xp).toBe(0);
    expect(character.advancements).toHaveLength(9);
    expect(character.advancements?.map((record) => record.toLevel)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(new Set(chosenAbilityIds).size).toBe(chosenAbilityIds.length);
    expect(new Set(chosenSkillNames).size).toBe(chosenSkillNames.length);
    for (const id of chosenAbilityIds) {
      expect(character.abilities.some((ability) => ability.id === id)).toBe(true);
    }
    for (const skill of chosenSkillNames) {
      expect(character.skills).toContain(skill);
    }
    // Even levels carry the automated class perk, one per slot.
    const classPerkLevels = character.perks
      .filter((perk) => perk.source === "class")
      .map((perk) => perk.level)
      .sort((left, right) => left - right);
    expect(classPerkLevels).toEqual([2, 4, 6, 8, 10]);
    expect(character.characteristics.reason).toBe(5);
    expect(character.characteristics.presence).toBe(5);
    // Skills arrive on levels four, seven and ten only.
    expect(chosenSkillNames).toHaveLength(3);
    // Ids stay unique across the same ability list.
    const abilityIds = character.abilities.map((ability) => ability.id);
    expect(new Set(abilityIds).size).toBe(abilityIds.length);
    // The recorded history is valid for persistence as a whole.
    const normalized = normalizeCharacter(character);
    expect(normalized.advancements).toEqual(character.advancements);
  });
});

describe("level-up explicit previous-level ability windows", () => {
  it.each([
    ["Смерть", "Созидание", "crafting", false],
    ["Смерть", "Созидание", "crafting", true],
    ["Созидание", "Смерть", "lore", false],
    ["Созидание", "Смерть", "lore", true],
    ["Смерть", "Природа", "exploration", false],
    ["Смерть", "Природа", "exploration", true],
  ])("awards the complement domain skill and grant end to end: %s → %s (automation %s)", (firstDomain, complement, groupKey, enabled) => {
    const domains = `${firstDomain}, ${complement}`;
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Проводник второго домена",
      ancestry: "Дварф",
      className: "Проводник",
      subclass: domains,
      characteristics: startingCharacteristics("Проводник"),
      classSkills: [],
      abilityIds: [],
      featureChoices: {},
      conduitDomainFeature: firstDomain,
    });
    const character = { ...built, level: 1, xp: ENOUGH_XP, automation: { ...built.automation!, enabled } };
    const plan = getLevelUpPlan(character);
    const skillChoice = plan.choices.find((entry) => entry.id === "conduit.domain.skill.2")!;
    const abilityChoice = plan.choices.find((entry) => entry.id === "conduit.ability.domain.2")!;
    expect(skillChoice).toMatchObject({ kind: "skill", count: 1, label: `Навык домена «${complement}»` });
    expect(abilityChoice).toMatchObject({ kind: "ability", count: 1, label: "Доменная способность 2-го уровня" });
    const legalGroup = SKILL_GROUPS.find((group) => group.key === groupKey)!;
    expect(skillChoice.options.length).toBeGreaterThan(0);
    expect(skillChoice.options.every((option) => legalGroup.skills.includes(option.id)), `${complement}/${groupKey}: ${skillChoice.options.map((option) => option.id).join(", ")}`).toBe(true);
    expect(skillChoice.options.every((option) => DOMAIN_SKILL_SLOTS[complement].options.includes(option.id))).toBe(true);

    const selections = firstChoices(character);
    const skill = skillChoice.options[0].id;
    selections[skillChoice.id] = [skill];
    selections[abilityChoice.id] = [abilityChoice.options[0].id];
    const result = expectOk(previewLevelUp(character, makeRequest(character, { choices: selections })));
    const normalized = normalizeCharacter(JSON.parse(JSON.stringify(result.rawNext)));
    expect(normalized.skills.filter((entry) => entry === skill)).toHaveLength(1);
    for (const name of DOMAIN_GRANTED_ABILITIES[complement] ?? []) {
      expect(normalized.abilities.filter((ability) => ability.name === name)).toHaveLength(1);
    }
    expect(normalized.abilities.filter((ability) => ability.id === abilityChoice.options[0].id)).toHaveLength(1);
    expect(normalized.advancements?.at(-1)?.choices).toMatchObject({
      [skillChoice.id]: [skill],
      [abilityChoice.id]: [abilityChoice.options[0].id],
    });
  });

  it("requires both level one domain selections and rejects a missing or foreign level one choice", () => {
    for (const first of ["", "Смерть"]) {
      const character = makeHero("Проводник", 1, "Созидание, Природа", {
        automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
          "conduit.domain": "Созидание, Природа",
          ...(first ? { "conduit.domain.1": first } : {}),
        } },
      });
      expect(getLevelUpPlan(character).available).toBe(false);
      expect(getLevelUpPlan(character).choices).toEqual([]);
      expectIssues(previewLevelUp(character, makeRequest(character)), "сначала выберите");
    }
  });

  it.each([false, true])("uses the selected complement with automatic calculation %s", (enabled) => {
    const domains = "Созидание, Смерть";
    const base = makeHero("Проводник", 1, domains, {
      automation: { enabled, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
        "conduit.domain": domains, "conduit.domain.1": "Созидание",
      } },
    });
    const skillChoice = getLevelUpPlan(base).choices.find((item) => item.id === "conduit.domain.skill.2")!;
    const request = makeRequest(base, { choices: { ...firstChoices(base), [skillChoice.id]: [skillChoice.options.at(-1)!.id] } });
    const result = expectOk(previewLevelUp(base, request));
    const normalized = normalizeCharacter(JSON.parse(JSON.stringify(result.rawNext)));
    expect(normalized.skills).toContain(skillChoice.options.at(-1)!.id);
    expect(normalized.automation?.enabled).toBe(enabled);
  });

  it("rejects a missing, foreign, or already learned complement skill and does not duplicate granted abilities", () => {
    const domains = "Созидание, Смерть";
    const base = makeHero("Проводник", 1, domains, {
      skills: ["Ремонт"] as Character["skills"],
      automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
        "conduit.domain": domains, "conduit.domain.1": "Созидание",
      } },
    });
    const choice = getLevelUpPlan(base).choices.find((entry) => entry.id === "conduit.domain.skill.2")!;
    expect(choice.options.map((entry) => entry.id)).not.toContain("Ремонт");
    const missing = firstChoices(base);
    delete missing[choice.id];
    expectIssues(previewLevelUp(base, makeRequest(base, { choices: missing })), "Не выбран обязательный вариант");
    expectIssues(previewLevelUp(base, makeRequest(base, { choices: { ...firstChoices(base), [choice.id]: ["Скрытность"] } })), "не входит в варианты выбора");
    const knownGrant = ABILITY_COMPENDIUM.find((ability) => ability.name === "Могильная Речь")!;
    const domainAbilityId = conduitAbilities.find((entry) => entry.level === 2 && entry.domain === "Созидание")!.abilityId;
    const knownDomainAbility = ABILITY_COMPENDIUM.find((ability) => ability.id === domainAbilityId)!;
    const duplicate = { ...base, abilities: [...base.abilities, knownGrant, knownDomainAbility] };
    const availableDomainChoice = getLevelUpPlan(duplicate).choices.find((entry) => entry.id === "conduit.ability.domain.2")!;
    expect(availableDomainChoice.options.map((option) => option.id)).not.toContain(domainAbilityId);
    const completed = firstChoices(duplicate);
    completed[choice.id] = [choice.options[0].id];
    const result = expectOk(previewLevelUp(duplicate, makeRequest(duplicate, { choices: completed })));
    expect(result.next.abilities.filter((ability) => ability.name === "Могильная Речь")).toHaveLength(1);
  });

  const elementalist = "Элементалист";
  const conduit = "Проводник";

  function catalogEntry(id: string) {
    const entry = ABILITY_COMPENDIUM.find((ability) => ability.id === id);
    expect(entry, id).toBeDefined();
    return entry!;
  }

  function levelUpGroup(className: string, targetLevel: number) {
    const rule = levelUpRule(className, targetLevel);
    expect(rule, `${className} ${targetLevel}`).toBeDefined();
    const group = rule!.abilityChoices[0];
    expect(group, `${className} ${targetLevel} group`).toBeDefined();
    return { rule: rule!, group };
  }

  it("declares the explicit window only for the source-backed Elementalist groups", () => {
    const widened = LEVEL_UP_RULES.flatMap((rule) =>
      rule.abilityChoices
        .filter((group) => Array.isArray(group.allowedLevels))
        .map((group) => ({ rule, group })),
    );
    expect(widened.map(({ rule }) => `${rule.className}:${rule.level}`)).toEqual([
      "Элементалист:6",
      "Элементалист:9",
    ]);
    expect(widened[0].group.allowedLevels).toEqual([5, 6]);
    expect(widened[1].group.allowedLevels).toEqual([8, 9]);
  });

  it("offers and accepts an unchosen previous-level ability at level six", () => {
    const { rule, group } = levelUpGroup(elementalist, 6);
    // A frozen sheet proves the widened window never mutates the input.
    const character = deepFreeze(makeHero(elementalist, 5, "Огонь"));
    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);

    const choice = plan.choices.find((entry) => entry.id === group.id);
    expect(choice).toBeDefined();
    expect(choice!.count).toBe(1);
    const offered = choice!.options.map((option) => option.id);
    // The union of both levels is offered, exactly as the rule text allows.
    expect([...offered].sort()).toEqual([...group.abilityIds].sort());
    const offeredLevels = offered.map((id) => catalogEntry(id).level);
    expect(offeredLevels.filter((level) => level === 5)).toHaveLength(4);
    expect(offeredLevels.filter((level) => level === 6)).toHaveLength(4);
    for (const id of offered) {
      expect(catalogEntry(id)).toMatchObject({
        sourceKind: "class",
        className: elementalist,
      });
    }

    const previousLevelId = offered.find(
      (id) => catalogEntry(id).level === 5,
    )!;
    const perkChoice = plan.choices.find((entry) => entry.kind === "perk")!;
    const result = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: {
            [group.id]: [previousLevelId],
            [perkChoice.id]: [perkChoice.options[0].id],
          },
        }),
      ),
    );
    expect(result.next.level).toBe(6);
    expect(
      result.next.abilities.filter((ability) => ability.id === previousLevelId),
    ).toHaveLength(1);
    expect(result.next.advancements?.[0]).toMatchObject({
      fromLevel: 5,
      toLevel: 6,
      articleId: rule.articleId,
    });
    expect(result.next.advancements?.[0].choices[group.id]).toEqual([
      previousLevelId,
    ]);
  });

  it("accepts an unchosen level-eight pick at level nine but not an out-of-group grant", () => {
    const { group } = levelUpGroup(elementalist, 9);
    const character = makeHero(elementalist, 8, "Огонь");
    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);
    const choice = plan.choices.find((entry) => entry.id === group.id)!;
    const offered = choice.options.map((option) => option.id);

    const previousLevelId = offered.find(
      (id) => catalogEntry(id).level === 8,
    )!;
    expect(previousLevelId).toBeDefined();
    expect(
      offered.filter((id) => catalogEntry(id).level === 9),
    ).toHaveLength(4);

    // «Призыв Источника Земли» is a level-8 Earth grant, not a generic pick.
    const earthGrantId = "elementalist-prizyv-istochnika-zemli-c9679a42db";
    expect(catalogEntry(earthGrantId)).toMatchObject({
      level: 8,
      className: elementalist,
      sourceKind: "class",
    });
    expect(offered).not.toContain(earthGrantId);

    const base = {} as Record<string, string[]>;
    const accepted = expectOk(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: { ...base, [group.id]: [previousLevelId] },
        }),
      ),
    );
    expect(accepted.next.level).toBe(9);
    expect(
      accepted.next.abilities.some((ability) => ability.id === previousLevelId),
    ).toBe(true);

    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: { ...base, [group.id]: [earthGrantId] },
        }),
      ),
      "не входит в варианты",
    );
  });

  it("keeps ownership filtering inside a widened window", () => {
    const { group } = levelUpGroup(elementalist, 6);
    const character = makeHero(elementalist, 5, "Огонь");
    const plan = getLevelUpPlan(character);
    const offered = plan.choices.find((entry) => entry.id === group.id)!.options;
    const previousLevelId = offered
      .map((option) => option.id)
      .find((id) => catalogEntry(id).level === 5)!;
    // A learned copy under another ID still never comes back as an option.
    const legacyCopy = {
      ...catalogEntry(previousLevelId),
      id: "legacy-previous-level",
    } as Ability;
    const owned: Character = {
      ...character,
      abilities: [...character.abilities, legacyCopy],
    };
    const ownedChoice = getLevelUpPlan(owned).choices.find(
      (entry) => entry.id === group.id,
    )!;
    expect(ownedChoice.options.map((option) => option.id)).not.toContain(
      previousLevelId,
    );
    expect(
      ownedChoice.options.some((option) => catalogEntry(option.id).level === 6),
    ).toBe(true);
  });

  it("keeps the exact target level when a group declares no window", () => {
    const { group } = levelUpGroup(conduit, 5);
    expect(group.allowedLevels).toBeUndefined();
    const character = makeHero(conduit, 4, "Созидание, Смерть", { automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": "Созидание, Смерть", "conduit.domain.4": "Созидание" } } });
    const plan = getLevelUpPlan(character);
    expect(plan.available, plan.reason).toBe(true);
    const choice = plan.choices.find((entry) => entry.id === group.id)!;
    const offered = choice.options.map((option) => option.id);
    expect(offered).toEqual([...group.abilityIds]);
    for (const id of offered) {
      expect(catalogEntry(id)).toMatchObject({
        level: 5,
        className: conduit,
        sourceKind: "class",
      });
    }

    const legalChoices = firstChoices(character);
    expectOk(
      previewLevelUp(
        character,
        makeRequest(character, { choices: legalChoices }),
      ),
    );

    // The default is the exact target level: a previous level of the same class…
    const previousLevelId = "provodnik-vytyagivanie-dushi-59f437b757";
    expect(catalogEntry(previousLevelId)).toMatchObject({
      level: 3,
      className: conduit,
    });
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: { ...legalChoices, [group.id]: [previousLevelId] },
        }),
      ),
      "не входит в варианты",
    );

    // …and a real level-5 ability of another class are both rejected.
    const foreignLevelId = "elementalist-peschanaya-burya-120402b3db";
    expect(catalogEntry(foreignLevelId)).toMatchObject({
      level: 5,
      className: elementalist,
    });
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: { ...legalChoices, [group.id]: [foreignLevelId] },
        }),
      ),
      "не входит в варианты",
    );
  });

  it("rejects a future-level or foreign-class ability even inside a widened group", () => {
    const { group } = levelUpGroup(elementalist, 6);
    const character = makeHero(elementalist, 5, "Огонь");
    const plan = getLevelUpPlan(character);
    const choice = plan.choices.find((entry) => entry.id === group.id)!;
    // Only the declared window is offered: never a later level of the class.
    expect(
      [...new Set(choice.options.map((option) => catalogEntry(option.id).level))].sort(),
    ).toEqual([5, 6]);

    const legalChoices = firstChoices(character);
    const futureLevelId = "elementalist-muza-ognya-3e351890f4";
    expect(catalogEntry(futureLevelId)).toMatchObject({
      level: 8,
      className: elementalist,
    });
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: { ...legalChoices, [group.id]: [futureLevelId] },
        }),
      ),
      "не входит в варианты",
    );

    const foreignLevelId = "provodnik-mayak-blagodati-5c85fcb46e";
    expect(catalogEntry(foreignLevelId)).toMatchObject({
      level: 5,
      className: conduit,
    });
    expectIssues(
      previewLevelUp(
        character,
        makeRequest(character, {
          choices: { ...legalChoices, [group.id]: [foreignLevelId] },
        }),
      ),
      "не входит в варианты",
    );
  });

  it("keeps grants on the exact target level and out of widened picks", () => {
    for (const rule of LEVEL_UP_RULES) {
      for (const grant of rule.grantedAbilities) {
        for (const id of grant.abilityIds) {
          expect(catalogEntry(id), `${rule.className} ${rule.level}`).toMatchObject({
            sourceKind: "class",
            className: rule.className,
            level: rule.level,
          });
        }
      }
    }

    for (const targetLevel of [6, 9]) {
      const { rule, group } = levelUpGroup(elementalist, targetLevel);
      expect(rule.grantedAbilities).toEqual([]);
      const grantedNearby = new Set(
        LEVEL_UP_RULES.filter(
          (candidate) =>
            candidate.className === elementalist &&
            (candidate.level === targetLevel ||
              candidate.level === targetLevel - 1),
        ).flatMap((candidate) =>
          candidate.grantedAbilities.flatMap((grant) => grant.abilityIds),
        ),
      );
      for (const id of group.abilityIds) {
        expect(grantedNearby.has(id)).toBe(false);
      }
      const plan = getLevelUpPlan(
        makeHero(elementalist, targetLevel - 1, "Огонь"),
      );
      expect(plan.grantedAbilityIds).toEqual([]);
    }
  });

  it("commits a previous-level pick through one App recalculation without healing", () => {
    const { group } = levelUpGroup(elementalist, 6);
    const base = makeHero(elementalist, 5, "Огонь");
    const calculated = recalculateCharacter(base, {
      ...base,
      automation: {
        enabled: true,
        adjustments: { stamina: 3 },
        ancestryTraits: [],
        ancestryTraitIds: [],
        classFeatureSelections: {},
      },
    });
    const character: Character = {
      ...calculated,
      stamina: { current: 7, max: calculated.stamina.max, temp: 1 },
    };
    const oldAdjustments = { ...character.automation!.adjustments };

    const plan = getLevelUpPlan(character);
    const choice = plan.choices.find((entry) => entry.id === group.id)!;
    const previousLevelId = choice.options
      .map((option) => option.id)
      .find((id) => catalogEntry(id).level === 5)!;
    const choices = firstChoices(character);
    choices[group.id] = [previousLevelId];

    const result = expectOk(
      previewLevelUp(character, makeRequest(character, { choices })),
    );
    expect(result.next.level).toBe(6);
    expect(result.rawNext).not.toBe(result.next);
    // The raw patch keeps the saved maxima; App.update recalculates exactly once.
    expect(result.rawNext.stamina.max).toBe(character.stamina.max);
    expect(result.rawNext.recoveries.max).toBe(character.recoveries.max);
    const committed = recalculateCharacter(character, result.rawNext);
    expect(committed.stamina.max).toBe(result.next.stamina.max);
    expect(committed.recoveries.max).toBe(result.next.recoveries.max);
    expect(committed.speed).toBe(result.next.speed);
    expect(result.next.stamina.max).toBeGreaterThan(character.stamina.max);
    // No healing: current resources and temporary stamina stay untouched.
    expect(result.next.stamina.current).toBe(7);
    expect(result.next.stamina.temp).toBe(1);
    expect(result.next.recoveries.current).toBe(character.recoveries.current);
    // Adjustments survive and the previous-level pick is added exactly once.
    expect(result.next.automation?.adjustments).toEqual(oldAdjustments);
    expect(
      result.next.abilities.filter((ability) => ability.id === previousLevelId),
    ).toHaveLength(1);
    // Recalculating the new sheet is stable, so the maximum does not compound.
    const again = recalculateCharacter(result.next, result.next);
    expect(again.stamina.max).toBe(result.next.stamina.max);
  });

  it("walks Elementalist from 1 to 10 through both previous-level windows", () => {
    let character = makeHero(elementalist, 1, "Земля", { xp: 0 });
    for (let level = 1; level < MAX_CHARACTER_LEVEL; level += 1) {
      const result = expectOk(
        previewLevelUp(
          character,
          makeRequest(character, {
            mode: "milestone",
            choices: firstChoices(character),
          }),
        ),
      );
      character = result.next;
    }
    expect(character.level).toBe(MAX_CHARACTER_LEVEL);
    expect(character.advancements).toHaveLength(9);
    const abilityIds = character.abilities.map((ability) => ability.id);
    expect(new Set(abilityIds).size).toBe(abilityIds.length);

    const pickedAtSix = character.advancements!.find(
      (record) => record.toLevel === 6,
    )!.choices["0896-g01"];
    expect(pickedAtSix).toHaveLength(1);
    expect(catalogEntry(pickedAtSix[0]).level).toBe(5);

    const pickedAtNine = character.advancements!.find(
      (record) => record.toLevel === 9,
    )!.choices["0899-9-g01"];
    expect(pickedAtNine).toHaveLength(1);
    expect(catalogEntry(pickedAtNine[0]).level).toBe(8);

    // The level-8 Earth grant is awarded exactly once alongside the picks.
    const earthGrant = "elementalist-prizyv-istochnika-zemli-c9679a42db";
    expect(
      character.abilities.filter((ability) => ability.id === earthGrant),
    ).toHaveLength(1);
  });

  it.each([2, 6, 9])("requires and records one of the two conduit domain abilities at level %i", (toLevel) => {
    const domains = "Жизнь, Защита";
    const character = makeHero("Проводник", toLevel - 1, domains, {
      automation: { enabled: true, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": domains, "conduit.domain.1": "Жизнь" } },
    });
    const key = `conduit.ability.domain.${toLevel}`;
    const plan = getLevelUpPlan(character);
    const choice = plan.choices.find((entry) => entry.id === key)!;
    expect(choice).toBeDefined();
    expect(choice.options.map((option) => option.description).sort()).toEqual(["Жизнь", "Защита"]);

    expectIssues(previewLevelUp(character, makeRequest(character)), "Не выбран обязательный вариант");
    const chosen = choice.options[1];
    const choices = { ...firstChoices(character), [key]: [chosen.id] };
    const result = expectOk(previewLevelUp(character, makeRequest(character, { choices })));
    expect(result.next.abilities.some((ability) => ability.id === chosen.id)).toBe(true);
    expect(result.next.advancements?.at(-1)?.choices[key]).toEqual([chosen.id]);
    expect(result.next.automation?.classFeatureSelections?.[key]).toBe("Защита");

    const foreign = "provodnik-bozhestvennyy-drakon-28e9f9991d";
    expectIssues(previewLevelUp(character, makeRequest(character, { choices: { ...firstChoices(character), [key]: [foreign] } })), "не входит в варианты выбора");
  });

  it.each([2, 6, 9])("counts learned Conduit domain abilities correctly at level %i", (toLevel) => {
    const domains = ["Жизнь", "Защита"];
    const mapped = domains.map((domain) => conduitAbilities.find((entry) => entry.level === toLevel && entry.domain === domain)!);
    const entries = mapped.map((mapping) => ABILITY_COMPENDIUM.find((ability) => ability.id === mapping.abilityId)!);
    const makeConduit = (abilities: Ability[]) => makeHero("Проводник", toLevel - 1, domains.join(", "), {
      abilities,
      automation: { enabled: false, adjustments: { stamina: 2 }, ancestryTraits: [], classFeatureSelections: {
        "conduit.domain": domains.join(", "), "conduit.domain.1": "Жизнь", preserved: "keep",
      } },
    });

    const oneKnown = makeConduit([entries[0]]);
    const onePlan = getLevelUpPlan(oneKnown);
    const oneChoice = onePlan.choices.find((entry) => entry.id === `conduit.ability.domain.${toLevel}`)!;
    expect(oneChoice.options.map((option) => option.id)).toEqual([entries[1].id]);
    const oneResult = expectOk(previewLevelUp(oneKnown, makeRequest(oneKnown, { choices: firstChoices(oneKnown) })));
    expect(oneResult.next.abilities.filter((ability) => entries.some((entry) => entry.id === ability.id))).toHaveLength(2);
    expect(oneResult.next.automation?.classFeatureSelections?.preserved).toBe("keep");
    expect(oneResult.next.automation?.adjustments).toEqual({ stamina: 2 });

    const bothKnown = makeConduit(entries);
    const bothPlan = getLevelUpPlan(bothKnown);
    expect(bothPlan.available).toBe(true);
    expect(bothPlan.choices.some((entry) => entry.id === `conduit.ability.domain.${toLevel}`)).toBe(false);
    expect(bothPlan.warnings.join(" ")).toContain("уже есть у героя");
    const bothResult = expectOk(previewLevelUp(bothKnown, makeRequest(bothKnown, { choices: firstChoices(bothKnown) })));
    expect(bothResult.next.abilities.filter((ability) => entries.some((entry) => entry.id === ability.id))).toHaveLength(2);

    const noneKnown = makeConduit([]);
    const noneChoice = getLevelUpPlan(noneKnown).choices.find((entry) => entry.id === `conduit.ability.domain.${toLevel}`)!;
    expect(noneChoice.options.map((option) => option.id).sort()).toEqual(entries.map((entry) => entry.id).sort());
  });

  it("explains when neither selected domain has an available ability", () => {
    const domains = "Жизнь, Защита";
    const mappedIds = conduitAbilities.filter((entry) => entry.level === 2 && ["Жизнь", "Защита"].includes(entry.domain)).map((entry) => entry.abilityId);
    const known = mappedIds.map((id) => ABILITY_COMPENDIUM.find((ability) => ability.id === id)!);
    const character = makeHero("Проводник", 1, domains, {
      abilities: known,
      automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
        "conduit.domain": domains, "conduit.domain.1": "Жизнь",
      } },
    });
    const plan = getLevelUpPlan(character);
    expect(plan.available).toBe(true);
    expect(plan.choices.some((choice) => choice.id === "conduit.ability.domain.2")).toBe(false);
    expect(plan.warnings.join(" ")).toContain("уже есть у героя");
    const result = expectOk(previewLevelUp(character, makeRequest(character, { choices: firstChoices(character) })));
    expect(result.next.abilities.filter((ability) => mappedIds.includes(ability.id))).toHaveLength(2);
  });

  it("uses legacy subclass domains and does not invent a choice without a domain pair", () => {
    const legacy = makeHero("Проводник", 1, "Жизнь, Защита", { automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": "Жизнь, Защита", "conduit.domain.1": "Жизнь" } } });
    expect(getLevelUpPlan(legacy).choices.some((choice) => choice.id === "conduit.ability.domain.2")).toBe(true);
    const incomplete = makeHero("Проводник", 1, "Жизнь");
    expect(getLevelUpPlan(incomplete).available).toBe(false);
    expect(getLevelUpPlan(incomplete).reason).toContain("сначала выберите");
    expect(getLevelUpPlan(incomplete).choices.some((choice) => choice.id === "conduit.ability.domain.2")).toBe(false);
  });

  it.each([[1, 2], [5, 6], [8, 9]] as const)("blocks domain rewards for an invalid pair at %i → %i", (from, to) => {
    const character = makeHero("Проводник", from, "Жизнь, Неизвестный", {
      automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
        "conduit.domain": "Жизнь, Неизвестный", "conduit.domain.1": "Жизнь",
      } },
    });
    const plan = getLevelUpPlan(character);
    expect(plan.available).toBe(false);
    expect(plan.reason).toContain("домен");
    expect(plan.choices).toEqual([]);
    expectIssues(previewLevelUp(character, makeRequest(character)), "известных домена");
  });

  it("canonicalizes lower-case domains before resolving the level-two skill and ability", () => {
    const character = makeHero("Проводник", 1, "жизнь, защита", {
      automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: {
        "conduit.domain": "жизнь, защита", "conduit.domain.1": "жИЗНЬ",
      } },
    });
    const plan = getLevelUpPlan(character);
    expect(plan.available).toBe(true);
    expect(plan.choices.find((item) => item.id === "conduit.domain.skill.2")?.label).toBe("Навык домена «Защита»");
    expect(plan.choices.find((item) => item.id === "conduit.ability.domain.2")?.options.map((item) => item.description)).toContain("Защита");
  });

  it("does not add conduit domain choices for other classes", () => {
    const character = makeHero("Неистовый", 1, "Берсерк");
    expect(getLevelUpPlan(character).choices.some((choice) => choice.id.startsWith("conduit.ability.domain."))).toBe(false);
  });

  it.each([[3, 4], [6, 7]] as const)("selects a Conduit domain feature on %i → %i and keeps its complement", (from, to) => {
    const domains = "Жизнь, Защита";
    const built = buildCharacter({
      ...emptyBuilderDraft(),
      name: "Проводник уровней",
      ancestry: "Дварф",
      traits: [],
      className: "Проводник",
      subclass: domains,
      characteristics: startingCharacteristics("Проводник"),
      abilityIds: [],
      featureChoices: {},
      conduitDomainFeature: "Жизнь",
    }, { ...createCharacter({ name: "Проводник уровней", className: "Проводник", level: from }), level: from, xp: ENOUGH_XP });
    const character = { ...built, level: from, xp: ENOUGH_XP, subclass: domains };
    const key = `conduit.domain.${to}`;
    const plan = getLevelUpPlan(character);
    const choice = plan.choices.find((item) => item.id === key)!;
    expect(choice.options.map((option) => option.description).sort()).toEqual(["Жизнь", "Защита"]);
    expectIssues(previewLevelUp(character, makeRequest(character)), "Не выбран обязательный вариант");

    const selected = choice.options[0];
    const result = expectOk(previewLevelUp(character, makeRequest(character, { choices: { ...firstChoices(character), [key]: [selected.id] } })));
    expect(result.rawNext.automation?.classFeatureSelections?.[key]).toBe(selected.description);
    expect(result.rawNext.advancements?.at(-1)?.choices[key]).toEqual([selected.id]);
    const reloaded = normalizeCharacter(JSON.parse(JSON.stringify(result.rawNext)));
    const featureIds = activeClassFeatures(reloaded).map((feature) => feature.id);
    expect(featureIds).toContain(selected.id);
    const complement = GENERATED_CLASS_FEATURES.find((feature) => feature.level === to && feature.keyedBy === "domain" && feature.keyValue === "Защита")!;
    const complementAtNextLevel = activeClassFeatures({ ...reloaded, level: to + 1 });
    expect(complementAtNextLevel.map((feature) => feature.id)).toContain(complement.id);
    expect(reloaded.advancements?.at(-1)?.choices[key]).toEqual([selected.id]);

    const disabled = { ...character, automation: { ...character.automation!, enabled: false } };
    const manualResult = expectOk(previewLevelUp(disabled, makeRequest(disabled, { choices: { ...firstChoices(disabled), [key]: [selected.id] } })));
    expect(manualResult.next.automation?.classFeatureSelections?.[key]).toBe(selected.description);
  });

  it.each(["", "Жизнь", "Жизнь, Жизнь", "Жизнь, неизвестный"])("blocks domain feature advancement for an unknown pair: %s", (domains) => {
    const character = makeHero("Проводник", 3, domains);
    expect(getLevelUpPlan(character).available).toBe(false);
    expect(getLevelUpPlan(character).reason).toContain("два известных домена");
  });

  it("prefers the saved Conduit domain pair over the subclass fallback", () => {
    const character = makeHero("Проводник", 3, "Смерть, Любовь", {
      automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: { "conduit.domain": "Жизнь, Защита" } },
    });
    const choice = getLevelUpPlan(character).choices.find((item) => item.id === "conduit.domain.4");
    expect(choice?.options.map((option) => option.description).sort()).toEqual(["Жизнь", "Защита"]);
  });

  it.each([[4, 5], [7, 8]] as const)("blocks %i→%i when the previous domain feature choice is missing or invalid", (featureLevel, toLevel) => {
    for (const saved of [undefined, "Чужой домен"] as const) {
      const selections: Record<string, string> = { "conduit.domain": "Жизнь, Защита" };
      if (saved) selections[`conduit.domain.${featureLevel}`] = saved;
      const character = makeHero("Проводник", featureLevel, "Жизнь, Защита", {
        automation: { enabled: false, adjustments: {}, ancestryTraits: [], classFeatureSelections: selections },
      });
      const plan = getLevelUpPlan(character);
      expect(plan.available).toBe(false);
      expect(plan.reason).toContain(`особенности домена ${featureLevel}-го уровня`);
      expect(plan.reason).toContain("панели особенностей");
      expectIssues(previewLevelUp(character, makeRequest(character)), "Восстановите пару доменов");
    }
  });

  it.each([true, false])("allows 4→5 with a valid saved domain feature when automation is %s", (enabled) => {
    const character = makeHero("Проводник", 4, "Жизнь, Защита", {
      automation: { enabled, adjustments: { stamina: 3 }, ancestryTraits: [], classFeatureSelections: {
        "conduit.domain": "Жизнь, Защита", "conduit.domain.4": "Защита",
      } },
    });
    const result = expectOk(previewLevelUp(character, makeRequest(character, { choices: firstChoices(character) })));
    expect(result.next.level).toBe(5);
    expect(result.next.automation?.classFeatureSelections?.["conduit.domain.4"]).toBe("Защита");
    expect(result.next.automation?.adjustments).toEqual({ stamina: 3 });
  });
});
