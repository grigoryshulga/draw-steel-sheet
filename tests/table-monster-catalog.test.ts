import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  loadMonsterSeed,
  monsterGroupName,
  searchMonsterSeeds,
} from "../src/lib/tables/monster-catalog";

beforeAll(() =>
  vi.stubGlobal("fetch", async (input: string) => {
    const pathname = new URL(input, "http://rules.test").pathname;
    if (!/^\/src\/generated\/rules\/articles\/[\w.-]+\.json$/.test(pathname))
      throw new Error("Unexpected article URL");
    return new Response(
      await readFile(path.join(process.cwd(), pathname), "utf8"),
    );
  }),
);
afterAll(() => vi.unstubAllGlobals());

describe("scene monster catalog adapter", () => {
  it("uses the Russian reference group name for goblins", async () => {
    const row = searchMonsterSeeds("Гоблин-убийца")[0];
    expect(row.group).toBe("Гоблины");
    expect(monsterGroupName("goblin")).toBe("Гоблины");
    expect(monsterGroupName("Моя группа")).toBe("Моя группа");
    expect((await loadMonsterSeed(row.sourceId)).group).toBe("Гоблины");
  });
  it("imports every canonical catalog entry with finite counters", async () => {
    const rows = searchMonsterSeeds("");
    expect(rows.filter((row) => row.kind === "monster")).toHaveLength(416);
    expect(rows.filter((row) => row.kind === "retainer")).toHaveLength(21);
    expect(rows.filter((row) => row.kind === "terrain")).toHaveLength(35);
    for (const row of rows) {
      const seed = await loadMonsterSeed(row.sourceId);
      expect(Number.isFinite(seed.maxStamina), row.sourceId).toBe(true);
      expect(seed.maxStamina, row.sourceId).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(seed.encounterValue * 4), row.sourceId).toBe(
        true,
      );
    }
  });
  it("searches canonical navigation in Russian and English with filters", () => {
    expect(
      searchMonsterSeeds("Аякс").some((seed) =>
        seed.sourceId.includes("ajax-the-invincible"),
      ),
    ).toBe(true);
    expect(
      searchMonsterSeeds("Frozen Pond", { kind: "terrain" }).some((seed) =>
        seed.sourceId.includes("frozen-pond"),
      ),
    ).toBe(true);
    expect(
      searchMonsterSeeds("", { level: 11 }).every((seed) => seed.level === 11),
    ).toBe(true);
  });

  it("loads printed values from monster, retainer, and terrain canonical entities", async () => {
    const monster = await loadMonsterSeed(
      "monsters.monster.ajax-the-invincible.statblock.ajax-the-invincible",
    );
    expect(monster).toMatchObject({
      kind: "monster",
      encounterValue: 156,
      maxStamina: 700,
    });
    const retainer = await loadMonsterSeed(
      "monsters.monster.retainer.statblock.gnoll-gnasher",
    );
    expect(retainer).toMatchObject({
      kind: "retainer",
      maxStamina: expect.any(Number),
    });
    const terrain = await loadMonsterSeed(
      "monsters.dynamic-terrain.environmental-hazards.frozen-pond",
    );
    expect(terrain).toMatchObject({
      kind: "terrain",
      encounterValue: 1,
      maxStamina: 3,
    });
  });

  it("rejects unknown and unsupported articles rather than returning invalid counters", async () => {
    await expect(loadMonsterSeed("not-a-monster")).rejects.toThrow();
    await expect(loadMonsterSeed("monsters.rule.role.brute")).rejects.toThrow();
  });
});
