import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTablesStore, normalizeVisibility, projectHero, projectScene, projectTable } from '../server/tables-store.mjs';
import { createStore } from '../server/store.mjs';
import { duplicateScene } from '../src/lib/tables/scenes';
import type { TableScene } from '../src/lib/tables/types';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });
async function setup() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dss-tables-')); dirs.push(dataDir);
  return { dataDir, store: createTablesStore({ dataDir }) };
}
const command = (type: string, payload = {}, expectedRevision?: number, operationId = randomUUID()) => ({ type, payload, operationId, ...(expectedRevision === undefined ? {} : { expectedRevision }) });
const create = (store: ReturnType<typeof createTablesStore>) => store.command(null, command('create', { name: 'Кампания', memberName: 'Ведущий' }));
function scene(): TableScene {
  return { id: 'prepared', name: 'Бой', kind: 'encounter', status: 'prepared', published: true, description: 'Открыто', directorNotes: 'SECRET-DM', round: 1, initiative: 'heroes', malice: 7, objective: 'Победа',
    combatants: [{ id: 'captain', sourceId: 'secret-source', name: 'Гоблин', group: 'A', organization: 'squad', faction: 'enemy', revealed: true, turn: 'ready', reactionUsed: false, conditions: [{ id: 'hidden', name: 'SECRET-CONDITION', public: false, ends: '' }, { id: 'visible', name: 'Горит', public: true, ends: '' }], health: 'hurt', stamina: 37, maxStamina: 40, temporaryStamina: 3, count: 4, encounterValue: 20, notes: 'SECRET-MONSTER' },
      { id: 'ambush', captainId: 'captain', name: 'SECRET-AMBUSH', group: 'A', organization: 'squad', faction: 'enemy', revealed: false, turn: 'done', reactionUsed: true, conditions: [], health: 'healthy', stamina: 98 }],
    counters: [{ id: 'secret', name: 'SECRET-COUNTER', value: 9, public: false }, { id: 'successes', name: 'Успехи', value: 2, public: true }] };
}

