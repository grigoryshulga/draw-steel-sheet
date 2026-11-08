import { describe, expect, it } from "vitest";
import {
  duplicateScene,
  combatantFromSeed,
  createScene,
  encounterBudget,
  normalizeScene,
  resizeMinionGroup,
} from "../src/lib/tables/scenes";

describe("сцены", () => {
  it("builds a minion pool and preserves its damage when resizing", () => {
    const creature = combatantFromSeed({
      sourceId: "minion",
      name: "Миньон",
      level: 1,
      organization: "minion",
      role: "",
      encounterValue: 0.75,
      maxStamina: 6,
      group: "",
      kind: "monster",
    });
    expect(creature).toMatchObject({ count: 4, stamina: 24, maxStamina: 24 });
    expect(resizeMinionGroup({ ...creature, stamina: 19 }, 8)).toEqual({
      count: 8,
      stamina: 43,
      maxStamina: 48,
    });
    const terrain = combatantFromSeed({
      sourceId: "hazard",
      name: "Опасность",
      level: 1,
      organization: "",
      role: "",
      encounterValue: 1,
      maxStamina: 0,
      group: "",
      kind: "terrain",
    });
    const normalized = normalizeScene({
      ...createScene("encounter"),
      combatants: [terrain],
    }).combatants[0];
    expect(normalized.stamina).toBeUndefined();
    expect(normalized.health).toBe("healthy");
  });
  it("budgets an encounter by hero level, victories and minion count", () => {
    const scene = createScene("encounter");
    scene.combatants = [
      {
        id: "minions",
        name: "Миньоны",
        group: "",
        organization: "minion",
        faction: "enemy",
        revealed: false,
        turn: "ready",
        reactionUsed: false,
        conditions: [],
        health: "healthy",
        encounterValue: 0.75,
        count: 4,
      },
    ];
    expect(encounterBudget(scene, [3, 3, 3, 3, 3], 2)).toMatchObject({
      cost: 3,
      strength: 60,
      standardMax: 70,
      hardMax: 90,
      difficulty: "Тривиальная",
    });
    scene.combatants[0].encounterValue = 15;
    expect(encounterBudget(scene, [3, 3, 3, 3, 3])).toMatchObject({
      cost: 60,
      difficulty: "Стандартная",
    });
    scene.combatants[0].faction = "ally";
    expect(encounterBudget(scene, [1])).toMatchObject({ cost: 0 });
    expect(encounterBudget(scene, [])).toBeNull();
  });
  it("keeps negotiation counters private and montage progress public by default", () => {
    expect(
      createScene("negotiation").counters.map((c) => [c.name, c.public]),
    ).toEqual([
      ["Интерес", false],
      ["Терпение", false],
    ]);
    expect(createScene("montage").counters.every((c) => c.public)).toBe(true);
  });
  it("duplicates into preparation and remaps captain references", () => {
    const scene = createScene("encounter", "Бой");
    scene.combatants = [
      {
        id: "a",
        name: "A",
        group: "",
        organization: "",
        faction: "enemy",
        revealed: false,
        turn: "done",
        reactionUsed: true,
        conditions: [{ id: "condition", name: "", public: false, ends: "" }],
        health: "healthy",
        stamina: 5,
        maxStamina: 5,
      },
      {
        id: "b",
        captainId: "a",
        name: "B",
        group: "",
        organization: "",
        faction: "enemy",
        revealed: false,
        turn: "ready",
        reactionUsed: false,
        conditions: [],
        health: "healthy",
      },
    ];
    const copy = duplicateScene(scene);
    expect(copy.id).not.toBe(scene.id);
    expect(copy).toMatchObject({ name: `${scene.name} — копия`, status: "prepared", published: false, round: 1 });
    expect(scene.id).not.toBe(copy.id);
    expect(copy.combatants[0].id).not.toBe("a");
    expect(copy.combatants[1].captainId).toBe(copy.combatants[0].id);
    expect(copy.combatants[0].conditions[0].id).not.toBe("condition");
    expect(copy.combatants[0].turn).toBe("ready");
  });
  it("keeps duplicate names within the storage limit", () => {
    const copy = duplicateScene(createScene("encounter", "А".repeat(200)));
    expect(copy.name).toHaveLength(200);
    expect(copy.name.endsWith(" — копия")).toBe(true);
  });
  it("bounds counters and stamina", () => {
    const scene = createScene("montage");
    scene.counters = [{ id: "x", name: "", value: 20, max: 3, public: true }];
    scene.combatants = [
      {
        id: "a",
        name: "",
        group: "",
        organization: "",
        faction: "enemy",
        revealed: true,
        turn: "ready",
        reactionUsed: false,
        conditions: [],
        health: "healthy",
        stamina: -2,
        maxStamina: 10,
      },
    ];
    const result = normalizeScene(scene);
    expect(result.counters[0].value).toBe(3);
    expect(result.combatants[0].stamina).toBe(0);
    expect(result.combatants[0].health).toBe("defeated");
  });
});
