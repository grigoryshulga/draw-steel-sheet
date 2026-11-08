import type { SceneCombatant, TableScene } from "./types";
import type { MonsterSeed } from "./monster-catalog";

export const sceneId = () => globalThis.crypto.randomUUID();
export function combatantFromSeed(seed?: MonsterSeed): SceneCombatant {
  const count = /миньон|minion/i.test(seed?.organization ?? "") ? 4 : 1;
  const maxStamina = (seed?.maxStamina ?? 1) * count;
  return {
    id: sceneId(),
    sourceId: seed?.sourceId,
    name: seed?.name ?? "Новое существо",
    group: seed?.group ?? "",
    organization: seed?.organization ?? "",
    faction: "enemy",
    revealed: false,
    turn: "ready",
    reactionUsed: false,
    conditions: [],
    health: "healthy",
    count,
    encounterValue: seed?.encounterValue ?? 0,
    ...(seed?.kind === "terrain" && maxStamina === 0
      ? {}
      : { stamina: maxStamina, maxStamina, temporaryStamina: 0 }),
  };
}

/** Changing a prepared squad's size preserves damage already recorded in its pool. */
export function resizeMinionGroup(
  combatant: SceneCombatant,
  value: number,
): Partial<SceneCombatant> {
  const count = Math.max(1, Math.min(500, Math.floor(value) || 1));
  const perMinion = (combatant.maxStamina ?? 0) / (combatant.count || 1);
  const maxStamina = Math.round(perMinion * count);
  return {
    count,
    maxStamina,
    stamina: Math.max(
      0,
      Math.min(
        maxStamina,
        (combatant.stamina ?? 0) + maxStamina - (combatant.maxStamina ?? 0),
      ),
    ),
  };
}
const nonnegative = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : fallback;
export function healthLabel(health: SceneCombatant["health"]): string {
  return {
    healthy: "Здоров",
    hurt: "Ранен",
    winded: "Утомлён",
    defeated: "Повержен",
  }[health];
}
export function normalizeScene(scene: TableScene): TableScene {
  return {
    ...scene,
    round: Math.max(1, nonnegative(scene.round, 1)),
    malice: nonnegative(scene.malice),
    counters: scene.counters.map((c) => {
      const max = c.max === undefined ? undefined : nonnegative(c.max);
      return {
        ...c,
        max,
        value: Math.min(nonnegative(c.value), max ?? Infinity),
      };
    }),
    combatants: scene.combatants.map((c) => {
      const maxStamina =
        c.maxStamina === undefined ? undefined : nonnegative(c.maxStamina);
      const stamina =
        c.stamina === undefined
          ? undefined
          : Math.min(nonnegative(c.stamina), maxStamina ?? Infinity);
      const health =
        stamina === undefined || maxStamina === undefined
          ? c.health
          : stamina === 0
            ? "defeated"
            : stamina <= maxStamina / 2
              ? "winded"
              : stamina < maxStamina
                ? "hurt"
                : "healthy";
      return {
        ...c,
        stamina,
        maxStamina,
        health,
        temporaryStamina:
          c.temporaryStamina === undefined
            ? undefined
            : nonnegative(c.temporaryStamina),
        count:
          c.count === undefined
            ? undefined
            : Math.max(1, nonnegative(c.count, 1)),
      };
    }),
  };
}
export function createScene(kind: TableScene["kind"], name = ""): TableScene {
  const counters =
    kind === "negotiation"
      ? [
          { id: sceneId(), name: "Интерес", value: 1, max: 5, public: false },
          { id: sceneId(), name: "Терпение", value: 3, max: 5, public: false },
        ]
      : kind === "montage"
        ? [
            { id: sceneId(), name: "Успехи", value: 0, max: 6, public: true },
            { id: sceneId(), name: "Провалы", value: 0, max: 3, public: true },
          ]
        : [];
  return {
    id: sceneId(),
    kind,
    name,
    status: "prepared",
    published: false,
    description: "",
    directorNotes: "",
    objective: "",
    round: 1,
    initiative: "heroes",
    malice: 0,
    combatants: [],
    counters,
  };
}

/** Monsters, chapter 22: ES = sum(4 + 2 × hero level); victories add effective heroes. */
export function encounterBudget(
  scene: TableScene,
  levels: number[],
  victories = 0,
) {
  if (!levels.length) return null;
  const normalized = levels.map((level) =>
    Math.max(1, Math.min(10, Math.floor(level))),
  );
  const single =
    normalized.reduce((sum, level) => sum + 4 + 2 * level, 0) /
    normalized.length;
  const strength =
    single * (normalized.length + Math.floor(Math.max(0, victories) / 2));
  const cost = scene.combatants
    .filter((c) => c.faction === "enemy")
    .reduce((sum, c) => sum + (c.encounterValue ?? 0) * (c.count ?? 1), 0);
  const difficulty =
    cost === 0
      ? "Без противников"
      : cost < strength - single
        ? "Тривиальная"
        : cost < strength
          ? "Лёгкая"
          : cost <= strength + single
            ? "Стандартная"
            : cost <= strength + 3 * single
              ? "Трудная"
              : "Экстремальная";
  return {
    cost,
    strength,
    standardMax: strength + single,
    hardMax: strength + 3 * single,
    difficulty,
  };
}
export function duplicateScene(scene: TableScene): TableScene {
  const ids = new Map(scene.combatants.map((c) => [c.id, sceneId()]));
  return normalizeScene({
    ...scene,
    id: sceneId(),
    name: `${scene.name.slice(0, 192)} — копия`,
    status: "prepared",
    published: false,
    round: 1,
    combatants: scene.combatants.map((c) => ({
      ...c,
      id: ids.get(c.id)!,
      captainId: c.captainId ? ids.get(c.captainId) : undefined,
      turn: "ready",
      reactionUsed: false,
      conditions: c.conditions.map((condition) => ({
        ...condition,
        id: sceneId(),
      })),
    })),
    counters: scene.counters.map((c) => ({ ...c, id: sceneId() })),
  });
}
