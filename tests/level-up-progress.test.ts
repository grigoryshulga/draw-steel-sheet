import { describe, expect, it } from "vitest";
import { levelUpProgress } from "../src/lib/level-up-progress";
import { getLevelUpPlan } from "../src/lib/level-up";
import { createCharacter } from "../src/lib/defaults";

// XP-only display must agree with the complete rules engine, including manual thresholds.
describe("lightweight level progress", () => {
  it.each([
    [{ level: 1, xp: 0 }, { fromLevel: 1, toLevel: 2, xpRequired: 16, xpMissing: 16 }],
    [{ level: 2, xp: 49, xpThreshold: { level: 3, value: 50 } }, { fromLevel: 2, toLevel: 3, xpRequired: 50, xpMissing: 1 }],
    [{ level: 2, xp: 100, xpThreshold: { level: 3, value: -1 } }, { fromLevel: 2, toLevel: 3, xpRequired: 32, xpMissing: 0 }],
    [{ level: 10, xp: 144 }, { fromLevel: 10, toLevel: 10, xpRequired: 144, xpMissing: 0 }],
  ])("keeps the saved XP threshold contract: %j", (character, expected) => {
    expect(levelUpProgress(character)).toEqual(expected);
  });

  it("matches the full plan for normal and malformed saved XP fields", () => {
    for (const level of [0, 1, 3, 9, 10, 11, NaN, 2.5]) {
      for (const xp of [0, 32, 999, NaN]) {
        for (const xpThreshold of [undefined, { level: level + 1, value: 50 }, { level: level + 1, value: -1 }]) {
          const character = { ...createCharacter(), level, xp, xpThreshold };
          const plan = getLevelUpPlan(character);
          expect(levelUpProgress(character)).toEqual({
            fromLevel: plan.fromLevel, toLevel: plan.toLevel,
            xpRequired: plan.xpRequired, xpMissing: plan.xpMissing,
          });
        }
      }
    }
  });
});