describe('local Director tables', () => {
  it('persists quarter-point minion encounter values without rounding', async () => {
    const { store } = await setup();
    const t = await create(store), s = scene();
    s.combatants[0].encounterValue = 0.75;
    const result = await store.command(t.id, command('save-scene', { scene: s }, t.revision));
    expect(result.scenes[0].combatants[0].encounterValue).toBe(0.75);
    s.combatants[0].encounterValue = -1;
    await expect(store.command(t.id, command('save-scene', { scene: s }, result.revision))).rejects.toMatchObject({ status: 400 });
  });
  it('copies independently as hidden preparation without changing the source', async () => {
    const { store } = await setup();
    let t = await create(store);
    const original = { ...scene(), status: 'active' as const };
    t = await store.command(t.id, command('save-scene', { scene: original }, t.revision));
    const duplicate = duplicateScene(t.scenes[0]);
    t = await store.command(t.id, command('save-scene', { scene: duplicate }, t.revision));
    expect(t.scenes).toHaveLength(2);
    expect(t.scenes[0]).toEqual(original);
    expect(t.scenes[1]).toMatchObject({ id: duplicate.id, name: `${original.name} — копия`, status: 'prepared', published: false, round: 1 });
    expect(t.scenes[1].combatants[0].id).not.toBe(original.combatants[0].id);
    expect(t.scenes[1].combatants[1].captainId).toBe(t.scenes[1].combatants[0].id);
  });
  it('persists create, scenes, in-place start, archive, templates and deletion across instances', async () => {
    const { store, dataDir } = await setup();
    let t = await create(store);
    expect(t).toMatchObject({ actorId: 'local', ownerId: 'local', revision: 1, memberCount: 1, myHeroIds: [] });
    t = await store.command(t.id, command('save-scene', { scene: scene() }, t.revision));
    t = await store.command(t.id, command('start-scene', { sceneId: 'prepared' }, t.revision));
    expect(t.scenes).toHaveLength(1);
    expect(t.scenes[0]).toEqual({ ...scene(), status: 'active' });
    // Starting again resumes the same scene without resetting progress.
    t = await store.command(t.id, command('start-scene', { sceneId: 'prepared' }, t.revision));
    expect(t.scenes).toEqual([{ ...scene(), status: 'active' }]);
    t = await store.command(t.id, command('save-material', { material: { id: 'm', title: 'Карта', text: 'Мост', public: true } }, t.revision));
    t = await store.command(t.id, command('event', { text: 'Сцена начата', public: true, kind: 'message', actor: 'spoof' }, t.revision));
    expect(t.events[0].actor).toBe('local');
    t = await store.command(t.id, command('archive', { archived: true }, t.revision));
    const loaded = createTablesStore({ dataDir });
    expect(await loaded.read(t.id)).toEqual(t);
    expect(await loaded.list()).toEqual([expect.objectContaining({ id: t.id, archived: true })]);
    await expect(loaded.command(t.id, command('rename', { name: 'Новая' }, t.revision))).rejects.toMatchObject({ status: 409 });
    t = await loaded.command(t.id, command('archive', { archived: false }, t.revision));
    t = await loaded.command(t.id, command('delete-scene', { sceneId: 'prepared' }, t.revision));
    t = await loaded.command(t.id, command('delete-material', { materialId: 'm' }, t.revision));
    expect(t.scenes).toEqual([]); expect(t.materials).toEqual([]);
    const template = await loaded.saveTemplate({ id: 'scene-template', name: 'Бой', kind: 'scene', version: 0, scene: scene() });
    expect(template.version).toBe(1);
    await expect(loaded.saveTemplate({ ...template, version: 0 })).rejects.toMatchObject({ status: 409 });
    expect((await store.saveTemplate(template)).version).toBe(2);
    expect(await createTablesStore({ dataDir }).templates()).toHaveLength(1);
    await loaded.deleteTemplate(template.id);
    expect(await store.templates()).toEqual([]);
    await expect(loaded.command(t.id, command('delete', {}, t.revision))).resolves.toBeNull();
    expect(await store.list()).toEqual([]);
    expect((await fs.readdir(dataDir)).filter(file => file.endsWith('.tmp'))).toEqual([]);
  });
  it('serializes competing instances, rejects stale revisions, and deduplicates after reload', async () => {
    const { store, dataDir } = await setup();
    const first = command('create', { name: 'Игра', memberName: 'Ведущий' });
    const t = await store.command(null, first);
    expect((await createTablesStore({ dataDir }).command(null, first)).id).toBe(t.id);
    const competing = await Promise.allSettled([store.command(t.id, command('rename', { name: 'A' }, 1)), createTablesStore({ dataDir }).command(t.id, command('rename', { name: 'B' }, 1))]);
    expect(competing.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const replay = await store.command(null, first);
    expect(replay.revision).toBe(2);
    expect(replay.name).toBe('A');
    await expect(store.command(null, { ...first, payload: { name: 'Other', memberName: 'DM' } })).rejects.toMatchObject({ status: 409 });
    const deletion = command('delete', {}, 2);
    await store.command(t.id, deletion);
    await expect(createTablesStore({ dataDir }).command(t.id, deletion)).resolves.toBeNull();
  });
  it('fails closed on corruption and does not damage persisted state on validation failures', async () => {
    const { store, dataDir } = await setup();
    const t = await create(store);
    const invalid = scene(); invalid.combatants[0].stamina = Number.NaN;
    await expect(store.command(t.id, command('save-scene', { scene: invalid }, t.revision))).rejects.toMatchObject({ status: 400 });
    const badCaptain = scene(); badCaptain.combatants[1].captainId = 'missing';
    await expect(store.command(t.id, command('save-scene', { scene: badCaptain }, t.revision))).rejects.toMatchObject({ status: 400 });
    expect((await store.read(t.id)).revision).toBe(1);
    await expect(store.read('../escape')).rejects.toMatchObject({ status: 400 });
    await fs.writeFile(path.join(dataDir, 'tables.json'), '{broken');
    await expect(store.list()).rejects.toMatchObject({ status: 500 });
    await expect(create(store)).rejects.toMatchObject({ status: 500 });
    expect(await fs.readFile(path.join(dataDir, 'tables.json'), 'utf8')).toBe('{broken');
  });
  it.each(['join', 'attach-hero', 'transfer', 'create-trade', 'answer-offer', 'visibility'])('explicitly refuses multiplayer command %s locally', async type => {
    const { store } = await setup();
    await expect(store.command(null, command(type))).rejects.toMatchObject({ status: 422 });
  });
  it('preserves bounded declarative item effects and rejects scripts or invalid values', async () => {
    const { store, dataDir } = await setup();
    const item = { id: 'magic', name: 'Амулет', category: 'trinket', qty: 1, notes: '', equipped: false, effects: [{ field: 'stamina', value: 5 }, { field: 'save', value: -100 }] };
    const template = await store.saveTemplate({ id: 'magic', name: 'Амулет', kind: 'item', version: 0, item });
    expect(template.item.effects).toEqual(item.effects);
    expect((await createTablesStore({ dataDir }).templates())[0].item.effects).toEqual(item.effects);
    for (const effects of [[{ field: 'stamina', value: 101 }], [{ field: 'stamina', value: 1.2 }], [{ field: 'script', value: 1 }], [{ field: 'save', value: 1, formula: '1d6' }], Array.from({ length: 17 }, () => ({ field: 'speed', value: 1 })), null]) {
      await expect(store.saveTemplate({ ...template, item: { ...item, effects } })).rejects.toMatchObject({ status: 400 });
    }
    expect((await store.templates())[0]).toEqual(template);
  });
  it('preserves ability references in item templates and rejects malformed grants', async () => {
    const { dataDir, store } = await setup();
    const item = { id: 'ability-item', name: 'Амулет', category: 'trinket', qty: 1, notes: '', equipped: false, abilityIds: ['fury-ability', 'kit-ability'] };
    const template = await store.saveTemplate({ id: 'abilities', name: 'Амулет', kind: 'item', version: 0, item });
    expect((await createTablesStore({ dataDir }).templates())[0].item.abilityIds).toEqual(item.abilityIds);
    for (const abilityIds of [null, [7], [''], ['x'.repeat(201)], ['same', 'same'], Array.from({ length: 17 }, (_, i) => `ability-${i}`)]) {
      await expect(store.saveTemplate({ ...template, item: { ...item, abilityIds } })).rejects.toMatchObject({ status: 400 });
    }
    expect((await store.templates())[0]).toEqual(template);
  });
  it('uses the existing character store without inventing a second character document', async () => {
    const { dataDir } = await setup(); const charactersStore = createStore(dataDir);
    const store = createTablesStore({ dataDir, charactersStore });
    await store.charactersStore.save('hero', { id: 'hero', name: 'Герой' });
    expect((await charactersStore.get('hero')).name).toBe('Герой');
    expect(store.mode).toBe('local-director'); expect(store.userId).toBe('local');
    expect(() => store.subscribe('id', () => {})).toThrow(/Локальный режим/);
  });
});

describe('server projections with distinct actors', () => {
  it('defaults gameplay sections open, personal notes closed and strips unselected sections', () => {
    const doc = { id: 'hero', name: 'Герой', stamina: { current: 10, max: 20, temp: 0, notes: 'SECRET-NESTED' }, conditions: { slowed: { active: true, ends: 'save', notes: 'SECRET-CONDITION' } }, runtime: { resources: { drama: 2, secret: { notes: 'SECRET-RESOURCE' } } }, notes: { story: 'Сюжет', secrets: 'SECRET-NOTE' }, inventory: [{ id: 'item' }], projects: [], unknownSecret: 'SECRET-FIELD' };
    const shared = projectHero(doc);
    expect(Object.keys(shared.sections)).toEqual(['hero', 'development', 'inventory', 'journal', 'companions']);
    expect(shared.notes).toEqual({}); expect(JSON.stringify(shared)).not.toContain('SECRET');
    expect(projectHero(doc, normalizeVisibility({ sections: [], notes: ['story'] }))).toMatchObject({ sections: {}, notes: { story: 'Сюжет' } });
    expect(() => normalizeVisibility({ sections: ['unknown'], notes: [] })).toThrow();
    expect(() => normalizeVisibility({ sections: [], notes: ['unknown'] })).toThrow();
  });
  it('omits exact monster numbers, hidden conditions and preparation for every player', () => {
    const active = { ...scene(), status: 'active' };
    const t = { id: 't', name: 'Игра', ownerId: 'dm', archived: false, revision: 1, updatedAt: '', inviteCode: 'SECRET-INVITE', members: [{ userId: 'dm', name: 'DM', hero: null }, { userId: 'a', name: 'A', hero: null }, { userId: 'b', name: 'B', hero: null }], scenes: [scene(), active], materials: [{ id: 'm', title: 'SECRET-MATERIAL', text: '', public: false }], events: [{ id: 'e', actor: 'dm', text: 'SECRET-EVENT', public: false }], offers: [], trades: [], visibility: {} };
    expect(projectTable(t, 'dm').scenes).toHaveLength(2);
    const a = projectTable(t, 'a'), b = projectTable(t, 'b');
    expect(a.scenes).toEqual(b.scenes); expect(a.scenes).toHaveLength(1);
    expect(JSON.stringify(a)).not.toMatch(/SECRET|stamina|maxStamina|temporaryStamina|encounterValue|malice|sourceId|captainId/);
    expect(a.scenes[0].combatants).toHaveLength(1);
    expect(a.scenes[0].combatants[0].conditions).toEqual([{ id: 'visible', name: 'Горит', public: true, ends: '' }]);
    expect(projectScene(scene(), true).combatants[0].stamina).toBe(37);
    expect(() => projectTable(t, 'outsider')).toThrow(/не найден/);
  });
});
