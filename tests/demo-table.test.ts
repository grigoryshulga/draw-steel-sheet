import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seedDemoTable, DEMO_TABLE_ID } from '../scripts/seed-demo-table.mjs';
import { createTablesStore } from '../server/tables-store.mjs';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))); });
async function directory() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dss-demo-'));
  directories.push(dir);
  return dir;
}

describe('demo table', () => {
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
});
