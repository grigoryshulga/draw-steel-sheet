import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createStore } from './store.mjs';
import { applyCombatCommand, clearInactiveCombat, combatCommands, projectCombat } from './table-combat.mjs';
import { applyBoardCommand, applyBoardView, assetId, boardCommands, boardReferencesAsset, discardHiddenSceneLayout, hidesSceneCounterLimit, installSceneLayout, projectBoard, projectBoardView, pruneBoardPins, stopBoardView, validBoardWebp, validateSceneLayout } from './table-board.mjs';

const queues = new Map();
export const DEMO_TABLE_ID = 'demo-old-road';
export const DEMO_PLAYER_ID = 'demo-boris';
const sections = ['hero', 'development', 'inventory', 'journal', 'companions'];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => structuredClone(value);
const text = (value, max = 200) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min && value <= 1000000000;
const now = () => new Date().toISOString();
function requireValid(ok) { if (!ok) fail(400, 'Некорректные данные'); }
export function normalizeVisibility(value) {
  if (value === undefined) return { sections: [...sections], notes: [] };
  requireValid(object(value) && Array.isArray(value.sections) && Array.isArray(value.notes));
  requireValid(value.sections.every(s => sections.includes(s)) && new Set(value.sections).size === value.sections.length);
  requireValid(value.notes.length <= 5 && value.notes.every(n => ['story', 'contacts', 'debts', 'secrets', 'misc'].includes(n)) && new Set(value.notes).size === value.notes.length);
  return { sections: [...value.sections], notes: [...value.notes] };
}
const fields = {
  hero: ['career', 'subclass', 'characteristics', 'size', 'speed', 'stability', 'disengage', 'kit', 'secondaryKit', 'weapon', 'armor', 'equipmentEffects', 'abilities', 'damageModifier', 'damageTraits', 'ancestryTraits', 'classFeatures'],
  development: ['xp', 'xpThreshold', 'epic', 'victories', 'perks', 'skills', 'languages', 'culture', 'careerInfo', 'advancements', 'automation'],
  inventory: ['inventory', 'wealth', 'renown'], journal: ['projects'], companions: ['companions'],
};
function pick(doc, keys) { return Object.fromEntries(keys.filter(k => doc[k] !== undefined).map(k => [k, copy(doc[k])])); }
/** Explicit allowlist: never return the complete persisted document as a section. */
export function projectHero(doc, visibility = normalizeVisibility()) {
  const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const string = value => typeof value === 'string' ? value : '';
  const conditions = object(doc.conditions) ? Object.fromEntries(Object.entries(doc.conditions).filter(([, value]) => object(value) && typeof value.active === 'boolean' && ['save', 'end-turn', 'next-turn', 'encounter', 'until-removed'].includes(value.ends)).map(([key, value]) => [key, pick(value, ['active', 'ends'])])) : {};
  const additional = object(doc.runtime?.resources) ? Object.fromEntries(Object.entries(doc.runtime.resources).filter(([, value]) => typeof value === 'number' && Number.isFinite(value))) : {};
  const result = { id: string(doc.id), name: string(doc.name) || 'Без имени', ancestry: string(doc.ancestry), className: string(doc.className), level: integer(doc.level, 1) && doc.level <= 10 ? doc.level : 1,
    stamina: { current: numeric(doc.stamina?.current), max: numeric(doc.stamina?.max), temp: numeric(doc.stamina?.temp) },
    resources: { heroicResource: { name: string(doc.heroicResource?.name), current: numeric(doc.heroicResource?.current), max: numeric(doc.heroicResource?.max) }, surges: numeric(doc.surges), heroTokens: numeric(doc.heroTokens), recoveries: { current: numeric(doc.recoveries?.current), max: numeric(doc.recoveries?.max) }, additional },
    conditions, updatedAt: string(doc.updatedAt), sections: {}, notes: {} };
  if (typeof doc.avatar?.url === 'string' && doc.avatar.url.trim()) result.avatarUrl = doc.avatar.url;
  for (const section of visibility.sections) result.sections[section] = pick(doc, fields[section] || []);
  for (const note of visibility.notes) if (typeof doc.notes?.[note] === 'string') result.notes[note] = doc.notes[note];
  return result;
}
/** Public scene projection is an allowlist, including nested combatants/conditions. */
function validateChallenge(challenge, kind) {
  requireValid(object(challenge) && challenge.kind === kind);
  const strings = (value, keys) => keys.every(key => value[key] === undefined || typeof value[key] === 'string' && value[key].length <= 10000);
  const flag = (value, key) => value[key] === undefined || typeof value[key] === 'boolean';
  if (kind === 'montage') {
    requireValid(integer(challenge.rounds, 1) && challenge.rounds <= 99 &&
      (challenge.difficulty === undefined || ['easy', 'moderate', 'hard'].includes(challenge.difficulty)) &&
      (challenge.result === undefined || ['success', 'partial', 'failure'].includes(challenge.result)) &&
      (challenge.acted === undefined || Array.isArray(challenge.acted) && challenge.acted.length <= 100 &&
        challenge.acted.every(id) && new Set(challenge.acted).size === challenge.acted.length) &&
      flag(challenge, 'hideLimits') && strings(challenge, ['obstacles']) &&
      (challenge.outcomes === undefined || object(challenge.outcomes) && strings(challenge.outcomes, ['success', 'partial', 'failure'])));
    return { ...pick(challenge, ['kind', 'rounds', 'difficulty', 'result', 'acted', 'hideLimits', 'obstacles']),
      ...(challenge.outcomes && { outcomes: pick(challenge.outcomes, ['success', 'partial', 'failure']) }) };
  }
  requireValid(kind === 'negotiation' && (challenge.npc === undefined || typeof challenge.npc === 'string' && challenge.npc.length <= 200) &&
    flag(challenge, 'researched') && ['impression', 'initialInterest', 'initialPatience'].every(key =>
      challenge[key] === undefined || integer(challenge[key]) && (key === 'impression' || challenge[key] <= 5)) &&
    (challenge.result === undefined || ['accepted', 'declined'].includes(challenge.result)) &&
    (challenge.offers === undefined || Array.isArray(challenge.offers) && challenge.offers.length <= 6 &&
      challenge.offers.every(value => typeof value === 'string' && value.length <= 10000)) &&
    Array.isArray(challenge.traits) && challenge.traits.length <= 50);
  const traits = challenge.traits.map(t => {
    requireValid(object(t) && id(t.id) && typeof t.name === 'string' && t.name.length <= 200 &&
      ['motivation', 'pitfall'].includes(t.kind) && typeof t.revealed === 'boolean' && flag(t, 'used'));
    return pick(t, ['id', 'name', 'kind', 'revealed', 'used']);
  });
  requireValid(new Set(traits.map(t => t.id)).size === traits.length);
  return { ...pick(challenge, ['kind', 'npc', 'impression', 'researched', 'result', 'offers', 'initialInterest', 'initialPatience']), traits };
}
export function projectScene(scene, director = false) {
  if (director) return copy(scene);
  const challenge = scene.challenge;
  const publicChallenge = challenge?.kind === 'montage' ? pick(challenge, ['kind', 'rounds', 'result']) :
    challenge?.kind === 'negotiation' ? { ...pick(challenge, ['kind', 'npc', 'result']),
      traits: challenge.traits.filter(t => t.revealed).map(t => pick(t, ['id', 'name', 'kind', 'revealed'])) } : undefined;
  return { ...pick(scene, ['id', 'name', 'kind', 'status', 'published', 'description', 'round', 'initiative', 'objective']),
    ...(publicChallenge && { challenge: publicChallenge }),
    combatants: scene.combatants.filter(c => c.revealed).map(c => ({ ...pick(c, ['id', 'name', 'group', 'organization', 'faction', 'revealed', 'turn', 'reactionUsed', 'health']),
      conditions: c.conditions.filter(s => s.public).map(s => pick(s, ['id', 'name', 'public', 'ends'])) })),
    counters: scene.counters.filter(c => c.public).map(c => {
      const counter = pick(c, ['id', 'name', 'value', 'max', 'public']);
      if (hidesSceneCounterLimit(scene, c)) delete counter.max;
      return counter;
    }) };
}
export function validateScene(scene) {
  requireValid(object(scene) && id(scene.id) && text(scene.name) && ['encounter', 'negotiation', 'montage'].includes(scene.kind) && ['prepared', 'active', 'finished'].includes(scene.status));
  requireValid(typeof scene.published === 'boolean' && typeof scene.description === 'string' && scene.description.length <= 50000 && typeof scene.objective === 'string' && scene.objective.length <= 10000);
  requireValid(integer(scene.round) && ['heroes', 'enemies'].includes(scene.initiative) && Array.isArray(scene.combatants) && scene.combatants.length <= 500 && Array.isArray(scene.counters) && scene.counters.length <= 100);
  requireValid(scene.directorNotes === undefined || typeof scene.directorNotes === 'string' && scene.directorNotes.length <= 50000);
  requireValid(scene.malice === undefined || integer(scene.malice));
  const ids = new Set();
  for (const c of scene.combatants) {
    requireValid(object(c) && id(c.id) && !ids.has(c.id) && text(c.name) && typeof c.group === 'string' && typeof c.organization === 'string' && ['enemy', 'ally'].includes(c.faction) && typeof c.revealed === 'boolean' && ['ready', 'active', 'done'].includes(c.turn) && typeof c.reactionUsed === 'boolean' && ['healthy', 'hurt', 'winded', 'defeated'].includes(c.health));
    ids.add(c.id);
    for (const key of ['stamina', 'maxStamina', 'temporaryStamina', 'count']) requireValid(c[key] === undefined || integer(c[key], key === 'stamina' ? -1000000000 : 0));
    requireValid(c.encounterValue === undefined || Number.isFinite(c.encounterValue) && c.encounterValue >= 0 && c.encounterValue <= 1000000000 && Number.isInteger(c.encounterValue * 4));
    requireValid(c.notes === undefined || typeof c.notes === 'string' && c.notes.length <= 50000);
    requireValid(c.sourceId === undefined || text(c.sourceId, 200));
    requireValid(c.captainId === undefined || id(c.captainId));
    requireValid(Array.isArray(c.conditions) && c.conditions.length <= 100 && new Set(c.conditions.map(s => s?.id)).size === c.conditions.length);
    for (const s of c.conditions) requireValid(object(s) && id(s.id) && text(s.name) && typeof s.public === 'boolean' && typeof s.ends === 'string' && s.ends.length <= 1000);
  }
  for (const c of scene.combatants) requireValid(c.captainId === undefined || ids.has(c.captainId));
  requireValid(new Set(scene.counters.map(c => c?.id)).size === scene.counters.length);
  for (const c of scene.counters) requireValid(object(c) && id(c.id) && text(c.name) && integer(c.value, -1000000000) && (c.max === undefined || integer(c.max)) && typeof c.public === 'boolean');
  // Strip unknown fields at every depth, even for Director storage.
  return { ...pick(scene, ['id', 'name', 'kind', 'status', 'published', 'description', 'directorNotes', 'round', 'initiative', 'malice', 'objective']),
    ...(scene.challenge !== undefined && { challenge: validateChallenge(scene.challenge, scene.kind) }),
    combatants: scene.combatants.map(c => ({ ...pick(c, ['id', 'sourceId', 'name', 'group', 'organization', 'captainId', 'faction', 'revealed', 'turn', 'reactionUsed', 'health', 'stamina', 'maxStamina', 'temporaryStamina', 'count', 'encounterValue', 'notes']), conditions: c.conditions.map(s => pick(s, ['id', 'name', 'public', 'ends'])) })),
    counters: scene.counters.map(c => pick(c, ['id', 'name', 'value', 'max', 'public'])) };
}
function validateItem(item) {
  requireValid(object(item) && id(item.id) && text(item.name) && ['gear', 'consumable', 'treasure', 'trinket', 'title'].includes(item.category) && integer(item.qty, 1) && typeof item.equipped === 'boolean' && typeof item.notes === 'string' && item.notes.length <= 50000 && (item.catalogId === undefined || text(item.catalogId, 200)));
  if (item.effects !== undefined) {
    requireValid(Array.isArray(item.effects) && item.effects.length <= 16);
    for (const effect of item.effects) requireValid(object(effect) && Object.keys(effect).every(key => ['field', 'value'].includes(key)) && ['stamina', 'recoveries', 'speed', 'stability', 'disengage', 'save', 'rolledDamage', 'freeStrikeDamage'].includes(effect.field) && Number.isInteger(effect.value) && effect.value >= -100 && effect.value <= 100);
  }
  if (item.abilityIds !== undefined) {
    requireValid(Array.isArray(item.abilityIds) && item.abilityIds.length <= 16 && item.abilityIds.every(value => text(value, 200)) && new Set(item.abilityIds).size === item.abilityIds.length);
  }
  return pick(item, ['id', 'name', 'category', 'qty', 'notes', 'equipped', 'catalogId', 'effects', 'abilityIds']);
}
function summary(t) { return { ...pick(t, ['id', 'name', 'ownerId', 'archived', 'revision', 'updatedAt']), memberCount: t.members.length }; }
export function projectTable(t, actorId) {
  if (!t.members.some(m => m.userId === actorId)) fail(404, 'Стол не найден');
  const director = t.ownerId === actorId;
  return { ...summary(t), actorId, members: t.members.map(m => ({ userId: m.userId, name: m.name, role: m.userId === t.ownerId ? 'director' : 'player', hero: m.hero ? copy(m.hero) : null })),
    myHeroIds: Object.keys(t.visibility || {}).filter(h => t.heroOwners?.[h] === actorId),
    visibility: Object.fromEntries(Object.entries(t.visibility || {}).filter(([h]) => t.heroOwners?.[h] === actorId)),
    scenes: t.scenes.filter(s => director || s.published && s.status !== 'prepared').map(s => projectScene(s, director)),
    board: projectBoard(t, director), combat: projectCombat(t, director), materials: t.materials.filter(m => director || m.public).map(copy), events: t.events.filter(e => director || e.public || e.actor === actorId).map(copy),
    offers: t.offers.filter(o => director || o.fromUserId === actorId || o.toUserId === actorId).map(copy), trades: t.trades.filter(o => o.fromUserId === actorId || o.toUserId === actorId).map(copy),
    ...(director ? { inviteCode: t.inviteCode, ...(t.transferTo ? { transferTo: t.transferTo } : {}) } : t.transferTo === actorId ? { transferTo: actorId } : {}) };
}
const playerTradeCommands = new Set(['create-trade', 'confirm-trade', 'cancel-trade']);
const unsupported = new Set(['join', 'leave', 'kick', 'allow-member', 'transfer', 'accept-transfer', 'attach-hero', 'activate-hero', 'remove-hero', 'visibility', 'offer-item', 'answer-offer', 'revoke-offer']);
/** The process fixes the identity at startup. HTTP requests cannot select a role. */
export function createTablesStore({ dataDir, charactersStore = dataDir ? createStore(dataDir) : undefined, demoPlayer = false } = {}) {
  if (!dataDir) throw new Error('createTablesStore требует dataDir');
  const actor = demoPlayer ? DEMO_PLAYER_ID : 'local';
  const requireDirector = () => { if (demoPlayer) fail(403, 'Доступно только ведущему'); };
  const file = path.resolve(dataDir, 'tables.json');
  function serial(operation) {
    const pending = (queues.get(file) || Promise.resolve()).catch(() => {}).then(operation);
    queues.set(file, pending);
    const clean = () => { if (queues.get(file) === pending) queues.delete(file); };
    pending.then(clean, clean); return pending;
  }
  async function load() {
    try {
      const state = JSON.parse(await fs.readFile(file, 'utf8'));
      if (state.version !== 1 || !object(state.tables) || !object(state.templates) || !object(state.operations)) throw new Error('invalid');
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, tables: {}, templates: {}, operations: {} };
      fail(500, 'Хранилище столов повреждено');
    }
  }
  async function persist(state) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await fs.open(temp, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
      await fs.rename(temp, file);
      const dir = await fs.open(path.dirname(file), 'r');
      try { await dir.sync(); } finally { await dir.close(); }
    } finally { await fs.rm(temp, { force: true }).catch(() => {}); }
  }
  const canSee = table => !demoPlayer || (table.id === DEMO_TABLE_ID && table.ownerId !== actor &&
    table.members.some(member => member.userId === actor));
  const find = (state, tableId) => {
    requireValid(id(tableId));
    if (!Object.hasOwn(state.tables, tableId) || !canSee(state.tables[tableId])) fail(404, 'Стол не найден');
    return state.tables[tableId];
  };
  const assetDirectory = tableId => path.resolve(dataDir, 'table-images', tableId);
  const assetPath = (tableId, key) => {
    requireValid(assetId(key));
    return path.join(assetDirectory(tableId), key);
  };
  const hasAsset = (tableId, key) => fs.stat(assetPath(tableId, key)).then(file => file.isFile(), () => false);
  async function collectImages(table, templates) {
    const directory = assetDirectory(table.id);
    const files = await fs.readdir(directory);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const key of files) {
      if (!assetId(key) || boardReferencesAsset(table.board, key) || boardReferencesAsset(table.board?.mainLayout, key) ||
          table.scenes.some(scene => boardReferencesAsset(scene.layout, key)) ||
          Object.values(templates).some(template => template.scene?.layout?.tableId === table.id && boardReferencesAsset(template.scene.layout, key))) continue;
      const image = assetPath(table.id, key);
      if ((await fs.stat(image)).mtimeMs < cutoff) await fs.unlink(image);
    }
  }
  return {
    mode: demoPlayer ? 'demo-player' : 'local-director', userId: actor, charactersStore,
    list: () => serial(async () => Object.values((await load()).tables).filter(canSee)
      .map(table => demoPlayer ? { ...summary(table), actorId: actor } : summary(table))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))),
    read: tableId => serial(async () => projectTable(find(await load(), tableId), actor)),
    readHeroCombat: heroId => serial(async () => {
      requireValid(id(heroId));
      for (const table of Object.values((await load()).tables).filter(canSee)) {
        const participant = table.members.find(member =>
          member.userId !== table.ownerId && member.hero?.id === heroId && (!demoPlayer || member.userId === actor));
        const combat = participant && projectCombat(table, !demoPlayer);
        if (combat) return { tableId: table.id, userId: participant.userId, combat };
      }
      return null;
    }),
    readBoardView: tableId => serial(async () => projectBoardView(find(await load(), tableId))),
    writeBoardView: (tableId, command) => serial(async () => {
      requireDirector();
      const state = await load(), table = find(state, tableId);
      if (table.archived) fail(409, 'Стол в архиве');
      if (applyBoardView(table, command)) await persist(state);
      return projectBoardView(table);
    }),
    uploadBoardImage: (tableId, key, bytes) => serial(async () => {
      requireDirector();
      const state = await load(), table = find(state, tableId);
      if (table.archived) fail(409, 'Стол в архиве');
      requireValid(bytes.length <= 8 * 1024 * 1024 && validBoardWebp(bytes));
      const target = assetPath(tableId, key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await collectImages(table, state.templates).catch(() => {});
      const pending = `${target}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(pending, bytes, { flag: 'wx', mode: 0o600 });
        try { await fs.link(pending, target); }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          if (!(await fs.readFile(target)).equals(bytes)) fail(409, 'Изображение уже существует');
        }
      } finally { await fs.rm(pending, { force: true }); }
    }),
    readBoardImage: (tableId, key) => serial(async () => {
      const table = find(await load(), tableId);
      if (demoPlayer && !boardReferencesAsset(table.board, key)) fail(404, 'Изображение не найдено');
      try { return await fs.readFile(assetPath(tableId, key)); }
      catch (error) { if (error.code === 'ENOENT') fail(404, 'Изображение не найдено'); throw error; }
    }),
    command: (tableId, command) => serial(async () => {
      requireValid(object(command) && id(command.operationId) && text(command.type, 80) && object(command.payload));
      requireValid(Buffer.byteLength(JSON.stringify(command)) <= 2 * 1024 * 1024);
      if (playerTradeCommands.has(command.type)) fail(422, 'Для передачи предметов между игроками нужен стол в Supabase');
      const p = command.payload;
      if (demoPlayer) {
        const ownTurn = (command.type === 'combat-start-turn' || command.type === 'combat-end-turn') &&
          p.side === 'heroes' && p.id === actor;
        const journalEntry = command.type === 'event' && (p.kind === 'message' || p.kind === 'roll');
        if (!ownTurn && !journalEntry) requireDirector();
      }
      const state = await load(), fingerprint = JSON.stringify({ tableId, command });
      if (Object.hasOwn(state.operations, command.operationId)) {
        const op = state.operations[command.operationId];
        if (op.fingerprint !== fingerprint) fail(409, 'Идентификатор операции уже использован');
        return op.tableId && Object.hasOwn(state.tables, op.tableId) ? projectTable(find(state, op.tableId), actor) : null;
      }
      if (unsupported.has(command.type)) fail(422, 'Локальный режим доступен только одному ведущему. Для совместной игры нужен Supabase');
      let t;
      if (command.type === 'create') {
        requireValid(tableId === null && text(p.name) && text(p.memberName));
        t = { id: randomUUID(), name: p.name.trim(), ownerId: 'local', archived: false, revision: 0, updatedAt: now(), inviteCode: randomUUID(), members: [{ userId: 'local', name: p.memberName.trim(), hero: null }], scenes: [], materials: [], events: [], offers: [], trades: [], visibility: {}, heroOwners: {} };
        state.tables[t.id] = t;
      } else {
        t = find(state, tableId);
        requireValid(integer(command.expectedRevision, 1));
        if (t.revision !== command.expectedRevision) fail(409, 'Конфликт версии стола. Обновите данные');
        if (t.archived && !['archive', 'delete'].includes(command.type)) fail(409, 'Стол в архиве');
        switch (command.type) {
          case 'rename': requireValid(text(p.name)); t.name = p.name.trim(); break;
          case 'rotate-invite': t.inviteCode = randomUUID(); break;
          case 'archive': requireValid(typeof p.archived === 'boolean'); t.archived = p.archived; if (t.archived) stopBoardView(t); break;
          case 'delete': delete state.tables[t.id]; break;
          case 'save-scene': {
            const scene = validateScene(p.scene);
            if (p.scene.layout) scene.layout = await validateSceneLayout(t.id, p.scene.layout, key => hasAsset(t.id, key));
            t.scenes = t.scenes.filter(s => s.id !== scene.id).concat(scene);
            break;
          }
          case 'delete-scene': requireValid(id(p.sceneId)); t.scenes = t.scenes.filter(s => s.id !== p.sceneId); break;
          case 'start-scene': { requireValid(id(p.sceneId)); const scene = t.scenes.find(s => s.id === p.sceneId); if (!scene) fail(404, 'Сцена не найдена'); scene.status = 'active'; break; }
          case 'board-start-scene': {
            if (p.sceneId === null && !Object.hasOwn(p, 'scene')) {
              installSceneLayout(t);
              break;
            }
            const scene = p.scene ? validateScene(p.scene) : t.scenes.find(s => s.id === p.sceneId);
            if (!scene) fail(404, 'Сцена не найдена');
            if (p.scene) {
              requireValid(!t.scenes.some(s => s.id === scene.id));
              if (p.scene.layout) scene.layout = await validateSceneLayout(t.id, p.scene.layout, key => hasAsset(t.id, key));
              t.scenes.push(scene);
            }
            scene.status = 'active';
            scene.published = true;
            installSceneLayout(t, scene);
            break;
          }
          case 'save-material': requireValid(object(p.material) && id(p.material.id) && text(p.material.title) && typeof p.material.text === 'string' && p.material.text.length <= 50000 && typeof p.material.public === 'boolean'); t.materials = t.materials.filter(m => m.id !== p.material.id).concat(pick(p.material, ['id', 'title', 'text', 'public'])); break;
          case 'delete-material': requireValid(id(p.materialId)); t.materials = t.materials.filter(m => m.id !== p.materialId); break;
          // Only explicitly authored text enters events; never log scene state.
          case 'event': requireValid(text(p.text, 10000) && typeof p.public === 'boolean' && text(p.kind, 80)); t.events.push({ id: randomUUID(), at: now(), actor, text: p.text, public: p.public, kind: p.kind }); break;
          default:
            if (combatCommands.has(command.type)) {
              applyCombatCommand(t, command, fail);
              break;
            }
            if (!boardCommands.has(command.type)) fail(400, 'Неизвестная команда');
            await applyBoardCommand(t, command.type, p, key => hasAsset(t.id, key));
        }
        pruneBoardPins(t);
        discardHiddenSceneLayout(t);
        clearInactiveCombat(t);
      }
      t.revision++; t.updatedAt = now();
      Object.defineProperty(state.operations, command.operationId, { value: { fingerprint, tableId: state.tables[t.id] ? t.id : null }, enumerable: true, configurable: true, writable: true });
      await persist(state);
      if (command.type === 'delete') await fs.rm(assetDirectory(t.id), { recursive: true, force: true }).catch(() => {});
      return state.tables[t.id] ? projectTable(t, actor) : null;
    }),
    templates: () => serial(async () => demoPlayer ? [] : Object.values((await load()).templates).map(copy)),
    saveTemplate: template => serial(async () => {
      requireDirector();
      requireValid(object(template) && id(template.id) && text(template.name) && ['scene', 'item'].includes(template.kind) && integer(template.version));
      const state = await load(), old = Object.hasOwn(state.templates, template.id) ? state.templates[template.id] : undefined;
      requireValid(!old || old.kind === template.kind);
      if (template.version !== (old?.version ?? 0)) fail(409, 'Заготовка уже изменена');
      const result = { id: template.id, name: template.name, kind: template.kind, version: template.version + 1, ...(template.kind === 'scene' ? { scene: validateScene(template.scene) } : { item: validateItem(template.item) }) };
      if (result.scene && template.scene.layout) {
        const { tableId } = template.scene.layout;
        find(state, tableId);
        result.scene.layout = await validateSceneLayout(tableId, template.scene.layout, key => hasAsset(tableId, key));
      }
      Object.defineProperty(state.templates, template.id, { value: result, enumerable: true, configurable: true, writable: true }); await persist(state); return copy(result);
    }),
    deleteTemplate: templateId => serial(async () => { requireDirector(); requireValid(id(templateId)); const state = await load(); delete state.templates[templateId]; await persist(state); }),
    subscribe: () => { fail(422, 'Локальный режим не поддерживает синхронизацию между участниками'); },
  };
}
