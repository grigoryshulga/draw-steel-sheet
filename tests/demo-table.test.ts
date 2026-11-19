import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedDemoPlayer, seedDemoTable, DEMO_TABLE_ID } from '../scripts/seed-demo-table.mjs';
import { createTablesStore } from '../server/tables-store.mjs';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))); });
async function directory() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dss-demo-'));
  directories.push(dir);
  return dir;
}

describe('demo table', () => {
  it('projects the demo as a player and permits only their own combat turn', async () => {
    const dir = await directory();
    await seedDemoPlayer(dir);
    const player = createTablesStore({ dataDir: dir, demoPlayer: true });
    const director = createTablesStore({ dataDir: dir });
    const table = await player.read(DEMO_TABLE_ID);
    expect(await player.list()).toMatchObject([{ id: DEMO_TABLE_ID, actorId: 'demo-boris', ownerId: 'local' }]);
    expect(table).toMatchObject({ actorId: 'demo-boris', ownerId: 'local', myHeroIds: ['demo-nul'] });
    expect(table.inviteCode).toBeUndefined();
    expect(table.scenes).toHaveLength(1);
    expect(table.scenes[0].combatants[0].stamina).toBeUndefined();
    expect(table.materials.map(material => material.id)).toEqual(['demo-letter']);
    expect(await fs.readdir(path.join(dir, 'characters'))).toEqual(['demo-nul.json']);
    expect((await player.readBoardImage(DEMO_TABLE_ID, table.board.background)).subarray(8, 12).toString()).toBe('WEBP');
    const hiddenAsset = (await director.read(DEMO_TABLE_ID)).scenes.find(scene => scene.id === 'demo-watch').layout.background;
    await expect(player.readBoardImage(DEMO_TABLE_ID, hiddenAsset)).rejects.toMatchObject({ status: 404 });
    await expect(player.writeBoardView(DEMO_TABLE_ID, {})).rejects.toMatchObject({ status: 403 });
    expect(await player.readHeroCombat('demo-elementalist')).toBeNull();
    const { id: combatId, sceneId } = table.combat;
    const turn = { combatId, sceneId, side: 'heroes', id: table.actorId, heroId: 'demo-nul' };
    const command = (type: string, payload: Record<string, unknown>, expectedRevision = table.revision) => ({
      type, payload, expectedRevision, operationId: randomUUID(),
    });
    await expect(player.command(DEMO_TABLE_ID, command('combat-start-turn', { ...turn, id: 'demo-anna', heroId: 'demo-elementalist' })))
      .rejects.toMatchObject({ status: 403 });
    await expect(player.command(DEMO_TABLE_ID, command('save-scene', { scene: table.scenes[0] })))
      .rejects.toMatchObject({ status: 403 });
    await expect(player.command(DEMO_TABLE_ID, command('create-trade', {
      toUserId: 'demo-anna', fromHeroId: 'demo-nul', toHeroId: 'demo-elementalist',
      offered: [{ itemId: 'cloak', qty: 1 }], requested: [],
    }))).rejects.toMatchObject({ status: 422, message: 'Для передачи предметов между игроками нужен стол в Supabase' });
    const start = command('combat-start-turn', turn);
    const started = await player.command(DEMO_TABLE_ID, start);
    expect(started.combat.active).toMatchObject({ side: 'heroes', id: 'demo-boris', heroId: 'demo-nul' });
    expect(await player.command(DEMO_TABLE_ID, start)).toEqual(started);
    const ended = await player.command(DEMO_TABLE_ID, command('combat-end-turn', turn, started.revision));
    expect(ended.combat).toMatchObject({ active: null, side: 'enemies' });
    await seedDemoPlayer(dir);
    expect(await player.read(DEMO_TABLE_ID)).toEqual(ended);
  });

  it('renders through the real repository with heroes and a waiting player', async () => {
    const dir = await directory();
    const source = await fs.readFile('demo-data/characters/demo-elementalist.json', 'utf8');
    await seedDemoTable(dir);
    const store = createTablesStore({ dataDir: dir });
    const table = await store.read(DEMO_TABLE_ID);
    expect(table).toMatchObject({ ownerId: 'local', actorId: 'local', memberCount: 6 });
    expect(table.members.filter((member) => member.role === 'director')).toHaveLength(1);
    expect(table.members.filter((member) => member.hero)).toHaveLength(4);
    expect(table.members.find((member) => member.userId === 'demo-elena')).toMatchObject({ role: 'player', hero: null });
    expect(table.members.find((member) => member.userId === 'demo-boris').hero.stamina.current).toBeLessThan(table.members.find((member) => member.userId === 'demo-boris').hero.stamina.max);
    expect(table.scenes.map((scene) => scene.kind)).toEqual(['encounter', 'negotiation', 'montage']);
    expect(await fs.readFile('demo-data/characters/demo-elementalist.json', 'utf8')).toBe(source);
  });
  it('preserves existing data and never resets an edited demo table', async () => {
    const dir = await directory();
    const file = path.join(dir, 'tables.json');
    const existing = { version: 1, tables: { existing: { name: 'Мой стол' } }, templates: { keep: { name: 'Заготовка' } }, operations: { keep: { fingerprint: 'saved' } } };
    await fs.writeFile(file, JSON.stringify(existing));
    await seedDemoTable(dir);
    const saved = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(saved.tables.existing).toEqual(existing.tables.existing);
    expect(saved.templates).toEqual(existing.templates);
    expect(saved.operations).toEqual(existing.operations);
    saved.tables[DEMO_TABLE_ID].name = 'Моя демо-кампания';
    await fs.writeFile(file, JSON.stringify(saved));
    expect(await seedDemoTable(dir)).toEqual({ created: false, id: DEMO_TABLE_ID });
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual(saved);
  });
  it('switches between three prepared scenes with their own assets and counters and restores the camp', async () => {
    const dir = await directory();
    await seedDemoTable(dir);
    const store = createTablesStore({ dataDir: dir });
    let table = await store.read(DEMO_TABLE_ID);
    const camp = table.board.background;
    const sceneIds = table.scenes.map(scene => scene.id);
    const backgrounds = new Set([camp]);
    async function show(sceneId: string | null) {
      table = await store.command(DEMO_TABLE_ID, {
        type: 'board-start-scene', operationId: randomUUID(),
        expectedRevision: table.revision, payload: { sceneId },
      });
      expect((await store.readBoardImage(DEMO_TABLE_ID, table.board.background)).subarray(8, 12).toString()).toBe('WEBP');
    }
    expect(table.scenes.every(scene => scene.status === 'prepared')).toBe(true);
    expect(table.scenes[0].combatants.filter(unit => unit.revealed)).toHaveLength(4);
    expect(table.scenes[1].counters.map(({ name, value, max }) => [name, value, max])).toEqual([['Интерес', 1, 5], ['Терпение', 3, 5]]);
    expect(table.scenes[2].counters.map(({ name, value, max }) => [name, value, max])).toEqual([['Успехи', 0, 6], ['Провалы', 0, 3]]);
    for (const id of sceneIds) {
      await show(id);
      backgrounds.add(table.board.background);
    }
    expect(backgrounds.size).toBe(4);
    await show(null);
    expect(table.board.background).toBe(camp);
  });

  it('fills an existing demo fixture without resetting authored scene progress', async () => {
    const dir = await directory();
    await seedDemoTable(dir);
    const file = path.join(dir, 'tables.json');
    const state = JSON.parse(await fs.readFile(file, 'utf8'));
    const demo = state.tables[DEMO_TABLE_ID];
    const [bridge, gate, forest] = demo.scenes;
    delete bridge.layout;
    bridge.combatants = [];
    bridge.name = 'Засада у каменного моста';
    bridge.status = 'active';
    gate.counters[0].value = 4;
    forest.status = 'active';
    forest.round = 3;
    demo.name = 'Изменённый стол';
    await fs.writeFile(file, JSON.stringify(state));
    expect(await seedDemoTable(dir, { refreshScenes: true })).toMatchObject({ updated: true });
    const next = await createTablesStore({ dataDir: dir }).read(DEMO_TABLE_ID);
    expect(next).toMatchObject({ name: 'Изменённый стол', revision: demo.revision + 1 });
    expect(next.scenes[0]).toMatchObject({ status: 'prepared', name: 'Засада гоблинов у каменного моста' });
    expect(next.scenes[0].combatants).toHaveLength(4);
    expect(next.scenes[1].counters[0].value).toBe(4);
    expect(next.scenes[2]).toMatchObject({ status: 'active', round: 3 });
    expect(await seedDemoTable(dir, { refreshScenes: true })).toMatchObject({ updated: false });
  });
});
