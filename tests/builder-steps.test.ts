import { describe, expect, it } from "vitest";
import {
  BUILDER_STEPS,
  builderStepIndex,
  isBuilderStepId,
  migrateLegacyBuilderStep,
  nextBuilderStep,
  previousBuilderStep,
  restoreBuilderStep,
} from "../src/lib/builder-steps";

describe("stable character builder steps", () => {
  it("defines the twelve contracted IDs in order", () => {
    expect(BUILDER_STEPS.map(({ id }) => id)).toEqual([
      "concept", "ancestry", "ancestry-options", "culture", "career",
      "career-options", "class", "class-options", "kit", "abilities",
      "details", "summary",
    ]);
    expect(BUILDER_STEPS).toHaveLength(12);
  });

  it("navigates by stable ID and clamps at either end", () => {
    expect(nextBuilderStep("ancestry")).toBe("ancestry-options");
    expect(previousBuilderStep("ancestry-options")).toBe("ancestry");
    expect(nextBuilderStep("summary")).toBe("summary");
    expect(previousBuilderStep("concept")).toBe("concept");
    expect(builderStepIndex("summary")).toBe(11);
    expect(isBuilderStepId("career-options")).toBe(true);
    expect(isBuilderStepId("12")).toBe(false);
  });

  it("maps all valid old numeric positions with selection-aware pick/config steps", () => {
    const mappings = [
      "concept", "ancestry", "culture", "career", "class", "kit",
      "abilities", "details", "summary",
    ];
    for (const [index, expected] of mappings.entries()) {
      expect(migrateLegacyBuilderStep(String(index))).toBe(expected);
    }
    expect(migrateLegacyBuilderStep("1", { ancestry: true })).toBe("ancestry-options");
    expect(migrateLegacyBuilderStep("3", { career: true })).toBe("career-options");
    expect(migrateLegacyBuilderStep("4", { className: true })).toBe("class-options");
  });

  it("prefers a valid v2 ID and otherwise safely resumes the legacy position", () => {
    expect(restoreBuilderStep("class-options", "0")).toBe("class-options");
    expect(restoreBuilderStep("not-an-id", "4", { className: true })).toBe("class-options");
    expect(restoreBuilderStep(null, "1", { ancestry: true })).toBe("ancestry-options");
    expect(restoreBuilderStep(null, null)).toBe("concept");
  });

  it.each([null, "", "-1", "9", "1.5", "NaN", "Infinity", "01", "foo"])(
    "sends malformed legacy step %s to concept",
    (raw) => expect(migrateLegacyBuilderStep(raw)).toBe("concept"),
  );
});
