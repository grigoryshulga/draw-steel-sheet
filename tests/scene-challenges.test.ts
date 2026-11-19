import { describe, expect, it } from "vitest";
import { projectScene, validateScene } from "../server/tables-store.mjs";
import { projectBoard } from "../server/table-board.mjs";
import {
  advanceMontage, argumentEffect, challengeCounter, montageLimits, montageState, montageVictories, negotiationArgument,
  negotiationProgress, negotiationState, recordMontage, researchNegotiation, setChallengeCounter,
} from "../src/lib/tables/challenges";
import { createScene, duplicateScene } from "../src/lib/tables/scenes";
import type { NegotiationTrait, TableScene } from "../src/lib/tables/types";

const protection: NegotiationTrait = { id: "protection", name: "Защита", kind: "motivation", revealed: false };
const greed: NegotiationTrait = { id: "greed", name: "Жадность", kind: "pitfall", revealed: false };
const negotiation = (): TableScene => ({
  ...createScene("negotiation", "Переговоры"), challenge: { kind: "negotiation", traits: [protection, greed] },
});

describe("монтаж-тест", () => {
  it("adjusts recommended limits for the group with a floor of two", () => {
    expect(montageLimits("easy", 5)).toEqual({ successes: 5, failures: 5 });
    expect(montageLimits("hard", 4)).toEqual({ successes: 6, failures: 2 });
    expect(montageLimits("moderate", 2)).toEqual({ successes: 3, failures: 2 });
    expect(montageLimits("moderate", 7)).toEqual({ successes: 8, failures: 6 });
    expect(challengeCounter(createScene("montage", "Поход", 4), "successes")?.max).toBe(5);
  });

  it("counts at most one contribution per hero per round and ends after round two", () => {
    const scene = createScene("montage");
    const first = recordMontage(scene, "successes", "hero");
    expect(recordMontage(first, "failures", "hero")).toBe(first);
    const second = advanceMontage(first);
    expect(second.round).toBe(2);
    expect(montageState(second).acted).toEqual([]);
    const pass = recordMontage(second, "pass", "hero");
    expect(challengeCounter(pass, "successes")?.value).toBe(1);
    expect(montageState(advanceMontage(pass)).result).toBe("failure");
  });

  it("ends on either limit and distinguishes partial success at the failure limit or time limit", () => {
    const scene = createScene("montage");
    const four = recordMontage(scene, "successes", undefined, 4);
    const five = recordMontage(four, "successes");
    expect(montageState(recordMontage(five, "successes")).result).toBe("success");
    expect(montageState(advanceMontage(advanceMontage(four))).result).toBe("partial");

    const harder = setChallengeCounter(four, "failures", { max: 2 });
    expect(montageState(recordMontage(harder, "failures", undefined, 2)).result).toBe("partial");
    const failed = recordMontage(scene, "failures", undefined, 4);
    expect(montageState(failed).result).toBe("failure");
    expect(recordMontage(failed, "successes")).toBe(failed);
    expect(montageVictories("success", "hard")).toBe(2);
    expect(montageVictories("partial", "easy")).toBe(0);
    expect(montageVictories("partial", "moderate")).toBe(1);
  });

  it("continues legacy scenes with existing counter ids and preserves private montage limits even on pinned counters", () => {
    const scene = createScene("montage", "Опасность");
    const legacy = { ...scene, challenge: undefined, counters: scene.counters.map(c => ({ ...c, id: `old-${c.id}` })) };
    const recorded = recordMontage(legacy, "successes", "hero");
    expect(challengeCounter(recorded, "successes")).toMatchObject({ id: "old-successes", value: 1 });
    const hidden = validateScene({ ...recorded, status: "active", published: true,
      challenge: { ...montageState(recorded), hideLimits: true, obstacles: "Секрет" } });
    expect(projectScene(hidden).challenge).toEqual({ kind: "montage", rounds: 2 });
    expect(projectScene(hidden).counters[0].max).toBeUndefined();
    const table = { scenes: [hidden], board: { pins: [{ sceneId: hidden.id, id: "old-successes" }], counters: [] } };
    expect(projectBoard(table, false).counters[0].max).toBeUndefined();
    expect(projectBoard(table, true).counters[0].max).toBe(6);
    const copy = duplicateScene(recorded);
    expect(challengeCounter(copy, "successes")?.value).toBe(0);
    expect(montageState(copy).acted).toEqual([]);
  });
});

describe("переговоры", () => {
  it("applies both scores in one action for every tier, a repeated motivation, and a dangerous topic", () => {
    expect([argumentEffect(1), argumentEffect(2), argumentEffect(3), argumentEffect("critical")]).toEqual([
      { interest: -1, patience: -1 }, { interest: 0, patience: -1 }, { interest: 1, patience: -1 }, { interest: 1, patience: 0 },
    ]);
    expect([argumentEffect(1, protection), argumentEffect(2, protection), argumentEffect(3, protection)]).toEqual([
      { interest: 0, patience: -1 }, { interest: 1, patience: -1 }, { interest: 1, patience: 0 },
    ]);
    const first = negotiationArgument(negotiation(), 2, protection.id);
    expect(negotiationProgress(first)).toEqual({ interest: 3, patience: 2, terminal: false });
    const repeat = negotiationArgument(first, 3, protection.id);
    expect(negotiationProgress(repeat)).toEqual({ interest: 3, patience: 1, terminal: false });
    const finished = negotiationArgument(repeat, 3, greed.id);
    expect(negotiationProgress(finished)).toEqual({ interest: 2, patience: 0, terminal: true });
    expect(negotiationArgument(finished, 3)).toBe(finished);
    expect(negotiationProgress(duplicateScene(finished))).toEqual({ interest: 2, patience: 3, terminal: false });
  });

  it("can probe one motivation or dangerous topic between arguments", () => {
    const first = researchNegotiation(negotiation(), 1);
    expect(negotiationProgress(first).patience).toBe(2);
    expect(researchNegotiation(first, 3)).toBe(first);
    const next = negotiationArgument(first, 3, protection.id);
    expect(negotiationState(next).researched).toBe(false);
    expect(negotiationState(researchNegotiation(next, 3)).researched).toBe(true);
    const far = setChallengeCounter(next, "interest", { value: 4 });
    expect(negotiationProgress(negotiationArgument(far, "critical"))).toMatchObject({ interest: 5, terminal: true });
  });

  it("projects only revealed traits and strips private offers and preparation", () => {
    const scene = negotiation();
    const record = validateScene({ ...scene, challenge: {
      ...negotiationState(scene), npc: "Капитан", offers: ["Секрет"], impression: 3,
      traits: [{ ...protection, revealed: true, used: true }, greed],
    } });
    expect(projectScene(record).challenge).toEqual({
      kind: "negotiation", npc: "Капитан", traits: [{ ...protection, revealed: true }],
    });
    expect(projectScene(record).counters).toEqual([]);
    expect(projectScene(record, true).challenge.traits).toHaveLength(2);
    expect(() => validateScene({ ...scene, challenge: { ...negotiationState(scene), traits: [greed, greed] } })).toThrow();
  });
});
