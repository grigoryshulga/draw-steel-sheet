import type { Character, TableCombatLink } from "../../types";
import { previewGameAction, type GameAction } from "../game-actions";
import { currentRuntime } from "../runtime";
import type { HeroTableCombat, TableCombat, TableSnapshot } from "./types";

export const combatPhaseLabel = {
  ready: "Ожидание хода",
  active: "Ваш ход",
  done: "Ход завершён",
} satisfies Record<TableCombatLink["phase"], string>;
const phaseOrder = { ready: 0, active: 1, done: 2 };
const roundCries = [
  "Достать мечи!",
  "К бою!",
  "Украсть дроу!",
  "Рисуй сталь!",
  "Мечи наголо!",
  "Поднять оружие!",
  "В атаку!",
];

export function combatAnnouncement(table: TableSnapshot, previous?: TableCombat) {
  const combat = table.combat;
  if (!combat) return;
  const sameRound = previous?.id === combat.id && previous.round === combat.round;
  const active = combat.active;
  if (active && (!sameRound || active.id !== previous.active?.id || active.side !== previous.active?.side)) {
    const name = active.side === "heroes"
      ? table.members.find(member => member.userId === active.id && member.hero?.id === active.heroId)?.hero?.name
      : table.scenes.find(scene => scene.id === combat.sceneId)?.combatants.find(unit => unit.id === active.id)?.name;
    return {
      key: `${combat.id}:${combat.round}:${active.side}:${active.id}`,
      text: `Ходит ${name || (active.side === "enemies" ? "ведущий" : "игрок")}!`,
    };
  }
  if (!sameRound) {
    const key = `${combat.id}:${combat.round}`;
    // Stable pseudo-random choice so everyone sees the same phrase for this round.
    let hash = 2166136261;
    for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return { key, text: roundCries[(hash >>> 0) % roundCries.length] };
  }
}

export function heroTurnPhase(combat: TableCombat, userId: string, heroId: string): TableCombatLink["phase"] {
  if (combat.active?.side === "heroes" && combat.active.id === userId && combat.active.heroId === heroId) return "active";
  return combat.heroTurns.some(turn => turn.round === combat.round && turn.userId === userId && turn.heroId === heroId)
    ? "done" : "ready";
}

const automaticActions = new Set<GameAction["kind"]>([
  "round", "encounter", "combat-start", "combat-end", "turn-start", "turn-end",
  "fury-turn-start", "fury-turn-end", "rest",
]);
export const belongsToTableCombat = (action: GameAction) => automaticActions.has(action.kind);

function apply(character: Character, action: GameAction) {
  const result = previewGameAction(character, action);
  return result.ok ? result.next : character;
}

function endTurn(character: Character) {
  let next = character;
  if (next.runtime?.furyTurn?.active) next = apply(next, { kind: "fury-turn-end" });
  if (next.runtime?.turnActive) next = apply(next, { kind: "turn-end" });
  return next;
}

function endCombat(character: Character) {
  const next = apply(endTurn(character), { kind: "combat-end" });
  const runtime = currentRuntime(next);
  delete runtime.tableCombat;
  return { ...next, runtime };
}

export function tableCombatForHero(table: TableSnapshot, heroId: string): HeroTableCombat | null | undefined {
  const member = table.members.find(member =>
    member.role === "player" && member.hero?.id === heroId &&
    (member.userId === table.actorId || table.actorId === "local"));
  if (!member) return undefined;
  return table.combat ? { tableId: table.id, combat: table.combat, userId: member.userId } : null;
}

/** Replay the hero's own turns from the authoritative table snapshot, including after reconnect. */
export function syncCharacterCombat(character: Character, state: HeroTableCombat | null): Character {
  const previous = character.runtime?.tableCombat;
  if (!state) return previous ? endCombat(character) : character;
  const { combat, tableId, userId } = state;

  const phase = heroTurnPhase(combat, userId, character.id);
  const sameBattle = previous?.combatId === combat.id && previous.tableId === tableId;
  if (sameBattle && (previous.round > combat.round ||
      (previous.round === combat.round && phaseOrder[previous.phase] >= phaseOrder[phase]))) return character;

  let next = character;
  if (!sameBattle) {
    if (previous) next = endCombat(next);
    // A table encounter replaces the local round counter while preserving existing resources at its start.
    next = apply({ ...next, runtime: { ...currentRuntime(next), combatActive: false } }, { kind: "combat-start" });
  }

  const turns = new Set(combat.heroTurns
    .filter(turn => turn.userId === userId && turn.heroId === character.id)
    .map(turn => turn.round));
  const firstRound = sameBattle ? previous.round : 1;
  for (let round = firstRound; round <= combat.round; round++) {
    if (round > firstRound) next = apply(next, { kind: "round" });
    const applied = sameBattle && round === firstRound && previous.phase !== "ready";
    if (turns.has(round) && !applied) {
      next = apply(next, { kind: "turn-start" });
      if (next.className === "Неистовый") next = apply(next, { kind: "fury-turn-start" });
    }
    if (round < combat.round || phase !== "active") next = endTurn(next);
  }
  return {
    ...next,
    runtime: {
      ...currentRuntime(next),
      tableCombat: { tableId, combatId: combat.id, round: combat.round, phase },
    },
  };
}
