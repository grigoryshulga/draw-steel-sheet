export const combatCommands = new Set(['combat-start', 'combat-next-round', 'combat-start-turn', 'combat-end-turn']);

function encounter(table) {
  return !table.archived && table.scenes.find(scene =>
    scene.id === table.board?.sceneId && scene.kind === 'encounter' && scene.status === 'active' && scene.published);
}

function availability(table, scene, combat) {
  const heroes = table.members.filter(member => member.userId !== table.ownerId && member.hero);
  const enemies = scene.combatants.filter(unit => unit.health !== 'defeated');
  const { active, heroTurns, enemyTurns, round, nextSide } = combat;
  const current = active?.side === 'heroes'
    ? heroes.some(member => member.userId === active.id && member.hero.id === active.heroId)
    : enemies.some(unit => unit.id === active?.id);
  const readyHeroes = heroes.filter(member => !heroTurns.some(turn =>
    turn.round === round && turn.userId === member.userId && turn.heroId === member.hero.id));
  const readyEnemies = enemies.filter(unit => !enemyTurns.includes(unit.id));
  const ready = { heroes: readyHeroes, enemies: readyEnemies };
  const other = nextSide === 'heroes' ? 'enemies' : 'heroes';
  return { active: current ? active : null, ready,
    side: current ? active.side : ready[nextSide].length ? nextSide : ready[other].length ? other : null };
}

export function projectCombat(table, director) {
  const scene = encounter(table);
  if (!scene || table.combat?.sceneId !== scene.id) return undefined;
  const { nextSide, ...combat } = table.combat;
  const { active, side } = availability(table, scene, table.combat);
  const visible = id => director || scene.combatants.some(unit => unit.id === id && unit.revealed);
  return {
    ...combat, side,
    active: active?.side === 'enemies' && !visible(active.id) ? { side: 'enemies', id: null } : active,
    enemyTurns: combat.enemyTurns.filter(visible),
  };
}

export function clearInactiveCombat(table) {
  if (table.combat && encounter(table)?.id !== table.combat.sceneId) delete table.combat;
}

export function applyCombatCommand(table, command, fail) {
  const { type, payload, operationId } = command;
  const scene = encounter(table);
  if (!scene || scene.id !== payload.sceneId) fail(409, 'Сначала откройте сцену боя');
  if (type === 'combat-start') {
    if (table.combat) fail(409, 'Бой уже начался');
    if (!['heroes', 'enemies'].includes(payload.initiative)) fail(400, 'Выберите инициативу');
    table.combat = {
      id: operationId, sceneId: scene.id, round: 1, initiative: payload.initiative,
      nextSide: payload.initiative, active: null, heroTurns: [], enemyTurns: [],
    };
  } else {
    const combat = table.combat;
    if (!combat || combat.id !== payload.combatId) fail(409, 'Этот бой уже недоступен');
    if (type === 'combat-next-round') {
      combat.round++;
      combat.active = null;
      combat.nextSide = combat.initiative;
      combat.enemyTurns = [];
    } else {
      const { active, ready, side } = availability(table, scene, combat);
      const { id, side: actorSide } = payload;
      if (type === 'combat-end-turn') {
        if (!active || active.side !== actorSide || active.id !== id) fail(409, 'Этот ход не начат');
        combat.active = null;
        combat.nextSide = actorSide === 'heroes' ? 'enemies' : 'heroes';
      } else {
        if (!side || side !== actorSide || active) fail(409, 'Сейчас нельзя начать этот ход');
        if (side === 'heroes') {
          const member = ready.heroes.find(player => player.userId === id && player.hero.id === payload.heroId);
          if (!member) fail(409, 'Герой уже сходил или недоступен');
          combat.heroTurns.push({ userId: id, heroId: member.hero.id, round: combat.round });
          combat.active = { side, id, heroId: member.hero.id };
        } else {
          if (!ready.enemies.some(unit => unit.id === id)) fail(409, 'Участник уже сходил или недоступен');
          combat.enemyTurns.push(id);
          combat.active = { side, id };
        }
      }
    }
  }
  if (type === 'combat-start' || type === 'combat-next-round') {
    scene.combatants = scene.combatants.map(unit => ({ ...unit, turn: 'ready', reactionUsed: false }));
  }
}
