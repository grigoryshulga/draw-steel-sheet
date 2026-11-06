import { describe, expect, it } from "vitest";
import {
  advanceBuilderFlow,
  builderAbilityGroups,
  builderFlow,
  restoreBuilderFlow,
} from "../src/lib/builder-flow";
import {
  BUILDER_DATA,
  emptyBuilderDraft,
  startingCharacteristics,
} from "../src/lib/character-builder";

const draftFor = (className: string, subclass = "") => ({
  ...emptyBuilderDraft(),
  className,
  subclass,
  characteristics: startingCharacteristics(className),
});

describe("guided creation flow", () => {
  it("starts with ancestry and asks for a name only in personality", () => {
    const flow = builderFlow(emptyBuilderDraft());
    expect(flow[0].id).toBe("ancestry");
    expect(flow.find((s) => s.id === "details")?.issue).toBe(
      "Дайте герою имя.",
    );
    expect(flow.some((s) => s.step === "concept")).toBe(false);
    expect(flow.at(-1)?.id).toBe("summary");
    expect(new Set(flow.map((s) => s.id)).size).toBe(flow.length);
  });

  it("skips unavailable equipment and keeps tactician kits sequential", () => {
    expect(
      builderFlow(draftFor("Элементалист")).some((s) => s.step === "kit"),
    ).toBe(false);
    expect(
      builderFlow(draftFor("Неистовый", "Буревестник")).some(
        (s) => s.step === "kit",
      ),
    ).toBe(false);
    expect(
      builderFlow(draftFor("Тактик", "Авангард"))
        .filter((s) => s.step === "kit")
        .map((s) => s.part),
    ).toEqual(["primary", "secondary", "bonuses"]);
    const draft = {
      ...draftFor("Тактик", "Авангард"),
      kit: "Гора",
      secondaryKit: "Гора",
    };
    expect(
      builderFlow(draft).find((s) => s.id === "kit/secondary")?.issue,
    ).not.toBe("");
  });

  it("requires the conduit level-one domain before dependent skills", () => {
    const draft = draftFor("Проводник", "Созидание, Смерть");
    const before = builderFlow(draft);
    expect(before.find((s) => s.id === "class-options/subclass")?.issue).toBe(
      "",
    );
    expect(before.find((s) => s.id === "class-options/domain")?.issue).not.toBe(
      "",
    );
    expect(
      before.findIndex((s) => s.id === "class-options/domain"),
    ).toBeLessThan(before.findIndex((s) => s.id === "class-options/skills"));
    expect(
      builderFlow({ ...draft, conduitDomainFeature: "Созидание" }).find(
        (s) => s.id === "class-options/domain",
      )?.issue,
    ).toBe("");
    expect(
      builderFlow({ ...draft, conduitDomainFeature: "Жизнь" }).find(
        (s) => s.id === "class-options/domain",
      )?.issue,
    ).not.toBe("");
  });

  it("counts abilities within their own group and exposes only level one choices", () => {
    const draft = draftFor("Тактик", "Авангард");
    const groups = builderAbilityGroups(draft);
    expect(groups.some((g) => g.id === "signature")).toBe(false);
    expect(groups.flatMap((g) => g.entries).every((a) => a.level === 1)).toBe(
      true,
    );
    const three = groups.find((g) => g.id === "3")!;
    const flow = builderFlow({ ...draft, abilityIds: [three.entries[0].id] });
    expect(flow.find((s) => s.id === "abilities/3")?.issue).toBe("");
    expect(flow.find((s) => s.id === "abilities/5")?.issue).not.toBe("");
  });

  it("does not offer other doctrines' triggers to a vanguard", () => {
    const draft = draftFor("Тактик", "Авангард");
    expect(builderAbilityGroups(draft).find((g) => g.id === "other")).toBeUndefined();
    expect(builderFlow(draft).some((s) => s.id === "abilities/other")).toBe(false);
  });

  it("keeps the conduit's actual choice of triggered action", () => {
    const group = builderAbilityGroups(draftFor("Проводник", "Созидание, Смерть"))
      .find((g) => g.id === "other")!;
    expect(group.count).toBe(1);
    expect(group.entries.map((a) => a.name).sort()).toEqual(["Слово Наставления", "Слово Суда"]);
  });

  it.each(BUILDER_DATA.classes.filter((c) => c.name !== "Проводник").flatMap((c) =>
    c.subclasses.map((s) => [c.name, s.name]),
  ))("does not ask for automatic subclass abilities: %s / %s", (className, subclass) => {
    expect(builderAbilityGroups(draftFor(className, subclass)).find((g) => g.id === "other"))
      .toBeUndefined();
  });

  it("restores v3 and historical positions without changing draft data", () => {
    const draft = draftFor("Тактик", "Авангард");
    const original = structuredClone(draft);
    expect(restoreBuilderFlow(draft, "class-options/skills", null, null)).toBe(
      "class-options/skills",
    );
    expect(restoreBuilderFlow(draft, null, "class-options", null)).toBe(
      "class-options/subclass",
    );
    expect(restoreBuilderFlow(draft, null, null, "4")).toBe(
      "class-options/subclass",
    );
    expect(restoreBuilderFlow(draft, null, "concept", null)).toBe("details");
    expect(restoreBuilderFlow(draft, null, null, null)).toBe("ancestry");
    expect(
      restoreBuilderFlow(draft, "class-options/feature:removed", null, null),
    ).toBe("class-options/subclass");
    expect(draft).toEqual(original);
  });
});

describe("applying a list choice on Next", () => {
  it("applies the pending choice before validation and advances to its options", () => {
    const draft = emptyBuilderDraft();
    const next = advanceBuilderFlow(draft, "ancestry", { ancestry: "Дварф" });
    expect(next.issue).toBe("");
    expect(next.id).toBe("ancestry-options");
    expect(next.draft.ancestry).toBe("Дварф");
    expect(draft.ancestry).toBe("");
  });
  it("does not commit a disabled option or advance on incomplete input", () => {
    const draft = draftFor("Тактик", "Авангард");
    const next = advanceBuilderFlow(
      draft,
      "class",
      { className: "Призыватель" },
      "Нет перевода",
    );
    expect(next.draft).toBe(draft);
    expect(next.id).toBe("class");
    expect(next.issue).toBe("Нет перевода");
    expect(advanceBuilderFlow(emptyBuilderDraft(), "ancestry").issue).not.toBe(
      "",
    );
  });
});
