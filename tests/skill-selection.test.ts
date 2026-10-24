import { describe, expect, it } from "vitest";
import { CAREER_SKILL_SLOTS, type SkillSlot } from "../src/data/creation-rules";
import { SKILL_GROUPS } from "../src/data/skills";
import {
  resolveSkillSelection,
  toggleSkillSelection,
} from "../src/lib/skill-selection";

const group = (...keys: (typeof SKILL_GROUPS)[number]["key"][]) =>
  SKILL_GROUPS.filter((entry) => keys.includes(entry.key)).flatMap(
    (entry) => entry.skills,
  );

const flexible = (...keys: (typeof SKILL_GROUPS)[number]["key"][]): SkillSlot => ({
  label: "Навык",
  options: group(...keys),
});

const fixed = (name: string): SkillSlot => ({
  label: name,
  options: [name],
  fixed: name,
});

const explicit = (options: string[], label = "Навык"): SkillSlot => ({
  label,
  options,
});

const names = (state: { values: string[] }) => state.values;

describe("resolveSkillSelection", () => {
  it("matches a chosen set to heterogeneous restricted slots instead of greedily filling positions", () => {
    const slots: SkillSlot[] = [
      explicit(["Обман"]),
      explicit(["Обман", "Прыжки"]),
    ];
    const straight = resolveSkillSelection(slots, ["Обман", "Прыжки"]);
    expect(straight.values).toEqual(["Обман", "Прыжки"]);
    expect(straight.selected).toEqual(["Обман", "Прыжки"]);
    expect(straight.complete).toBe(true);

    // Same set, positions swapped: the canonical assignment reorders it.
    const swapped = resolveSkillSelection(slots, ["Прыжки", "Обман"]);
    expect(swapped.values).toEqual(["Обман", "Прыжки"]);
    expect(swapped.invalid).toEqual([]);
    expect(swapped.complete).toBe(true);
  });

  it("uses an augmenting path so a legal extra skill stays selectable", () => {
    const slots: SkillSlot[] = [
      explicit(["Обман", "Прыжки"]),
      explicit(["Прыжки"]),
    ];
    const state = resolveSkillSelection(slots, ["Прыжки", ""]);
    // The narrower slot reserves its only legal pick; the broad slot stays free.
    expect(state.values).toEqual(["", "Прыжки"]);
    expect(state.selected).toEqual(["Прыжки"]);
    expect(state.remaining).toBe(1);
    expect(state.requirements).toEqual([
      { label: "Обман или Прыжки", required: 1, selected: 0 },
      { label: "Прыжки", required: 1, selected: 1 },
    ]);

    // «Обман» is not directly selectable: it needs «Прыжки» to move right.
    expect(state.selectable).toContain("Обман");
    expect(state.available).toContain("Обман");

    const filled = toggleSkillSelection(slots, ["Прыжки", ""], [], "Обман");
    expect(filled).toEqual(["Обман", "Прыжки"]);
    expect(resolveSkillSelection(slots, filled).complete).toBe(true);
  });

  it("never drops another valid selected skill when adding a feasible candidate", () => {
    const slots: SkillSlot[] = [flexible("interpersonal"), flexible("interpersonal")];
    let values = toggleSkillSelection(slots, ["", ""], [], "Обман");
    values = toggleSkillSelection(slots, values, [], "Эмпатия");
    expect(resolveSkillSelection(slots, values).selected).toEqual([
      "Обман",
      "Эмпатия",
    ]);

    const third = toggleSkillSelection(slots, values, [], "Запугивание");
    expect(third).toEqual(values); // over capacity: no-op, nothing dropped
    expect(resolveSkillSelection(slots, third).selected).toHaveLength(2);
  });

  it("removes any selected chip and re-canonicalizes the assignment", () => {
    const slots: SkillSlot[] = [
      explicit(["Обман", "Прыжки"]),
      explicit(["Прыжки"]),
    ];
    const full = ["Обман", "Прыжки"];
    // «Прыжки» stays in the only slot that can hold it.
    expect(toggleSkillSelection(slots, full, [], "Обман")).toEqual(["", "Прыжки"]);
    expect(toggleSkillSelection(slots, full, [], "Прыжки")).toEqual(["Обман", ""]);
    expect(toggleSkillSelection(slots, ["Прыжки", ""], [], "Прыжки")).toEqual([
      "",
      "",
    ]);
  });

  it("reserves non-duplicate fixed skills before flexible slots", () => {
    const slots: SkillSlot[] = [flexible("exploration"), fixed("Навигация")];
    const state = resolveSkillSelection(slots, ["Навигация", ""]);
    expect(state.automatic).toEqual(["Навигация"]);
    expect(state.values).toEqual(["", "Навигация"]);
    expect(state.invalid).toEqual(["Навигация"]);
    expect(state.complete).toBe(false);
    // A free slot may not consume the reserved automatic skill.
    expect(state.available).not.toContain("Навигация");
    expect(toggleSkillSelection(slots, ["Навигация", ""], [], "Навигация")).toEqual([
      "Навигация",
      "",
    ]);

    const legal = toggleSkillSelection(slots, ["", ""], [], "Плавание");
    expect(legal).toEqual(["Плавание", "Навигация"]);
    expect(resolveSkillSelection(slots, legal).complete).toBe(true);
  });

  it("turns a fixed skill already granted by an earlier source into a replacement choice", () => {
    const slots: SkillSlot[] = [fixed("Скрытность")];
    const prior = ["Скрытность"];
    const state = resolveSkillSelection(slots, [], prior);
    expect(state.automatic).toEqual([]);
    expect(state.required).toBe(1);
    expect(state.known).toEqual(["Скрытность"]);
    expect(state.available).not.toContain("Скрытность");
    expect(state.selectable).not.toContain("Скрытность");
    expect(state.available.length).toBeGreaterThan(30);

    // Raw data cannot restore the already owned skill in the replacement slot.
    const stale = resolveSkillSelection(slots, ["Скрытность"], prior);
    expect(stale.invalid).toEqual(["Скрытность"]);
    expect(stale.values).toEqual([""]);
    expect(stale.complete).toBe(false);
    expect(toggleSkillSelection(slots, [""], prior, "Скрытность")).toEqual([""]);

    const replaced = toggleSkillSelection(slots, [""], prior, "Обман");
    expect(replaced).toEqual(["Обман"]);
    expect(resolveSkillSelection(slots, replaced, prior).complete).toBe(true);
  });

  it("keeps the narrow quotas filled when a flexible replacement slot competes with them", () => {
    // Real chain: career «Агент» fixes «Скрытность», but an earlier source already
    // granted it, so that slot becomes a free replacement. The other two slots are
    // the interpersonal and the intrigue group.
    const slots = CAREER_SKILL_SLOTS["Агент"];
    const prior = ["Скрытность"];
    const full = ["Кулинария", "Обман", "Маскировка"];

    const state = resolveSkillSelection(slots, full, prior);
    expect(state.complete).toBe(true);
    expect(state.requirements).toEqual([
      { label: "Замена: Скрытность", required: 1, selected: 1 },
      { label: "Межличностные", required: 1, selected: 1 },
      { label: "Интрига", required: 1, selected: 1 },
    ]);

    // Removing the crafting pick must free the replacement slot, not the intrigue
    // slot: «Маскировка» is an intrigue skill and stays counted there.
    const afterRemove = toggleSkillSelection(slots, full, prior, "Кулинария");
    expect(afterRemove).toEqual(["", "Обман", "Маскировка"]);
    const partial = resolveSkillSelection(slots, afterRemove, prior);
    expect(partial.selected).toEqual(["Обман", "Маскировка"]);
    expect(partial.remaining).toBe(1);
    expect(partial.complete).toBe(false);
    expect(partial.requirements).toEqual([
      { label: "Замена: Скрытность", required: 1, selected: 0 },
      { label: "Межличностные", required: 1, selected: 1 },
      { label: "Интрига", required: 1, selected: 1 },
    ]);

    // Any crafting skill is still available through the free replacement slot.
    expect(partial.available).toContain("Кулинария");
    expect(partial.selectable).toContain("Кулинария");
    expect(toggleSkillSelection(slots, afterRemove, prior, "Кулинария")).toEqual(
      full,
    );
    expect(resolveSkillSelection(slots, full, prior).complete).toBe(true);
  });

  it("turns a duplicated fixed slot into one flexible replacement slot", () => {
    const slots: SkillSlot[] = [fixed("Магия"), fixed("Магия")];
    const state = resolveSkillSelection(slots, ["Магия", ""]);
    expect(state.automatic).toEqual(["Магия"]);
    expect(state.required).toBe(1);
    expect(state.values).toEqual(["Магия", ""]);
    expect(state.available).not.toContain("Магия");

    const filled = toggleSkillSelection(slots, ["Магия", ""], [], "История");
    expect(filled).toEqual(["Магия", "История"]);
    expect(resolveSkillSelection(slots, filled).complete).toBe(true);
  });

  it("reports malformed draft values and drops them from the canonical assignment", () => {
    const slots: SkillSlot[] = [flexible("interpersonal"), flexible("interpersonal")];
    const state = resolveSkillSelection(slots, ["Обман", "обман", "Псионика"]);
    expect(state.invalid).toEqual(["обман", "Псионика"]);
    expect(state.values).toEqual(["Обман", ""]);
    expect(state.complete).toBe(false);
  });

  it("rejects a set that no slot can hold instead of trusting the UI order", () => {
    const slots: SkillSlot[] = [explicit(["Обман"]), explicit(["Обман", "Прыжки"])];
    // Both picks only fit the first slot, so the draft is not a legal selection.
    const state = resolveSkillSelection(slots, ["Прыжки", "Прыжки"]);
    expect(state.invalid).toEqual(["Прыжки"]);
    expect(state.selected).toEqual(["Прыжки"]);
    expect(state.remaining).toBe(1);
    expect(state.complete).toBe(false);
  });

  it("keeps known prior skills, automatic skills and unknown names out of toggles", () => {
    const slots: SkillSlot[] = [flexible("interpersonal"), fixed("Навигация")];
    const prior = ["Обман"];
    expect(toggleSkillSelection(slots, ["", ""], prior, "Обман")).toEqual(["", ""]);
    expect(toggleSkillSelection(slots, ["", ""], prior, "Навигация")).toEqual([
      "",
      "",
    ]);
    expect(toggleSkillSelection(slots, ["", ""], prior, "Несуществующий")).toEqual([
      "",
      "",
    ]);
    const state = resolveSkillSelection(slots, ["", ""], prior);
    expect(state.known).toEqual(["Обман"]);
    expect(state.available).not.toContain("Обман");
    expect(state.available).not.toContain("Навигация");
  });

  it("normalizes case and ё while preserving catalog spelling", () => {
    const slots: SkillSlot[] = [explicit(["Печёный", "Ёж"]), explicit(["Ёж"])];
    const state = resolveSkillSelection(slots, ["ёж", "печеный"]);
    expect(state.invalid).toEqual([]);
    expect(state.values).toEqual(["Печёный", "Ёж"]);
    expect(resolveSkillSelection(slots, ["Еж", "Печеный"]).values).toEqual([
      "Печёный",
      "Ёж",
    ]);
  });

  it("aggregates requirements by eligible option domain with meaningful labels", () => {
    const slots: SkillSlot[] = [
      flexible("interpersonal"),
      flexible("interpersonal"),
      flexible("intrigue"),
      explicit(
        [...group("exploration"), "Внимательность", "Стратегия"],
        "Навык тактика",
      ),
    ];
    const state = resolveSkillSelection(slots, [
      "Обман",
      "Эмпатия",
      "",
      "Плавание",
    ]);
    expect(state.requirements).toEqual([
      { label: "Межличностные", required: 2, selected: 2 },
      { label: "Интрига", required: 1, selected: 0 },
      {
        label: "Исследование, Внимательность, Стратегия",
        required: 1,
        selected: 1,
      },
    ]);
  });

  it("labels requirements from the actual culture options instead of the generic slot label", () => {
    const cultureSlots: SkillSlot[] = [
      flexible("crafting", "lore"),
      flexible("crafting", "exploration"),
      flexible("lore"),
    ];
    const state = resolveSkillSelection(cultureSlots, []);
    expect(state.requirements).toEqual([
      { label: "Ремесло или Знания", required: 1, selected: 0 },
      { label: "Ремесло или Исследование", required: 1, selected: 0 },
      { label: "Знания", required: 1, selected: 0 },
    ]);
    expect(state.requirements.every((row) => row.label !== "Навык культуры")).toBe(
      true,
    );
    // Identical domains still aggregate into one quota row.
    const twice = resolveSkillSelection([
      flexible("exploration"),
      flexible("exploration"),
    ], []);
    expect(twice.requirements).toEqual([
      { label: "Исследование", required: 2, selected: 0 },
    ]);
    // Mixed group + named leftovers reads as groups followed by names.
    const mixed = resolveSkillSelection([
      explicit([...group("crafting"), ...group("exploration"), "Природа", "Магия"]),
    ], []);
    expect(mixed.requirements[0].label).toBe(
      "Ремесло, Исследование, Природа, Магия",
    );
    // Generic labels stay only as a fallback for option lists that cannot be
    // summarized at all.
    expect(
      resolveSkillSelection([explicit([], "Навык культуры")], []).requirements[0]
        .label,
    ).toBe("Навык культуры");
  });

  it("counts automatic skills separately from manually selected ones", () => {
    const slots: SkillSlot[] = [
      fixed("Природа"),
      flexible("exploration"),
      flexible("exploration"),
    ];
    const state = resolveSkillSelection(slots, ["", "Плавание", ""]);
    expect(state.automatic).toEqual(["Природа"]);
    expect(state.selected).toEqual(["Плавание"]);
    expect(state.required).toBe(2);
    expect(state.remaining).toBe(1);
    expect(state.complete).toBe(false);
    expect(state.values).toEqual(["Природа", "Плавание", ""]);
  });

  it("is complete for a group with no slots at all", () => {
    const state = resolveSkillSelection([], []);
    expect(state.complete).toBe(true);
    expect(state.required).toBe(0);
    expect(state.remaining).toBe(0);
    expect(state.values).toEqual([]);
    expect(toggleSkillSelection([], [], [], "Обман")).toEqual([]);
  });

  it("stays a maximum matching for every candidate subset, in any slot order", () => {
    // Independent truth source: brute-force feasibility over slot assignments.
    // The engine must never trade a legal pick for a slot order (greedy loss).
    const universe = [
      "Обман",
      "Прыжки",
      "Маскировка",
      "Кулинария",
      "Эмпатия",
      "История",
    ];
    const fits = (slots: readonly SkillSlot[], set: readonly string[]) => {
      const search = (index: number, used: Set<number>): boolean => {
        if (index === set.length) return true;
        return slots.some((slot, slotIndex) => {
          if (used.has(slotIndex) || !slot.options.includes(set[index]))
            return false;
          used.add(slotIndex);
          if (search(index + 1, used)) return true;
          used.delete(slotIndex);
          return false;
        });
      };
      return search(0, new Set());
    };
    const subsetsOf = (items: readonly string[]): string[][] =>
      items.reduce<string[][]>(
        (sets, item) => [...sets, ...sets.map((set) => [...set, item])],
        [[]],
      );
    const maxCovered = (slots: readonly SkillSlot[], set: readonly string[]) =>
      Math.max(
        ...subsetsOf(set)
          .filter((subset) => fits(slots, subset))
          .map((subset) => subset.length),
      );

    // Flexible-only shapes: raw draft values are positional, and fixed slots are
    // covered by their own regression tests below.
    const configs: SkillSlot[][] = [
      [explicit(["Обман", "Прыжки"]), explicit(["Прыжки"])],
      [explicit(universe), explicit(["Маскировка"]), explicit(["Обман", "Эмпатия"])],
      [explicit(["Маскировка"]), explicit(["Маскировка", "Обман", "Прыжки"])],
      [explicit(["Обман"]), explicit(["Обман"])],
      // Equal-width pools where greedy order alone is not enough: the third
      // narrow slot forces the second pick, and the first slot has to move.
      [
        explicit(["Обман", "Прыжки"]),
        explicit(["Обман", "Кулинария"]),
        explicit(["Кулинария"]),
      ],
      // Broad «any skill» slot competing with two narrow quotas, as in the
      // career «Агент» chain once its fixed skill is already owned.
      [explicit(universe), explicit(["Обман"]), explicit(["Маскировка"])],
    ];

    for (const slots of configs) {
      for (const set of subsetsOf(universe)) {
        const state = resolveSkillSelection(slots, set);
        const label = `${JSON.stringify(set)} for ${JSON.stringify(
          slots.map((slot) => slot.options.length),
        )}`;
        expect(state.values, label).toHaveLength(slots.length);
        expect(state.selected.length, label).toBe(maxCovered(slots, set));
        // Complete means the set both fits and fills every quota slot.
        expect(state.complete, label).toBe(
          set.length === slots.length && fits(slots, set),
        );
        // The canonical assignment is a real, distinct per-slot assignment:
        // automatic fixed skills plus the matched manual picks.
        expect(
          new Set(state.values.filter(Boolean)).size,
          label,
        ).toBe(state.automatic.length + state.selected.length);
        state.values.forEach((value, index) => {
          if (value) expect(slots[index].options, label).toContain(value);
        });
        expect([...state.values.filter(Boolean)].sort(), label).toEqual(
          [...state.automatic, ...state.selected].sort(),
        );

        // Raw picks outside every pool are dropped, so selectability extends the
        // legal picks, not the malformed raw array.
        const legalSet = set.filter((skill) =>
          slots.some((slot) => slot.options.includes(skill)),
        );
        for (const extra of universe) {
          expect(
            state.selectable.includes(extra),
            `${label} + ${extra}`,
          ).toBe(!legalSet.includes(extra) && fits(slots, [...legalSet, extra]));
        }
      }
    }
  });

  it("is deterministic for the same input", () => {
    const slots: SkillSlot[] = [
      explicit(["Обман", "Прыжки", "Эмпатия"]),
      explicit(["Прыжки", "Эмпатия"]),
      explicit(["Эмпатия"]),
    ];
    const first = resolveSkillSelection(slots, ["Эмпатия", "Прыжки", "Обман"]);
    for (let i = 0; i < 5; i++)
      expect(resolveSkillSelection(slots, ["Эмпатия", "Прыжки", "Обман"])).toEqual(
        first,
      );
    expect(first.values).toEqual(["Обман", "Прыжки", "Эмпатия"]);
    expect(first.complete).toBe(true);
  });

  it("does not mutate slots, values or prior", () => {
    const options = Object.freeze([...group("interpersonal")]) as string[];
    const slots = Object.freeze([
      Object.freeze({ label: "Навык", options }),
      Object.freeze({ label: "Навигация", options: Object.freeze(["Навигация"]) as string[], fixed: "Навигация" }),
    ]) as unknown as readonly SkillSlot[];
    const values = Object.freeze(["Обман", "Навигация"]);
    const prior = Object.freeze(["Эмпатия"]);
    const before = JSON.stringify({ slots, values, prior });

    const state = resolveSkillSelection(slots, values, prior);
    expect(state.values).toEqual(["Обман", "Навигация"]);
    expect(state.invalid).toEqual([]);
    const toggled = toggleSkillSelection(
      slots,
      ["", "Навигация"],
      prior,
      "Флирт",
    );
    expect(toggled).toEqual(["Флирт", "Навигация"]);
    expect(names(state)).toHaveLength(slots.length);

    expect(JSON.stringify({ slots, values, prior })).toBe(before);
  });

  it("returns a canonical values array of exactly one entry per slot", () => {
    const slots: SkillSlot[] = [flexible("lore"), fixed("Магия")];
    const state = resolveSkillSelection(slots, ["История", "Магия", "Лишний"]);
    expect(state.values).toHaveLength(2);
    expect(state.values).toEqual(["История", "Магия"]);
    expect(state.invalid).toEqual(["Лишний"]);
    expect(state.complete).toBe(false);
  });

  it("replaces a non-fixed choice whose every option was already granted (0301 duplicate grant)", () => {
    // Real chain: culture Городское/Бюрократическая/Творческое grants Музыка,
    // Выступление and Алхимия, so the career «Исполнитель» choice «Музыка или
    // Выступление» offers only skills the hero already owns.
    const slots = CAREER_SKILL_SLOTS["Исполнитель"];
    const prior = ["Музыка", "Выступление", "Алхимия"];
    const empty = resolveSkillSelection(slots, [], prior);
    expect(empty.automatic).toEqual([]);
    expect(empty.required).toBe(3);
    expect(empty.known).toEqual(prior);
    expect(empty.requirements[0]).toEqual({
      label: "Замена: Музыка или Выступление (уже известны)",
      required: 1,
      selected: 0,
    });
    // The exhausted domain becomes a free «any skill» replacement.
    expect(empty.available).toContain("Кулинария");
    expect(empty.available).not.toContain("Музыка");
    expect(empty.available).not.toContain("Выступление");
    expect(empty.selectable).toContain("Кулинария");
    expect(empty.complete).toBe(false);

    // A crafting pick plus two interpersonal skills now completes the group.
    let values = ["", "", ""];
    for (const skill of ["Кулинария", "Обман", "Эмпатия"])
      values = toggleSkillSelection(slots, values, prior, skill);
    const filled = resolveSkillSelection(slots, values, prior);
    expect(filled.selected).toEqual(["Кулинария", "Обман", "Эмпатия"]);
    expect(filled.values).toEqual(["Кулинария", "Обман", "Эмпатия"]);
    expect(filled.complete).toBe(true);
    expect(filled.requirements).toEqual([
      { label: "Замена: Музыка или Выступление (уже известны)", required: 1, selected: 1 },
      { label: "Межличностные", required: 2, selected: 2 },
    ]);

    // The duplicate grant is still rejected as raw data: prior skills can never
    // be picked twice, and the old dead end is what the replacement removes.
    const duplicate = resolveSkillSelection(
      slots,
      ["Музыка", "Обман", "Эмпатия"],
      prior,
    );
    expect(duplicate.invalid).toEqual(["Музыка"]);
    expect(duplicate.complete).toBe(false);
    expect(
      resolveSkillSelection(slots, ["Выступление", "Обман", "Эмпатия"], prior)
        .complete,
    ).toBe(false);

    // The duplicate-grant check is case and ё insensitive like the rest.
    const lower = ["музыка", "выступление", "алхимия"];
    expect(
      resolveSkillSelection(slots, [], lower).requirements[0].label,
    ).toBe("Замена: Музыка или Выступление (уже известны)");
    expect(resolveSkillSelection(slots, [], lower).available).toContain(
      "Кулинария",
    );
  });

  it("does not broaden a partially known choice domain", () => {
    const slots = CAREER_SKILL_SLOTS["Исполнитель"];
    const prior = ["Музыка"];
    const state = resolveSkillSelection(slots, [], prior);
    expect(state.required).toBe(3);
    expect(state.requirements[0]).toEqual({
      label: "Музыка или Выступление",
      required: 1,
      selected: 0,
    });
    expect(state.available).toContain("Выступление");
    expect(state.selectable).toContain("Выступление");
    // Only the other named option is legal here, never an outside skill.
    expect(state.available).not.toContain("Кулинария");
    expect(state.selectable).not.toContain("Кулинария");
    expect(toggleSkillSelection(slots, ["", "", ""], prior, "Кулинария")).toEqual([
      "",
      "",
      "",
    ]);

    let values = ["", "", ""];
    for (const skill of ["Выступление", "Обман", "Эмпатия"])
      values = toggleSkillSelection(slots, values, prior, skill);
    expect(resolveSkillSelection(slots, values, prior).complete).toBe(true);
  });

  it("keeps an empty option domain unavailable and does not broaden reserved automatic slots", () => {
    // An unresolved parent choice leaves an empty placeholder, not a free grant.
    const placeholder = resolveSkillSelection(
      [explicit([], "Пустой навык")],
      [],
      ["Музыка", "Выступление"],
    );
    expect(placeholder.required).toBe(1);
    expect(placeholder.available).toEqual([]);
    expect(placeholder.selectable).toEqual([]);
    expect(placeholder.complete).toBe(false);
    expect(placeholder.requirements).toEqual([
      { label: "Пустой навык", required: 1, selected: 0 },
    ]);

    // A domain whose only option is reserved as an automatic grant is not a
    // duplicate of an earlier source, so it stays empty instead of broadening.
    const reserved = resolveSkillSelection(
      [fixed("Навигация"), explicit(["Навигация"], "Остаток навигации")],
      [],
    );
    expect(reserved.automatic).toEqual(["Навигация"]);
    expect(reserved.required).toBe(1);
    expect(reserved.available).toEqual([]);
    expect(reserved.complete).toBe(false);
  });

  it("reports malformed raw values instead of throwing while rendering", () => {
    const slots: SkillSlot[] = [flexible("interpersonal"), flexible("interpersonal")];
    const malformed: [unknown, string[]][] = [
      [42, ["42"]],
      [{}, ["{}"]],
      [null, ["null"]],
      ["Обман", ["Обман"]],
    ];
    for (const [raw, invalid] of malformed) {
      const state = resolveSkillSelection(
        slots,
        raw as unknown as string[],
      );
      expect(state.invalid).toEqual(invalid);
      expect(state.values).toEqual(["", ""]);
      expect(state.selected).toEqual([]);
      expect(state.complete).toBe(false);
    }

    // A missing array is simply an empty draft, not malformed data.
    const missing = resolveSkillSelection(slots, undefined as unknown as string[]);
    expect(missing.invalid).toEqual([]);
    expect(missing.values).toEqual(["", ""]);
    expect(missing.complete).toBe(false);

    // Non-string entries inside the array are reported and dropped while the
    // valid picks around them still resolve.
    const mixed = resolveSkillSelection(slots, [
      "Обман",
      42,
      {},
      null,
      undefined,
      "",
      "Эмпатия",
    ] as unknown as string[]);
    expect(mixed.invalid).toEqual(["42", "{}", "null", "undefined"]);
    expect([...mixed.selected].sort()).toEqual(["Обман", "Эмпатия"]);
    expect([...mixed.values].sort()).toEqual(["Обман", "Эмпатия"]);
    expect(mixed.complete).toBe(false);

    // Malformed culture/career/class arrays are reported per group, never thrown.
    const slotGroup = CAREER_SKILL_SLOTS["Исполнитель"];
    expect(
      resolveSkillSelection(slotGroup, {} as unknown as string[], ["Музыка"])
        .invalid,
    ).toEqual(["{}"]);
  });

  it("repairs malformed toggle input instead of spreading it", () => {
    const slots: SkillSlot[] = [flexible("interpersonal"), flexible("interpersonal")];
    // A real toggle returns canonical data even when the stored array was junk.
    expect(toggleSkillSelection(slots, null as unknown as string[], [], "Обман")).toEqual([
      "Обман",
      "",
    ]);
    expect(toggleSkillSelection(slots, 42 as unknown as string[], [], "Обман")).toEqual([
      "Обман",
      "",
    ]);
    expect(
      toggleSkillSelection(slots, [42] as unknown as string[], [], "Обман"),
    ).toEqual(["Обман", ""]);
    // A no-op still has to return an array, never spread a non-array.
    expect(toggleSkillSelection(slots, ["", ""], [], "Кулинария")).toEqual([
      "",
      "",
    ]);
    expect(
      toggleSkillSelection(slots, null as unknown as string[], ["Обман"], "Обман"),
    ).toEqual(["", ""]);
    expect(
      toggleSkillSelection(slots, ["", ""], [], null as unknown as string),
    ).toEqual(["", ""]);
    // Prior junk contributes no known skills and does not throw.
    expect(
      toggleSkillSelection(slots, ["", ""], 42 as unknown as string[], "Обман"),
    ).toEqual(["Обман", ""]);
  });
});
