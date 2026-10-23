import { describe, expect, it } from "vitest";
import {
  normalizeNumberInput,
  parseNumberInputDraft,
} from "../src/lib/number-input";

describe("number input draft helpers", () => {
  it("accepts intermediate and signed decimal drafts without coercing them", () => {
    expect(parseNumberInputDraft("")).toBeNull();
    expect(parseNumberInputDraft("-")).toBeNull();
    expect(parseNumberInputDraft("-.")).toBeNull();
    expect(parseNumberInputDraft("-1.5")).toBe(-1.5);
    expect(parseNumberInputDraft("12.")).toBe(12);
  });

  it("normalizes empty input to the current value and clamps bounds", () => {
    expect(normalizeNumberInput(null, 4, 0, 10)).toBe(4);
    expect(normalizeNumberInput(-3, 4, 0, 10)).toBe(0);
    expect(normalizeNumberInput(15, 4, 0, 10)).toBe(10);
  });

  it("clamps outbound values without changing the raw draft", () => {
    const draft = "55";
    const outbound = normalizeNumberInput(
      parseNumberInputDraft(draft),
      0,
      undefined,
      5,
    );
    expect(outbound).toBe(5);
    expect(draft).toBe("55");
    expect(normalizeNumberInput(parseNumberInputDraft("10"), 1, 1)).toBe(10);
    expect(normalizeNumberInput(parseNumberInputDraft(""), 1, 1)).toBe(1);
  });
});
