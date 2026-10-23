import { describe, expect, it } from "vitest";
import { adjustProjectPoints, projectProgress } from "../src/lib/projects";

describe("projects", () => {
  it("считает прогресс и завершение", () => {
    expect(projectProgress({ points: "5", goal: "10" })).toEqual({
      points: 5,
      goal: 10,
      percent: 50,
      complete: false,
    });
    expect(projectProgress({ points: "10", goal: "10" }).complete).toBe(true);
    expect(projectProgress({ points: "15", goal: "10" })).toMatchObject({
      percent: 100,
      complete: true,
    });
  });

  it("безопасно обрабатывает пустую или нулевую цель", () => {
    expect(projectProgress({ points: "", goal: "" })).toEqual({
      points: 0,
      goal: 0,
      percent: 0,
      complete: false,
    });
    expect(projectProgress({ points: "3", goal: "0" }).percent).toBe(0);
    expect(projectProgress({ points: "-5", goal: "10" }).points).toBe(0);
  });

  it("меняет очки без отрицательных значений", () => {
    expect(adjustProjectPoints("5", 3)).toBe("8");
    expect(adjustProjectPoints("5", -3)).toBe("2");
    expect(adjustProjectPoints("1", -5)).toBe("0");
    expect(adjustProjectPoints("", 2)).toBe("2");
  });
});
