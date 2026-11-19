import { describe, expect, it } from "vitest";
import type { TableCombat, TableSnapshot } from "../src/lib/tables/types";
import { normalizeCharacter } from "../src/lib/defaults";
import { combatAnnouncement, syncCharacterCombat, tableCombatForHero } from "../src/lib/tables/combat";
import { markTrigger } from "../src/lib/runtime";

const baseCombat: TableCombat = {
  id: "battle", sceneId: "encounter", round: 1, side: "heroes", initiative: "heroes",
  active: null, heroTurns: [], enemyTurns: [],
};

function table(combat?: TableCombat): TableSnapshot {
  return {
    id: "table", name: "Стол", ownerId: "director", actorId: "player", archived: false,
    revision: 10, updatedAt: "", memberCount: 1, myHeroIds: ["hero"], visibility: {},
    scenes: [], materials: [], events: [], offers: [], trades: [],
    members: [{
      userId: "player", name: "Игрок", role: "player",
      hero: {
        id: "hero", name: "Герой", className: "Нуль", ancestry: "", level: 1,
        stamina: { current: 10, max: 10, temp: 0 },
        resources: { heroicResource: { current: 2, name: "Дисциплина" },
          recoveries: { current: 2, max: 2 }, surges: 0, heroTokens: 0, additional: {} },
        conditions: {}, updatedAt: "", sections: {}, notes: {},
      },
    }],
    combat,
  };
}
const state = (combat?: TableCombat) => tableCombatForHero(table(combat), "hero") ?? null;
const turn = { userId: "player", heroId: "hero", round: 1 };
const active = { side: "heroes", id: "player", heroId: "hero" } as const;
const ongoing = { ...baseCombat, active, heroTurns: [turn] };

describe("board combat announcements", () => {
  it("picks a shared phrase for the round and announces each newly active hero", () => {
    const opened = table(baseCombat);
    const round = combatAnnouncement(opened);
    expect(round?.text).toMatch(/^(Достать мечи|К бою|Украсть дроу|Рисуй сталь|Мечи наголо|Поднять оружие|В атаку)!$/);
    expect(combatAnnouncement({ ...opened, actorId: "director" })).toEqual(round);
    expect(combatAnnouncement(opened, baseCombat)).toBeUndefined();
    expect(combatAnnouncement(table(ongoing), baseCombat)?.text).toBe("Ходит Герой!");
    expect(combatAnnouncement(table(ongoing), ongoing)).toBeUndefined();
  });

  it("announces the Director's revealed combatant and preserves hidden names", () => {
    const combat = { ...baseCombat, side: "enemies" as const, active: { side: "enemies" as const, id: null } };
    const battle = table(combat);
    expect(combatAnnouncement(battle, baseCombat)?.text).toBe("Ходит ведущий!");
    battle.scenes = [{
      id: combat.sceneId, name: "Сцена", kind: "encounter", status: "active", published: true,
      description: "", objective: "", round: 1, initiative: "heroes", counters: [],
      combatants: [{
        id: "enemy", name: "Дозорный", group: "", organization: "", revealed: true,
        faction: "enemy", turn: "ready", reactionUsed: false, health: "healthy", conditions: [],
      }],
    }];
    battle.combat = { ...combat, active: { ...combat.active, id: "enemy" } };
    expect(combatAnnouncement(battle, baseCombat)?.text).toBe("Ходит Дозорный!");
  });
});

describe("combat synchronized into the hero sheet", () => {
  it("starts and ends the hero's turn exactly once, including after loading a saved sheet", () => {
    const hero = normalizeCharacter({ id: "hero", className: "Нуль" });
    const ready = syncCharacterCombat(hero, state(baseCombat));
    expect(ready.runtime).toMatchObject({ combatActive: true, round: 1, turnActive: false });
    const started = syncCharacterCombat(ready, state(ongoing));
    expect(started.runtime).toMatchObject({ round: 1, turn: 1, turnActive: true, tableCombat: { phase: "active" } });
    expect(syncCharacterCombat(started, state(baseCombat))).toBe(started);
    const reloaded = normalizeCharacter(started);
    expect(syncCharacterCombat(reloaded, state(ongoing))).toBe(reloaded);
    const done = syncCharacterCombat(reloaded, state({ ...ongoing, side: "enemies", active: null }));
    expect(done.runtime).toMatchObject({ turn: 1, turnActive: false, tableCombat: { phase: "done" } });
    expect(syncCharacterCombat(done, state(ongoing))).toBe(done);
    const ended = syncCharacterCombat(done, state());
    expect(ended.runtime?.tableCombat).toBeUndefined();
    expect(ended.runtime?.combatActive).toBe(false);
  });

  it("advances missed rounds and replays only the matching hero's turns", () => {
    const hero = normalizeCharacter({ id: "hero", className: "Нуль" });
    const started = syncCharacterCombat(hero, state(ongoing));
    const marked = markTrigger(started, "once-this-round", true, "round");
    const next = syncCharacterCombat(marked, state({
      ...ongoing, round: 4, active: null,
      heroTurns: [turn, { ...turn, round: 2 }, { ...turn, userId: "other", round: 3 }],
    }));
    expect(next.runtime).toMatchObject({ round: 4, turn: 2, turnActive: false, tableCombat: { phase: "ready" } });
    expect(next.runtime?.triggers["once-this-round"]).toBeUndefined();
  });

  it("drives Fury's turn-specific state from the same turn", () => {
    const hero = normalizeCharacter({ id: "hero", className: "Неистовый" });
    const started = syncCharacterCombat(hero, state(ongoing));
    expect(started.runtime?.furyTurn?.active).toBe(true);
    const next = syncCharacterCombat(started, state({ ...ongoing, round: 2, active: null }));
    expect(next.runtime?.furyTurn).toBeUndefined();
    expect(next.runtime?.turnActive).toBe(false);
  });

  it("leaves unrelated personal sheets untouched", () => {
    const hero = normalizeCharacter({ id: "another-hero" });
    expect(tableCombatForHero(table(ongoing), hero.id)).toBeUndefined();
    expect(syncCharacterCombat(hero, state())).toBe(hero);
  });
});
